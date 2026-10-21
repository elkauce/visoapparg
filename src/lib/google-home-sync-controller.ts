import type {
  GoogleHomeApplyResult,
  GoogleHomeBridge,
  GoogleHomeConfiguration,
  GoogleHomeStateKey,
  GoogleHomeStatus,
} from "./google-home-native.ts";
import {
  normalizeVisoStatusName,
  VISO_STATES,
} from "@/pages/deck/_lib/viso-states.ts";

export function googleHomeStateForStatusName(
  name: string | null,
): GoogleHomeStateKey | null {
  if (!name) return null;
  const normalized = normalizeVisoStatusName(name);
  return (
    VISO_STATES.find((state) =>
      [state.name, ...state.aliases].some(
        (candidate) => normalizeVisoStatusName(candidate) === normalized,
      ),
    )?.key ?? null
  );
}

interface StateSnapshot {
  stateKey: GoogleHomeStateKey | null;
  revision: string;
  customColor?: string;
}

/** One owner-scoped worker. An opted-in Deck may keep signaling while covered by a call. */
export class GoogleHomeSyncController {
  private accountId: string | null = null;
  private foreground = true;
  private backgroundEnabled = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retrySignature: string | null = null;
  private retryCount = 0;
  private configurationRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private configurationRetryCount = 0;
  private ownerBindingFailed = false;
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
    this.backgroundEnabled = false;
    this.cancelRetry();
    this.cancelConfigurationRetry();
    this.generation += 1;
    this.latest = null;
    this.configuration = null;
    this.status = null;
    this.lastApplied = null;
    this.lastAttempted = null;
    this.bindOwner();
    if (accountId && this.permitted()) void this.refreshConfiguration();
  }

  setForeground(active: boolean, reconcile = false): void {
    // Google may return from a translucent activity without a preceding inactive event.
    // An explicit native resume must rebind ownership and refresh SDK permissions.
    if (this.foreground === active && !reconcile) return;
    const wasPermitted = this.permitted();
    this.foreground = active;
    if (wasPermitted && this.permitted() && !reconcile) return;
    this.cancelRetry();
    this.cancelConfigurationRetry();
    this.generation += 1;
    this.status = null;
    this.configuration = null;
    this.lastApplied = null;
    this.lastAttempted = null;
    // Native invalidation also stops an SDK read from issuing commands after pause/logout.
    this.bindOwner();
    if (this.permitted() && this.accountId) void this.refreshConfiguration();
  }

  setBackgroundEnabled(enabled: boolean): void {
    const next = enabled && !!this.accountId && !!this.bridge.setBackgroundSync;
    if (this.backgroundEnabled === next) return;
    this.backgroundEnabled = next;
    this.cancelRetry();
    this.cancelConfigurationRetry();
    this.generation += 1;
    this.status = null;
    this.configuration = null;
    this.lastApplied = null;
    this.lastAttempted = null;
    this.bindOwner();
    if (this.permitted() && this.accountId) void this.refreshConfiguration();
  }

  private permitted(): boolean {
    return this.foreground || this.backgroundEnabled;
  }

  private cancelRetry(): void {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.retrySignature = null;
    this.retryCount = 0;
  }

  private retry(signature: string): void {
    if (!this.accountId || !this.permitted()) return;
    if (this.retrySignature !== signature) {
      this.cancelRetry();
      this.retrySignature = signature;
    }
    if (this.retryTimer !== null || this.retryCount >= 2) return;
    const accountId = this.accountId;
    const generation = this.generation;
    this.retryCount += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (
        !this.current(accountId, generation) ||
        !this.latest ||
        !this.configuration ||
        this.signature(this.latest, this.configuration) !== signature
      )
        return;
      // Recheck real permission and the selected subset before retrying this latest state.
      void this.refreshConfiguration();
    }, this.retryCount * 1000);
  }

  private cancelConfigurationRetry(): void {
    if (this.configurationRetryTimer !== null)
      clearTimeout(this.configurationRetryTimer);
    this.configurationRetryTimer = null;
    this.configurationRetryCount = 0;
  }

  private retryConfiguration(): void {
    if (
      !this.accountId ||
      !this.permitted() ||
      this.configurationRetryTimer !== null ||
      this.configurationRetryCount >= 2
    )
      return;
    const accountId = this.accountId;
    const generation = this.generation;
    this.configurationRetryCount += 1;
    this.configurationRetryTimer = setTimeout(() => {
      this.configurationRetryTimer = null;
      if (!this.current(accountId, generation)) return;
      if (this.ownerBindingFailed) this.bindOwner();
      void this.refreshConfiguration();
    }, this.configurationRetryCount * 1000);
  }

  /** A real network reconnection starts a fresh, bounded recovery attempt. */
  reconnect(): void {
    if (!this.accountId || !this.permitted()) return;
    this.cancelRetry();
    this.cancelConfigurationRetry();
    if (this.ownerBindingFailed) this.bindOwner();
    void this.refreshConfiguration();
  }

  updateState(
    stateKey: GoogleHomeStateKey | null,
    revision: string,
    customColor?: string,
  ): void {
    const validColor =
      !stateKey && customColor && /^#[0-9a-fA-F]{6}$/.test(customColor)
        ? customColor
        : undefined;
    const changed =
      this.latest?.stateKey !== stateKey ||
      this.latest?.revision !== revision ||
      this.latest?.customColor !== validColor;
    if (changed) {
      this.cancelRetry();
      this.cancelConfigurationRetry();
    }
    this.latest = { stateKey, revision, customColor: validColor };
    if (changed && !this.refreshing && (!this.status || !this.configuration)) {
      if (this.ownerBindingFailed) this.bindOwner();
      void this.refreshConfiguration();
    }
    void this.drain();
  }

  async refreshConfiguration(forAccountId?: string): Promise<void> {
    if (forAccountId && forAccountId !== this.accountId) return;
    if (!this.accountId || !this.permitted()) return;
    if (this.refreshing) {
      this.refreshRequested = true;
      return;
    }
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
      if (status.verificationPending && !status.requiresAuthorization) {
        // An SDK timeout can return a status instead of rejecting the call.
        // Keep the retry budget until Google confirms the permission result.
        this.retryConfiguration();
      } else {
        this.cancelConfigurationRetry();
        if (
          !status.available ||
          !status.authorized ||
          status.requiresAuthorization
        )
          this.cancelRetry();
      }
    } catch (failure) {
      if (this.current(accountId, generation)) {
        this.status = null;
        this.configuration = null;
        this.reportError(
          failure instanceof Error
            ? failure.message
            : "No se pudieron verificar los permisos de Google Home.",
        );
        this.retryConfiguration();
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
    const accountId = this.accountId;
    const generation = this.generation;
    const enabled = this.backgroundEnabled;
    this.ownerBindingFailed = false;
    const bound = this.bridge.setActiveAccount({
      accountId: this.permitted() ? accountId : null,
    });
    this.ownerReady = bound.then(async () => {
      if (accountId !== this.accountId || generation !== this.generation)
        return;
      if (this.bridge.setBackgroundSync)
        await this.bridge.setBackgroundSync({
          accountId: this.permitted() ? accountId : null,
          enabled,
        });
    });
    // A bridge unavailable in this build must never enable synchronization.
    void this.ownerReady.catch(() => {
      if (accountId === this.accountId && generation === this.generation)
        this.ownerBindingFailed = true;
    });
  }

  private current(accountId: string, generation: number): boolean {
    return (
      this.accountId === accountId &&
      this.permitted() &&
      this.generation === generation
    );
  }

  private signature(
    snapshot: StateSnapshot,
    configuration: GoogleHomeConfiguration,
  ): string {
    return JSON.stringify([
      this.accountId,
      snapshot.stateKey,
      snapshot.revision,
      snapshot.customColor,
      configuration.revision,
    ]);
  }

  private ready(): boolean {
    return !!(
      this.accountId &&
      this.permitted() &&
      this.status?.available &&
      this.status.authorized &&
      !this.status.verificationPending &&
      !this.status.requiresAuthorization &&
      this.status.configured &&
      this.status.selectedCount > 0 &&
      this.configuration?.enabled &&
      this.configuration.selectedIds.length > 0
    );
  }

  private async drain(): Promise<void> {
    if (this.running || !this.ready()) return;
    this.running = true;
    try {
      while (this.ready()) {
        const snapshot = this.latest;
        const accountId = this.accountId;
        const configuration = this.configuration;
        if (
          !snapshot ||
          (!snapshot.stateKey && !snapshot.customColor) ||
          !accountId ||
          !configuration
        )
          break;
        const signature = this.signature(snapshot, configuration);
        if (signature === this.lastApplied || signature === this.lastAttempted)
          break;
        const generation = this.generation;
        try {
          await this.ownerReady;
          if (!this.current(accountId, generation) || !this.ready()) break;
          // If a newer status arrived before the SDK call, coalesce straight to it.
          if (this.latest !== snapshot || this.configuration !== configuration)
            continue;
          this.lastAttempted = signature;
          const result: GoogleHomeApplyResult = await this.bridge.applyState({
            accountId,
            stateKey: snapshot.stateKey,
            revision: snapshot.revision,
            ...(snapshot.customColor
              ? { customColor: snapshot.customColor }
              : {}),
          });
          if (!this.current(accountId, generation)) break;
          const resultIds = new Set(result.results.map((light) => light.id));
          const covered =
            result.results.length === configuration.selectedIds.length &&
            resultIds.size === configuration.selectedIds.length &&
            configuration.selectedIds.every((id) => resultIds.has(id));
          if (
            result.applied &&
            covered &&
            result.results.every((light) => light.success)
          ) {
            this.lastApplied = signature;
            this.cancelRetry();
          } else if (!result.skipped) {
            const failure = result.results.find(
              (light) => !light.success,
            )?.error;
            this.reportError(
              failure ??
                result.reason ??
                "Google Home no pudo aplicar el color a alguna luz seleccionada.",
            );
            this.retry(signature);
          } else if (
            [
              "application-inactive",
              "account-or-visibility-changed",
              "inactive-account",
              "superseded",
            ].includes(result.reason ?? "")
          ) {
            this.retry(signature);
          }
        } catch (failure) {
          if (this.current(accountId, generation)) {
            this.lastAttempted = signature;
            this.retry(signature);
            this.reportError(
              failure instanceof Error
                ? failure.message
                : "No se pudo aplicar el estado a Google Home.",
            );
          }
        }
      }
    } finally {
      this.running = false;
      if (
        this.ready() &&
        (this.latest?.stateKey || this.latest?.customColor) &&
        this.configuration &&
        this.signature(this.latest, this.configuration) !==
          this.lastAttempted &&
        this.signature(this.latest, this.configuration) !== this.lastApplied
      )
        void this.drain();
    }
  }
}
