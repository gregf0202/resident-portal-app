-- 0031 Public, low-res images for notice emails (v0.38.0).
-- Email apps block data: URLs, so the building logo (96px PNG) and any notice
-- photo (720px JPEG) are uploaded here by
-- send-announcement and linked from the email. Public so mail apps can load
-- them; no SELECT policy on storage.objects, so the bucket cannot be listed.
-- Paths are <building uuid>/logo-<sha>.png and <building uuid>/notice-<id>.jpg.
-- 300 KB cap, PNG and JPEG only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('email-assets', 'email-assets', true, 307200, array['image/png','image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 307200, allowed_mime_types = array['image/png','image/jpeg'];
