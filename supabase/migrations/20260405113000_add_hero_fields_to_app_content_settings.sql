alter table public.app_content_settings
  add column if not exists hero_badge_text text not null default '🔥 Premium chow, Joburg style',
  add column if not exists hero_title_text text not null default 'VILLAGE EATS, MZANSI FAVOURITES',
  add column if not exists hero_subtitle_text text not null default 'Kota energy, bunny classics, and premium local flavour — delivered fast to your door.',
  add column if not exists hero_primary_cta_text text not null default 'Order Chow';

update public.app_content_settings
set
  hero_badge_text = coalesce(nullif(hero_badge_text, ''), '🔥 Premium chow, Joburg style'),
  hero_title_text = coalesce(nullif(hero_title_text, ''), 'VILLAGE EATS, MZANSI FAVOURITES'),
  hero_subtitle_text = coalesce(nullif(hero_subtitle_text, ''), 'Kota energy, bunny classics, and premium local flavour — delivered fast to your door.'),
  hero_primary_cta_text = coalesce(nullif(hero_primary_cta_text, ''), 'Order Chow')
where id = 1;
