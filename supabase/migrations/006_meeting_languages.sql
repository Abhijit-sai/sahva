alter table sahva.participants drop constraint if exists participants_listening_check,
  drop constraint if exists participants_speaking_check,
  add constraint participants_listening_check check (listening in ('en-IN','te-IN','hi-IN')),
  add constraint participants_speaking_check check (speaking in ('en-IN','te-IN','hi-IN'));

alter table sahva.deliveries add column if not exists timings jsonb not null default '{}';
