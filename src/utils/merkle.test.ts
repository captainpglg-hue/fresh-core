import { hashLeaf, buildMerkleRoot, buildMerkleProof, verifyMerkleProof } from './merkle';

describe('merkle', () => {
  it('hashLeaf donne un hash stable pour un payload identique', () => {
    expect(hashLeaf('lot-1|hash-abc')).toBe(hashLeaf('lot-1|hash-abc'));
    expect(hashLeaf('lot-1|hash-abc')).not.toBe(hashLeaf('lot-2|hash-abc'));
  });

  it('buildMerkleRoot 1 feuille = la feuille elle-même (cas dégénéré)', () => {
    const leaves = [hashLeaf('only')];
    expect(buildMerkleRoot(leaves)).toBe(leaves[0]);
  });

  it('buildMerkleRoot 2 feuilles : pair-hash sorted', () => {
    const root = buildMerkleRoot([hashLeaf('a'), hashLeaf('b')]);
    expect(root).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('buildMerkleRoot 5 feuilles (pair impair → dernière dupliquée)', () => {
    const leaves = ['a', 'b', 'c', 'd', 'e'].map(hashLeaf);
    const root = buildMerkleRoot(leaves);
    expect(root).toMatch(/^0x[0-9a-f]{64}$/);
    // Le root doit être stable et reproductible.
    expect(buildMerkleRoot(leaves)).toBe(root);
  });

  it('proof + verify : feuille présente passe', () => {
    const leaves = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(hashLeaf);
    const root = buildMerkleRoot(leaves);
    for (let i = 0; i < leaves.length; i++) {
      const proof = buildMerkleProof(leaves, i);
      expect(verifyMerkleProof(leaves[i], proof, root)).toBe(true);
    }
  });

  it('proof + verify : feuille modifiée échoue', () => {
    const leaves = ['a', 'b', 'c', 'd'].map(hashLeaf);
    const root = buildMerkleRoot(leaves);
    const proof = buildMerkleProof(leaves, 0);
    const tampered = hashLeaf('a-tampered');
    expect(verifyMerkleProof(tampered, proof, root)).toBe(false);
  });

  it('proof + verify : proof altéré échoue', () => {
    const leaves = ['a', 'b', 'c', 'd'].map(hashLeaf);
    const root = buildMerkleRoot(leaves);
    const proof = buildMerkleProof(leaves, 0);
    const badProof = [...proof];
    badProof[0] = hashLeaf('not-a-real-sibling');
    expect(verifyMerkleProof(leaves[0], badProof, root)).toBe(false);
  });

  it('buildMerkleRoot vide jette une erreur', () => {
    expect(() => buildMerkleRoot([])).toThrow(/empty/);
  });

  it('buildMerkleProof index hors bornes jette une erreur', () => {
    const leaves = ['a', 'b'].map(hashLeaf);
    expect(() => buildMerkleProof(leaves, -1)).toThrow();
    expect(() => buildMerkleProof(leaves, 99)).toThrow();
  });
});
