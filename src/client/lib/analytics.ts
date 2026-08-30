/// <reference types="vite/client" />
// ============================================================================
// GitHoot Privacy-Preserving Event Telemetry (src/client/lib/analytics.ts)
// Implements the exact accepted taxonomy and trigger semantics from contract §7.
// ============================================================================

export type ViewportBucket = 'mobile' | 'tablet' | 'desktop';
export type CtaSource = 'hero' | 'navbar' | 'footer' | 'early_access' | 'example_link';
export type DemoControl = 'play' | 'slowmo' | 'scrub' | 'replay';
export type ShareNetwork = 'x' | 'linkedin' | 'badge' | 'copy_link';
export type CreatorDestination = 'agentkit' | 'nextlevelbuilder' | 'goclaw' | 'ui_ux_pro_max' | 'github_source';

export interface EventMap {
  landing_viewed: {
    viewport_bucket: ViewportBucket;
    reduced_motion: boolean;
  };
  profile_lookup_submitted: {
    cta_source: CtaSource;
    input_length: number;
  };
  demo_interacted: {
    control: DemoControl;
    frame_index: number;
  };
  archetype_selected: {
    archetype_id: string;
    element: string;
  };
  egg_viewed: {
    archetype_id: string;
    rarity_tier: string;
  };
  claim_started: {
    archetype_id: string;
  };
  claim_completed: {
    archetype_id: string;
    rarity_tier: string;
    slot_is_free: boolean;
  };
  share_clicked: {
    network: ShareNetwork;
  };
  creator_link_clicked: {
    destination: CreatorDestination;
  };
}

export interface RecordedEvent<K extends keyof EventMap = keyof EventMap> {
  name: K;
  properties: EventMap[K];
  timestamp: number;
}

interface PostHogWindow {
  posthog?: {
    capture?: (name: string, properties: Record<string, unknown>) => void;
  };
  __githoot_events?: RecordedEvent[];
}

/**
 * Single tracking entrypoint per contract §7.
 * - Reads import.meta.env.VITE_POSTHOG_KEY; when unset, does not send network requests.
 * - Records events in a local debug buffer for contract verification assertions.
 * - Zero PII: no usernames, emails, avatar URLs, or query strings.
 */
export function track<K extends keyof EventMap>(event: K, props: EventMap[K]): void {
  if (typeof window === 'undefined') return;
  const win = window as unknown as PostHogWindow;

  // In-memory debug session buffer for contract auditing
  if (!win.__githoot_events) {
    win.__githoot_events = [];
  }
  win.__githoot_events.push({
    name: event,
    properties: props,
    timestamp: Date.now()
  });

  const posthogKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_POSTHOG_KEY : undefined;
  if (!posthogKey) {
    // Unkeyed: return immediately without network overhead
    return;
  }

  // If a key exists and PostHog is loaded on window
  if (win.posthog && typeof win.posthog.capture === 'function') {
    try {
      win.posthog.capture(event, props as unknown as Record<string, unknown>);
    } catch {
      // Non-blocking telemetry
    }
  }
}

export function getRecordedEvents(): RecordedEvent[] {
  if (typeof window === 'undefined') return [];
  const win = window as unknown as PostHogWindow;
  return win.__githoot_events || [];
}

export function clearRecordedEvents(): void {
  if (typeof window === 'undefined') return;
  const win = window as unknown as PostHogWindow;
  win.__githoot_events = [];
}
