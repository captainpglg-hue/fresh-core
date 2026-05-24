/**
 * Régression — commit "fix(reglages): rendre la déconnexion utile en mode démo".
 * En mode démo, l'Alert "Déconnexion" doit proposer 2 boutons (Annuler,
 * Réinitialiser la démo) et celui de réinit doit appeler signOut().
 *
 * On ne fait pas de rendering React Native ici (le coût d'un mock complet
 * de stores zustand + expo-router + UI dépasse la valeur ajoutée pour un
 * test d'IF tout simple). À la place, on lit le source pour vérifier la
 * forme de l'Alert, ce qui est suffisant pour empêcher une régression
 * comme "quelqu'un supprime un des deux boutons".
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..', '..');

describe('handleSignOut demo branch (commit 2f434e1)', () => {
  const src = readFileSync(join(repoRoot, 'app/(tabs)/reglages.tsx'), 'utf8');

  it('branches on isDemoMode', () => {
    expect(src).toMatch(/if\s*\(\s*isDemoMode\s*\)/);
  });

  it('demo Alert mentions "Réinitialiser la démo" as second button', () => {
    expect(src).toMatch(/Réinitialiser la démo/);
  });

  it('demo Alert includes a Cancel button', () => {
    // The cancel button is just `{ text: 'Annuler', style: 'cancel' }` and
    // must be present somewhere in the demo branch.
    const demoBranch = src.match(/if\s*\(\s*isDemoMode\s*\)\s*\{[\s\S]*?\n\s{4,}\}/);
    expect(demoBranch).not.toBeNull();
    expect(demoBranch![0]).toMatch(/text:\s*'Annuler'/);
    expect(demoBranch![0]).toMatch(/style:\s*'cancel'/);
  });

  it('"Réinitialiser la démo" button invokes signOut()', () => {
    const demoBranch = src.match(/if\s*\(\s*isDemoMode\s*\)\s*\{[\s\S]*?\n\s{4,}\}/);
    expect(demoBranch).not.toBeNull();
    // The destructive button entry must reference signOut().
    expect(demoBranch![0]).toMatch(/Réinitialiser la démo[\s\S]*?signOut\s*\(\s*\)/);
  });
});
