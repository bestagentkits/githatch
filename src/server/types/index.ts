// ============================================================================
// GitHoot Server Types & Contracts (src/server/types/index.ts)
// ============================================================================

export interface Env {
  // Cloudflare Bindings
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  CACHE_KV: KVNamespace;
  AI_QUEUE: Queue<any>;
  ASSETS?: { fetch: (req: Request) => Promise<Response> };

  // Public Configuration
  ENVIRONMENT: string;
  DOMAIN: string;
  CDN_DOMAIN: string;
  EARLY_ACCESS_TOTAL_SLOTS: string;
  AI_MODEL_TIER: string;

  // Encrypted Runtime Secrets & Keys
  GEMINI_API_KEY?: string;
  POSTHOG_API_KEY?: string;
  GITHUB_TOKENS?: string; // JSON string array of PATs
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  AUTH_SECRET?: string;
  ADMIN_REVIEW_SECRET?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_TEAM_NAME?: string;
  CF_ACCESS_JWKS?: string;
}

export interface PublicConfig {
  quota_total: number;
  free_until: number;
  charge_after_usd: number;
  posthog_configured: boolean;
  analytics_enabled: boolean;
  environment: string;
  domain: string;
  cdn_domain: string;
}

export interface GitHubUserRaw {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  created_at: string;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  is_private?: boolean;
  is_fork?: boolean;
  updated_at?: string;
}

export interface UserActivity {
  id: string;
  type: string;
  repo: string;
  repo_url: string;
  summary: string;
  created_at: string;
}

export interface UserSession {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface AggregateStats {
  contributions_last_year: number;
  owned_repositories_total: number;
  period_started_at: string;
  period_ended_at: string;
  refreshed_at: string;
}

export interface ResolvedProfile {
  github_user_id: number;
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  public_repos: number;
  followers: number;
  total_stars: number;
  top_languages: string[];
  dna_seed: string;
  egg_archetype_id: string;
  estimated_rarity: RarityTier;
  claimed: boolean;
  guardian: GuardianSummary | null;
  source: 'cache_fresh' | 'cache_stale' | 'github_live' | 'degraded_seed';
  last_synced_at: number;
  activities?: UserActivity[];
  highlighted_repos?: GitHubRepo[];
  active_repos?: GitHubRepo[];
  mood?: {
    state: EnergyState;
    title: string;
    description: string;
    badgeColor: string;
    recommendedPose: string;
  };
  aggregate_stats?: AggregateStats | null;
}

export type RarityTier = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';

export type GuardianStatus = 'PENDING' | 'GENERATING' | 'VERIFYING' | 'QUARANTINED' | 'ASSET_READY' | 'FAILED';

export type EnergyState = 'Energetic' | 'Active' | 'Resting' | 'Sleeping' | 'Hungry_for_code';

export type MetricProvenance = 'measured' | 'unavailable';

export interface TelemetrySnapshot {
  topLanguages: string[];
  stars: number;
  forks: number;
  publicRepos: number;
  followers: number;
  accountAgeYears: number;
  mergedExternalPRs: number;
  releases: number;
  reviewRatio: number;
  collaborators: number;
  activeWeeks: number;
  nightCommitRatio: number;
  provenance: Record<
    | 'topLanguages'
    | 'stars'
    | 'forks'
    | 'publicRepos'
    | 'followers'
    | 'accountAgeYears'
    | 'mergedExternalPRs'
    | 'releases'
    | 'reviewRatio'
    | 'collaborators'
    | 'activeWeeks'
    | 'nightCommitRatio',
    MetricProvenance
  >;
}

export interface IdentitySpec {
  identitySpecVersion: string;
  dnaVersion: string;
  telemetrySnapshotVersion: string;
  githubUserId: string;
  dnaSeed: string;
  telemetrySnapshotHash: string;
  element: string;
  rarity: RarityTier;
  merit: number;
  species: string;
  speciesName: string;
  anatomy: string;
  build: string;
  silhouette: string;
  crest: string;
  markings: string;
  material: string;
  aura: string;
  temperament: string;
  pinnedFields?: string[];
  identityHash: string;
}

export interface GuardianDNA {
  github_user_id: number;
  dna_seed: string;
  egg_archetype_id: string;
  species: string;
  species_name?: string;
  anatomy?: string;
  element: string;
  rarity_tier: RarityTier;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  markings: string;
  silhouette: string;
  temperament: string;
  archetype: string;
  identity_spec?: IdentitySpec;
}

export interface GuardianSummary {
  id: string;
  name: string;
  species: string;
  species_name?: string;
  anatomy?: string;
  element: string;
  rarity_tier: RarityTier;
  status?: GuardianStatus;
  hero_image_url?: string | null;
  spritesheet_url?: string | null;
  level: number;
  experience: number;
  energy_state: string;
  manifest_url?: string | null;
  mood_title?: string;
  mood_description?: string;
}

export interface EarlyAccessStatus {
  total: number;
  claimed: number | null;
  remaining: number | null;
  is_available?: boolean;
  is_free?: boolean;
  user_has_claimed?: boolean;
  degraded?: boolean;
}

export interface ReferenceCandidateRecord {
  id: string;
  guardian_id: string;
  candidate_sha256: string;
  identity_hash: string;
  prompt_hash: string;
  model_id: string;
  raw_sha256: string;
  state: 'VERIFYING' | 'APPROVED' | 'REJECTED';
  reviewer: string | null;
  verdict_data: string | null;
  created_at: number;
}

export interface HatchJobRecord {
  id: string;
  guardian_id: string;
  request_fingerprint: string;
  state: GuardianStatus;
  model_id: string;
  attempts_count: number;
  frames_completed: number;
  manifest_url: string | null;
  error_log: string | null;
  created_at: number;
  updated_at: number;
}

export interface HatchFrameRecord {
  id: string;
  job_id: string;
  pose_id: string;
  pose_index: number;
  frame_sha256: string;
  raw_sha256: string;
  state: 'ACCEPTED' | 'REJECTED' | 'QUARANTINED';
  raw_gate_metrics: string | null;
  semantic_verdict: string | null;
  created_at: number;
}
