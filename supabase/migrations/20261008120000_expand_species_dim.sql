-- Expand species_dim to support agent reasoning.
--
-- Context: species_dim was populated by import_species.js from the Perenual
-- API, which collapsed watering into four buckets {3,7,14,30}, stored light as
-- a comma-joined string, and hardcoded is_toxic_to_cats = true on every row.
-- That data cannot support care decisions. This migration widens the table to
-- match species_seed.json; 20261008120200_load_species_catalog.sql fills it.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.light_level as enum (
  'low',
  'low_medium',
  'medium',
  'medium_bright',
  'bright_indirect',
  'direct_sun'
);

create type public.care_difficulty as enum ('easy', 'moderate', 'hard');

create type public.growth_habit as enum (
  'upright', 'trailing', 'vining', 'climbing', 'creeping',
  'clumping', 'rosette', 'tree', 'shrub', 'epiphyte', 'globular'
);

-- ---------------------------------------------------------------------------
-- species_dim
-- ---------------------------------------------------------------------------

-- The old watering column becomes the agent's baseline, so rename rather than
-- drop: any downstream reference keeps working against the same data.
alter table public.species_dim
  rename column typical_watering_frequency_days to water_days_baseline;

-- light_requirements held Perenual's joined string ("full sun, part shade").
-- Nothing in it is worth preserving.
alter table public.species_dim
  drop column if exists light_requirements;

alter table public.species_dim
  add column slug              text,
  add column family            text,
  add column difficulty        public.care_difficulty,
  add column light             public.light_level,
  add column water_days_min    integer,
  add column water_days_max    integer,
  add column water_notes       text,
  add column humidity_min_pct  integer,
  add column temp_min_f        integer,
  add column temp_max_f        integer,
  add column fertilizer        text,
  add column soil              text,
  add column growth_habit      public.growth_habit,
  add column mature_size       text,
  add column common_problems   text[] not null default '{}',
  add column propagation       text,
  add column winter_adjustment text,
  add column updated_at        timestamptz not null default now();

create unique index species_dim_slug_key on public.species_dim (slug);

-- ---------------------------------------------------------------------------
-- Constraints
--
-- Added NOT VALID so this applies cleanly over the existing Perenual rows.
-- They are enforced on every INSERT and UPDATE from here on; the old rows are
-- simply not retroactively checked. The catalog migration validates them once
-- the Perenual rows are gone.
-- ---------------------------------------------------------------------------

-- The watering band is the agent's guardrail: it may move an interval freely
-- inside [min, max], and anything outside requires user confirmation.
-- Enforcing the ordering here means a malformed band cannot reach the agent.
alter table public.species_dim
  add constraint species_water_band_ordered
  check (
    water_days_min <= water_days_baseline
    and water_days_baseline <= water_days_max
  ) not valid;

alter table public.species_dim
  add constraint species_water_band_positive
  check (water_days_min > 0) not valid;

alter table public.species_dim
  add constraint species_humidity_pct_range
  check (humidity_min_pct between 0 and 100) not valid;

alter table public.species_dim
  add constraint species_temp_range_ordered
  check (temp_min_f < temp_max_f) not valid;

-- ---------------------------------------------------------------------------
-- Care knowledge corpus (RAG)
-- ---------------------------------------------------------------------------

create extension if not exists vector;

create table public.care_knowledge (
  knowledge_id uuid primary key default gen_random_uuid(),
  species_id   uuid references public.species_dim(species_id) on delete cascade,
  topic        text not null,
  content      text not null,
  -- 1536 matches OpenAI text-embedding-3-small. Using Voyage voyage-3 instead?
  -- Change this to vector(1024) before the first embedding is written.
  embedding    vector(1536),
  source       text,
  created_at   timestamptz not null default now()
);

comment on column public.care_knowledge.species_id is
  'NULL means general horticultural guidance not tied to one species.';

create index care_knowledge_species_idx
  on public.care_knowledge (species_id);

create index care_knowledge_embedding_idx
  on public.care_knowledge using hnsw (embedding vector_cosine_ops);

alter table public.care_knowledge enable row level security;

create policy "Care knowledge is readable by all"
  on public.care_knowledge for select
  using (true);
