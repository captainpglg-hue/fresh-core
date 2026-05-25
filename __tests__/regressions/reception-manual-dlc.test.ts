/**
 * Régression — commit "fix(reception): propager la DLC manuelle vers l'item parent".
 *
 * Le composant ProductItemCard (interne à app/reception/nouvelle.tsx)
 * embarque un useEffect qui surveille le watch('dlc') de son
 * formulaire interne et, à chaque changement, appelle onUpdate(index, {
 * dlc, dlcRaw }) sur l'item parent. Avant le fix, la valeur restait
 * piégée dans le form interne et n'apparaissait jamais sur le badge
 * "DLC: jj/mm/aaaa" du step 4 d'acceptation.
 *
 * On évite de rendre le composant (export interne, React 19, expo-router
 * mocks lourds) et on garantit par inspection statique que la mécanique
 * de propagation est en place.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..', '..');
const src = readFileSync(
  join(repoRoot, 'app/reception/nouvelle.tsx'),
  'utf8',
);

describe('ProductItemCard manual DLC propagation (commit faf8fe3)', () => {
  it('uses dlcForm.watch("dlc") to observe the FormDatePicker', () => {
    expect(src).toMatch(/dlcForm\.watch\(\s*'dlc'\s*\)/);
  });

  it('runs a useEffect that calls onUpdate with dlc + dlcRaw', () => {
    // The fix is: when manualDlc changes, onUpdate(index, { dlc, dlcRaw }).
    const block = src.match(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?onUpdate\(index,\s*\{[\s\S]*?\}\);[\s\S]*?\},\s*\[[^\]]*\]\);/);
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/dlc:\s*manualDlc/);
    expect(block![0]).toMatch(/dlcRaw:\s*`/);
  });

  it('formats dlcRaw as dd/mm/yyyy (zero-padded)', () => {
    // Two padStart(2, '0') calls in the template literal: day + month.
    const block = src.match(/dlcRaw:\s*`[^`]*`/);
    expect(block).not.toBeNull();
    const padCalls = (block![0].match(/padStart\(2,\s*'0'\)/g) || []).length;
    expect(padCalls).toBeGreaterThanOrEqual(2);
  });

  it('guards against re-firing the effect when dlc is already current', () => {
    // Prevents infinite loop / extra writes: skip when item.dlc has same time.
    expect(src).toMatch(/manualDlc\.getTime\(\)\s*===\s*item\.dlc\.getTime\(\)/);
  });

  it('badge "DLC: jj/mm/aaaa" is rendered from item.dlcRaw', () => {
    expect(src).toMatch(/Badge\s+text=\{`DLC:\s*\$\{item\.dlcRaw\}`\}/);
  });
});
