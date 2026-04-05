create table if not exists public.push_dispatch_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  state text not null default 'pending' check (state in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_dispatch_queue_state_next_attempt_idx
  on public.push_dispatch_queue(state, next_attempt_at);
create index if not exists push_dispatch_queue_user_id_idx
  on public.push_dispatch_queue(user_id);
create index if not exists push_dispatch_queue_order_id_idx
  on public.push_dispatch_queue(order_id);

create trigger set_push_dispatch_queue_updated_at
before update on public.push_dispatch_queue
for each row execute procedure public.update_updated_at_column();

alter table public.push_dispatch_queue enable row level security;

create policy "Users can view own push queue records"
on public.push_dispatch_queue
for select
using (auth.uid() = user_id);
