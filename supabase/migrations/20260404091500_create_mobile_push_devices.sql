create table if not exists public.mobile_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('customer', 'driver', 'admin')),
  platform text not null check (platform in ('ios', 'android')),
  token text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists mobile_push_devices_user_id_idx on public.mobile_push_devices(user_id);
create index if not exists mobile_push_devices_role_idx on public.mobile_push_devices(role);
create index if not exists mobile_push_devices_enabled_idx on public.mobile_push_devices(enabled);

create trigger set_mobile_push_devices_updated_at
before update on public.mobile_push_devices
for each row execute procedure public.update_updated_at_column();

alter table public.mobile_push_devices enable row level security;

create policy "Users can view own push devices"
on public.mobile_push_devices
for select
using (auth.uid() = user_id);
