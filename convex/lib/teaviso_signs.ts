import { v } from "convex/values";

export const signModel = v.union(
  v.literal("qr"),
  v.literal("address"),
  v.literal("professional"),
);
export const signMaterial = v.union(
  v.literal("acrylic"),
  v.literal("aluminum"),
);
export const signState = v.union(
  v.literal("requested"),
  v.literal("reviewing"),
  v.literal("closed"),
  v.literal("cancelled"),
);
export const signFields = v.object({
  street: v.string(),
  number: v.string(),
  name: v.string(),
  profession: v.string(),
  registration: v.string(),
  details: v.string(),
});
export const signModels = {
  qr: {
    name: "Timbre QR",
    description: "Una placa compacta para pegar.",
    size: "12 × 12 cm",
    width: 120,
    height: 120,
  },
  address: {
    name: "Dirección + timbre",
    description: "Tu calle, número y timbre en una placa vertical.",
    size: "12 × 18 cm · Vertical",
    width: 120,
    height: 180,
  },
  professional: {
    name: "Profesional + timbre",
    description: "Nombre, matrícula y datos del consultorio.",
    size: "30 × 20 cm",
    width: 300,
    height: 200,
  },
} as const;
