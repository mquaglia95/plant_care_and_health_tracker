-- Agent layer: care plans, observations, tasks, proposals, run log.
--
-- Design notes:
--
-- plant_facts stays exactly what it is: the append-only log of care ACTIONS
-- taken (watered, fertilized, repotted). observations is a separate log of
-- health ASSESSMENTS. Different shapes, different consumers -- the scheduler
-- reads actions, the diagnosis UI reads assessments -- and merging them would
-- mean half the columns are null on every row.
--
-- Every table the agent can write carries created_by and agent_run_id, so any
-- row in the system traces back to the run that produced it.

-- ---------------------------------------------------------------------------
-- Shared enums
-- ---------------------------------------------------------------------------

create type public.actor as enum ('user', 'agent', 'system');

create type public.autonomy_tier as enum (
  'auto',             -- tier 0: executed silently (reads, user-dictated logs)
  'auto_with_notice', -- tier 1: executed, shown in the feed, undoable
  'confirm'           -- tier 2: queued as a proposal, needs the user to accept
);

create type public.task_status as enum ('pending', 'done', 'dismissed', 'snoozed');

create type public.proposal_status as enum (
  'pending', 'accepted', 'rejected', 'auto_applied', 'expired'
);

create type public.agent_surface as enum (
  'chat',          -- authenticated conversational agent
  'demo',          -- unauthenticated landing-page agent
  'vision',        -- photo diagnosis
  'nightly_sweep', -- scheduled per-user care pass
  'seasonal'       -- scheduled daylight/season transition pass
);

-- ---------------------------------------------------------------------------
-- Provenance on the existing action log
-- ---------------------------------------------------------------------------

alter table public.plant_facts
  add column created_by   public.actor not null default 'user',
  add column agent_run_id uuid;

create index plant_facts_plant_time_idx
  on public.plant_facts (plant_id, event_timestamp desc);

-- ---------------------------------------------------------------------------
-- care_plans: versioned, never updated in place
-- ---------------------------------------------------------------------------

create table public.care_plans (
  plan_id                 uuid primary key default gen_random_uuid(),
  plant_id                uuid not null references public.my_plants_dim(plant_id) on delete cascade,
  version                 integer not null,
  water_interval_days     numeric(5,1) not null check (water_interval_days > 0),
  fertilize_interval_days numeric(5,1) check (fertilize_interval_days > 0),
  light_target            public.light_level,
  notes                   text,
  -- Required. A plan version with no stated reason is what makes an agent feel
  -- arbitrary, so this is NOT NULL rather than conventionally filled in.
  reason                  text not null,
  created_by              public.actor not null,
  agent_run_id            uuid,
  is_current              boolean not null default true,
  created_at              timestamptz not null default now(),
  superseded_at           timestamptz,

  unique (plant_id, version),
  constraint care_plan_superseded_consistency
    check ((is_current and superseded_at is null)
        or (not is_current and superseded_at is not null))
);

-- Exactly one live plan per plant, enforced rather than assumed.
create unique index care_plans_one_current_per_plant
  on public.care_plans (plant_id) where is_current;

create index care_plans_plant_version_idx
  on public.care_plans (plant_id, version desc);

-- ---------------------------------------------------------------------------
-- observations: health assessments, with or without a photo
-- ---------------------------------------------------------------------------

create table public.observations (
  observation_id   uuid primary key default gen_random_uuid(),
  plant_id         uuid not null references public.my_plants_dim(plant_id) on delete cascade,
  observed_at      timestamptz not null default now(),
  image_url        text,
  note_text        text,
  -- { issues: [{label, severity, evidence}], species_guess, ... }
  agent_assessment jsonb,
  health_score     numeric(4,1) check (health_score between 0 and 100),
  -- Drives tier promotion: a low-confidence read escalates to 'confirm' even
  -- when the action itself would normally be tier 1.
  confidence       numeric(3,2) check (confidence between 0 and 1),
  created_by       public.actor not null default 'user',
  agent_run_id     uuid,
  created_at       timestamptz not null default now()
);

create index observations_plant_time_idx
  on public.observations (plant_id, observed_at desc);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  task_id      uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  plant_id     uuid references public.my_plants_dim(plant_id) on delete cascade,
  task_type    text not null,
  due_date     date not null,
  status       public.task_status not null default 'pending',
  priority     smallint not null default 3 check (priority between 1 and 5),
  reason       text,
  created_by   public.actor not null,
  agent_run_id uuid,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- The nightly sweep's main read path: open work for one user, soonest first.
create index tasks_user_open_idx
  on public.tasks (user_id, due_date)
  where status = 'pending';

create index tasks_plant_idx on public.tasks (plant_id);

-- ---------------------------------------------------------------------------
-- agent_proposals: the human-in-the-loop queue
--
-- This is where the autonomy tiers become real. A tier 2 action is written
-- here as 'pending' and nothing else happens until the user accepts. A tier 1
-- action is applied immediately AND written here as 'auto_applied', which is
-- what makes the activity feed and the undo button possible.
-- ---------------------------------------------------------------------------

create table public.agent_proposals (
  proposal_id  uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  plant_id     uuid references public.my_plants_dim(plant_id) on delete cascade,
  agent_run_id uuid,
  action_type  text not null,     -- the tool the agent wants to call
  payload      jsonb not null,    -- its arguments
  tier         public.autonomy_tier not null,
  confidence   numeric(3,2) check (confidence between 0 and 1),
  rationale    text not null,
  status       public.proposal_status not null default 'pending',
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index agent_proposals_user_pending_idx
  on public.agent_proposals (user_id, created_at desc)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- agent_runs: one row per agent invocation
--
-- Not optional. Without it there is no debugging the agent, no "what it did
-- while you were away" feed, and no cost control.
-- ---------------------------------------------------------------------------

create table public.agent_runs (
  run_id              uuid primary key default gen_random_uuid(),
  -- NULL for unauthenticated landing-page demo runs.
  user_id             uuid references public.profiles(id) on delete set null,
  surface             public.agent_surface not null,
  model               text not null,
  trigger             text,
  input_summary       text,
  -- [{ tool, args, result_summary, ms, tier, outcome }]
  tool_calls          jsonb not null default '[]',
  output_text         text,
  input_tokens        integer,
  output_tokens       integer,
  cached_input_tokens integer,
  cost_usd            numeric(10,6),
  latency_ms          integer,
  status              text not null default 'ok',
  error_text          text,
  created_at          timestamptz not null default now()
);

create index agent_runs_user_time_idx
  on public.agent_runs (user_id, created_at desc);

-- Supports the demo-spend dashboard and the daily global ceiling.
create index agent_runs_surface_time_idx
  on public.agent_runs (surface, created_at desc);

-- Backfill the FKs now that agent_runs exists.
alter table public.plant_facts
  add constraint plant_facts_agent_run_fkey
  foreign key (agent_run_id) references public.agent_runs(run_id) on delete set null;

alter table public.care_plans
  add constraint care_plans_agent_run_fkey
  foreign key (agent_run_id) references public.agent_runs(run_id) on delete set null;

alter table public.observations
  add constraint observations_agent_run_fkey
  foreign key (agent_run_id) references public.agent_runs(run_id) on delete set null;

alter table public.tasks
  add constraint tasks_agent_run_fkey
  foreign key (agent_run_id) references public.agent_runs(run_id) on delete set null;

alter table public.agent_proposals
  add constraint agent_proposals_agent_run_fkey
  foreign key (agent_run_id) references public.agent_runs(run_id) on delete set null;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Ownership reaches these tables two ways: directly via user_id, or through
-- plant_id -> my_plants_dim.user_id. Both are spelled out rather than relying
-- on the client to filter.
-- ---------------------------------------------------------------------------

alter table public.care_plans      enable row level security;
alter table public.observations    enable row level security;
alter table public.tasks           enable row level security;
alter table public.agent_proposals enable row level security;
alter table public.agent_runs      enable row level security;

create policy "Users can manage own care plans"
  on public.care_plans for all
  using (plant_id in (
    select plant_id from public.my_plants_dim where user_id = auth.uid()
  ));

create policy "Users can manage own observations"
  on public.observations for all
  using (plant_id in (
    select plant_id from public.my_plants_dim where user_id = auth.uid()
  ));

create policy "Users can manage own tasks"
  on public.tasks for all
  using (auth.uid() = user_id);

create policy "Users can manage own proposals"
  on public.agent_proposals for all
  using (auth.uid() = user_id);

-- Read-only to the user: runs are written by the service role only, so the
-- trace cannot be edited after the fact.
create policy "Users can read own agent runs"
  on public.agent_runs for select
  using (auth.uid() = user_id);
