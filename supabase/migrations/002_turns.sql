create table if not exists sahva.turns (
  id uuid primary key, room_id uuid not null references sahva.rooms on delete cascade,
  speaker_id uuid not null, seq int not null, idem uuid not null, mime text not null, duration_ms int not null check (duration_ms between 1 and 30000),
  original_key text not null, created_at timestamptz not null default now(),
  source text, raw_text text, target text not null, revision int not null default 0,
  stage text not null default 'stt' check(stage in ('stt','translation','tts','ready')),
  error text, retries int not null default 0, lease uuid, lease_until timestamptz,
  timings jsonb not null default '{}', unique(room_id,seq), unique(room_id,speaker_id,idem),
  foreign key(room_id,speaker_id) references sahva.participants(room_id,id)
);
create table if not exists sahva.revisions (
  turn_id uuid not null references sahva.turns on delete cascade, num int not null, text text not null,
  author uuid not null references sahva.participants, created_at timestamptz not null default now(), primary key(turn_id,num)
);
create table if not exists sahva.deliveries (
  turn_id uuid not null references sahva.turns on delete cascade, revision int not null,
  target text not null, text text not null, audio_key text, primary key(turn_id,revision,target)
);
