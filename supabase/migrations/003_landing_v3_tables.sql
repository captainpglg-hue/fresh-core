-- Tables alimentées par /landing/ (index.html v3 vanilla).
-- Schéma volontairement séparé du modèle Expo (deliveries / delivery_items
-- etc.) car la landing v3 a sa propre logique métier orientée "lot de pêche".
-- Pas de FK vers profiles/establishments : la landing est anonyme (device_id).

CREATE TABLE IF NOT EXISTS public.profils (
  device_id     TEXT PRIMARY KEY,
  filiere       TEXT,
  maillon       TEXT,
  nom           TEXT,
  etablissement TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lots (
  lot_id           TEXT PRIMARY KEY,
  device_id        TEXT NOT NULL,
  espece           TEXT NOT NULL,
  poids_kg         NUMERIC,
  qualite          TEXT,
  zone_peche       TEXT,
  temperature_cale NUMERIC,
  notes            TEXT,
  hash_blockchain  TEXT,
  tx_hash          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lots_device ON public.lots(device_id);

CREATE TABLE IF NOT EXISTS public.temperatures (
  id         BIGINT PRIMARY KEY,
  device_id  TEXT NOT NULL,
  zone       TEXT NOT NULL,
  valeur     NUMERIC NOT NULL,
  conforme   BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_temperatures_device ON public.temperatures(device_id);

CREATE TABLE IF NOT EXISTS public.nettoyage (
  device_id  TEXT NOT NULL,
  date_jour  DATE NOT NULL,
  tache      TEXT NOT NULL,
  faite      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id, date_jour, tache)
);

CREATE TABLE IF NOT EXISTS public.dlc (
  id          BIGINT PRIMARY KEY,
  device_id   TEXT NOT NULL,
  produit     TEXT NOT NULL,
  date_limite DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dlc_device ON public.dlc(device_id);

-- RLS : la landing est anonyme, anon doit pouvoir INSERT/UPDATE/SELECT.
-- Aucune PII sensible (juste filière + nom optionnel). Pas de DELETE depuis anon.
ALTER TABLE public.profils       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temperatures  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nettoyage     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dlc           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon read profils"   ON public.profils      FOR SELECT TO anon USING (true);
CREATE POLICY "anon write profils"  ON public.profils      FOR INSERT TO anon WITH CHECK (device_id IS NOT NULL);
CREATE POLICY "anon update profils" ON public.profils      FOR UPDATE TO anon USING (true) WITH CHECK (device_id IS NOT NULL);

CREATE POLICY "anon read lots"      ON public.lots         FOR SELECT TO anon USING (true);
CREATE POLICY "anon write lots"     ON public.lots         FOR INSERT TO anon WITH CHECK (device_id IS NOT NULL);
CREATE POLICY "anon update lots"    ON public.lots         FOR UPDATE TO anon USING (true) WITH CHECK (device_id IS NOT NULL);

CREATE POLICY "anon read temps"     ON public.temperatures FOR SELECT TO anon USING (true);
CREATE POLICY "anon write temps"    ON public.temperatures FOR INSERT TO anon WITH CHECK (device_id IS NOT NULL);
CREATE POLICY "anon update temps"   ON public.temperatures FOR UPDATE TO anon USING (true) WITH CHECK (device_id IS NOT NULL);

CREATE POLICY "anon read nett"      ON public.nettoyage    FOR SELECT TO anon USING (true);
CREATE POLICY "anon write nett"     ON public.nettoyage    FOR INSERT TO anon WITH CHECK (device_id IS NOT NULL);
CREATE POLICY "anon update nett"    ON public.nettoyage    FOR UPDATE TO anon USING (true) WITH CHECK (device_id IS NOT NULL);

CREATE POLICY "anon read dlc"       ON public.dlc          FOR SELECT TO anon USING (true);
CREATE POLICY "anon write dlc"      ON public.dlc          FOR INSERT TO anon WITH CHECK (device_id IS NOT NULL);
CREATE POLICY "anon update dlc"     ON public.dlc          FOR UPDATE TO anon USING (true) WITH CHECK (device_id IS NOT NULL);
