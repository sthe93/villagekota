alter table public.app_content_settings
  add column if not exists trust_badge_eta_text text not null default '30 min delivery',
  add column if not exists trust_badge_quality_text text not null default 'Quality guaranteed',
  add column if not exists trust_badge_rating_text text not null default '4.9★ average rating';

update public.app_content_settings
set
  trust_badge_eta_text = coalesce(nullif(trust_badge_eta_text, ''), '30 min delivery'),
  trust_badge_quality_text = coalesce(nullif(trust_badge_quality_text, ''), 'Quality guaranteed'),
  trust_badge_rating_text = coalesce(nullif(trust_badge_rating_text, ''), '4.9★ average rating')
where id = 1;
