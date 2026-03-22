ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_confirmation_code text,
  ADD COLUMN IF NOT EXISTS delivery_confirmation_verified_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_delivery_confirmation_code_format'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_confirmation_code_format
      CHECK (
        delivery_confirmation_code IS NULL
        OR delivery_confirmation_code ~ '^[0-9]{4}$'
      );
  END IF;
END $$;

UPDATE public.orders
SET delivery_confirmation_code = lpad((floor(random() * 10000))::int::text, 4, '0')
WHERE delivery_confirmation_code IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN delivery_confirmation_code SET NOT NULL;

CREATE OR REPLACE FUNCTION public.complete_delivery_order_with_code(
  p_order_id uuid,
  p_driver_id uuid,
  p_confirmation_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := left(regexp_replace(coalesce(p_confirmation_code, ''), '\D', '', 'g'), 4);
BEGIN
  IF v_code = '' OR length(v_code) <> 4 THEN
    RETURN false;
  END IF;

  UPDATE public.orders
  SET
    status = 'delivered',
    delivered_at = COALESCE(delivered_at, now()),
    delivery_confirmation_verified_at = now(),
    updated_at = now()
  WHERE id = p_order_id
    AND driver_id = p_driver_id
    AND status = 'arrived'
    AND delivery_confirmation_code = v_code
    AND (
      lower(coalesce(payment_method, '')) <> 'cash'
      OR coalesce(cash_collected, false)
    );

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_delivery_order_with_code(uuid, uuid, text) TO authenticated;
