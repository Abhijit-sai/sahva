alter table sahva.participants drop constraint participants_listening_check, drop constraint participants_speaking_check,
  add check (listening in ('en-IN','te-IN','hi-IN','af','ak','sq','am','ar','hy','az','eu','be','bn','bg','my','ca','zh-Hans','zh-Hant','hr','cs','da','nl','et','fil','fi','fr','gl','ka','de','el','gu','ha','he','hu','is','id','it','ja','jv','kn','kk','km','rw','ko','lo','lv','lt','mk','ms','ml','mr','mn','ne','no','fa','pl','pt-BR','pt-PT','pa','ro','ru','sr','sd','si','sk','sl','es','su','sw','sv','ta','th','tr','uk','ur','uz','vi','zu')),
  add check (speaking in ('en-IN','te-IN','hi-IN','af','ak','sq','am','ar','hy','az','eu','be','bn','bg','my','ca','zh-Hans','zh-Hant','hr','cs','da','nl','et','fil','fi','fr','gl','ka','de','el','gu','ha','he','hu','is','id','it','ja','jv','kn','kk','km','rw','ko','lo','lv','lt','mk','ms','ml','mr','mn','ne','no','fa','pl','pt-BR','pt-PT','pa','ro','ru','sr','sd','si','sk','sl','es','su','sw','sv','ta','th','tr','uk','ur','uz','vi','zu'));
create table sahva.meeting_replays (
  id uuid primary key, room_id uuid not null references sahva.rooms on delete cascade,
  speaker_id uuid not null, listener_id uuid not null, epoch int not null, source_track text not null,
  target text not null, started_at timestamptz not null, duration_ms integer not null check(duration_ms between 1 and 30000),
  audio_key text not null unique, provider text not null, caption text,
  foreign key(room_id,speaker_id) references sahva.participants(room_id,id),
  foreign key(room_id,listener_id) references sahva.participants(room_id,id)
);
create index meeting_replays_listener on sahva.meeting_replays(room_id,listener_id,started_at);
alter table sahva.meeting_replays enable row level security;
