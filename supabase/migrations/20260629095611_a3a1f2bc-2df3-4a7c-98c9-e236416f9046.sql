
-- Storage policies for raum-fotos: scoped to current betrieb via path prefix {betrieb_id}/...
CREATE POLICY "raum_fotos_select_own_betrieb" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'raum-fotos' AND (storage.foldername(name))[1] = public.current_betrieb_id()::text);

CREATE POLICY "raum_fotos_insert_own_betrieb" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'raum-fotos' AND (storage.foldername(name))[1] = public.current_betrieb_id()::text);

CREATE POLICY "raum_fotos_update_own_betrieb" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'raum-fotos' AND (storage.foldername(name))[1] = public.current_betrieb_id()::text);

CREATE POLICY "raum_fotos_delete_own_betrieb" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'raum-fotos' AND (storage.foldername(name))[1] = public.current_betrieb_id()::text);
