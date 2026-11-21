create table if not exists sahva.meeting_records (
  room_id uuid primary key references sahva.rooms on delete cascade,
  fingerprint text not null, canonical jsonb, telugu jsonb, skipped int not null default 0,
  lease uuid, lease_until timestamptz, error text, attempts int not null default 0,
  version int not null default 1, created_at timestamptz not null default now()
);
