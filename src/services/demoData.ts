import { getDatabase } from './database';
import { createLot, appendEvent } from './lotChain';

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
    { id: 'eq-2', name: 'Congelateur', type: 'cold_negative', threshold_min: null as number | null, threshold_max: -18 as number | null, location: 'Reserve' },
    { id: 'eq-3', name: 'Frigo legumes', type: 'cold_positive_veg', threshold_min: null as number | null, threshold_max: 8 as number | null, location: 'Cuisine' },
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
    { id: 'ct-2', zone: 'cuisine', zone_name: 'Equipements de cuisson', frequency: 'per_service' },
    { id: 'ct-3', zone: 'cuisine', zone_name: 'Sols cuisine', frequency: 'per_service' },
    { id: 'ct-4', zone: 'stockage', zone_name: 'Chambres froides', frequency: 'weekly' },
    { id: 'ct-5', zone: 'sanitaires', zone_name: 'Sanitaires', frequency: 'daily' },
    { id: 'ct-6', zone: 'cuisine', zone_name: 'Poubelles', frequency: 'daily' },
    { id: 'ct-7', zone: 'salle', zone_name: 'Tables et chaises', frequency: 'per_service' },
    { id: 'ct-8', zone: 'stockage', zone_name: 'Reserve seche', frequency: 'weekly' },
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
    { id: 'prod-1', name: 'Filet de boeuf', category: 'viande', dlc_primary: addDays(today, 5), lot_number: 'L2026-0401', supplier_id: 'sup-1' },
    { id: 'prod-2', name: 'Blanc de poulet', category: 'volaille', dlc_primary: addDays(today, 2), lot_number: 'L2026-0399', supplier_id: 'sup-1' },
    { id: 'prod-3', name: 'Saumon frais', category: 'poisson', dlc_primary: addDays(today, 1), lot_number: 'L2026-0412', supplier_id: 'sup-2' },
    { id: 'prod-4', name: 'Creme fraiche', category: 'laitier', dlc_primary: addDays(today, 8), lot_number: 'LOT-CF-220', supplier_id: 'sup-2' },
    { id: 'prod-5', name: 'Salade mesclun', category: 'legume', dlc_primary: addDays(today, 0), lot_number: 'L2026-0405', supplier_id: 'sup-3' },
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
    { id: 'pc-1', name: 'Entree cuisine', type: 'daily_check' },
    { id: 'pc-2', name: 'Reserve seche', type: 'daily_check' },
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
}

/**
 * Seed une chaîne de traçabilité complète Pêche maritime end-to-end :
 *   Pêcheur → Mareyeur (filets) → Poissonnier → Restaurateur (tartare)
 *
 * Permet de présenter immédiatement la fonctionnalité multi-maillons en
 * démo, et sert de fixture aux tests manuels. Idempotent : skip si déjà seedé.
 */
export async function seedDemoLotChain(): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM lots`);
  if (existing && existing.count > 0) return;

  const userId = 'demo-user-001';
  const estId = 'demo-establishment-001';

  // 1. Pêcheur sort un thon de l'eau (FAO-37, ligne).
  const thon = await createLot({
    filiere: 'peche',
    maillonOrigin: 'pecheur',
    productName: 'Thon rouge entier',
    productCategory: 'poisson',
    unit: 'kg',
    quantity: 48,
    actorId: userId,
    establishmentId: estId,
    payload: {
      espece: 'Thunnus thynnus',
      zone_peche: 'FAO-37',
      methode: 'ligne',
      bateau: 'F/V Marie-Galante CC-12345',
      date_capture: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10),
    },
    occurredAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  });

  // 2. Transfert pêcheur → mareyeur en glace.
  await appendEvent({
    lotId: thon.id,
    type: 'TRANSFER',
    actorId: userId,
    actorMaillon: 'pecheur',
    establishmentId: estId,
    payload: {
      from_maillon: 'pecheur',
      to_maillon: 'mareyeur',
      temperature_transport: 1,
      duree_transport_min: 90,
      transporteur: 'Transports Maritimes Sud',
    },
    occurredAt: new Date(Date.now() - 4 * 86400000 + 3600000).toISOString(),
    newHolderId: userId, // démo mono-utilisateur
    newEstablishmentId: estId,
  });

  // 3. Mareyeur transforme en 4 lots de filets (TRANSFORM).
  const filets = await createLot({
    filiere: 'peche',
    maillonOrigin: 'mareyeur',
    productName: 'Filets de thon rouge',
    productCategory: 'poisson',
    unit: 'kg',
    quantity: 18,
    actorId: userId,
    establishmentId: estId,
    payload: {
      espece: 'Thunnus thynnus',
      recette: 'Filetage manuel, mise sous vide',
      parent_lot_codes: [thon.lot_code],
    },
    occurredAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  });
  await appendEvent({
    lotId: thon.id,
    type: 'TRANSFORM',
    actorId: userId,
    actorMaillon: 'mareyeur',
    establishmentId: estId,
    payload: {
      child_lot_code: filets.lot_code,
      recette: 'Filetage manuel, rendement 37 %',
      duree_min: 45,
    },
    parentLotIds: [thon.id],
    occurredAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  });

  // 4. Mareyeur livre poissonnier (transfert avec T° respectée).
  await appendEvent({
    lotId: filets.id,
    type: 'TRANSFER',
    actorId: userId,
    actorMaillon: 'mareyeur',
    establishmentId: estId,
    payload: {
      from_maillon: 'mareyeur',
      to_maillon: 'poissonnier',
      temperature_transport: 2,
      duree_transport_min: 120,
      transporteur: 'STEF',
    },
    occurredAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    newHolderId: userId,
    newEstablishmentId: estId,
  });

  // 5. Poissonnier contrôle T° vitrine.
  await appendEvent({
    lotId: filets.id,
    type: 'CONTROL',
    actorId: userId,
    actorMaillon: 'poissonnier',
    establishmentId: estId,
    payload: { control_type: 'temperature', value: 2, compliant: true },
    occurredAt: new Date(Date.now() - 86400000 - 7200000).toISOString(),
  });

  // 6. Poissonnier transfère au resto.
  await appendEvent({
    lotId: filets.id,
    type: 'TRANSFER',
    actorId: userId,
    actorMaillon: 'poissonnier',
    establishmentId: estId,
    payload: {
      from_maillon: 'poissonnier',
      to_maillon: 'restaurateur',
      temperature_transport: 2,
      transporteur: 'Livraison locale',
    },
    occurredAt: new Date(Date.now() - 86400000).toISOString(),
    newHolderId: userId,
    newEstablishmentId: estId,
  });

  // 7. Resto compose un tartare (TRANSFORM enfant) et le sert (CONSUME).
  const tartare = await createLot({
    filiere: 'restauration',
    maillonOrigin: 'restaurateur',
    productName: 'Tartare de thon rouge, condiments',
    productCategory: 'plat',
    unit: 'piece',
    quantity: 12,
    actorId: userId,
    establishmentId: estId,
    payload: {
      recette: 'Tartare au couteau, échalote, citron, huile olive',
      service: 'midi',
      parent_lot_codes: [filets.lot_code],
    },
    occurredAt: new Date(Date.now() - 3600000).toISOString(),
  });
  await appendEvent({
    lotId: filets.id,
    type: 'TRANSFORM',
    actorId: userId,
    actorMaillon: 'restaurateur',
    establishmentId: estId,
    payload: { child_lot_code: tartare.lot_code, recette: 'Tartare 12 portions' },
    parentLotIds: [filets.id],
    occurredAt: new Date(Date.now() - 3600000).toISOString(),
  });
}

// ----------------------------------------------------------------------------
// Seeds par filière — appelés par seedAllDemoLotChains() au bootstrap.
// Chaque seed produit une chaîne représentative end-to-end de sa filière.
// ----------------------------------------------------------------------------

const userId = 'demo-user-001';
const estId = 'demo-establishment-001';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

export async function seedDemoLotChainElevage(): Promise<void> {
  const db = await getDatabase();
  const exists = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM lots WHERE filiere = 'elevage'`
  );
  if (exists && exists.c > 0) return;

  // Éleveur abat un veau charolais.
  const veau = await createLot({
    filiere: 'elevage',
    maillonOrigin: 'eleveur',
    productName: 'Veau Charolais — demi-carcasse',
    productCategory: 'viande',
    unit: 'kg',
    quantity: 145,
    actorId: userId,
    establishmentId: estId,
    payload: {
      id_animal: 'FR-72-018245',
      race: 'Charolaise',
      troupeau: 'GAEC des Prairies',
      date_naissance: '2025-03-12',
      date_abattage: daysAgo(6).slice(0, 10),
      abattoir: 'FR.71.270.001 CE',
      bio: true,
    },
    occurredAt: daysAgo(6),
  });

  // Transfert éleveur → charcutier.
  await appendEvent({
    lotId: veau.id, type: 'TRANSFER', actorId: userId, actorMaillon: 'eleveur',
    establishmentId: estId, occurredAt: daysAgo(5),
    payload: { from_maillon: 'eleveur', to_maillon: 'charcutier', temperature_transport: 2, transporteur: 'TransViande', duree_transport_min: 180 },
    newHolderId: userId, newEstablishmentId: estId,
  });

  // Charcutier transforme en pièces (entrecôte, faux-filet, jarret).
  const pieces = await createLot({
    filiere: 'charcuterie', maillonOrigin: 'charcutier',
    productName: 'Entrecôte Charolaise — lot pièces',
    productCategory: 'viande', unit: 'kg', quantity: 22,
    actorId: userId, establishmentId: estId, occurredAt: daysAgo(4),
    payload: { recette: 'Désossage + parage', origine_viande: 'France', parent_lot_codes: [veau.lot_code] },
  });
  await appendEvent({
    lotId: veau.id, type: 'TRANSFORM', actorId: userId, actorMaillon: 'charcutier',
    establishmentId: estId, occurredAt: daysAgo(4),
    payload: { child_lot_code: pieces.lot_code, recette: 'Désossage', duree_min: 90 },
    parentLotIds: [veau.id],
  });

  // Charcutier → resto.
  await appendEvent({
    lotId: pieces.id, type: 'TRANSFER', actorId: userId, actorMaillon: 'charcutier',
    establishmentId: estId, occurredAt: daysAgo(2),
    payload: { from_maillon: 'charcutier', to_maillon: 'restaurateur', temperature_transport: 2, transporteur: 'Livraison directe' },
    newHolderId: userId, newEstablishmentId: estId,
  });

  // Resto contrôle T° réception.
  await appendEvent({
    lotId: pieces.id, type: 'CONTROL', actorId: userId, actorMaillon: 'restaurateur',
    establishmentId: estId, occurredAt: daysAgo(2),
    payload: { control_type: 'temperature', value: 3, compliant: true },
  });
}

export async function seedDemoLotChainLaitier(): Promise<void> {
  const db = await getDatabase();
  const exists = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM lots WHERE filiere IN ('laitier','fromage')`
  );
  if (exists && exists.c > 0) return;

  // Producteur trait un cheptel.
  const lait = await createLot({
    filiere: 'laitier', maillonOrigin: 'producteur',
    productName: 'Lait cru entier — vache montbéliarde',
    productCategory: 'lait', unit: 'L', quantity: 240,
    actorId: userId, establishmentId: estId, occurredAt: daysAgo(30),
    payload: {
      type_lait: 'vache',
      date_traite: daysAgo(30).slice(0, 10),
      volume_litres: 240,
      ferme: 'GAEC du Doubs',
      bio: false,
    },
  });

  // Producteur → fromager.
  await appendEvent({
    lotId: lait.id, type: 'TRANSFER', actorId: userId, actorMaillon: 'producteur',
    establishmentId: estId, occurredAt: daysAgo(30),
    payload: { from_maillon: 'producteur', to_maillon: 'fromager', temperature_transport: 4, transporteur: 'Citerne réfrigérée', duree_transport_min: 60 },
    newHolderId: userId, newEstablishmentId: estId,
  });

  // Fromager transforme en meules (TRANSFORM).
  const comte = await createLot({
    filiere: 'fromage', maillonOrigin: 'fromager',
    productName: 'Comté AOP — meule 38 kg',
    productCategory: 'fromage', unit: 'piece', quantity: 6,
    actorId: userId, establishmentId: estId, occurredAt: daysAgo(28),
    payload: { recette: 'Comté AOP', duree_affinage_mois: 1, date_caillage: daysAgo(28).slice(0, 10), aop: 'Comté AOP', parent_lot_codes: [lait.lot_code] },
  });
  await appendEvent({
    lotId: lait.id, type: 'TRANSFORM', actorId: userId, actorMaillon: 'fromager',
    establishmentId: estId, occurredAt: daysAgo(28),
    payload: { child_lot_code: comte.lot_code, recette: 'Caillage + moulage', duree_min: 240, temperature_celsius: 32 },
    parentLotIds: [lait.id],
  });

  // 27 jours plus tard, contrôle d'affinage en cave.
  await appendEvent({
    lotId: comte.id, type: 'CONTROL', actorId: userId, actorMaillon: 'fromager',
    establishmentId: estId, occurredAt: daysAgo(1),
    payload: { control_type: 'temperature', value: 11, compliant: true, notes: 'Cave 11 °C / 95 % HR' },
  });
}

export async function seedDemoLotChainLegumes(): Promise<void> {
  const db = await getDatabase();
  const exists = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM lots WHERE filiere = 'legumes'`
  );
  if (exists && exists.c > 0) return;

  // Maraîcher récolte.
  const tomates = await createLot({
    filiere: 'legumes', maillonOrigin: 'producteur',
    productName: 'Tomates Cœur de bœuf',
    productCategory: 'legume', unit: 'kg', quantity: 35,
    actorId: userId, establishmentId: estId, occurredAt: daysAgo(2),
    payload: { variete: 'Cœur de bœuf', date_recolte: daysAgo(2).slice(0, 10), parcelle: 'Parcelle Sud', bio: true },
  });

  // Producteur → primeur.
  await appendEvent({
    lotId: tomates.id, type: 'TRANSFER', actorId: userId, actorMaillon: 'producteur',
    establishmentId: estId, occurredAt: daysAgo(1),
    payload: { from_maillon: 'producteur', to_maillon: 'primeur', temperature_transport: 12, transporteur: 'Camion ferme' },
    newHolderId: userId, newEstablishmentId: estId,
  });

  // Primeur contrôle visuel + vente partielle.
  await appendEvent({
    lotId: tomates.id, type: 'CONTROL', actorId: userId, actorMaillon: 'primeur',
    establishmentId: estId, occurredAt: daysAgo(1),
    payload: { control_type: 'visuel', compliant: true, notes: 'État impeccable, calibre 100-150 g' },
  });
}

export async function seedDemoLotChainBoulangerie(): Promise<void> {
  const db = await getDatabase();
  const exists = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM lots WHERE filiere = 'boulangerie'`
  );
  if (exists && exists.c > 0) return;

  // Boulanger fait sa fournée.
  const pain = await createLot({
    filiere: 'boulangerie', maillonOrigin: 'boulanger',
    productName: 'Baguette tradition française',
    productCategory: 'pain', unit: 'piece', quantity: 80,
    actorId: userId, establishmentId: estId, occurredAt: daysAgo(0),
    payload: {
      type_produit: 'pain',
      date_fournee: new Date().toISOString().slice(0, 10),
      allergenes: 'gluten',
    },
  });

  // Contrôle fournée.
  await appendEvent({
    lotId: pain.id, type: 'CONTROL', actorId: userId, actorMaillon: 'boulanger',
    establishmentId: estId, occurredAt: daysAgo(0),
    payload: { control_type: 'temperature', value: 230, compliant: true, notes: 'T° à cœur sortie de four' },
  });
}

/**
 * Seed l'ensemble des chaînes démo représentatives. Idempotent par filière :
 * chaque seed est skip si la filière a déjà des lots.
 */
export async function seedAllDemoLotChains(): Promise<void> {
  await seedDemoLotChain(); // Pêche (Phase 0/1)
  await seedDemoLotChainElevage();
  await seedDemoLotChainLaitier();
  await seedDemoLotChainLegumes();
  await seedDemoLotChainBoulangerie();
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
