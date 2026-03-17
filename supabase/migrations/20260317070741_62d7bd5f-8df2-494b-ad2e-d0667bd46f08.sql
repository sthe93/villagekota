
-- Vouchers table for discount codes and prepaid vouchers
CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('discount_percentage', 'discount_fixed', 'prepaid')),
  value numeric NOT NULL,
  balance numeric DEFAULT 0,
  min_order numeric DEFAULT 0,
  max_uses integer DEFAULT NULL,
  used_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  expires_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Track voucher redemptions
CREATE TABLE public.voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid REFERENCES public.vouchers(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add discount and stripe columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS voucher_code text DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stripe_session_id text DEFAULT NULL;

-- RLS for vouchers
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vouchers viewable by everyone" ON public.vouchers FOR SELECT USING (true);
CREATE POLICY "Admins can manage vouchers" ON public.vouchers FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS for voucher_redemptions
ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create redemptions" ON public.voucher_redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own redemptions" ON public.voucher_redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all redemptions" ON public.voucher_redemptions FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Seed sample vouchers
INSERT INTO public.vouchers (code, type, value, balance, max_uses) VALUES
  ('WELCOME10', 'discount_percentage', 10, 0, NULL),
  ('SAVE20', 'discount_fixed', 20, 0, NULL),
  ('GIFT100', 'prepaid', 100, 100, 1);
