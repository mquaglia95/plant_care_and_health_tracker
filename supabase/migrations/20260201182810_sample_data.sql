-- A. Create the Auth Users first (The internal Supabase layer)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'charlie@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- B. Ensure they have identities (Required for Supabase Auth to recognize them)
INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', format('{"sub":"%s","email":"%s"}','11111111-1111-1111-1111-111111111111','alice@example.com')::jsonb, 'email', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', format('{"sub":"%s","email":"%s"}','22222222-2222-2222-2222-222222222222','bob@example.com')::jsonb, 'email', now(), now(), now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', format('{"sub":"%s","email":"%s"}','33333333-3333-3333-3333-333333333333','charlie@example.com')::jsonb, 'email', now(), now(), now())
ON CONFLICT DO NOTHING;

-- 1. Create Three Distinct Users
INSERT INTO public.profiles (id, full_name, unit_preference)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Alice Green', 'metric'),
  ('22222222-2222-2222-2222-222222222222', 'Bob Bloom', 'imperial'),
  ('33333333-3333-3333-3333-333333333333', 'Charlie Cactus', 'metric')
ON CONFLICT (id) DO NOTHING;

-- 2. Give each user 15 random plants (45 total)
-- This pulls random species from your existing species_dim
INSERT INTO public.my_plants_dim (user_id, species_id, nickname, location_of_plant, pot_size_in)
SELECT 
    u.id,
    (SELECT species_id FROM public.species_dim ORDER BY random() LIMIT 1),
    'Plant ' || i,
    (ARRAY['Kitchen', 'Balcony', 'Office', 'Bedroom'])[floor(random()*4)+1],
    floor(random()*12)+4
FROM 
    public.profiles u, 
    generate_series(1, 15) as i
WHERE u.full_name IN ('Alice Green', 'Bob Bloom', 'Charlie Cactus');

-- 3. Create 5-10 History Logs for EVERY plant created above
-- We generate a random date between 1 year ago and today
INSERT INTO public.plant_facts (plant_id, event_type, plant_height_in, note_text)
SELECT 
    m.plant_id,
    (ARRAY['watered', 'fertilized', 'measured', 'replanted'])[floor(random()*4)+1],
    (CASE WHEN random() > 0.5 THEN floor(random()*20)+5 ELSE NULL END),
    'Random maintenance log entry'
FROM 
    public.my_plants_dim m,
    generate_series(1, floor(random()*5)+5) as s; -- 5 to 10 logs per plant