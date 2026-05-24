-- RLS policies pour les tables ouvertes par 001_initial_schema.sql.
-- Sans policy explicite, une table avec RLS activé est inaccessible : tout
-- SELECT/INSERT/UPDATE/DELETE renvoie zéro ligne (silencieux côté client).
--
-- Règle générale : un utilisateur ne voit / ne modifie que les lignes qui
-- appartiennent à un établissement dont il est `owner_id`.
--
-- profiles : chaque user gère uniquement sa propre fiche.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Helper : un user "owns" un establishment s'il y est `owner_id`.
-- On l'inline dans chaque policy (CREATE FUNCTION nécessiterait un search_path
-- explicite + GRANT, plus de surface d'attaque pour 0 gain).

-- equipment
CREATE POLICY "Owners manage equipment"
  ON equipment FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- temperature_readings
CREATE POLICY "Owners manage temperature_readings"
  ON temperature_readings FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- suppliers
CREATE POLICY "Owners manage suppliers"
  ON suppliers FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- deliveries
CREATE POLICY "Owners manage deliveries"
  ON deliveries FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- delivery_items : pas de establishment_id direct, on remonte via deliveries.
CREATE POLICY "Owners manage delivery_items"
  ON delivery_items FOR ALL
  USING (
    delivery_id IN (
      SELECT d.id FROM deliveries d
      JOIN establishments e ON e.id = d.establishment_id
      WHERE e.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    delivery_id IN (
      SELECT d.id FROM deliveries d
      JOIN establishments e ON e.id = d.establishment_id
      WHERE e.owner_id = auth.uid()
    )
  );

-- cleaning_tasks
CREATE POLICY "Owners manage cleaning_tasks"
  ON cleaning_tasks FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- cleaning_records
CREATE POLICY "Owners manage cleaning_records"
  ON cleaning_records FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- products_in_stock
CREATE POLICY "Owners manage products_in_stock"
  ON products_in_stock FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- oil_controls
CREATE POLICY "Owners manage oil_controls"
  ON oil_controls FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- pest_controls
CREATE POLICY "Owners manage pest_controls"
  ON pest_controls FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- ddpp_reports
CREATE POLICY "Owners manage ddpp_reports"
  ON ddpp_reports FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- blockchain_queue : la table existe mais n'est pas RLS-activée dans 001.
-- On l'active + on la lock côté owner pour cohérence (au cas où la feature
-- serait re-câblée plus tard).
ALTER TABLE blockchain_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read blockchain_queue"
  ON blockchain_queue FOR SELECT
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners insert blockchain_queue"
  ON blockchain_queue FOR INSERT
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );
