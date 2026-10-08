export type UnitPreference = 'metric' | 'imperial';

export type OriginType = 'propagated' | 'seed' | 'purchased_gifted';

export type EventType = 'watered' | 'fertilized' | 'replanted' | 'noted' | 'measured' | 'health_issue';

// --- Enums added by 20261008120000 / 20261008120100 ---------------------------

export type LightLevel =
  | 'low'
  | 'low_medium'
  | 'medium'
  | 'medium_bright'
  | 'bright_indirect'
  | 'direct_sun';

export type CareDifficulty = 'easy' | 'moderate' | 'hard';

export type GrowthHabit =
  | 'upright' | 'trailing' | 'vining' | 'climbing' | 'creeping'
  | 'clumping' | 'rosette' | 'tree' | 'shrub' | 'epiphyte' | 'globular';

/** Who performed a write. Agent-written rows also carry agent_run_id. */
export type Actor = 'user' | 'agent' | 'system';

/**
 * Resolved per call, not fixed per tool. See docs/agent-tools.md section 1.
 * - auto:             executes silently
 * - auto_with_notice: executes, appears in the feed, undoable
 * - confirm:          queued as a proposal, waits for the user
 */
export type AutonomyTier = 'auto' | 'auto_with_notice' | 'confirm';

export type TaskStatus = 'pending' | 'done' | 'dismissed' | 'snoozed';

export type ProposalStatus =
  | 'pending' | 'accepted' | 'rejected' | 'auto_applied' | 'expired';

export type AgentSurface = 'chat' | 'demo' | 'vision' | 'nightly_sweep' | 'seasonal';

// --- Core ---------------------------------------------------------------------

export interface Profile {
  id: string;
  full_name: string | null;
  location_city: string | null;
  location_state: string | null;
  unit_preference: UnitPreference;
  updated_at: string;
}

export interface Species {
  species_id: string;
  slug: string;
  scientific_name: string;
  common_name: string | null;
  family: string | null;
  difficulty: CareDifficulty;
  light: LightLevel;
  /** Agent's starting point, modified by season/humidity/pot size. */
  water_days_baseline: number | null;
  /**
   * The agent may move an interval freely inside [min, max]. Outside it, the
   * action escalates to a user confirmation. Enforced by a DB CHECK.
   */
  water_days_min: number | null;
  water_days_max: number | null;
  water_notes: string | null;
  humidity_min_pct: number | null;
  temp_min_f: number | null;
  temp_max_f: number | null;
  fertilizer: string | null;
  soil: string | null;
  is_toxic_to_cats: boolean;
  is_toxic_to_dogs: boolean;
  growth_habit: GrowthHabit | null;
  mature_size: string | null;
  common_problems: string[];
  propagation: string | null;
  /** Prose the seasonal agent reads to adjust for dormancy. */
  winter_adjustment: string | null;
  additional_tips: string | null;
  updated_at: string;
}

export interface Plant {
  plant_id: string;
  user_id: string;
  species_id: string | null;
  nickname: string | null;
  location_of_plant: string | null;
  soil_brand: string | null;
  pot_size_in: number | null;
  pot_size_cm: number | null;
  origin_type: OriginType | null;
  active_start_date: string | null;
  is_active: boolean;
  archived_date: string | null;
  species?: Species;
  current_plan?: CarePlan;
}

/** Append-only log of care ACTIONS taken. Assessments live in Observation. */
export interface PlantFact {
  fact_id: string;
  plant_id: string;
  event_timestamp: string;
  event_type: EventType;
  note_text: string | null;
  plant_height_cm: number | null;
  plant_height_in: number | null;
  image_url: string | null;
  created_by: Actor;
  agent_run_id: string | null;
}

// --- Agent layer --------------------------------------------------------------

/**
 * Versioned, never updated in place. A new version supersedes the old one and
 * `reason` is required, so every schedule change can answer "why".
 */
export interface CarePlan {
  plan_id: string;
  plant_id: string;
  version: number;
  water_interval_days: number;
  fertilize_interval_days: number | null;
  light_target: LightLevel | null;
  notes: string | null;
  reason: string;
  created_by: Actor;
  agent_run_id: string | null;
  is_current: boolean;
  created_at: string;
  superseded_at: string | null;
}

export interface DiagnosisIssue {
  label: string;
  severity: 'low' | 'medium' | 'high';
  evidence: string;
}

export interface AgentAssessment {
  issues: DiagnosisIssue[];
  species_guess?: string;
  summary?: string;
}

/** Health ASSESSMENTS, with or without a photo. Actions live in PlantFact. */
export interface Observation {
  observation_id: string;
  plant_id: string;
  observed_at: string;
  image_url: string | null;
  note_text: string | null;
  agent_assessment: AgentAssessment | null;
  health_score: number | null;
  /** Below the user's confirmBelow setting, actions escalate to tier 2. */
  confidence: number | null;
  created_by: Actor;
  agent_run_id: string | null;
  created_at: string;
}

export interface Task {
  task_id: string;
  user_id: string;
  plant_id: string | null;
  task_type: string;
  due_date: string;
  status: TaskStatus;
  priority: number;
  reason: string | null;
  created_by: Actor;
  agent_run_id: string | null;
  completed_at: string | null;
  created_at: string;
  plant?: Plant;
}

/**
 * The human-in-the-loop queue. Tier 2 lands here as 'pending' and nothing
 * executes; tier 1 executes AND lands here as 'auto_applied', which is what
 * makes the activity feed and the undo button possible.
 */
export interface AgentProposal {
  proposal_id: string;
  user_id: string;
  plant_id: string | null;
  agent_run_id: string | null;
  action_type: string;
  payload: Record<string, unknown>;
  tier: AutonomyTier;
  confidence: number | null;
  rationale: string;
  status: ProposalStatus;
  resolved_at: string | null;
  created_at: string;
}

export interface AgentToolCall {
  tool: string;
  args: Record<string, unknown>;
  result_summary: string;
  ms: number;
  tier: AutonomyTier;
  outcome: 'executed' | 'proposed' | 'error';
}

/** One row per agent invocation, failures included. */
export interface AgentRun {
  run_id: string;
  user_id: string | null;
  surface: AgentSurface;
  model: string;
  trigger: string | null;
  input_summary: string | null;
  tool_calls: AgentToolCall[];
  output_text: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cached_input_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  status: string;
  error_text: string | null;
  created_at: string;
}

/** User-tunable autonomy thresholds. See docs/agent-tools.md section 1. */
export interface AutonomySettings {
  confirmBelow: number;
  maxAutoDelta: number;
  confirmEverything: boolean;
}

export const DEFAULT_AUTONOMY: AutonomySettings = {
  confirmBelow: 0.7,
  maxAutoDelta: 0.25,
  confirmEverything: false,
};

/** Display labels for the light enum. */
export const LIGHT_LABEL: Record<LightLevel, string> = {
  low: 'Low light',
  low_medium: 'Low to medium light',
  medium: 'Medium light',
  medium_bright: 'Medium to bright light',
  bright_indirect: 'Bright indirect light',
  direct_sun: 'Direct sun',
};

export const DIFFICULTY_LABEL: Record<CareDifficulty, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Demanding',
};
