/**
 * Régression — fix(origine): fallback SQLite local en mode démo.
 *
 * En mode démo, Supabase n'est pas joignable et `supabase.rpc('get_origine')`
 * renvoie null → la page Origine affichait "Produit introuvable" pour les
 * seeds del-meat-001 / del-fish-001 pourtant présents dans le SQLite local.
 *
 * On vérifie par inspection statique que :
 *  1) le composant branche sur `isDemoMode`,
 *  2) il lit la table `deliveries` localement via `getAllLocal`,
 *  3) la branche Supabase RPC est toujours présente (non-régression de fallback online).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..', '..');
const src = readFileSync(join(repoRoot, 'app/origine/[id].tsx'), 'utf8');

describe('origine demo fallback', () => {
  it('importe isDemoMode depuis le service supabase', () => {
    expect(src).toMatch(/import\s*{[^}]*isDemoMode[^}]*}\s*from\s*['"][^'"]*services\/supabase['"]/);
  });

  it('importe getAllLocal depuis le service database', () => {
    expect(src).toMatch(/import\s*{[^}]*getAllLocal[^}]*}\s*from\s*['"][^'"]*services\/database['"]/);
  });

  it('branche sur isDemoMode', () => {
    expect(src).toMatch(/if\s*\(\s*isDemoMode\s*\)/);
  });

  it("lit la table 'deliveries' via getAllLocal avec filtre id OR local_id", () => {
    expect(src).toMatch(/getAllLocal[^)]*['"]deliveries['"]/);
    expect(src).toMatch(/id\s*=\s*\?\s*OR\s*local_id\s*=\s*\?/);
  });

  it("lit la table 'delivery_items' via getAllLocal", () => {
    expect(src).toMatch(/getAllLocal[^)]*['"]delivery_items['"]/);
  });

  it("conserve l'appel supabase.rpc pour le mode online (non-régression)", () => {
    expect(src).toMatch(/supabase\.rpc\(\s*['"]get_origine['"]/);
  });

  it("les deux seeds démo (del-meat-001 et del-fish-001) restent présents dans demoData.ts", () => {
    const demoData = readFileSync(join(repoRoot, 'src/services/demoData.ts'), 'utf8');
    expect(demoData).toMatch(/['"]del-meat-001['"]/);
    expect(demoData).toMatch(/['"]del-fish-001['"]/);
  });
});
