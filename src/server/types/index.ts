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
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
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
}

export type RarityTier = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';

export type EnergyState = 'Energetic' | 'Active' | 'Resting' | 'Hungry_for_code';

export interface GuardianSummary {
  id: string;
  name: string;
  species: string;
  element: string;
  rarity_tier: RarityTier;
  level: number;
  experience: number;
  energy_state: EnergyState;
  hero_image_url: string;
  spritesheet_url: string | null;
}

export interface GuardianDNA {
  github_user_id: number;
  dna_seed: string;
  egg_archetype_id: string;
  species: string;
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
}

export interface EarlyAccessStatus {
  total: number;
  claimed: number | null;
  remaining: number | null;
  is_free: boolean;
  user_has_claimed: boolean;
  degraded: boolean;
}
