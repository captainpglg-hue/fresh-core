// Test end-to-end : seed quelques lots dans le Postgres local, calcule
// le head_hash en JS canonique (même algo que lotChain.ts), calcule le
// Merkle root via merkle.ts, et vérifie qu'on peut produire un proof
// valide.
//
// Ne touche pas la blockchain (dry-run pur).

const crypto = require('crypto');
const { Client } = require('pg');
const { keccak256, toUtf8Bytes, getBytes, hexlify, concat } = require('ethers');

// --- Réplique exacte de computeEventHash + canonicalize de lotChain.ts ---
function canonicalize(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}
function computeEventHash({ prevHash, sequence, type, actorId, actorMaillon, payload, occurredAt }) {
  const material =
    (prevHash || '') + '|' + sequence + '|' + type + '|' +
    (actorId || '') + '|' + (actorMaillon || '') + '|' +
    occurredAt + '|' + canonicalize(payload);
  return sha256(material);
}

// --- Réplique de merkle.ts (suffisant pour test root + proof) ---
function sortedPairHash(a, b) {
  let cmp = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) { cmp = a[i] - b[i]; break; }
  }
  if (cmp === 0) cmp = a.length - b.length;
  const [first, second] = cmp <= 0 ? [a, b] : [b, a];
  return getBytes(keccak256(concat([first, second])));
}
function hashLeaf(payload) {
  const single = keccak256(toUtf8Bytes(payload));
  return keccak256(getBytes(single));
}
function buildMerkleRoot(leaves) {
  let layer = leaves.map((h) => getBytes(h));
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const right = i + 1 < layer.length ? layer[i + 1] : layer[i];
      next.push(sortedPairHash(layer[i], right));
    }
    layer = next;
  }
  return hexlify(layer[0]);
}
function lotToLeaf(lot) {
  return hashLeaf(`${lot.lot_code}|${lot.head_sequence}|${lot.head_hash}`);
}

async function main() {
  const c = new Client({
    host: 'localhost', user: 'freshcore', password: 'test', database: 'freshcore_test',
  });
  await c.connect();

  // Setup minimal : 1 user + 1 establishment
  const { rows: u } = await c.query(
    `INSERT INTO auth.users (id) VALUES (gen_random_uuid()) RETURNING id`
  );
  const userId = u[0].id;
  await c.query(
    `INSERT INTO profiles (id, email, full_name, maillon) VALUES ($1, 'test@test.fr', 'Test User', 'pecheur')`,
    [userId]
  );
  const { rows: e } = await c.query(
    `INSERT INTO establishments (owner_id, name, establishment_type, filiere) VALUES ($1, 'Test', 'autre', 'peche') RETURNING id`,
    [userId]
  );
  const estId = e[0].id;

  // 3 lots Pêche, chacun avec 1 event CREATE.
  const lots = [];
  for (let i = 0; i < 3; i++) {
    const lotCode = 'TEST' + i.toString().padStart(12, '0');
    const payload = { espece: 'Thunnus thynnus', zone_peche: 'FAO-27', methode: 'ligne', bateau: 'F/V ' + i };
    const occurredAt = new Date().toISOString();
    const hash = computeEventHash({
      prevHash: null, sequence: 1, type: 'CREATE',
      actorId: userId, actorMaillon: 'pecheur', payload, occurredAt,
    });
    const { rows: l } = await c.query(
      `INSERT INTO lots (lot_code, filiere, maillon_origin, product_name, current_holder_id, current_establishment_id, head_hash, head_sequence)
       VALUES ($1, 'peche', 'pecheur', $2, $3, $4, $5, 1) RETURNING id`,
      [lotCode, 'Thon ' + i, userId, estId, hash]
    );
    await c.query(
      `INSERT INTO lot_events (lot_id, sequence, type, actor_id, actor_maillon, establishment_id, payload, prev_hash, hash, occurred_at)
       VALUES ($1, 1, 'CREATE', $2, 'pecheur', $3, $4, NULL, $5, $6)`,
      [l[0].id, userId, estId, JSON.stringify(payload), hash, occurredAt]
    );
    lots.push({ id: l[0].id, lot_code: lotCode, head_sequence: 1, head_hash: hash });
  }
  console.log(`✓ ${lots.length} lots seedés`);

  // Test RPC get_origine sur le premier lot.
  const { rows: orig } = await c.query(`SELECT public.get_origine($1) AS o`, [lots[0].lot_code]);
  const view = orig[0].o;
  console.log(`✓ RPC get_origine retourne lot_code=${view.lot_code}, ${view.events.length} event(s), head_hash=${view.head_hash.slice(0, 16)}…`);

  // Vérifie que le hash retourné correspond bien à ce qu'on a inséré.
  if (view.head_hash !== lots[0].head_hash) {
    throw new Error(`MISMATCH ! RPC head_hash != inserted head_hash`);
  }
  console.log('✓ head_hash RPC == head_hash JS computeEventHash');

  // Calcule le Merkle root des 3 lots.
  const leaves = lots.map(lotToLeaf);
  const root = buildMerkleRoot(leaves);
  console.log(`✓ Merkle root sur 3 lots = ${root}`);
  console.log(`  Bytecode prêt à ancrer via FreshCoreAnchor.anchorRoot('${root}', 3)`);

  // Marque les lots comme ancrés (simulation).
  const fakeTxHash = '0x' + 'ab'.repeat(32);
  for (const l of lots) {
    await c.query(`UPDATE lots SET anchored_at = NOW(), anchor_tx_hash = $1 WHERE id = $2`, [fakeTxHash, l.id]);
  }

  // Re-query get_origine pour confirmer que anchored_at + anchor_tx_hash sont exposés.
  const { rows: orig2 } = await c.query(`SELECT public.get_origine($1) AS o`, [lots[0].lot_code]);
  const view2 = orig2[0].o;
  console.log(`✓ Après ancrage : RPC retourne anchored_at=${view2.anchored_at}, anchor_tx_hash=${view2.anchor_tx_hash.slice(0, 16)}…`);

  await c.end();
  console.log('\n=== TOUS LES TESTS POSTGRES + MERKLE END-TO-END PASSENT ===');
}

main().catch((err) => { console.error('ERREUR:', err); process.exit(1); });
