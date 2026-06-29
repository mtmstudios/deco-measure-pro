
ALTER TABLE public.leistung_katalog
  ADD CONSTRAINT leistung_katalog_betrieb_code_unique UNIQUE (betrieb_id, code);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'tim@mtmstudios.de',
  crypt('Aufmass2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"betrieb_name":"Deco & More","name":"Tim"}'::jsonb,
  now(), now(), '', '', '', ''
);
