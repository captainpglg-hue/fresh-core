#!/usr/bin/env node
/**
 * CLI batcher d'ancrage Fresh-Core (server-side, Node).
 *
 * Lit les lots non ancrés depuis Postgres (Supabase), construit un Merkle
 * root, l'écrit sur le contrat FreshCoreAnchor déployé sur Polygon
 * (Amoy testnet par défaut). À cron-er toutes les N minutes (recommandé : 15).
 *
 * Variables d'environnement requises :
 *   FRESHCORE_DATABASE_URL         — URL Postgres (postgresql://user:pass@host:5432/db)
 *   FRESHCORE_ANCHOR_RPC_URL       — RPC du chain cible (Amoy par défaut)
 *   FRESHCORE_ANCHOR_CONTRACT      — adresse du contrat FreshCoreAnchor
 *   FRESHCORE_ANCHOR_PRIVATE_KEY   — clé privée du batcher (NE JAMAIS commit)
 *
 * Options :
 *   --dry-run        : calcule le Merkle root sans envoyer la tx (preview)
 *   --batch-size N   : limite le nombre de lots par batch (défaut 256)
 *
 * Usage :
 *   npm run anchor -- --dry-run
 *   npm run anchor
 */

import { Client } from 'pg';
import { anchorBatch, type LotStore } from '../src/services/anchor';
import type { Lot } from '../src/types/lotChain';

function postgresLotStore(client: Client): LotStore {
  return {
    async pickLotsToAnchor(batchSize: number) {
      const { rows } = await client.query(
        `SELECT * FROM lots
         WHERE head_hash IS NOT NULL
           AND anchored_at IS NULL
           AND head_sequence > 0
         ORDER BY created_at ASC
         LIMIT $1`,
        [batchSize]
      );
      return rows as Lot[];
    },
    async markLotsAnchored(lotIds: string[], txHash: string, isoTimestamp: string) {
      if (lotIds.length === 0) return;
      await client.query(
        `UPDATE lots SET anchored_at = $1, anchor_tx_hash = $2 WHERE id = ANY($3::uuid[])`,
        [isoTimestamp, txHash, lotIds]
      );
    },
    async getLotById(lotId: string) {
      const { rows } = await client.query(`SELECT * FROM lots WHERE id = $1`, [lotId]);
      return (rows[0] as Lot | undefined) ?? null;
    },
    async getLotsByAnchorTx(anchorTxHash: string, limit: number) {
      const { rows } = await client.query(
        `SELECT * FROM lots WHERE anchor_tx_hash = $1 ORDER BY created_at ASC LIMIT $2`,
        [anchorTxHash, limit]
      );
      return rows as Lot[];
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sizeArg = args.indexOf('--batch-size');
  const batchSize = sizeArg >= 0 ? Number(args[sizeArg + 1]) : 256;

  const dbUrl = process.env.FRESHCORE_DATABASE_URL;
  const rpcUrl = process.env.FRESHCORE_ANCHOR_RPC_URL || 'https://rpc-amoy.polygon.technology';
  const contractAddress = process.env.FRESHCORE_ANCHOR_CONTRACT;
  const privateKey = process.env.FRESHCORE_ANCHOR_PRIVATE_KEY;

  if (!dbUrl) {
    console.error('ERREUR — FRESHCORE_DATABASE_URL manquant');
    console.error('  ex: postgresql://user:pass@db.xxx.supabase.co:5432/postgres');
    process.exit(1);
  }
  if (!dryRun && (!contractAddress || !privateKey)) {
    console.error('ERREUR — Variables manquantes :');
    console.error('  FRESHCORE_ANCHOR_CONTRACT     : adresse du contrat déployé');
    console.error('  FRESHCORE_ANCHOR_PRIVATE_KEY  : clé privée du batcher');
    console.error('Utilise --dry-run pour tester sans clé.');
    process.exit(1);
  }

  console.log(`[anchor] mode = ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`[anchor] db = ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`[anchor] rpc = ${rpcUrl}`);
  console.log(`[anchor] batch size max = ${batchSize}`);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const result = await anchorBatch({
      rpcUrl,
      contractAddress: contractAddress || '0x0',
      privateKey: privateKey || '0x0',
      batchSize,
      dryRun,
      store: postgresLotStore(client),
    });

    if (result.leafCount === 0) {
      console.log('[anchor] Aucun lot à ancrer. Rien à faire.');
      return;
    }

    console.log(`[anchor] ${result.leafCount} lots dans le batch`);
    console.log(`[anchor] merkle root = ${result.root}`);
    if (dryRun) {
      console.log('[anchor] DRY RUN — aucune tx envoyée.');
      console.log(`[anchor] anchorés (si live) : ${result.anchoredLotIds.length} lots`);
    } else {
      console.log(`[anchor] tx hash = ${result.txHash}`);
      console.log(`[anchor] batch id = ${result.batchId}`);
      console.log(`[anchor] block = ${result.blockNumber}`);
      if (result.explorerUrl) console.log(`[anchor] explorer = ${result.explorerUrl}`);
    }
  } catch (err) {
    console.error('[anchor] ERREUR :', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
