import * as Crypto from 'expo-crypto';

export async function computeSHA256(data: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    data
  );
  return hash;
}

export async function buildMerkleTree(leaves: string[]): Promise<{ root: string; proofs: Map<string, string[]> }> {
  const proofs = new Map<string, string[]>();

  if (leaves.length === 0) {
    const emptyHash = await computeSHA256('');
    return { root: emptyHash, proofs };
  }

  if (leaves.length === 1) {
    proofs.set(leaves[0], []);
    return { root: leaves[0], proofs };
  }

  // Initialize proof tracking
  const proofMap: Map<string, string[]> = new Map();
  leaves.forEach((leaf) => proofMap.set(leaf, []));

  let currentLevel = [...leaves];

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;

      const combined = await computeSHA256(left + right);
      nextLevel.push(combined);

      // Update proofs for all original leaves
      for (const [leaf, proof] of proofMap) {
        const leafIndex = currentLevel.indexOf(leaf);
        if (leafIndex === -1) continue;

        if (leafIndex === i) {
          proof.push(right);
        } else if (leafIndex === i + 1) {
          proof.push(left);
        }
      }
    }

    currentLevel = nextLevel;
  }

  // Copy proofs
  for (const [leaf, proof] of proofMap) {
    proofs.set(leaf, proof);
  }

  return { root: currentLevel[0], proofs };
}

export async function verifyProof(leaf: string, proof: string[], root: string): Promise<boolean> {
  let current = leaf;
  for (const sibling of proof) {
    // Consistent ordering: smaller value first
    const left = current < sibling ? current : sibling;
    const right = current < sibling ? sibling : current;
    current = await computeSHA256(left + right);
  }
  return current === root;
}
