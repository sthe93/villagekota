ALTER TABLE public.vouchers
DROP CONSTRAINT IF EXISTS vouchers_provider_check;

ALTER TABLE public.vouchers
ADD CONSTRAINT vouchers_provider_check
CHECK (provider IN ('one_voucher', 'ott_voucher', 'blu_voucher', 'instant_money'));
