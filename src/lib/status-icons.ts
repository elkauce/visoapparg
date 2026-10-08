import {
  Ban,
  BellOff,
  Brain,
  Briefcase,
  CircleCheck,
  Calendar,
  Coffee,
  DoorClosed,
  Folder,
  Globe,
  Headphones,
  House,
  Lightbulb,
  Mail,
  Mic,
  Moon,
  Music,
  Phone,
  Plane,
  Power,
  Tv,
  Trophy,
  Users,
  Utensils,
  Video,
  Volume1,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";

export const STATUS_ICONS = {
  "check-circle": CircleCheck,
  ban: Ban,
  users: Users,
  phone: Phone,
  utensils: Utensils,
  moon: Moon,
  coffee: Coffee,
  headphones: Headphones,
  mic: Mic,
  video: Video,
  briefcase: Briefcase,
  "door-closed": DoorClosed,
  "bell-off": BellOff,
  brain: Brain,
  plane: Plane,
  home: House,
  globe: Globe,
  folder: Folder,
  music: Music,
  tv: Tv,
  mail: Mail,
  calendar: Calendar,
  lightbulb: Lightbulb,
  power: Power,
  trophy: Trophy,
  "volume-up": Volume2,
  "volume-down": Volume1,
  "volume-mute": VolumeX,
} satisfies Record<string, LucideIcon>;

export type StatusIconKey = keyof typeof STATUS_ICONS;

export const STATUS_ICON_KEYS = Object.keys(STATUS_ICONS) as StatusIconKey[];

export function getStatusIcon(key: string): LucideIcon {
  return key in STATUS_ICONS ? STATUS_ICONS[key as StatusIconKey] : CircleCheck;
}

export const STATUS_COLORS = [
  "#22c55e",
  "#ef4444",
  "#f59e0b",
  "#8b5cf6",
  "#0ea5e9",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#64748b",
  "#eab308",
] as const;
