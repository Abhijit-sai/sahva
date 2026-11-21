create schema if not exists sahva;
revoke all on schema sahva from public;
create table if not exists sahva.rooms (
  id uuid primary key, title text not null, invite_hash text not null,
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now(), ended_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create table if not exists sahva.participants (
  id uuid primary key, room_id uuid not null references sahva.rooms on delete cascade,
  seat integer not null check (seat in (1,2)), name text not null,
  listening text not null check (listening in ('en-IN','te-IN')),
  speaking text not null check (speaking in ('en-IN','te-IN')),
  consented_at timestamptz, consent_version text not null, last_seen timestamptz not null default now(),
  unique(room_id,seat), unique(room_id,id)
);
