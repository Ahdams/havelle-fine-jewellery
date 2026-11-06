drop policy "Public can read Havelle shop settings" on public.shop_settings;
create policy "Public can read Havelle shop settings"
on public.shop_settings for select to anon
using (id = true);
