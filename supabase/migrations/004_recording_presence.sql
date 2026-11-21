alter table sahva.participants add column if not exists recording_key uuid;
alter table sahva.participants add column if not exists recording_until timestamptz;
