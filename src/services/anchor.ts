import { ethers } from 'ethers';
import { getDatabase } from './database';
import {
  hashLeaf,
  buildMerkleRoot,
  buildMerkleProof,
  type Hex,
} from '../utils/merkle';
import type { Lot } from '../types/lotChain';

// ABI minimale (fonctions/events utilisés par le batcher).
const ANCHOR_ABI = [
  'function anchorRoot(bytes32 root, uint256 leafCount) external returns (uint256)',
  'function getRoot(uint256 batchId) external view returns (bytes32)',
  'function getBatch(uint256 batchId) external view returns (bytes32 root, uint256 timestamp, uint256 leafCount)',
  'function nextBatchId() external view returns (uint256)',
  'event RootAnchored(uint256 indexed batchId, bytes32 indexed root, uint256 leafCount, uint256 timestamp)',
];

export interface AnchorConfig {
  rpcUrl: string;             // ex: https://rpc-amoy.polygon.technology
  contractAddress: string;    // adresse du contrat déployé
  privateKey: string;         // clé du batcher (NE JAMAIS commit)
  batchSize?: number;         // nombre max de lots ancrés par batch
  dryRun?: boolean;           // si true : calcule mais n'envoie pas la tx
}

export interface AnchorBatchResult {
  batchId: number | null;
  root: Hex;
  leafCount: number;
  txHash: string | null;
  anchoredLotIds: string[];
  blockNumber: number | null;
  explorerUrl: string | null;
}

/**
 * Construit la feuille Merkle pour un lot. Format canonique :
 *   "<lot_code>|<head_sequence>|<head_hash>"
 *
 * Cette représentation est stable (les 3 champs sont des UTF-8 simples) et
 * permet à n'importe quel tiers de recomputer la feuille à partir des seules
 * données publiques retournées par get_origine().
 */
export function lotToLeaf(lot: Pick<Lot, 'lot_code' | 'head_sequence' | 'head_hash'>): Hex {
  if (!lot.head_hash) throw new Error(`Lot ${lot.lot_code} sans head_hash`);
  return hashLeaf(`${lot.lot_code}|${lot.head_sequence}|${lot.head_hash}`);
}

/**
 * Récupère les lots non ancrés (head_hash défini, anchored_at null) à inclure
 * dans le prochain batch. Limité par batchSize pour borner la taille on-chain.
 */
export async function pickLotsToAnchor(batchSize = 256): Promise<Lot[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    `SELECT * FROM lots
     WHERE head_hash IS NOT NULL
       AND anchored_at IS NULL
       AND head_sequence > 0
     ORDER BY created_at ASC
     LIMIT ?`,
    [batchSize]
  );
  return rows as Lot[];
}

/**
 * Marque une liste de lots comme ancrés en mettant à jour anchored_at +
 * anchor_tx_hash. Appelé après la confirmation de la tx blockchain.
 */
async function markLotsAnchored(lotIds: string[], txHash: string, timestamp: string): Promise<void> {
  if (lotIds.length === 0) return;
  const db = await getDatabase();
  const placeholders = lotIds.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE lots SET anchored_at = ?, anchor_tx_hash = ? WHERE id IN (${placeholders})`,
    [timestamp, txHash, ...lotIds]
  );
}

/**
 * Batcher principal : query lots, build Merkle, call contract, update DB.
 *
 * - En dryRun : retourne le root + leafCount sans envoyer la tx (utile pour
 *   pré-visualisation / coût estimé).
 * - Sinon : envoie anchorRoot(), attend la confirmation, met à jour la DB.
 *
 * Les erreurs réseau / gas sont remontées telles quelles — le caller (cron,
 * CLI, UI bouton "Ancrer maintenant") décide de retry.
 */
export async function anchorBatch(config: AnchorConfig): Promise<AnchorBatchResult> {
  const lots = await pickLotsToAnchor(config.batchSize ?? 256);
  if (lots.length === 0) {
    return {
      batchId: null,
      root: '0x0',
      leafCount: 0,
      txHash: null,
      anchoredLotIds: [],
      blockNumber: null,
      explorerUrl: null,
    };
  }

  const leaves = lots.map(lotToLeaf);
  const root = buildMerkleRoot(leaves);

  if (config.dryRun) {
    return {
      batchId: null,
      root,
      leafCount: lots.length,
      txHash: null,
      anchoredLotIds: lots.map((l) => l.id),
      blockNumber: null,
      explorerUrl: null,
    };
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);
  const contract = new ethers.Contract(config.contractAddress, ANCHOR_ABI, wallet);

  const tx = await contract.anchorRoot(root, BigInt(lots.length));
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Pas de receipt blockchain');

  // batchId vient de l'event RootAnchored.
  let batchId: number | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === 'RootAnchored') {
        batchId = Number(parsed.args[0]);
        break;
      }
    } catch {
      // Pas un de nos events
    }
  }

  const ts = new Date().toISOString();
  await markLotsAnchored(lots.map((l) => l.id), tx.hash, ts);

  const explorerUrl = explorerTxUrl(config.rpcUrl, tx.hash);

  return {
    batchId,
    root,
    leafCount: lots.length,
    txHash: tx.hash,
    anchoredLotIds: lots.map((l) => l.id),
    blockNumber: receipt.blockNumber,
    explorerUrl,
  };
}

/**
 * Génère le proof Merkle pour un lot donné dans un batch. Utile pour la
 * page publique /origine/<code> qui veut prouver l'inclusion dans le root
 * on-chain. À usage off-chain uniquement (le contrat n'expose pas verify).
 */
export async function proofForLot(lotId: string, batchSize = 256): Promise<{
  leaf: Hex;
  proof: Hex[];
  root: Hex;
} | null> {
  // Reconstruit le batch d'ancrage du lot : on regroupe tous les lots ancrés
  // avec le même anchor_tx_hash, dans l'ordre original (created_at ASC).
  const db = await getDatabase();
  const lot = (await db.getFirstAsync(`SELECT * FROM lots WHERE id = ?`, [lotId])) as Lot | null;
  if (!lot || !lot.anchor_tx_hash) return null;

  const batchLots = (await db.getAllAsync(
    `SELECT * FROM lots WHERE anchor_tx_hash = ? ORDER BY created_at ASC LIMIT ?`,
    [lot.anchor_tx_hash, batchSize]
  )) as Lot[];
  if (batchLots.length === 0) return null;

  const leaves = batchLots.map(lotToLeaf);
  const idx = batchLots.findIndex((l) => l.id === lotId);
  if (idx < 0) return null;
  const proof = buildMerkleProof(leaves, idx);
  const root = buildMerkleRoot(leaves);
  return { leaf: leaves[idx], proof, root };
}

function explorerTxUrl(rpcUrl: string, txHash: string): string | null {
  const lower = rpcUrl.toLowerCase();
  if (lower.includes('amoy')) return `https://amoy.polygonscan.com/tx/${txHash}`;
  if (lower.includes('polygon')) return `https://polygonscan.com/tx/${txHash}`;
  if (lower.includes('mumbai')) return `https://mumbai.polygonscan.com/tx/${txHash}`;
  if (lower.includes('arb')) return `https://arbiscan.io/tx/${txHash}`;
  if (lower.includes('base')) return `https://basescan.org/tx/${txHash}`;
  return null;
}
