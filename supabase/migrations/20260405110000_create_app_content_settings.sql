create table if not exists public.app_content_settings (
  id integer primary key,
  brand_name text not null,
  footer_description text not null,
  contact_address text not null,
  contact_phone text not null,
  contact_email text not null,
  business_hours text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_content_settings (
  id,
  brand_name,
  footer_description,
  contact_address,
  contact_phone,
  contact_email,
  business_hours
)
values (
  1,
  'Village Eats',
  'Village Eats brings together bold local flavour, comfort food favourites, and everyday meal options in one elevated delivery experience.',
  '123 Durban Road, Johannesburg, 2000',
  '+27 11 234 5678',
  'hello@villageeats.co.za',
  'Mon – Sun: 10:00 – 22:00'
)
on conflict (id) do nothing;

create trigger set_app_content_settings_updated_at
before update on public.app_content_settings
for each row execute procedure public.update_updated_at_column();

alter table public.app_content_settings enable row level security;

create policy "Public can read app content settings"
on public.app_content_settings
for select
using (true);

create policy "Admins can insert app content settings"
on public.app_content_settings
for insert
with check (
  exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
  )
);

create policy "Admins can update app content settings"
on public.app_content_settings
for update
using (
  exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
  )
);
