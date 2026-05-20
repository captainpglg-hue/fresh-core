-- Backfill local_id for the two existing demo deliveries so the
-- QR codes /origine/del-meat-001 and /origine/del-fish-001 resolve.
UPDATE deliveries SET local_id = 'del-meat-001'
 WHERE id = '4d1fa320-dcaf-413f-bfbe-33540bf19438' AND local_id IS NULL;
UPDATE deliveries SET local_id = 'del-fish-001'
 WHERE id = 'ef4d6c35-997f-4f63-a9d4-06ae22b801a4' AND local_id IS NULL;

-- Consumer-facing endpoint reached by QR scan. Returns only the fields
-- a customer needs, only for accepted deliveries, never the refusal
-- photos / internal owner metadata. SECURITY DEFINER lets it bypass
-- the owner-scoped RLS while still hiding non-accepted rows.
CREATE OR REPLACE FUNCTION public.get_origine(p_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery       deliveries%ROWTYPE;
  v_supplier       suppliers%ROWTYPE;
  v_establishment  establishments%ROWTYPE;
  v_items          JSONB;
BEGIN
  SELECT * INTO v_delivery
    FROM deliveries
   WHERE (id::text = p_id OR local_id = p_id)
     AND status = 'accepted'
   ORDER BY recorded_at DESC
   LIMIT 1;

  IF v_delivery.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_delivery.supplier_id IS NOT NULL THEN
    SELECT * INTO v_supplier FROM suppliers WHERE id = v_delivery.supplier_id;
  END IF;
  SELECT * INTO v_establishment FROM establishments WHERE id = v_delivery.establishment_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id',                    di.id,
            'product_name',          di.product_name,
            'category',              di.category,
            'temperature',           di.temperature,
            'temperature_compliant', di.temperature_compliant,
            'dlc',                   di.dlc,
            'lot_number',            di.lot_number,
            'packaging_ok',          di.packaging_ok,
            'visual_ok',             di.visual_ok
          ) ORDER BY di.created_at), '[]'::jsonb)
    INTO v_items
    FROM delivery_items di
   WHERE di.delivery_id = v_delivery.id;

  RETURN jsonb_build_object(
    'delivery', jsonb_build_object(
      'id',              v_delivery.id,
      'local_id',        v_delivery.local_id,
      'delivery_date',   v_delivery.delivery_date,
      'recorded_at',     v_delivery.recorded_at,
      'status',          v_delivery.status,
      'blockchain_hash', v_delivery.blockchain_hash
    ),
    'supplier',      CASE WHEN v_supplier.id IS NULL THEN NULL ELSE jsonb_build_object(
                       'name',              v_supplier.name,
                       'sanitary_approval', v_supplier.sanitary_approval
                     ) END,
    'establishment', CASE WHEN v_establishment.id IS NULL THEN NULL ELSE jsonb_build_object(
                       'name', v_establishment.name,
                       'city', v_establishment.city
                     ) END,
    'items',         v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_origine(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_origine(TEXT) TO anon, authenticated;
