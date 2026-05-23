import { keccak256, toUtf8Bytes, getBytes, hexlify, concat } from 'ethers';

/**
 * Merkle tree binaire avec keccak256 (interop EVM / Solidity standard).
 *
 * Structure : feuilles = hashLeaf(payload). Pour OpenZeppelin compat,
 * on trie chaque paire avant hashage (sorted pair) — ça donne un root
 * indépendant de l'ordre des feuilles dans le même niveau, et le proof
 * n'a pas besoin d'indiquer left/right.
 *
 * Une feuille impaire au dernier niveau est dupliquée (auto-pair).
 */

export type Hex = `0x${string}`;

function toHex(b: Uint8Array): Hex {
  return hexlify(b) as Hex;
}

function sortedPairHash(a: Uint8Array, b: Uint8Array): Uint8Array {
  // Tri lexicographique des deux uint8arrays (comparaison byte par byte).
  let cmp = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      cmp = a[i] - b[i];
      break;
    }
  }
  if (cmp === 0) cmp = a.length - b.length;
  const [first, second] = cmp <= 0 ? [a, b] : [b, a];
  return getBytes(keccak256(concat([first, second])));
}

/**
 * hashLeaf : double-keccak du payload (Open Zeppelin MerkleTree compat).
 * Le double hash protège contre les attaques second-preimage où une
 * feuille pourrait être interprétée comme un noeud interne.
 */
export function hashLeaf(payload: string): Hex {
  const single = keccak256(toUtf8Bytes(payload));
  return keccak256(getBytes(single)) as Hex;
}

export function buildMerkleRoot(leaves: Hex[]): Hex {
  if (leaves.length === 0) {
    throw new Error('Cannot build Merkle root from empty leaves');
  }
  let layer = leaves.map((h) => getBytes(h));
  while (layer.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : layer[i];
      next.push(sortedPairHash(left, right));
    }
    layer = next;
  }
  return toHex(layer[0]);
}

/**
 * Génère le proof Merkle d'une feuille (siblings de la feuille jusqu'au root).
 * Le proof, combiné avec la feuille, permet de recalculer le root client-side
 * et de le comparer à celui ancré on-chain.
 */
export function buildMerkleProof(leaves: Hex[], leafIndex: number): Hex[] {
  if (leafIndex < 0 || leafIndex >= leaves.length) {
    throw new Error(`leafIndex ${leafIndex} out of bounds`);
  }
  const proof: Hex[] = [];
  let layer = leaves.map((h) => getBytes(h));
  let index = leafIndex;
  while (layer.length > 1) {
    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;
    const sibling = siblingIndex < layer.length ? layer[siblingIndex] : layer[index];
    proof.push(toHex(sibling));

    const next: Uint8Array[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : layer[i];
      next.push(sortedPairHash(left, right));
    }
    layer = next;
    index = Math.floor(index / 2);
  }
  return proof;
}

/**
 * Vérifie qu'une feuille appartient à un root via son proof.
 * Reproduit le comportement de MerkleProof.verify d'OpenZeppelin.
 */
export function verifyMerkleProof(leaf: Hex, proof: Hex[], root: Hex): boolean {
  let computed = getBytes(leaf);
  for (const sibling of proof) {
    computed = sortedPairHash(computed, getBytes(sibling));
  }
  return toHex(computed).toLowerCase() === root.toLowerCase();
}
