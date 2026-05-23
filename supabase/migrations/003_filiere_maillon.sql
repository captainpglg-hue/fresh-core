-- Phase 1 — Étendre profiles + establishments pour porter la filière + maillon
--
-- L'enum existe déjà (migration 002). On ajoute les colonnes avec defaults
-- legacy pour ne pas casser les comptes existants. L'onboarding adaptatif
-- (Phase 3) écrira directement ces colonnes ; les comptes pré-Phase-3
-- continuent de fonctionner via le mapping legacy côté app (hook
-- useMaillonContext).

ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS filiere filiere_enum NOT NULL DEFAULT 'restauration';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS maillon maillon_enum NOT NULL DEFAULT 'restaurateur';

-- Index utiles pour filtrer dashboards par filière / maillon.
CREATE INDEX IF NOT EXISTS idx_establishments_filiere ON establishments(filiere);
CREATE INDEX IF NOT EXISTS idx_profiles_maillon ON profiles(maillon);
