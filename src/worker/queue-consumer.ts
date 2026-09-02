// ============================================================================
// GitHoot Dedicated AI Queue Consumer Worker Entrypoint (src/worker/queue-consumer.ts)
// ============================================================================

import type { Env } from '../server/types';
import { handleQueueBatch, type GenerationQueueMessage } from '../server/queue/generation-worker';

export type ConsumerQueueMessage = GenerationQueueMessage;

export default {
  async queue(batch: MessageBatch<GenerationQueueMessage>, env: Env): Promise<void> {
    return handleQueueBatch(batch, env);
  },
  async scheduled(_controller: unknown, env: Env, _ctx: unknown): Promise<void> {
    const { drainOutbox } = await import('../server/queue/outbox');
    const { reconcileAbandonedReservations } = await import('../server/services/billing/budget-guard');
    await drainOutbox(env);
    await reconcileAbandonedReservations(env);
  }
};
