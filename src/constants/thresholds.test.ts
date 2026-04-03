import { isCompliant, THRESHOLDS, COOLING_RULES } from './thresholds';

describe('isCompliant', () => {
  it('returns true when cold_positive temp is within range', () => {
    expect(isCompliant(3, 'cold_positive')).toBe(true);
  });

  it('returns false when cold_positive temp exceeds max', () => {
    expect(isCompliant(6, 'cold_positive')).toBe(false);
  });

  it('returns true when cold_negative temp is within range', () => {
    expect(isCompliant(-20, 'cold_negative')).toBe(true);
  });

  it('returns false when cold_negative temp exceeds max', () => {
    expect(isCompliant(-15, 'cold_negative')).toBe(false);
  });

  it('returns true when cooking_poultry temp meets minimum', () => {
    expect(isCompliant(75, 'cooking_poultry')).toBe(true);
  });

  it('returns false when cooking_poultry temp below minimum', () => {
    expect(isCompliant(60, 'cooking_poultry')).toBe(false);
  });

  it('returns true for exactly the threshold value (max)', () => {
    expect(isCompliant(4, 'cold_positive')).toBe(true);
  });

  it('returns true for exactly the threshold value (min)', () => {
    expect(isCompliant(63, 'hot_holding')).toBe(true);
  });

  it('returns true for unknown type', () => {
    expect(isCompliant(999, 'unknown_type')).toBe(true);
  });

  it('validates oil TPM threshold', () => {
    expect(isCompliant(20, 'oil_tpm')).toBe(true);
    expect(isCompliant(30, 'oil_tpm')).toBe(false);
  });
});

describe('THRESHOLDS', () => {
  it('has all expected keys', () => {
    expect(Object.keys(THRESHOLDS)).toEqual(expect.arrayContaining([
      'cold_positive', 'cold_negative', 'cold_room',
      'hot_holding', 'cooking_minced', 'cooking_poultry',
      'oil_tpm',
    ]));
  });
});

describe('COOLING_RULES', () => {
  it('defines correct cooling parameters', () => {
    expect(COOLING_RULES.from).toBe(63);
    expect(COOLING_RULES.to).toBe(10);
    expect(COOLING_RULES.maxMinutes).toBe(120);
  });
});
