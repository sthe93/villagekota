import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppContentSettings {
  brand_name: string;
  footer_description: string;
  contact_address: string;
  contact_phone: string;
  contact_email: string;
  business_hours: string;
  hero_badge_text: string;
  hero_title_text: string;
  hero_subtitle_text: string;
  hero_primary_cta_text: string;
  offer_banner_text: string;
  offer_banner_code: string;
  trust_badge_delivery_text: string;
  trust_badge_eta_text: string;
  trust_badge_quality_text: string;
  trust_badge_rating_text: string;
}

export const DEFAULT_APP_CONTENT_SETTINGS: AppContentSettings = {
  brand_name: "Village Eats",
  footer_description:
    "Village Eats brings together bold local flavour, comfort food favourites, and everyday meal options in one elevated delivery experience.",
  contact_address: "123 Durban Road, Johannesburg, 2000",
  contact_phone: "+27 11 234 5678",
  contact_email: "hello@villageeats.co.za",
  business_hours: "Mon – Sun: 10:00 – 22:00",
  hero_badge_text: "🔥 Premium chow, Joburg style",
  hero_title_text: "VILLAGE EATS, MZANSI FAVOURITES",
  hero_subtitle_text: "Kota energy, bunny classics, and premium local flavour — delivered fast to your door.",
  hero_primary_cta_text: "Order Chow",
  offer_banner_text: "for 20% off your first order",
  offer_banner_code: "MZANSI20",
  trust_badge_delivery_text: "Free delivery over R150",
  trust_badge_eta_text: "30 min delivery",
  trust_badge_quality_text: "Quality guaranteed",
  trust_badge_rating_text: "4.9★ average rating",
};

function normalizeSettings(data: Partial<AppContentSettings> | null | undefined): AppContentSettings {
  return {
    brand_name: data?.brand_name?.trim() || DEFAULT_APP_CONTENT_SETTINGS.brand_name,
    footer_description:
      data?.footer_description?.trim() || DEFAULT_APP_CONTENT_SETTINGS.footer_description,
    contact_address: data?.contact_address?.trim() || DEFAULT_APP_CONTENT_SETTINGS.contact_address,
    contact_phone: data?.contact_phone?.trim() || DEFAULT_APP_CONTENT_SETTINGS.contact_phone,
    contact_email: data?.contact_email?.trim() || DEFAULT_APP_CONTENT_SETTINGS.contact_email,
    business_hours: data?.business_hours?.trim() || DEFAULT_APP_CONTENT_SETTINGS.business_hours,
    hero_badge_text: data?.hero_badge_text?.trim() || DEFAULT_APP_CONTENT_SETTINGS.hero_badge_text,
    hero_title_text: data?.hero_title_text?.trim() || DEFAULT_APP_CONTENT_SETTINGS.hero_title_text,
    hero_subtitle_text:
      data?.hero_subtitle_text?.trim() || DEFAULT_APP_CONTENT_SETTINGS.hero_subtitle_text,
    hero_primary_cta_text:
      data?.hero_primary_cta_text?.trim() || DEFAULT_APP_CONTENT_SETTINGS.hero_primary_cta_text,
    offer_banner_text: data?.offer_banner_text?.trim() || DEFAULT_APP_CONTENT_SETTINGS.offer_banner_text,
    offer_banner_code: data?.offer_banner_code?.trim() || DEFAULT_APP_CONTENT_SETTINGS.offer_banner_code,
    trust_badge_delivery_text:
      data?.trust_badge_delivery_text?.trim() || DEFAULT_APP_CONTENT_SETTINGS.trust_badge_delivery_text,
    trust_badge_eta_text:
      data?.trust_badge_eta_text?.trim() || DEFAULT_APP_CONTENT_SETTINGS.trust_badge_eta_text,
    trust_badge_quality_text:
      data?.trust_badge_quality_text?.trim() || DEFAULT_APP_CONTENT_SETTINGS.trust_badge_quality_text,
    trust_badge_rating_text:
      data?.trust_badge_rating_text?.trim() || DEFAULT_APP_CONTENT_SETTINGS.trust_badge_rating_text,
  };
}

export async function fetchPublicAppContentSettings() {
  const { data, error } = await supabase
    .from("app_content_settings" as never)
    .select(
      "brand_name, footer_description, contact_address, contact_phone, contact_email, business_hours, hero_badge_text, hero_title_text, hero_subtitle_text, hero_primary_cta_text, offer_banner_text, offer_banner_code, trust_badge_delivery_text, trust_badge_eta_text, trust_badge_quality_text, trust_badge_rating_text"
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.warn("Failed to load app content settings", error.message);
    return DEFAULT_APP_CONTENT_SETTINGS;
  }

  return normalizeSettings((data ?? null) as Partial<AppContentSettings> | null);
}

export function usePublicAppContentSettings() {
  const [settings, setSettings] = useState<AppContentSettings>(DEFAULT_APP_CONTENT_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    void fetchPublicAppContentSettings().then((next) => {
      if (!cancelled) setSettings(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
