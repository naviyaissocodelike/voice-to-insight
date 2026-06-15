-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Master contact record (one row per person)
create table if not exists investors (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text unique,
  phone        text,
  linkedin_url text,
  summary      text,          -- AI-regenerated rolling summary
  tags         text[] default '{}',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Interaction log (append-only, one row per event)
create table if not exists crm_updates (
  id               uuid primary key default gen_random_uuid(),
  investor_id      uuid not null references investors(id) on delete cascade,
  event_type       text not null default 'Meeting',
  event_date       date not null,
  raw_input        text,
  source_url       text,
  summary          text,
  personal_details text,
  key_topics       text[] default '{}',
  follow_ups       text[] default '{}',
  next_steps       jsonb  default '[]',
  follow_up_date   date,
  tags             text[] default '{}',
  created_by_id    uuid references auth.users(id),
  created_by_email text,
  created_at       timestamptz default now()
);

-- Indexes for common lookups
create index if not exists investors_email_idx    on investors(email);
create index if not exists crm_updates_investor   on crm_updates(investor_id);
create index if not exists crm_updates_event_date on crm_updates(event_date desc);

-- Row-level security: any authenticated team member can read/write everything
alter table investors   enable row level security;
alter table crm_updates enable row level security;

create policy "Authenticated team access — investors"
  on investors for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated team access — crm_updates"
  on crm_updates for all
  to authenticated
  using (true)
  with check (true);
