import type { Id } from "@/convex/_generated/dataModel";
import type { StatusIconKey } from "@/lib/status-icons";

export type VisoStateDefinition = {
  key: "libre" | "ocupado" | "reunion" | "llamada" | "no-molestar" | "ausente";
  name: string;
  label: string;
  aliases: readonly string[];
  defaultColor: string;
  icon: StatusIconKey;
};

export type VisoStatusRecord = {
  _id: Id<"statuses">;
  name: string;
  color: string;
  icon: string;
};

// These are the six buttons of the Android state screen, not a replacement for
// the user's saved states. Existing custom states and their actions stay intact.
export {
  VISO_STATES,
  findVisoStatus,
  normalizeVisoStatusName,
} from "../../../../convex/lib/viso_preset_states";
