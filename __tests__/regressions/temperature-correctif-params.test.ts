/**
 * Régression — commit "fix(temperature): paramètres correctifs envoyés au bon nom".
 * L'écran correctif lit `params.threshold` et `params.thresholdType` ; un
 * ancien refactor envoyait `thresholdMin`/`thresholdMax` côté appelant,
 * ce qui faisait afficher "Seuil non défini" en permanence. On vérifie
 * ici que l'écran cible ET le code appelant utilisent bien le même
 * vocabulaire de params.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

const repoRoot = join(__dirname, '..', '..');

describe('temperature/correctif params shape (commit fb70a68)', () => {
  it('correctif.tsx reads `threshold` and `thresholdType`', () => {
    const src = readFileSync(join(repoRoot, 'app/temperature/correctif.tsx'), 'utf8');
    expect(src).toMatch(/threshold:\s*string/);
    expect(src).toMatch(/thresholdType:\s*string/);
    expect(src).toMatch(/params\.threshold\b/);
    expect(src).toMatch(/params\.thresholdType\b/);
  });

  it('no caller in app/ pushes thresholdMin/thresholdMax to /temperature/correctif', () => {
    const files = glob.sync('app/**/*.{ts,tsx}', { cwd: repoRoot, absolute: true });
    const offenders: { file: string; snippet: string }[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // We only care about push() calls targeting the correctif route.
      const calls = [...src.matchAll(/router\.(?:push|replace)\s*\(\s*\{[\s\S]*?\}\s*\)/g)];
      for (const c of calls) {
        if (
          c[0].includes('/temperature/correctif') &&
          /thresholdMin|thresholdMax/.test(c[0])
        ) {
          offenders.push({ file, snippet: c[0].substring(0, 200) });
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('correctif params contract: threshold AND thresholdType keys exist in all callers', () => {
    const files = glob.sync('app/**/*.{ts,tsx}', { cwd: repoRoot, absolute: true });
    let foundCaller = false;
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const calls = [...src.matchAll(/router\.(?:push|replace)\s*\(\s*\{[\s\S]*?\}\s*\)/g)];
      for (const c of calls) {
        if (c[0].includes('/temperature/correctif')) {
          foundCaller = true;
          expect(c[0]).toMatch(/\bthreshold\b\s*:/);
          expect(c[0]).toMatch(/\bthresholdType\b\s*:/);
        }
      }
    }
    // Au moins un appelant doit exister, sinon ce test ne garde rien.
    expect(foundCaller).toBe(true);
  });
});
