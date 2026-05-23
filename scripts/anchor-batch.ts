#!/usr/bin/env node
/**
 * CLI batcher d'ancrage Fresh-Core.
 *
 * Lit les lots non ancrés depuis la base, construit un Merkle root, l'écrit
 * sur le contrat FreshCoreAnchor déployé sur Polygon (Amoy testnet par
 * défaut). À cron-er toutes les N minutes (recommandé : 15 min).
 *
 * Variables d'environnement requises :
 *   FRESHCORE_ANCHOR_RPC_URL       — RPC du chain cible (Amoy par défaut)
 *   FRESHCORE_ANCHOR_CONTRACT      — adresse du contrat FreshCoreAnchor
 *   FRESHCORE_ANCHOR_PRIVATE_KEY   — clé privée du batcher (NE JAMAIS commit)
 *
 * Options :
 *   --dry-run : calcule le Merkle root sans envoyer la tx (preview)
 *   --batch-size N : limite le nombre de lots par batch (défaut 256)
 *
 * Usage :
 *   npm run anchor -- --dry-run
 *   npm run anchor
 */

import { anchorBatch } from '../src/services/anchor';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sizeArg = args.indexOf('--batch-size');
  const batchSize = sizeArg >= 0 ? Number(args[sizeArg + 1]) : 256;

  const rpcUrl = process.env.FRESHCORE_ANCHOR_RPC_URL || 'https://rpc-amoy.polygon.technology';
  const contractAddress = process.env.FRESHCORE_ANCHOR_CONTRACT;
  const privateKey = process.env.FRESHCORE_ANCHOR_PRIVATE_KEY;

  if (!dryRun && (!contractAddress || !privateKey)) {
    console.error('ERREUR — Variables manquantes :');
    console.error('  FRESHCORE_ANCHOR_CONTRACT     : adresse du contrat déployé');
    console.error('  FRESHCORE_ANCHOR_PRIVATE_KEY  : clé privée du batcher');
    console.error('Utilise --dry-run pour tester sans clé.');
    process.exit(1);
  }

  console.log(`[anchor] mode = ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`[anchor] rpc = ${rpcUrl}`);
  console.log(`[anchor] batch size max = ${batchSize}`);

  try {
    const result = await anchorBatch({
      rpcUrl,
      contractAddress: contractAddress || '0x0',
      privateKey: privateKey || '0x0',
      batchSize,
      dryRun,
    });

    if (result.leafCount === 0) {
      console.log('[anchor] Aucun lot à ancrer. Rien à faire.');
      return;
    }

    console.log(`[anchor] ${result.leafCount} lots dans le batch`);
    console.log(`[anchor] merkle root = ${result.root}`);
    if (dryRun) {
      console.log('[anchor] DRY RUN — aucune tx envoyée.');
    } else {
      console.log(`[anchor] tx hash = ${result.txHash}`);
      console.log(`[anchor] batch id = ${result.batchId}`);
      console.log(`[anchor] block = ${result.blockNumber}`);
      if (result.explorerUrl) console.log(`[anchor] explorer = ${result.explorerUrl}`);
    }
  } catch (err) {
    console.error('[anchor] ERREUR :', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
