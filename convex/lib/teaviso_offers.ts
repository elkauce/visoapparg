// Public descriptions and reference amounts, not billable plans or entitlements.
export const teavisoOffers = {
  hogares: { name: "Casas y departamentos", amount: null },
  avisos: { name: "Avisos", amount: 36000 },
  videollamada: { name: "Videollamada", amount: 48000 },
  familia: { name: "Familia", amount: 80000 },
  portal: { name: "Portal de visitas", amount: null },
  negocios: { name: "Profesionales y consultorios", amount: null },
  edificios: { name: "Edificios", amount: null },
  hardware: { name: "Hardware con Timbre incluido", amount: null },
} as const;
export type TeavisoInterest = keyof typeof teavisoOffers;
export const isTeavisoInterest = (
  value: string | null,
): value is TeavisoInterest =>
  value !== null && Object.prototype.hasOwnProperty.call(teavisoOffers, value);
