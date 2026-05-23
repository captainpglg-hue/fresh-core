export type Filiere =
  | 'peche'
  | 'elevage'
  | 'laitier'
  | 'fromage'
  | 'charcuterie'
  | 'legumes'
  | 'boulangerie'
  | 'restauration'
  | 'vins'
  | 'autre';

export type Maillon =
  | 'producteur'
  | 'pecheur'
  | 'eleveur'
  | 'transformateur'
  | 'criee'
  | 'mareyeur'
  | 'fromager'
  | 'charcutier'
  | 'boulanger'
  | 'distributeur'
  | 'detaillant'
  | 'poissonnier'
  | 'primeur'
  | 'cremier'
  | 'caviste'
  | 'restaurateur'
  | 'logisticien'
  | 'autre';

export type LotEventType =
  | 'CREATE'
  | 'TRANSFER'
  | 'TRANSFORM'
  | 'CONTROL'
  | 'CONSUME'
  | 'DESTROY';

export type LotStatus = 'active' | 'consumed' | 'destroyed';

export interface Lot {
  id: string;
  lot_code: string;
  filiere: Filiere;
  maillon_origin: Maillon;
  product_name: string;
  product_category: string | null;
  unit: string | null;
  quantity: number | null;
  current_holder_id: string | null;
  current_establishment_id: string | null;
  status: LotStatus;
  head_hash: string | null;
  head_sequence: number;
  anchored_at: string | null;
  anchor_tx_hash: string | null;
  created_at: string;
}

export interface LotEvent {
  id: string;
  lot_id: string;
  sequence: number;
  type: LotEventType;
  actor_id: string | null;
  actor_maillon: Maillon | null;
  establishment_id: string | null;
  payload: Record<string, unknown>;
  photo_paths: string[] | null;
  prev_hash: string | null;
  hash: string;
  signature: string | null;
  occurred_at: string;
  created_at: string;
}

export interface LotLink {
  id: string;
  parent_lot_id: string;
  child_lot_id: string;
  transform_event_id: string | null;
  ratio: number | null;
  created_at: string;
}

// Payloads typés par maillon/filière. JSONB côté DB, garde la souplesse.
export interface CreatePayloadPeche {
  zone_peche?: string;
  gps_lat?: number;
  gps_lon?: number;
  espece?: string;
  methode?: string;
  bateau?: string;
  date_capture?: string;
}

export interface CreatePayloadElevage {
  id_animal?: string;
  troupeau?: string;
  date_naissance?: string;
  date_abattage?: string;
  abattoir?: string;
}

export interface CreatePayloadLaitier {
  type_lait?: 'vache' | 'chevre' | 'brebis' | 'bufflonne' | 'melange';
  date_traite?: string;
  volume_litres?: number;
  ferme?: string;
}

export interface CreatePayloadLegumes {
  variete?: string;
  date_recolte?: string;
  parcelle?: string;
  bio?: boolean;
}

export interface CreatePayloadBoulangerie {
  type_produit?: string;
  date_fournee?: string;
  allergenes?: string[];
}

export interface CreatePayloadVins {
  cepage?: string;
  millesime?: number;
  appellation?: string;
  domaine?: string;
}

export interface TransferPayload {
  from_maillon: Maillon;
  to_maillon: Maillon;
  temperature_transport?: number;
  duree_transport_min?: number;
  transporteur?: string;
  notes?: string;
}

export interface TransformPayload {
  recette?: string;
  process?: string;
  duree_min?: number;
  temperature_celsius?: number;
  parent_lot_codes: string[];
}

export interface ControlPayload {
  control_type: 'temperature' | 'dlc' | 'nettoyage' | 'tpm' | 'nuisibles' | 'visuel' | 'autre';
  value?: number | string;
  compliant?: boolean;
  notes?: string;
}

export interface ConsumePayload {
  context?: string;
  notes?: string;
}

export interface DestroyPayload {
  reason: string;
  notes?: string;
}

export type LotEventPayload =
  | CreatePayloadPeche
  | CreatePayloadElevage
  | CreatePayloadLaitier
  | CreatePayloadLegumes
  | CreatePayloadBoulangerie
  | CreatePayloadVins
  | TransferPayload
  | TransformPayload
  | ControlPayload
  | ConsumePayload
  | DestroyPayload
  | Record<string, unknown>;
