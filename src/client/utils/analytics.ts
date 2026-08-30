// ============================================================================
// GitHoot Privacy-Preserving Event Taxonomy (src/client/utils/analytics.ts)
// ============================================================================

export type AnalyticsEvent =
  | { name: 'landing_viewed'; properties: { viewport_width: number; device_type: 'mobile' | 'tablet' | 'desktop'; is_reduced_motion: boolean } }
  | { name: 'profile_lookup_submitted'; properties: { input_length: number; source: 'hero_form' | 'nav_form' | 'early_access_form' | 'popular_chip' } }
  | { name: 'demo_interacted'; properties: { action: 'play' | 'slowmo' | 'scrub' | 'reset'; frame?: number } }
  | { name: 'archetype_selected'; properties: { archetype_id: string; element: string } }
  | { name: 'claim_started'; properties: { slot_tier: 'free' | 'paid'; slots_remaining: number | null } }
  | { name: 'egg_viewed'; properties: { archetype_id: string; is_claimed: boolean } }
  | { name: 'claim_completed'; properties: { slot_number: number } }
  | { name: 'share_clicked'; properties: { platform: 'x' | 'linkedin' | 'copy_link' } }
  | { name: 'creator_link_clicked'; properties: { destination: 'agentkit' | 'nextlevelbuilder' | 'goclaw' | 'ui_ux_pro_max' | 'github_source' } };

interface PostHogWindow {
  posthog?: {
    capture?: (name: string, properties: Record<string, unknown>) => void;
  };
  __githoot_events?: AnalyticsEvent[];
}

/**
 * Strict privacy allow-list audit:
 * - NO usernames, emails, display names, avatar URLs, or GitHub IDs.
 * - `input_length` is an integer, so the taxonomy cannot leak typed handles.
 * - When no PostHog key is configured, zero outbound network requests are made.
 * - Records events in an in-memory session buffer for contract validation.
 */
export function trackEvent(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  const win = window as unknown as PostHogWindow;

  // In-memory session buffer for telemetry auditing
  if (!win.__githoot_events) {
    win.__githoot_events = [];
  }
  win.__githoot_events.push(event);

  // If PostHog SDK is active on window
  if (win.posthog && typeof win.posthog.capture === 'function') {
    try {
      win.posthog.capture(event.name, event.properties as unknown as Record<string, unknown>);
    } catch {
      // Ignore telemetry errors
    }
  }
}

export function getRecordedEvents(): AnalyticsEvent[] {
  if (typeof window === 'undefined') return [];
  const win = window as unknown as PostHogWindow;
  return win.__githoot_events || [];
}

export function clearRecordedEvents(): void {
  if (typeof window === 'undefined') return;
  const win = window as unknown as PostHogWindow;
  win.__githoot_events = [];
}
