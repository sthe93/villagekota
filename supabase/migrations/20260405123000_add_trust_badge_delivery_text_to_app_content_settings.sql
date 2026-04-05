alter table public.app_content_settings
  add column if not exists trust_badge_delivery_text text not null default 'Free delivery over R150';

update public.app_content_settings
set trust_badge_delivery_text = coalesce(nullif(trust_badge_delivery_text, ''), 'Free delivery over R150')
where id = 1;
