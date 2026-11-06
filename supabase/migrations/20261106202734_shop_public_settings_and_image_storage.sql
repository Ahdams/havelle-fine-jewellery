insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('havelle-products', 'havelle-products', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read Havelle shop settings"
on public.shop_settings for select to anon, authenticated
using (id = true);

create policy "Public can view Havelle product images"
on storage.objects for select to anon, authenticated
using (bucket_id = 'havelle-products');

create policy "Havelle admins can upload product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'havelle-products' and (select private.is_havelle_admin()));

grant usage on schema private to anon, authenticated;
grant execute on function private.is_havelle_admin() to anon, authenticated;

create or replace function public.is_havelle_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_havelle_admin();
$$;

grant execute on function public.is_havelle_admin() to anon, authenticated;
