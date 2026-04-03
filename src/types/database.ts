export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'manager' | 'employee';
  created_at: string;
  updated_at: string;
}

export interface Establishment {
  id: string;
  owner_id: string;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  siret: string | null;
  establishment_type: 'restaurant' | 'boulangerie' | 'traiteur' | 'epicerie' | 'food_truck' | 'cantine' | 'hotel_restaurant' | 'autre';
  created_at: string;
  updated_at: string;
}

export interface Equipment {
  id: string;
  establishment_id: string;
  name: string;
  type: 'cold_positive' | 'cold_negative' | 'cold_positive_veg' | 'cold_room' | 'display_case' | 'hot_holding' | 'cooking' | 'fryer' | 'other';
  threshold_min: number | null;
  threshold_max: number | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TemperatureReading {
  id: string;
  establishment_id: string;
  equipment_id: string;
  temperature_value: number;
  threshold_min: number | null;
  threshold_max: number | null;
  is_compliant: boolean;
  ocr_confidence: number | null;
  manual_entry: boolean;
  photo_path: string | null;
  reading_type: 'routine' | 'cooking_core' | 'cooling' | 'reheating' | 'corrective';
  corrective_action: string | null;
  corrective_action_photo_path: string | null;
  recorded_by: string | null;
  recorded_at: string;
  local_id: string | null;
  synced_at: string | null;
  blockchain_hash: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  establishment_id: string;
  name: string;
  siret: string | null;
  sanitary_approval: string | null;
  sanitary_approval_expiry: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Delivery {
  id: string;
  establishment_id: string;
  supplier_id: string | null;
  delivery_date: string;
  delivery_note_photo_path: string | null;
  status: 'pending' | 'accepted' | 'refused' | 'partial';
  refusal_reason: string | null;
  refusal_photo_path: string | null;
  recorded_by: string | null;
  recorded_at: string;
  local_id: string | null;
  synced_at: string | null;
  blockchain_hash: string | null;
  created_at: string;
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  product_name: string;
  category: string | null;
  temperature: number | null;
  temperature_compliant: boolean | null;
  dlc: string | null;
  dlc_compliant: boolean | null;
  lot_number: string | null;
  packaging_ok: boolean;
  visual_ok: boolean;
  photo_paths: string[] | null;
  notes: string | null;
  created_at: string;
}

export interface CleaningTask {
  id: string;
  establishment_id: string;
  zone: string;
  zone_name: string;
  frequency: 'daily' | 'per_service' | 'weekly' | 'monthly';
  is_active: boolean;
  created_at: string;
}

export interface CleaningRecord {
  id: string;
  task_id: string;
  establishment_id: string;
  cleaning_product: string | null;
  dosage: string | null;
  contact_time_minutes: number | null;
  photo_path: string | null;
  validated_by: string | null;
  validated_at: string;
  scheduled_at: string | null;
  is_late: boolean;
  local_id: string | null;
  synced_at: string | null;
  created_at: string;
}

export interface ProductInStock {
  id: string;
  establishment_id: string;
  product_name: string;
  category: string | null;
  dlc_primary: string | null;
  dlc_secondary: string | null;
  opened_at: string | null;
  lot_number: string | null;
  supplier_id: string | null;
  status: 'in_stock' | 'opened' | 'destroyed' | 'consumed';
  destruction_reason: string | null;
  destruction_photo_path: string | null;
  destroyed_at: string | null;
  local_id: string | null;
  synced_at: string | null;
  created_at: string;
}

export interface OilControl {
  id: string;
  establishment_id: string;
  equipment_id: string;
  control_type: 'tpm_test' | 'oil_change' | 'filtration' | 'waste_removal';
  tpm_value: number | null;
  tpm_compliant: boolean | null;
  photo_path: string | null;
  waste_collector: string | null;
  waste_receipt_photo_path: string | null;
  recorded_by: string | null;
  recorded_at: string;
  local_id: string | null;
  synced_at: string | null;
  created_at: string;
}

export interface PestControl {
  id: string;
  establishment_id: string;
  control_type: 'daily_check' | 'pest_sighting' | 'intervention_report';
  checkpoint_name: string | null;
  is_anomaly: boolean;
  pest_type: string | null;
  location_description: string | null;
  photo_path: string | null;
  intervention_date: string | null;
  service_provider: string | null;
  next_visit_date: string | null;
  recorded_by: string | null;
  recorded_at: string;
  local_id: string | null;
  synced_at: string | null;
  created_at: string;
}

export interface BlockchainQueue {
  id: string;
  establishment_id: string;
  record_type: string;
  record_id: string;
  data_hash: string;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  tx_hash: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface DDPPReport {
  id: string;
  establishment_id: string;
  report_date: string;
  period_start: string;
  period_end: string;
  pdf_path: string | null;
  qr_code_verification: string | null;
  generated_by: string | null;
  generated_at: string;
}

export interface SyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: string;
  photo_paths: string | null;
  status: 'pending' | 'synced' | 'error';
  retry_count: number;
  created_at: string;
  synced_at: string | null;
  error_message: string | null;
}
