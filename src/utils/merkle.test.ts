import { computeSHA256, buildMerkleTree, verifyProof } from './merkle';

describe('computeSHA256', () => {
  it('returns a hash string', async () => {
    const hash = await computeSHA256('test data');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('returns consistent hashes', async () => {
    const hash1 = await computeSHA256('same input');
    const hash2 = await computeSHA256('same input');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different inputs', async () => {
    const hash1 = await computeSHA256('input a');
    const hash2 = await computeSHA256('input b');
    expect(hash1).not.toBe(hash2);
  });
});

describe('buildMerkleTree', () => {
  it('handles single leaf - root equals the leaf', async () => {
    const leaf = 'single-hash';
    const { root, proofs } = await buildMerkleTree([leaf]);
    expect(root).toBe(leaf);
    expect(proofs.get(leaf)).toEqual([]);
  });

  it('builds tree with 2 leaves and returns a computed root', async () => {
    const leaves = ['hash1', 'hash2'];
    const { root, proofs } = await buildMerkleTree(leaves);
    expect(typeof root).toBe('string');
    expect(root).not.toBe('hash1');
    expect(root).not.toBe('hash2');
    expect(proofs.size).toBe(2);
  });

  it('builds tree with 5 leaves and returns root + proofs', async () => {
    const leaves = ['a', 'b', 'c', 'd', 'e'];
    const { root, proofs } = await buildMerkleTree(leaves);
    expect(typeof root).toBe('string');
    expect(proofs.size).toBe(5);

    for (const leaf of leaves) {
      const proof = proofs.get(leaf);
      expect(proof).toBeDefined();
      expect(Array.isArray(proof)).toBe(true);
      expect(proof!.length).toBeGreaterThan(0);
    }
  });

  it('handles empty leaves array', async () => {
    const { root, proofs } = await buildMerkleTree([]);
    expect(typeof root).toBe('string');
    expect(proofs.size).toBe(0);
  });
});

describe('verifyProof', () => {
  it('returns a boolean result', async () => {
    const result = await verifyProof('leaf', ['sibling'], 'root');
    expect(typeof result).toBe('boolean');
  });

  it('returns true for single-leaf tree with empty proof', async () => {
    const leaf = 'only-leaf';
    const { root } = await buildMerkleTree([leaf]);

    const isValid = await verifyProof(leaf, [], root);
    expect(isValid).toBe(true);
  });

  it('returns false for wrong root', async () => {
    const isValid = await verifyProof('leaf', ['sibling'], 'definitely-wrong-root');
    expect(isValid).toBe(false);
  });
});
