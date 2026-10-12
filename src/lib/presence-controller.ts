export type PresenceMode = "call" | "meeting" | null;
export type PresenceSnapshot = {
  statusId: string | null;
  revision: number;
  mode: PresenceMode;
};
export type PresenceRecovery = {
  previous: string | null;
  statusId: string | null;
  revision: number;
  mode: Exclude<PresenceMode, null>;
};
type Episode = {
  previous: string | null;
  statusId: string | null;
  revision: number;
  mode: PresenceMode;
  owned: boolean;
  suppressed: boolean;
};
export class PresenceController {
  private latest: PresenceSnapshot | null = null;
  private episode: Episode | null;
  private running = false;
  private stopped = false;
  private pending: {
    mode: PresenceMode;
    revision: number;
    previous: string | null;
    requestId: string;
  } | null = null;
  constructor(
    private readonly transition: (
      mode: PresenceMode,
      previous: string | null,
      revision: number,
      requestId: string,
    ) => Promise<{
      applied: boolean;
      cancelled?: boolean;
      statusId: string | null;
      revision: number;
    }>,
    private readonly persist: (recovery: PresenceRecovery | null) => void,
    private readonly report: (error: unknown) => void,
    recovery: PresenceRecovery | null = null,
  ) {
    this.episode = recovery
      ? { ...recovery, owned: true, suppressed: false }
      : null;
  }
  update(snapshot: PresenceSnapshot) {
    this.latest = snapshot;
    if (!this.stopped) void this.drain();
  }
  manualOverride() {
    if (this.episode) {
      this.episode.suppressed = true;
      this.persist(null);
    }
  }
  dispose() {
    this.stopped = true;
  }
  private async drain() {
    if (this.running || this.stopped || !this.latest) return;
    this.running = true;
    try {
      while (!this.stopped && this.latest) {
        const current: PresenceSnapshot = this.latest;
        if (!this.episode) {
          if (!current.mode) return;
          this.episode = {
            previous: current.statusId,
            statusId: current.statusId,
            revision: current.revision,
            mode: null,
            owned: false,
            suppressed: false,
          };
        }
        const episode = this.episode;
        // Reconcile an uncertain response with the same idempotency key before interpreting a revision as manual.
        if (
          !this.pending &&
          episode.owned &&
          current.revision > episode.revision
        ) {
          episode.suppressed = true;
          this.persist(null);
        }
        if (episode.suppressed) {
          if (!current.mode) {
            this.episode = null;
            this.pending = null;
            this.persist(null);
          }
          return;
        }
        if (!this.pending) {
          if (!current.mode && !episode.owned) {
            this.episode = null;
            this.persist(null);
            return;
          }
          if (current.mode === episode.mode && episode.owned) return;
          this.pending = {
            mode: current.mode,
            previous: episode.previous,
            revision: episode.revision,
            requestId: crypto.randomUUID(),
          };
        }
        const action: NonNullable<typeof this.pending> = this.pending;
        const result = await this.transition(
          action.mode,
          action.previous,
          action.revision,
          action.requestId,
        );
        if (this.stopped) return;
        this.pending = null;
        if (result.cancelled) {
          // Wait for a new signal if the source invalidated this action without a replacement yet.
          if (this.latest?.mode === action.mode) return;
          continue;
        }
        if (!result.applied) {
          episode.suppressed = true;
          this.persist(null);
          continue;
        }
        if (!action.mode) {
          this.episode = null;
          this.persist(null);
          return;
        }
        episode.statusId = result.statusId;
        episode.revision = result.revision;
        episode.mode = action.mode;
        episode.owned = true;
        if (episode.suppressed) this.persist(null);
        else
          this.persist({
            previous: episode.previous,
            statusId: episode.statusId,
            revision: episode.revision,
            mode: action.mode,
          });
      }
    } catch (error) {
      if (!this.stopped) this.report(error);
    } finally {
      this.running = false;
    }
  }
}
