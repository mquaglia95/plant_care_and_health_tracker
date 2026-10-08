# Agent tool surface

The tool surface is the product spec. If an action is not a tool here, the
agent cannot do it; if it is, the tier table below decides whether it happens
silently, happens with an undo, or waits for the user.

The agent runs as a **standalone API consumed by both clients** — the Expo app
in `mobile/` and the web app. No agent logic lives in either client.

Backing schema: `supabase/migrations/20261008120100_agent_tables.sql`.

## 1. Autonomy tiers

| Tier | Name | Behavior |
|---|---|---|
| 0 | `auto` | Executes silently. No proposal row. |
| 1 | `auto_with_notice` | Executes immediately, writes `agent_proposals` with status `auto_applied`. Shows in the activity feed with undo. |
| 2 | `confirm` | Does **not** execute. Writes `agent_proposals` as `pending`. Applied only when the user accepts. |

Tier is not a fixed property of the tool. It is resolved per call from the
declared base tier plus runtime context — which is what lets one model handle
both "log that I watered it" and "stop watering this entirely" correctly.

```ts
function resolveTier(action: Action, ctx: UserSettings): AutonomyTier {
  const base = DECLARED_TIER[action.type];

  // Low confidence always escalates, whatever the action.
  if (action.confidence < ctx.confirmBelow) return 'confirm';

  if (action.type === 'update_care_plan') {
    const { waterDaysMin, waterDaysMax } = action.speciesBand;
    // Outside the species' own band is never automatic.
    if (action.next < waterDaysMin || action.next > waterDaysMax) return 'confirm';
    // Large swings inside the band still get confirmed.
    const delta = Math.abs(action.next - action.current) / action.current;
    if (delta > ctx.maxAutoDelta) return 'confirm';
  }

  return base;
}
```

The species band comes from `species_dim.water_days_min / _max` and is enforced
by a DB CHECK constraint, so a malformed band cannot reach this function.

**User settings** (expose these in the UI — this is the demo moment):

| Setting | Default | Effect |
|---|---|---|
| `confirmBelow` | `0.7` | Confidence under this escalates to tier 2 |
| `maxAutoDelta` | `0.25` | Schedule swings beyond ±25% escalate to tier 2 |
| `confirmEverything` | `false` | Forces every write to tier 2 |

## 2. Tools

### Reads — all tier 0

| Tool | Signature | Notes |
|---|---|---|
| `list_plants` | `(filter?: { location?, needsWater?, species? })` | Scoped to the caller by RLS |
| `get_plant` | `(plantId)` | Joins current care plan + last 5 events |
| `get_species_profile` | `(slug \| speciesId)` | The full 22-field row |
| `get_care_history` | `(plantId, since?)` | From `plant_facts` |
| `get_observations` | `(plantId, limit?)` | Health timeline, newest first |
| `search_care_knowledge` | `(query, speciesId?)` | pgvector cosine over `care_knowledge` |
| `get_weather` | `(userId)` | Open-Meteo: temp, humidity, daylight hours |
| `get_open_tasks` | `(userId)` | Status `pending`, soonest first |

`get_weather` is what makes seasonal reasoning possible. Daylight hours matter
more than temperature for the dormancy transitions in
`species_dim.winter_adjustment`.

### Writes

| Tool | Base tier | Signature |
|---|---|---|
| `log_care_event` | 0 | `(plantId, eventType, note?, heightIn?, occurredAt?)` |
| `complete_task` | 0 | `(taskId)` |
| `create_task` | 1 | `(plantId?, taskType, dueDate, priority?, reason)` |
| `log_observation` | 1 | `(plantId, imageUrl?, note?, assessment?, healthScore?, confidence)` |
| `update_care_plan` | 1 | `(plantId, waterIntervalDays?, fertilizeIntervalDays?, lightTarget?, reason)` |
| `propose_treatment` | 2 | `(plantId, diagnosis, steps[], confidence)` |
| `archive_plant` | 2 | `(plantId, reason)` |
| `notify_user` | 1 | `(userId, channel, subject, body)` |

`log_care_event` is tier 0 only when the user described the action in their own
message ("I watered the monstera"). The agent inferring that a plant was
probably watered is not the same thing and goes through `create_task` instead.

`eventType` must match the existing `EventType` union in
`mobile/types/database.ts`: `watered | fertilized | replanted | noted |
measured | health_issue`.

`update_care_plan` never updates in place. It inserts a new `care_plans` row
with `version = current + 1`, flips the old row's `is_current` to false and
stamps `superseded_at`. A partial unique index enforces one live plan per
plant, so a buggy implementation fails loudly rather than double-writing.

`reason` is NOT NULL on `care_plans`. Every schedule change can answer "why",
which is where most of the perceived intelligence comes from: *"moved watering
7d → 10d on Oct 3 because daylight dropped below 11h and your Monstera's
winter_adjustment calls for a ~40% stretch."*

## 3. Proposal lifecycle

```
agent emits action
   │
   ├── resolveTier → 'auto'
   │      └─ execute. no proposal row.
   │
   ├── resolveTier → 'auto_with_notice'
   │      └─ execute, then INSERT agent_proposals (status='auto_applied')
   │         └─ user clicks undo → reverse the write, status='rejected'
   │
   └── resolveTier → 'confirm'
          └─ INSERT agent_proposals (status='pending'). nothing executes.
             ├─ user accepts → execute, status='accepted'
             ├─ user rejects → status='rejected'
             └─ 7 days pass → status='expired'
```

Undo for `update_care_plan` is a new version restoring the prior values, not a
delete. The history stays intact.

## 4. Model routing

| Surface | Model | Why |
|---|---|---|
| `demo` | Haiku 5.5 | ~$0.0013/run. Unauthenticated, so cost is the constraint |
| `chat` | Sonnet 5.5 | Authenticated, multi-turn, full tool surface |
| `vision` | Sonnet 5.5 | Diagnosis quality matters more than cost |
| `nightly_sweep` | Sonnet 5.5 via Batch API | 50% off, and nobody is waiting on it |
| `seasonal` | Sonnet 5.5 via Batch API | Same |

Cache the system prompt, tool definitions and species profiles — identical
across calls, and Sonnet 5.5 cache reads are $0.10/MTok against $2 standard.

### Demo-path limits

- Rate limit per IP via Upstash (`@upstash/ratelimit`), ~10 runs/hour
- Global daily ceiling; past it, serve a replayed canned trace, not a 503
- `max_tokens` hard cap and a max tool-call depth of 5
- Resize images to ≤768px client-side before any vision call
- No write tools at all on the demo surface — it reads a fixed sandbox dataset

## 5. Run logging

Every invocation writes one `agent_runs` row, including failures. `tool_calls`
is an array of:

```json
{ "tool": "update_care_plan", "args": {}, "result_summary": "v3 created",
  "ms": 42, "tier": "confirm", "outcome": "proposed" }
```

This powers three things that are otherwise impossible: the streaming
tool-call UI on the landing page, the "what the agent did while you were away"
feed, and per-run cost tracking. Populate `cost_usd` at write time from the
token counts rather than computing it later.

`agent_runs` is readable by the owning user and writable only by the service
role, so a trace cannot be edited after the fact.

## 6. Nightly sweep

One batched run per user, fanned out by Inngest.

1. Load the user's active plants with current care plan and last watering
2. `get_weather` once for the user's coordinates
3. Per plant, compute days-since-water against the plan interval, modified by:
   daylight hours vs. the species band, indoor humidity vs. `humidity_min_pct`,
   pot size, and recent observation health trend
4. Emit `create_task` for anything due within 48h
5. Emit `update_care_plan` where the seasonal modifier has drifted the
   interval — tier resolution decides whether it applies or queues
6. One `notify_user` summarizing the whole sweep, never one per plant

Step 6 matters. A per-plant notification scheme is how a useful agent becomes
an app the user mutes. `mobile/lib/notifications.ts` already has the Expo
push wiring.

## 7. Evals

Build the set before the agent feels finished, not after. 30–50 cases:

- **State → recommendation.** Fixture plant + history + weather, assert the
  expected tool call and tier. Catches tier-resolution regressions, which are
  the dangerous ones.
- **Photo → diagnosis.** Labeled images, assert the top issue and that
  confidence falls on the correct side of `confirmBelow`.
- **Refusals.** Out-of-scope requests should produce no tool calls.

Run on every prompt change. Publish the pass rate in the repo — a reviewer
reading an eval table is the difference between "wired up an API" and "built a
system".
