alter table sahva.rooms add column if not exists transport text not null default 'phrase' check (transport in ('phrase','livekit'));
alter table sahva.rooms add column if not exists media_epoch integer not null default 0;
alter table sahva.participants drop constraint if exists participants_seat_check;
alter table sahva.participants add constraint participants_seat_check check (seat between 1 and 6);
