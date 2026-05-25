/**
 * Régression — feat(reglages): bouton "Réessayer" pour la file failed.
 *
 * `syncManager.requeueFailed()` existait (commit 48fb168) mais aucune UI
 * ne l'appelait. Les items en état terminal 'failed' restaient invisibles
 * sauf inspection SQLite. On ajoute une carte conditionnelle dans
 * Réglages qui apparaît seulement si stats.failed > 0.
 *
 * Inspection statique du source — comme pour les autres régressions de
 * Réglages, c'est suffisant : le coût d'un rendering complet (stores
 * zustand + Modal + Alert) dépasse la valeur ajoutée pour un test
 * d'IF conditionnel.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..', '..');
const src = readFileSync(join(repoRoot, 'app/(tabs)/reglages.tsx'), 'utf8');

describe('Réglages: bouton "Réessayer items failed"', () => {
  it("appelle syncManager.requeueFailed()", () => {
    expect(src).toMatch(/syncManager\.requeueFailed\s*\(/);
  });

  it("appelle syncManager.getStats() pour connaître le compteur failed", () => {
    expect(src).toMatch(/syncManager\.getStats\s*\(/);
  });

  it("expose un état React 'failedCount' (ou équivalent) avec un setter", () => {
    expect(src).toMatch(/setFailedCount/);
  });

  it("rend la carte conditionnellement quand failedCount > 0", () => {
    // Doit contenir une expression conditionnelle "failedCount > 0".
    expect(src).toMatch(/failedCount\s*>\s*0/);
  });

  it("affiche un Alert de feedback après le requeue", () => {
    // L'Alert mentionne "remis en attente" pour confirmer le succès.
    expect(src).toMatch(/Alert\.alert\(\s*['"]Sync['"]/);
    expect(src).toMatch(/remis en attente/);
  });

  it("le bouton porte bien le libellé 'Réessayer maintenant'", () => {
    expect(src).toMatch(/Réessayer maintenant/);
  });
});
