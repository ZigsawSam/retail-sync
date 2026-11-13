BEGIN;
CREATE OR REPLACE FUNCTION public.create_purchase_with_logistics(p_purchase jsonb)
RETURNS public.purchases
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_owner uuid; v_row public.purchases%ROWTYPE; v_transporter uuid;
 v_freight numeric; v_freight_paid numeric; v_name text; v_source text; v_mode text;
 v_request_id uuid; v_existing_purchase_id text;
 v_items jsonb := '[]'::jsonb; v_item jsonb; v_product jsonb; v_product_id text; v_new_item jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 v_owner:=auth.uid();
 IF NOT EXISTS(SELECT 1 FROM public.settings WHERE id=v_owner::text) THEN RAISE EXCEPTION 'Only the shop owner can record purchases'; END IF;
 v_request_id:=nullif(p_purchase->>'request_id','')::uuid;
 IF v_request_id IS NULL THEN RAISE EXCEPTION 'Purchase request ID is required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text||':purchase:'||v_request_id::text,0));
 SELECT purchase_id INTO v_existing_purchase_id FROM public.purchase_request_keys WHERE "userId"=v_owner::text AND request_id=v_request_id;
 IF v_existing_purchase_id IS NOT NULL THEN
  SELECT * INTO v_row FROM public.purchases WHERE id=v_existing_purchase_id AND "userId"=v_owner::text;
  IF NOT FOUND THEN RAISE EXCEPTION 'Previously submitted purchase record is unavailable'; END IF;
  RETURN v_row;
 END IF;
 IF jsonb_typeof(p_purchase->'items')<>'array' OR jsonb_array_length(p_purchase->'items')=0 THEN RAISE EXCEPTION 'Add at least one purchase item'; END IF;
 -- Create new catalogue identities only at final save. This is inside the same
 -- transaction as stock intake, invoice, supplier payment and freight payment.
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_purchase->'items') LOOP
  IF v_item ? 'newProduct' AND jsonb_typeof(v_item->'newProduct')='object' THEN
   v_product:=v_item->'newProduct';
   IF nullif(trim(v_product->>'name'),'') IS NULL THEN RAISE EXCEPTION 'New product name is required'; END IF;
   IF nullif(trim(v_product->>'purchaseUnit'),'') IS NULL OR nullif(trim(v_product->>'baseUnit'),'') IS NULL THEN RAISE EXCEPTION 'Both units are required'; END IF;
   INSERT INTO public.products
   SELECT (jsonb_populate_record(NULL::public.products,jsonb_build_object(
    'id',gen_random_uuid()::text,'userId',v_owner::text,'name',trim(v_product->>'name'),
    'category',COALESCE(NULLIF(trim(v_product->>'category'),''),'Other'),
    'purchasePrice',(v_item->>'purchasePrice')::numeric,'sellingPrice',(v_product->>'sellingPrice')::numeric,
    'quantity',0,'barcode',COALESCE(NULLIF(trim(v_product->>'barcode'),''),'SKU-'||gen_random_uuid()::text),
    'lowStockLimit',5,'overstockLimit',40,'purchase_unit',trim(v_product->>'purchaseUnit'),
    'base_unit',trim(v_product->>'baseUnit'),'units_per_purchase_unit',(v_product->>'unitsPerPurchaseUnit')::integer
   ))).* RETURNING id::text INTO v_product_id;
   v_new_item:=v_item-'newProduct';
   v_new_item:=jsonb_set(v_new_item,'{productId}',to_jsonb(v_product_id),true);
   v_items:=v_items||jsonb_build_array(v_new_item);
  ELSE
   IF nullif(v_item->>'productId','') IS NULL THEN RAISE EXCEPTION 'Purchase item product is missing'; END IF;
   v_items:=v_items||jsonb_build_array(v_item);
  END IF;
 END LOOP;
 v_transporter:=nullif(p_purchase->>'transporter_id','')::uuid;
 v_freight:=COALESCE((p_purchase->>'freight_amount')::numeric,0);
 v_freight_paid:=COALESCE((p_purchase->>'freight_paid_amount')::numeric,0);
 IF v_freight<0 OR v_freight_paid<0 OR v_freight_paid>v_freight THEN RAISE EXCEPTION 'Check freight and freight paid amounts'; END IF;
 IF v_freight>0 AND v_transporter IS NULL THEN RAISE EXCEPTION 'Select a transporter for separate delivery charges'; END IF;
 IF v_transporter IS NOT NULL THEN
  SELECT name INTO v_name FROM public.transporters WHERE id=v_transporter AND "userId"=v_owner::text;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transporter not found'; END IF;
 END IF;
 v_source:=COALESCE(NULLIF(p_purchase->>'purchase_source',''),'Direct');
 IF v_source NOT IN ('Direct','Agent-assisted') THEN RAISE EXCEPTION 'Invalid purchase source'; END IF;
 v_mode:=nullif(trim(p_purchase->>'delivery_mode'),'');
 v_row:=public.create_purchase(jsonb_set(p_purchase,'{items}',v_items,true));
 UPDATE public.purchases SET purchase_source=v_source,delivery_mode=v_mode,transporter_id=v_transporter,
  transporter_name=v_name,freight_amount=v_freight,freight_paid_amount=v_freight_paid,freight_due_amount=v_freight-v_freight_paid
 WHERE id=v_row.id AND "userId"=v_owner::text RETURNING * INTO v_row;
 IF v_freight_paid>0 THEN
  INSERT INTO public.transporter_payments("userId",transporter_id,amount,payment_method,notes)
  VALUES(v_owner::text,v_transporter,v_freight_paid,COALESCE(NULLIF(p_purchase->>'freight_payment_method',''),'Cash'),'Initial freight payment for purchase '||v_row.id);
 END IF;
 INSERT INTO public.purchase_request_keys("userId",request_id,purchase_id) VALUES(v_owner::text,v_request_id,v_row.id);
 RETURN v_row;
END; $$;
REVOKE ALL ON FUNCTION public.create_purchase_with_logistics(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_purchase_with_logistics(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;