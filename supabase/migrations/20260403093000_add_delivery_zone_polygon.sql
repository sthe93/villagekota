ALTER TABLE public.delivery_zone_settings
ADD COLUMN IF NOT EXISTS polygon_coordinates JSONB;

COMMENT ON COLUMN public.delivery_zone_settings.polygon_coordinates IS
'Optional polygon geofence coordinates as JSON array of [lat,lng] points.';
