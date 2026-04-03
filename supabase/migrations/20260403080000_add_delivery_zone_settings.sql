CREATE TABLE IF NOT EXISTS public.delivery_zone_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name TEXT NOT NULL DEFAULT 'Star Village',
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL CHECK (radius_meters > 0),
  address_pattern TEXT NOT NULL DEFAULT '\\bstar\\s+village\\b',
  out_of_zone_message TEXT NOT NULL DEFAULT 'We currently deliver only to addresses inside Star Village.',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_zone_settings_single_active_idx
  ON public.delivery_zone_settings ((is_active))
  WHERE is_active;

CREATE OR REPLACE FUNCTION public.set_delivery_zone_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS delivery_zone_settings_set_updated_at ON public.delivery_zone_settings;
CREATE TRIGGER delivery_zone_settings_set_updated_at
BEFORE UPDATE ON public.delivery_zone_settings
FOR EACH ROW EXECUTE FUNCTION public.set_delivery_zone_settings_updated_at();

ALTER TABLE public.delivery_zone_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'delivery_zone_settings'
      AND policyname = 'Authenticated users can read delivery zone settings'
  ) THEN
    CREATE POLICY "Authenticated users can read delivery zone settings"
      ON public.delivery_zone_settings
      FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'delivery_zone_settings'
      AND policyname = 'Admins can manage delivery zone settings'
  ) THEN
    CREATE POLICY "Admins can manage delivery zone settings"
      ON public.delivery_zone_settings
      FOR ALL
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

INSERT INTO public.delivery_zone_settings (
  zone_name,
  center_lat,
  center_lng,
  radius_meters,
  address_pattern,
  out_of_zone_message,
  is_active
)
SELECT
  'Star Village',
  -26.2856,
  27.7594,
  2200,
  '\\bstar\\s+village\\b',
  'We currently deliver only to addresses inside Star Village.',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zone_settings WHERE is_active = true);
