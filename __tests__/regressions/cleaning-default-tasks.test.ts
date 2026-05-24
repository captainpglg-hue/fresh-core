/**
 * Régression — commit "fix(nettoyage): aligner DEFAULT_TASKS sur le seed démo".
 * DEFAULT_TASKS et le seed démo de cleaning_tasks doivent rester strictement
 * alignés (8 tâches, même zone_name dans le même ordre), sinon
 * l'écran Nettoyage affiche un dénominateur différent en mode démo vs.
 * en mode réel — c'est ce qui produisait "Toutes les tâches: 6" au lieu de 8.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..', '..');

function extractDefaultTaskZoneNames(): string[] {
  const src = readFileSync(join(repoRoot, 'src/stores/cleaningStore.ts'), 'utf8');
  // Lit le contenu du literal DEFAULT_TASKS pour en extraire les zone_name.
  const block = src.match(/const DEFAULT_TASKS = \[([\s\S]*?)\];/);
  expect(block).not.toBeNull();
  const names = [...block![1].matchAll(/zone_name:\s*'([^']+)'/g)].map((m) => m[1]);
  return names;
}

function extractDemoSeedCleaningTaskNames(): string[] {
  const src = readFileSync(join(repoRoot, 'src/services/demoData.ts'), 'utf8');
  const block = src.match(/const cleaningTasks = \[([\s\S]*?)\];/);
  expect(block).not.toBeNull();
  const names = [...block![1].matchAll(/zone_name:\s*'([^']+)'/g)].map((m) => m[1]);
  return names;
}

describe('DEFAULT_TASKS regression (commit 41403c9)', () => {
  it('exactly 8 tasks', () => {
    expect(extractDefaultTaskZoneNames()).toHaveLength(8);
  });

  it('is aligned with the demo seed (same names, same order)', () => {
    expect(extractDefaultTaskZoneNames()).toEqual(extractDemoSeedCleaningTaskNames());
  });
});
