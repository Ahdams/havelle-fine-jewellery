alter table public.orders add column if not exists payment_receipt_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('havelle-payment-receipts', 'havelle-payment-receipts', false, 4194304, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 4194304, allowed_mime_types = excluded.allowed_mime_types;

create policy "Havelle admins can view payment receipts"
on storage.objects for select to authenticated
using (bucket_id = 'havelle-payment-receipts' and (select private.is_havelle_admin()));
