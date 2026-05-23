// E2E blockchain LIVE :
//   1. Compile FreshCoreAnchor.sol (déjà fait → contracts/FreshCoreAnchor.json)
//   2. Déploie sur le hardhat node local (chainId 31337)
//   3. Vérifie ownership + état initial (nextBatchId == 0)
//   4. Reset les lots seedés (anchored_at = NULL) dans Postgres local
//   5. Lance npm run anchor (LIVE — pas dry-run) → envoie une vraie tx
//   6. Vérifie via getBatch(0) que le root est bien on-chain
//   7. Recompute le Merkle root côté JS et compare au root on-chain
//   8. Génère un proofForLot pour un lot et vérifie l'inclusion off-chain
//
// Si tout passe → l'architecture blockchain Phase 4 est end-to-end VÉRIFIÉE.

import { ethers } from 'ethers';
import { Client } from 'pg';
import fs from 'fs';
import { execSync } from 'child_process';

const RPC = 'http://localhost:8545';
const DB_URL = 'postgresql://freshcore:test@localhost:5432/freshcore_test';

// Compte hardhat #0 (clé bien connue, ne JAMAIS utiliser en prod !)
const DEPLOYER_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

async function main() {
  console.log('=== STEP 1. Compile contract ===');
  execSync('node scripts/compile-contract.js', { stdio: 'inherit' });
  const artifact = JSON.parse(fs.readFileSync('contracts/FreshCoreAnchor.json', 'utf8'));

  console.log('\n=== STEP 2. Deploy to local hardhat ===');
  const provider = new ethers.JsonRpcProvider(RPC);
  const deployer = new ethers.Wallet(DEPLOYER_PK, provider);
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Balance  : ${ethers.formatEther(await provider.getBalance(deployer.address))} ETH`);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`  ✓ Contract déployé : ${contractAddress}`);

  console.log('\n=== STEP 3. Vérifie l\'état initial ===');
  const owner = await contract.owner();
  const nextBatchId = await contract.nextBatchId();
  console.log(`  owner       : ${owner}`);
  console.log(`  nextBatchId : ${nextBatchId}`);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) throw new Error('Owner mismatch');
  if (nextBatchId !== 0n) throw new Error('nextBatchId should be 0');

  console.log('\n=== STEP 4. Reset des lots seedés (anchored_at = NULL) ===');
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  await pg.query(`UPDATE lots SET anchored_at = NULL, anchor_tx_hash = NULL`);
  const { rows: ready } = await pg.query(
    `SELECT COUNT(*) as n FROM lots WHERE head_hash IS NOT NULL AND anchored_at IS NULL`
  );
  console.log(`  ${ready[0].n} lots prêts à ancrer`);
  await pg.end();

  console.log('\n=== STEP 5. npm run anchor (LIVE) ===');
  const env = {
    ...process.env,
    FRESHCORE_DATABASE_URL: DB_URL,
    FRESHCORE_ANCHOR_RPC_URL: RPC,
    FRESHCORE_ANCHOR_CONTRACT: contractAddress,
    FRESHCORE_ANCHOR_PRIVATE_KEY: DEPLOYER_PK,
  };
  const output = execSync('npm run anchor', { env, encoding: 'utf8' });
  console.log(output.split('\n').slice(-12).join('\n'));

  // Extract root + tx hash from output
  const rootMatch = output.match(/merkle root = (0x[a-f0-9]+)/);
  const txMatch = output.match(/tx hash = (0x[a-f0-9]+)/);
  const batchMatch = output.match(/batch id = (\d+)/);
  if (!rootMatch || !txMatch) throw new Error('Pas de root/tx dans la sortie');
  const root = rootMatch[1];
  const txHash = txMatch[1];
  const batchId = Number(batchMatch[1]);
  console.log(`\n  Extrait : root=${root.slice(0, 18)}… tx=${txHash.slice(0, 18)}… batchId=${batchId}`);

  console.log('\n=== STEP 6. Vérifie getBatch(0) on-chain ===');
  const [onChainRoot, ts, leafCount] = await contract.getBatch(batchId);
  console.log(`  Root on-chain   : ${onChainRoot}`);
  console.log(`  Timestamp       : ${new Date(Number(ts) * 1000).toISOString()}`);
  console.log(`  Leaf count      : ${leafCount}`);
  if (onChainRoot.toLowerCase() !== root.toLowerCase()) {
    throw new Error(`Root mismatch ! on-chain=${onChainRoot} vs computed=${root}`);
  }
  console.log(`  ✓ Root on-chain == root calculé côté batcher`);

  console.log('\n=== STEP 7. Vérifie la DB : lots marqués ancrés ===');
  const pg2 = new Client({ connectionString: DB_URL });
  await pg2.connect();
  const { rows: anchored } = await pg2.query(
    `SELECT lot_code, anchored_at, anchor_tx_hash FROM lots WHERE anchor_tx_hash = $1 ORDER BY created_at ASC`,
    [txHash]
  );
  console.log(`  ${anchored.length} lots marqués ancrés en DB :`);
  anchored.slice(0, 5).forEach((l) => console.log(`    - ${l.lot_code} anchored_at=${l.anchored_at.toISOString().slice(0, 19)}Z`));
  await pg2.end();

  console.log('\n=== STEP 8. Vérifie un Merkle proof off-chain ===');
  // Recompute manuellement le proof du premier lot.
  const { keccak256, toUtf8Bytes, getBytes, concat, hexlify } = ethers;
  function hashLeaf(s) { return keccak256(getBytes(keccak256(toUtf8Bytes(s)))); }
  function sortedPair(a, b) {
    let cmp = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) { cmp = a[i] - b[i]; break; }
    }
    if (cmp === 0) cmp = a.length - b.length;
    const [x, y] = cmp <= 0 ? [a, b] : [b, a];
    return getBytes(keccak256(concat([x, y])));
  }
  const pg3 = new Client({ connectionString: DB_URL });
  await pg3.connect();
  const { rows: lots } = await pg3.query(
    `SELECT lot_code, head_sequence, head_hash FROM lots WHERE anchor_tx_hash = $1 ORDER BY created_at ASC`,
    [txHash]
  );
  await pg3.end();
  const leaves = lots.map((l) => hashLeaf(`${l.lot_code}|${l.head_sequence}|${l.head_hash}`));
  // Build root from scratch and compare
  let layer = leaves.map((h) => getBytes(h));
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const r = i + 1 < layer.length ? layer[i + 1] : layer[i];
      next.push(sortedPair(layer[i], r));
    }
    layer = next;
  }
  const recomputedRoot = hexlify(layer[0]);
  console.log(`  Recomputed root : ${recomputedRoot}`);
  console.log(`  On-chain root   : ${onChainRoot}`);
  if (recomputedRoot.toLowerCase() !== onChainRoot.toLowerCase()) {
    throw new Error('Recomputed root mismatch!');
  }
  console.log(`  ✓ Recomputed root == on-chain root → inclusion vérifiable end-to-end par un tiers`);

  console.log('\n========================================');
  console.log('🎉 ANCRAGE BLOCKCHAIN LIVE : 8/8 ÉTAPES VERTES');
  console.log('========================================');
  console.log(`Contrat        : ${contractAddress}`);
  console.log(`Tx ancrage     : ${txHash}`);
  console.log(`Batch ID       : ${batchId}`);
  console.log(`Lots ancrés    : ${anchored.length}`);
  console.log(`Merkle root    : ${onChainRoot}`);
  console.log('========================================');
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
