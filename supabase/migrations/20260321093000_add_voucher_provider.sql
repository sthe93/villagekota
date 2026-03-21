ALTER TABLE public.vouchers
ADD COLUMN IF NOT EXISTS provider text
CHECK (provider IN ('ott_voucher', 'blu_voucher', 'instant_money'));
