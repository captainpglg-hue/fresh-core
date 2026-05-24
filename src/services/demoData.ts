import { getDatabase } from './database';
import { computeChainHash, GENESIS_HASH } from '../utils/hashChain';

export async function seedDemoData(): Promise<void> {
  const db = await getDatabase();

  // Check if demo data already exists
  const existing = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM equipment`
  );
  if (existing && existing.count > 0) return;

  const estId = 'demo-establishment-001';
  const userId = 'demo-user-001';
  const now = new Date().toISOString();

  // Equipment
  const equipment = [
    { id: 'eq-1', name: 'Chambre froide cuisine', type: 'cold_positive', threshold_min: null as number | null, threshold_max: 4 as number | null, location: 'Cuisine' },
    { id: 'eq-2', name: 'Congélateur', type: 'cold_negative', threshold_min: null as number | null, threshold_max: -18 as number | null, location: 'Réserve' },
    { id: 'eq-3', name: 'Frigo légumes', type: 'cold_positive_veg', threshold_min: null as number | null, threshold_max: 8 as number | null, location: 'Cuisine' },
    { id: 'eq-4', name: 'Vitrine froide', type: 'display_case', threshold_min: null as number | null, threshold_max: 4 as number | null, location: 'Salle' },
    { id: 'eq-5', name: 'Bain-marie', type: 'hot_holding', threshold_min: 63 as number | null, threshold_max: null as number | null, location: 'Cuisine' },
    { id: 'eq-6', name: 'Friteuse 1', type: 'fryer', threshold_min: null as number | null, threshold_max: 25 as number | null, location: 'Cuisine' },
  ];

  for (const eq of equipment) {
    await db.runAsync(
      `INSERT OR IGNORE INTO equipment (id, establishment_id, name, type, threshold_min, threshold_max, location, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [eq.id, estId, eq.name, eq.type, eq.threshold_min, eq.threshold_max, eq.location, now]
    );
  }

  // Suppliers
  const suppliers = [
    { id: 'sup-1', name: 'Metro Cash & Carry', sanitary_approval: 'FR 75.123.001 CE', sanitary_approval_expiry: '2027-06-15', contact_phone: '01 42 00 00 00' },
    { id: 'sup-2', name: 'Pomona', sanitary_approval: 'FR 92.045.002 CE', sanitary_approval_expiry: '2027-03-20', contact_phone: '01 43 00 00 00' },
    { id: 'sup-3', name: 'Boulanger Bio Local', sanitary_approval: 'FR 75.200.003 CE', sanitary_approval_expiry: '2026-12-01', contact_phone: '06 12 34 56 78' },
  ];

  for (const sup of suppliers) {
    await db.runAsync(
      `INSERT OR IGNORE INTO suppliers (id, establishment_id, name, sanitary_approval, sanitary_approval_expiry, contact_phone, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [sup.id, estId, sup.name, sup.sanitary_approval, sup.sanitary_approval_expiry, sup.contact_phone, now]
    );
  }

  // Cleaning tasks
  const cleaningTasks = [
    { id: 'ct-1', zone: 'cuisine', zone_name: 'Plans de travail', frequency: 'per_service' },
    { id: 'ct-2', zone: 'cuisine', zone_name: 'Équipements de cuisson', frequency: 'per_service' },
    { id: 'ct-3', zone: 'cuisine', zone_name: 'Sols cuisine', frequency: 'per_service' },
    { id: 'ct-4', zone: 'stockage', zone_name: 'Chambres froides', frequency: 'weekly' },
    { id: 'ct-5', zone: 'sanitaires', zone_name: 'Sanitaires', frequency: 'daily' },
    { id: 'ct-6', zone: 'cuisine', zone_name: 'Poubelles', frequency: 'daily' },
    { id: 'ct-7', zone: 'salle', zone_name: 'Tables et chaises', frequency: 'per_service' },
    { id: 'ct-8', zone: 'stockage', zone_name: 'Réserve sèche', frequency: 'weekly' },
  ];

  for (const task of cleaningTasks) {
    await db.runAsync(
      `INSERT OR IGNORE INTO cleaning_tasks (id, establishment_id, zone, zone_name, frequency, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [task.id, estId, task.zone, task.zone_name, task.frequency, now]
    );
  }

  // Some products in stock with DLC
  const today = new Date();
  const products = [
    { id: 'prod-1', name: 'Filet de bœuf', category: 'viande', dlc_primary: addDays(today, 5), lot_number: 'L2026-0401', supplier_id: 'sup-1' },
    { id: 'prod-2', name: 'Blanc de poulet', category: 'volaille', dlc_primary: addDays(today, 2), lot_number: 'L2026-0399', supplier_id: 'sup-1' },
    { id: 'prod-3', name: 'Saumon frais', category: 'poisson', dlc_primary: addDays(today, 1), lot_number: 'L2026-0412', supplier_id: 'sup-2' },
    { id: 'prod-4', name: 'Crème fraîche', category: 'laitier', dlc_primary: addDays(today, 8), lot_number: 'LOT-CF-220', supplier_id: 'sup-2' },
    { id: 'prod-5', name: 'Salade mesclun', category: 'légume', dlc_primary: addDays(today, 0), lot_number: 'L2026-0405', supplier_id: 'sup-3' },
  ];

  for (const p of products) {
    await db.runAsync(
      `INSERT OR IGNORE INTO products_in_stock (id, establishment_id, product_name, category, dlc_primary, lot_number, supplier_id, status, local_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'in_stock', ?, ?)`,
      [p.id, estId, p.name, p.category, p.dlc_primary, p.lot_number, p.supplier_id, p.id, now]
    );
  }

  // Some temperature readings from today (to show data on dashboard)
  const readings = [
    { id: 'tr-1', equipment_id: 'eq-1', value: 3.2, is_compliant: 1, reading_type: 'routine', recorded_at: todayAt(7, 30) },
    { id: 'tr-2', equipment_id: 'eq-2', value: -19.5, is_compliant: 1, reading_type: 'routine', recorded_at: todayAt(7, 35) },
    { id: 'tr-3', equipment_id: 'eq-3', value: 6.1, is_compliant: 1, reading_type: 'routine', recorded_at: todayAt(7, 40) },
  ];

  for (const r of readings) {
    await db.runAsync(
      `INSERT OR IGNORE INTO temperature_readings (id, establishment_id, equipment_id, temperature_value, threshold_min, threshold_max, is_compliant, reading_type, recorded_by, recorded_at, local_id, created_at)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)`,
      [r.id, estId, r.equipment_id, r.value, r.is_compliant, r.reading_type, userId, r.recorded_at, r.id, now]
    );
  }

  // Pest control checkpoints
  const pestCheckpoints = [
    { id: 'pc-1', name: 'Entrée cuisine', type: 'daily_check' },
    { id: 'pc-2', name: 'Réserve sèche', type: 'daily_check' },
    { id: 'pc-3', name: 'Local poubelles', type: 'daily_check' },
    { id: 'pc-4', name: 'Quai de livraison', type: 'daily_check' },
  ];

  for (const pc of pestCheckpoints) {
    await db.runAsync(
      `INSERT OR IGNORE INTO pest_controls (id, establishment_id, control_type, checkpoint_name, is_anomaly, recorded_by, recorded_at, local_id, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [pc.id, estId, pc.type, pc.name, userId, now, pc.id, now]
    );
  }

  // ── Filière viande + poisson : deux réceptions historiques avec
  // chaîne de hash (genesis → meat → fish). Sert de support à la démo
  // consommateur (QR code → page "Origine produit").
  const meatReceivedAt = todayAt(8, 15);
  const meatItems = [
    {
      product_name: 'Filet de bœuf race Charolaise',
      category: 'viande',
      temperature: 2.8,
      temperature_compliant: 1,
      dlc: addDays(today, 6),
      lot_number: 'L2026-0401',
      packaging_ok: 1,
      visual_ok: 1,
    },
    {
      product_name: 'Onglet de bœuf',
      category: 'viande',
      temperature: 3.1,
      temperature_compliant: 1,
      dlc: addDays(today, 5),
      lot_number: 'L2026-0402',
      packaging_ok: 1,
      visual_ok: 1,
    },
  ];
  const meatPayload = {
    supplier_id: 'sup-1',
    establishment_id: estId,
    delivery_date: today.toISOString().split('T')[0],
    recorded_at: meatReceivedAt,
    items: meatItems.map((it) => ({
      product_name: it.product_name,
      category: it.category,
      temperature: it.temperature,
      dlc: it.dlc,
      lot_number: it.lot_number,
      photo_paths: null,
    })),
  };
  const meatHash = await computeChainHash(GENESIS_HASH, meatPayload);

  await db.runAsync(
    `INSERT OR IGNORE INTO deliveries
      (id, establishment_id, supplier_id, delivery_date, status, recorded_by, recorded_at, local_id, blockchain_hash, created_at)
     VALUES (?, ?, ?, ?, 'accepted', ?, ?, ?, ?, ?)`,
    [
      'del-meat-001',
      estId,
      'sup-1',
      today.toISOString().split('T')[0],
      userId,
      meatReceivedAt,
      'del-meat-001',
      meatHash,
      now,
    ],
  );
  let meatItemIdx = 1;
  for (const it of meatItems) {
    await db.runAsync(
      `INSERT OR IGNORE INTO delivery_items
        (id, delivery_id, product_name, category, temperature, temperature_compliant, dlc, lot_number, packaging_ok, visual_ok, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `del-meat-001-item-${meatItemIdx++}`,
        'del-meat-001',
        it.product_name,
        it.category,
        it.temperature,
        it.temperature_compliant,
        it.dlc,
        it.lot_number,
        it.packaging_ok,
        it.visual_ok,
        now,
      ],
    );
  }

  const fishReceivedAt = todayAt(9, 5);
  const fishItems = [
    {
      product_name: 'Saumon Atlantique entier',
      category: 'poisson',
      temperature: 1.2,
      temperature_compliant: 1,
      dlc: addDays(today, 2),
      lot_number: 'L2026-0412',
      packaging_ok: 1,
      visual_ok: 1,
    },
    {
      product_name: 'Bar de ligne',
      category: 'poisson',
      temperature: 1.5,
      temperature_compliant: 1,
      dlc: addDays(today, 2),
      lot_number: 'L2026-0413',
      packaging_ok: 1,
      visual_ok: 1,
    },
  ];
  const fishPayload = {
    supplier_id: 'sup-2',
    establishment_id: estId,
    delivery_date: today.toISOString().split('T')[0],
    recorded_at: fishReceivedAt,
    items: fishItems.map((it) => ({
      product_name: it.product_name,
      category: it.category,
      temperature: it.temperature,
      dlc: it.dlc,
      lot_number: it.lot_number,
      photo_paths: null,
    })),
  };
  const fishHash = await computeChainHash(meatHash, fishPayload);

  await db.runAsync(
    `INSERT OR IGNORE INTO deliveries
      (id, establishment_id, supplier_id, delivery_date, status, recorded_by, recorded_at, local_id, blockchain_hash, created_at)
     VALUES (?, ?, ?, ?, 'accepted', ?, ?, ?, ?, ?)`,
    [
      'del-fish-001',
      estId,
      'sup-2',
      today.toISOString().split('T')[0],
      userId,
      fishReceivedAt,
      'del-fish-001',
      fishHash,
      now,
    ],
  );
  let fishItemIdx = 1;
  for (const it of fishItems) {
    await db.runAsync(
      `INSERT OR IGNORE INTO delivery_items
        (id, delivery_id, product_name, category, temperature, temperature_compliant, dlc, lot_number, packaging_ok, visual_ok, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `del-fish-001-item-${fishItemIdx++}`,
        'del-fish-001',
        it.product_name,
        it.category,
        it.temperature,
        it.temperature_compliant,
        it.dlc,
        it.lot_number,
        it.packaging_ok,
        it.visual_ok,
        now,
      ],
    );
  }
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function todayAt(hours: number, minutes: number): string {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}
