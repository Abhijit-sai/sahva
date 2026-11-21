-- Run on the intended Supabase project. Existing public buckets must be made private before use.
insert into storage.buckets(id,name,public,file_size_limit)
values ('room-original-audio','room-original-audio',false,4000000),
       ('room-translated-audio','room-translated-audio',false,10000000)
on conflict(id) do nothing;
do $$
begin
  if exists (select 1 from storage.buckets where id in ('room-original-audio','room-translated-audio') and public) then
    raise exception 'Sahva requires private audio buckets';
  end if;
end $$;
