import type { GoogleHomeApplyResult, GoogleHomeBridge, GoogleHomeConfiguration, GoogleHomeStateKey, GoogleHomeStatus } from "./google-home-native.ts";
import { normalizeVisoStatusName, VISO_STATES } from "@/pages/deck/_lib/viso-states.ts";

export function googleHomeStateForStatusName(name: string | null): GoogleHomeStateKey | null {
  if (!name) return null;
  const normalized = normalizeVisoStatusName(name);
  return VISO_STATES.find((state) =>
    [state.name, ...state.aliases].some((candidate) => normalizeVisoStatusName(candidate) === normalized),
  )?.key ?? null;
}

interface StateSnapshot {
  stateKey: GoogleHomeStateKey | null;
  revision: string;
}

/** One foreground worker. New snapshots replace queued work; owner changes invalidate it. */
export class GoogleHomeSyncController {
  private accountId: string | null = null;
  private foreground = true;
  private generation = 0;
  private latest: StateSnapshot | null = null;
  private configuration: GoogleHomeConfiguration | null = null;
  private status: GoogleHomeStatus | null = null;
  private lastApplied: string | null = null;
  private lastAttempted: string | null = null;
  private ownerReady: Promise<void> = Promise.resolve();
  private running = false;
  private refreshing = false;
  private refreshRequested = false;

  constructor(
    private readonly bridge: GoogleHomeBridge,
    private readonly reportError: (message: string) => void = () => undefined,
  ) {}

  setAccount(accountId: string | null): void {
    if (accountId === this.accountId) return;
    this.accountId = accountId;
    this.generation += 1;
    this.latest = null;
    this.configuration = null;
    this.status = null;
    this.lastApplied = null;
    this.lastAttempted = null;
    this.bindOwner();
    if (accountId && this.foreground) void this.refreshConfiguration();
  }

  setForeground(active: boolean): void {
    if (this.foreground === active) return;
    this.foreground = active;
    this.generation += 1;
    this.status = null;
    this.configuration = null;
    this.lastApplied = null;
    this.lastAttempted = null;
    // Native invalidation also stops an SDK read from issuing commands after pause/logout.
    this.bindOwner();
    if (active && this.accountId) void this.refreshConfiguration();
  }

  updateState(stateKey: GoogleHomeStateKey | null, revision: string): void {
    this.latest = { stateKey, revision };
    void this.drain();
  }

  async refreshConfiguration(forAccountId?: string): Promise<void> {
    if (forAccountId && forAccountId !== this.accountId) return;
    if (!this.accountId || !this.foreground) return;
    if (this.refreshing) { this.refreshRequested = true; return; }
    this.refreshing = true;
    const accountId = this.accountId;
    const generation = this.generation;
    this.status = null;
    try {
      await this.ownerReady;
      if (!this.current(accountId, generation)) return;
      const [status, configuration] = await Promise.all([
        this.bridge.getStatus({ accountId }),
        this.bridge.getConfiguration({ accountId }),
      ]);
      if (!this.current(accountId, generation)) return;
      this.status = status;
      this.configuration = configuration;
      this.lastAttempted = null;
    } catch (failure) {
      if (this.current(accountId, generation)) {
        this.status = null;
        this.configuration = null;
        this.reportError(failure instanceof Error ? failure.message : "No se pudieron verificar los permisos de Google Home.");
      }
    } finally {
      this.refreshing = false;
      if (this.refreshRequested) {
        this.refreshRequested = false;
        void this.refreshConfiguration();
      } else void this.drain();
    }
  }

  private bindOwner(): void {
    this.ownerReady = this.bridge.setActiveAccount({ accountId: this.foreground ? this.accountId : null });
    // A bridge unavailable in this build must never enable synchronization.
    void this.ownerReady.catch(() => undefined);
  }

  private current(accountId: string, generation: number): boolean {
    return this.accountId === accountId && this.foreground && this.generation === generation;
  }

  private signature(snapshot: StateSnapshot, configuration: GoogleHomeConfiguration): string {
    return JSON.stringify([this.accountId, snapshot.stateKey, snapshot.revision, configuration.revision]);
  }

  private ready(): boolean {
    return !!(this.accountId && this.foreground && this.status?.available &&
      this.status.authorized && this.status.configured && this.status.selectedCount > 0 &&
      this.configuration?.enabled && this.configuration.selectedIds.length > 0);
  }

  private async drain(): Promise<void> {
    if (this.running || !this.ready()) return;
    this.running = true;
    try {
      while (this.ready()) {
        const snapshot = this.latest;
        const accountId = this.accountId;
        const configuration = this.configuration;
        if (!snapshot?.stateKey || !accountId || !configuration) break;
        const signature = this.signature(snapshot, configuration);
        if (signature === this.lastApplied || signature === this.lastAttempted) break;
        const generation = this.generation;
        this.lastAttempted = signature;
        try {
          await this.ownerReady;
          if (!this.current(accountId, generation) || !this.ready()) break;
          // If a newer status arrived before the SDK call, coalesce straight to it.
          if (this.latest !== snapshot || this.configuration !== configuration) continue;
          const result: GoogleHomeApplyResult = await this.bridge.applyState({
            accountId,
            stateKey: snapshot.stateKey,
            revision: snapshot.revision,
          });
          if (!this.current(accountId, generation)) break;
          const resultIds = new Set(result.results.map((light) => light.id));
          const covered = result.results.length === configuration.selectedIds.length &&
            resultIds.size === configuration.selectedIds.length &&
            configuration.selectedIds.every((id) => resultIds.has(id));
          if (result.applied && covered && result.results.every((light) => light.success)) {
            this.lastApplied = signature;
          } else if (!result.skipped) {
            const failure = result.results.find((light) => !light.success)?.error;
            this.reportError(failure ?? result.reason ?? "Google Home no pudo aplicar el color a alguna luz seleccionada.");
          }
        } catch (failure) {
          if (this.current(accountId, generation)) {
            this.reportError(failure instanceof Error ? failure.message : "No se pudo aplicar el estado a Google Home.");
          }
        }
      }
    } finally {
      this.running = false;
      if (this.ready() && this.latest?.stateKey && this.configuration &&
        this.signature(this.latest, this.configuration) !== this.lastAttempted &&
        this.signature(this.latest, this.configuration) !== this.lastApplied) void this.drain();
    }
  }
}
