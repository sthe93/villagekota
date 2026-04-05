alter table public.app_content_settings
  add column if not exists offer_banner_text text not null default 'for 20% off your first order',
  add column if not exists offer_banner_code text not null default 'MZANSI20';

update public.app_content_settings
set
  offer_banner_text = coalesce(nullif(offer_banner_text, ''), 'for 20% off your first order'),
  offer_banner_code = coalesce(nullif(offer_banner_code, ''), 'MZANSI20')
where id = 1;
