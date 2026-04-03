-- Profiles (extension de auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','manager','employee')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Etablissements
CREATE TABLE establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  siret TEXT,
  establishment_type TEXT NOT NULL CHECK (establishment_type IN ('restaurant','boulangerie','traiteur','epicerie','food_truck','cantine','hotel_restaurant','autre')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipements
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cold_positive','cold_negative','cold_positive_veg','cold_room','display_case','hot_holding','cooking','fryer','other')),
  threshold_min DECIMAL,
  threshold_max DECIMAL,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Releves de temperature
CREATE TABLE temperature_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id),
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  temperature_value DECIMAL NOT NULL,
  threshold_min DECIMAL,
  threshold_max DECIMAL,
  is_compliant BOOLEAN NOT NULL,
  ocr_confidence DECIMAL,
  manual_entry BOOLEAN DEFAULT false,
  photo_path TEXT,
  reading_type TEXT NOT NULL DEFAULT 'routine' CHECK (reading_type IN ('routine','cooking_core','cooling','reheating','corrective')),
  corrective_action TEXT,
  corrective_action_photo_path TEXT,
  recorded_by UUID REFERENCES profiles(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  local_id TEXT UNIQUE,
  synced_at TIMESTAMPTZ,
  blockchain_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fournisseurs
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id),
  name TEXT NOT NULL,
  siret TEXT,
  sanitary_approval TEXT,
  sanitary_approval_expiry DATE,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receptions
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id),
  supplier_id UUID REFERENCES suppliers(id),
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_note_photo_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','refused','partial')),
  refusal_reason TEXT,
  refusal_photo_path TEXT,
  recorded_by UUID REFERENCES profiles(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  local_id TEXT UNIQUE,
  synced_at TIMESTAMPTZ,
  blockchain_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Articles livres
CREATE TABLE delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  category TEXT,
  temperature DECIMAL,
  temperature_compliant BOOLEAN,
  dlc DATE,
  dlc_compliant BOOLEAN,
  lot_number TEXT,
  packaging_ok BOOLEAN DEFAULT true,
  visual_ok BOOLEAN DEFAULT true,
  photo_paths TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Taches de nettoyage (template)
CREATE TABLE cleaning_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id),
  zone TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','per_service','weekly','monthly')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enregistrements nettoyage
CREATE TABLE cleaning_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES cleaning_tasks(id),
  establishment_id UUID NOT NULL REFERENCES establishments(id),
  cleaning_product TEXT,
  dosage TEXT,
  contact_time_minutes INTEGER,
  photo_path TEXT,
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ,
  is_late BOOLEAN DEFAULT false,
  local_id TEXT UNIQUE,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Produits en stock (DLC)
CREATE TABLE products_in_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id),
  product_name TEXT NOT NULL,
  category TEXT,
  dlc_primary DATE,
  dlc_secondary DATE,
  opened_at TIMESTAMPTZ,
  lot_number TEXT,
  supplier_id UUID REFERENCES suppliers(id),
  status TEXT DEFAULT 'in_stock' CHECK (status IN ('in_stock','opened','destroyed','consumed')),
  destruction_reason TEXT,
  destruction_photo_path TEXT,
  destroyed_at TIMESTAMPTZ,
  local_id TEXT UNIQUE,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Controles huiles
CREATE TABLE oil_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id),
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  control_type TEXT NOT NULL CHECK (control_type IN ('tpm_test','oil_change','filtration','waste_removal')),
  tpm_value DECIMAL,
  tpm_compliant BOOLEAN,
  photo_path TEXT,
  waste_collector TEXT,
  waste_receipt_photo_path TEXT,
  recorded_by UUID REFERENCES profiles(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  local_id TEXT UNIQUE,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Controles nuisibles
CREATE TABLE pest_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id),
  control_type TEXT NOT NULL CHECK (control_type IN ('daily_check','pest_sighting','intervention_report')),
  checkpoint_name TEXT,
  is_anomaly BOOLEAN DEFAULT false,
  pest_type TEXT,
  location_description TEXT,
  photo_path TEXT,
  intervention_date DATE,
  service_provider TEXT,
  next_visit_date DATE,
  recorded_by UUID REFERENCES profiles(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  local_id TEXT UNIQUE,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- File blockchain
CREATE TABLE blockchain_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id),
  record_type TEXT NOT NULL,
  record_id UUID NOT NULL,
  data_hash TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','submitted','confirmed','failed')),
  tx_hash TEXT,
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rapports DDPP
CREATE TABLE ddpp_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id),
  report_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pdf_path TEXT,
  qr_code_verification TEXT,
  generated_by UUID REFERENCES profiles(id),
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEX
CREATE INDEX idx_temp_readings_establishment ON temperature_readings(establishment_id);
CREATE INDEX idx_temp_readings_recorded_at ON temperature_readings(recorded_at);
CREATE INDEX idx_deliveries_establishment ON deliveries(establishment_id);
CREATE INDEX idx_cleaning_records_establishment ON cleaning_records(establishment_id);
CREATE INDEX idx_products_stock_dlc ON products_in_stock(dlc_primary);
CREATE INDEX idx_blockchain_queue_status ON blockchain_queue(status);

-- RLS
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE products_in_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE oil_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE pest_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ddpp_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own establishments" ON establishments FOR ALL USING (owner_id = auth.uid());
