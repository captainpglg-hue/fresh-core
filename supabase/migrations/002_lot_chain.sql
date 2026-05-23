-- Phase 0 — Lot chain (traçabilité multi-maillons inalterable)
--
-- Modèle :
--  * Un LOT est une unité physique identifiée qui voyage à travers les maillons
--    de la filière (Pêcheur -> Mareyeur -> Poissonnier -> Resto, etc.).
--  * Chaque action sur un lot ajoute un EVENT à son journal. Les events sont
--    chaînés par hash : chaque event embarque le hash du précédent + son propre
--    payload, formant une chaîne tamper-evident.
--  * Une transformation (charcutier qui découpe une carcasse en pièces,
--    fromager qui fait des meules à partir de lait, cuisinier qui compose
--    un plat) crée N lots enfants à partir de M lots parents. Le graphe
--    parent->enfant vit dans lot_links.
--  * La tête de chaîne (head_hash) sera ancrée périodiquement sur blockchain
--    via blockchain_queue (déjà existant). C'est la couche immuable.

-- Enum des 10 filières + Autre
CREATE TYPE filiere_enum AS ENUM (
  'peche',
  'elevage',
  'laitier',
  'fromage',
  'charcuterie',
  'legumes',
  'boulangerie',
  'restauration',
  'vins',
  'autre'
);

-- Enum des maillons (rôles dans la filière)
CREATE TYPE maillon_enum AS ENUM (
  'producteur',
  'pecheur',
  'eleveur',
  'transformateur',
  'criee',
  'mareyeur',
  'fromager',
  'charcutier',
  'boulanger',
  'distributeur',
  'detaillant',
  'poissonnier',
  'primeur',
  'cremier',
  'caviste',
  'restaurateur',
  'logisticien',
  'autre'
);

-- Enum des types d'événements
CREATE TYPE lot_event_type AS ENUM (
  'CREATE',     -- Naissance d'un lot par un maillon source
  'TRANSFER',   -- Changement de garde (handoff entre 2 maillons)
  'TRANSFORM',  -- N lots parents -> M lots enfants
  'CONTROL',    -- Mesure non-transformante (T°, DLC, nettoyage, TPM, ...)
  'CONSUME',    -- Fin de chaîne nominale (resto sert, primeur vend)
  'DESTROY'     -- Fin anormale (refus, périmé, casse)
);

-- ============================================================================
-- TABLE: lots
-- ============================================================================
-- Un lot = une unité physique tracée. lot_code est l'identifiant public
-- (encodé dans le QR). On garde un id UUID interne pour les FK.
CREATE TABLE lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_code TEXT UNIQUE NOT NULL,
  filiere filiere_enum NOT NULL,
  maillon_origin maillon_enum NOT NULL,
  product_name TEXT NOT NULL,
  product_category TEXT,
  unit TEXT,
  quantity DECIMAL,
  current_holder_id UUID REFERENCES profiles(id),
  current_establishment_id UUID REFERENCES establishments(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'destroyed')),
  head_hash TEXT,
  head_sequence INTEGER DEFAULT 0,
  anchored_at TIMESTAMPTZ,
  anchor_tx_hash TEXT,
  local_id TEXT UNIQUE,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lots_filiere ON lots(filiere);
CREATE INDEX idx_lots_holder ON lots(current_holder_id);
CREATE INDEX idx_lots_establishment ON lots(current_establishment_id);
CREATE INDEX idx_lots_status ON lots(status);

-- ============================================================================
-- TABLE: lot_events (event log chaîné)
-- ============================================================================
-- Append-only. UNIQUE(lot_id, sequence) garantit l'ordre strict.
-- hash = sha256(prev_hash || sequence || type || actor_id || payload_json)
CREATE TABLE lot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  type lot_event_type NOT NULL,
  actor_id UUID REFERENCES profiles(id),
  actor_maillon maillon_enum,
  establishment_id UUID REFERENCES establishments(id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  photo_paths TEXT[],
  prev_hash TEXT,
  hash TEXT NOT NULL,
  signature TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  local_id TEXT UNIQUE,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lot_id, sequence)
);

CREATE INDEX idx_lot_events_lot ON lot_events(lot_id, sequence);
CREATE INDEX idx_lot_events_type ON lot_events(type);
CREATE INDEX idx_lot_events_actor ON lot_events(actor_id);
CREATE INDEX idx_lot_events_payload ON lot_events USING GIN (payload);

-- ============================================================================
-- TABLE: lot_links (DAG parent -> enfant pour les transformations)
-- ============================================================================
-- ratio = quelle quantité du parent a été utilisée pour produire cet enfant
-- (utile pour la décharge de stock côté parent). Exemple : 0.25 = un quart de
-- la carcasse parent est dans cet enfant.
CREATE TABLE lot_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  child_lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  transform_event_id UUID REFERENCES lot_events(id),
  ratio DECIMAL,
  local_id TEXT UNIQUE,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parent_lot_id, child_lot_id)
);

CREATE INDEX idx_lot_links_parent ON lot_links(parent_lot_id);
CREATE INDEX idx_lot_links_child ON lot_links(child_lot_id);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_links ENABLE ROW LEVEL SECURITY;

-- Lecture : le détenteur actuel + tous ceux qui ont participé à la chaîne
-- voient le lot et ses events. La page publique /origine/<code> passe par la
-- RPC SECURITY DEFINER ci-dessous, donc cette RLS reste owner-only.
CREATE POLICY lots_select_holder ON lots
  FOR SELECT TO authenticated
  USING (
    current_holder_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM lot_events e
      WHERE e.lot_id = lots.id AND e.actor_id = auth.uid()
    )
  );

CREATE POLICY lots_insert_self ON lots
  FOR INSERT TO authenticated
  WITH CHECK (current_holder_id = auth.uid());

CREATE POLICY lots_update_holder ON lots
  FOR UPDATE TO authenticated
  USING (current_holder_id = auth.uid());

CREATE POLICY lot_events_select_participant ON lot_events
  FOR SELECT TO authenticated
  USING (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM lots l
      WHERE l.id = lot_events.lot_id
        AND (l.current_holder_id = auth.uid())
    )
  );

CREATE POLICY lot_events_insert_self ON lot_events
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- lot_events est append-only : pas de UPDATE ni DELETE pour authenticated.

CREATE POLICY lot_links_select_participant ON lot_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lots l
      WHERE (l.id = lot_links.parent_lot_id OR l.id = lot_links.child_lot_id)
        AND l.current_holder_id = auth.uid()
    )
  );

CREATE POLICY lot_links_insert_holder ON lot_links
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lots l
      WHERE l.id = lot_links.child_lot_id AND l.current_holder_id = auth.uid()
    )
  );

-- ============================================================================
-- RPC: get_origine — vue publique consommateur (scan QR final)
-- ============================================================================
-- SECURITY DEFINER pour bypasser RLS et exposer une vue publique aux anon.
-- Ne renvoie que les champs traçabilité (pas d'info personnelle utilisateur).
CREATE OR REPLACE FUNCTION public.get_origine(p_lot_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot lots%ROWTYPE;
  v_events JSONB;
  v_parents JSONB;
BEGIN
  SELECT * INTO v_lot FROM lots WHERE lot_code = p_lot_code;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'sequence', e.sequence,
        'type', e.type,
        'actor_maillon', e.actor_maillon,
        'payload', e.payload,
        'photo_paths', e.photo_paths,
        'hash', e.hash,
        'occurred_at', e.occurred_at
      ) ORDER BY e.sequence ASC
    ),
    '[]'::jsonb
  ) INTO v_events
  FROM lot_events e
  WHERE e.lot_id = v_lot.id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'lot_code', pl.lot_code,
        'filiere', pl.filiere,
        'product_name', pl.product_name,
        'ratio', ll.ratio
      )
    ),
    '[]'::jsonb
  ) INTO v_parents
  FROM lot_links ll
  JOIN lots pl ON pl.id = ll.parent_lot_id
  WHERE ll.child_lot_id = v_lot.id;

  RETURN jsonb_build_object(
    'lot_code', v_lot.lot_code,
    'filiere', v_lot.filiere,
    'maillon_origin', v_lot.maillon_origin,
    'product_name', v_lot.product_name,
    'product_category', v_lot.product_category,
    'unit', v_lot.unit,
    'quantity', v_lot.quantity,
    'status', v_lot.status,
    'head_hash', v_lot.head_hash,
    'head_sequence', v_lot.head_sequence,
    'anchored_at', v_lot.anchored_at,
    'anchor_tx_hash', v_lot.anchor_tx_hash,
    'created_at', v_lot.created_at,
    'events', v_events,
    'parents', v_parents
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_origine(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_origine(TEXT) TO anon, authenticated;
