export const THRESHOLDS: Record<string, { min?: number; max?: number }> = {
  cold_positive: { max: 4 },
  cold_positive_veg: { max: 8 },
  cold_negative: { max: -18 },
  cold_room: { max: 3 },
  hot_holding: { min: 63 },
  cooking_minced: { min: 70 },
  cooking_poultry: { min: 74 },
  cooking_pork_fish: { min: 63 },
  cooking_stuffed: { min: 70 },
  reheating: { min: 63 },
  oil_tpm: { max: 25 },
};

export const COOLING_RULES = { from: 63, to: 10, maxMinutes: 120 };

export function isCompliant(value: number, type: string): boolean {
  const t = THRESHOLDS[type];
  if (!t) return true;
  if (t.min !== undefined && value < t.min) return false;
  if (t.max !== undefined && value > t.max) return false;
  return true;
}
