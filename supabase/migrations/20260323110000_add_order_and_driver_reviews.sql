ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_order_product_unique
  ON public.reviews (user_id, order_id, product_id)
  WHERE order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.driver_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_reviews_order_user_unique UNIQUE (order_id, user_id)
);

ALTER TABLE public.driver_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers and drivers can view relevant driver reviews"
  ON public.driver_reviews
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.drivers
      WHERE drivers.id = driver_reviews.driver_id
        AND drivers.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own driver reviews"
  ON public.driver_reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.orders
      WHERE orders.id = driver_reviews.order_id
        AND orders.user_id = auth.uid()
        AND orders.status = 'delivered'
        AND orders.driver_id = driver_reviews.driver_id
    )
  );

CREATE POLICY "Users can update own driver reviews"
  ON public.driver_reviews
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.orders
      WHERE orders.id = driver_reviews.order_id
        AND orders.user_id = auth.uid()
        AND orders.status = 'delivered'
        AND orders.driver_id = driver_reviews.driver_id
    )
  );

CREATE POLICY "Users can delete own driver reviews"
  ON public.driver_reviews
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.refresh_product_review_summary(target_product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET
    rating = COALESCE((
      SELECT ROUND(AVG(reviews.rating)::numeric, 1)
      FROM public.reviews
      WHERE reviews.product_id = target_product_id
    ), 0),
    review_count = (
      SELECT COUNT(*)::INT
      FROM public.reviews
      WHERE reviews.product_id = target_product_id
    ),
    updated_at = now()
  WHERE products.id = target_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_product_review_summary_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.product_id IS NOT NULL THEN
    PERFORM public.refresh_product_review_summary(NEW.product_id);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.product_id IS NOT NULL AND (TG_OP = 'DELETE' OR OLD.product_id IS DISTINCT FROM NEW.product_id) THEN
    PERFORM public.refresh_product_review_summary(OLD.product_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS refresh_product_review_summary_on_change ON public.reviews;
CREATE TRIGGER refresh_product_review_summary_on_change
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.handle_product_review_summary_change();

CREATE OR REPLACE FUNCTION public.refresh_driver_review_summary(target_driver_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.drivers
  SET
    rating = COALESCE((
      SELECT ROUND(AVG(driver_reviews.rating)::numeric, 1)
      FROM public.driver_reviews
      WHERE driver_reviews.driver_id = target_driver_id
    ), 0),
    review_count = (
      SELECT COUNT(*)::INT
      FROM public.driver_reviews
      WHERE driver_reviews.driver_id = target_driver_id
    )
  WHERE drivers.id = target_driver_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_driver_review_summary_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.driver_id IS NOT NULL THEN
    PERFORM public.refresh_driver_review_summary(NEW.driver_id);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.driver_id IS NOT NULL AND (TG_OP = 'DELETE' OR OLD.driver_id IS DISTINCT FROM NEW.driver_id) THEN
    PERFORM public.refresh_driver_review_summary(OLD.driver_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS update_driver_reviews_updated_at ON public.driver_reviews;
CREATE TRIGGER update_driver_reviews_updated_at
BEFORE UPDATE ON public.driver_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS refresh_driver_review_summary_on_change ON public.driver_reviews;
CREATE TRIGGER refresh_driver_review_summary_on_change
AFTER INSERT OR UPDATE OR DELETE ON public.driver_reviews
FOR EACH ROW
EXECUTE FUNCTION public.handle_driver_review_summary_change();

DO $$
DECLARE
  product_record RECORD;
  driver_record RECORD;
BEGIN
  FOR product_record IN SELECT id FROM public.products LOOP
    PERFORM public.refresh_product_review_summary(product_record.id);
  END LOOP;

  FOR driver_record IN SELECT id FROM public.drivers LOOP
    PERFORM public.refresh_driver_review_summary(driver_record.id);
  END LOOP;
END;
$$;
