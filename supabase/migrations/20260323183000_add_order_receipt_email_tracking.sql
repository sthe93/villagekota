ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS receipt_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_email_error text;
