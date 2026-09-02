/**
 * GitHoot Queue Message Schema & Runtime Validator (v1)
 *
 * Implements versioned discriminated union for Cloudflare Queue envelopes.
 * All messages reaching Queue Consumer are strictly validated before dispatch.
 */

import { POSE_SET } from '../services/dna/contracts';

export type MessageVersion = 1;

export interface BaseQueueMessage {
  v: MessageVersion;
  type: string;
}

export interface HatchReferenceMessage extends BaseQueueMessage {
  v: 1;
  type: 'HATCH_REFERENCE';
  jobId: string;
  guardianId: string;
  attempt?: number;
}

export interface HatchPoseMessage extends BaseQueueMessage {
  v: 1;
  type: 'HATCH_POSE';
  jobId: string;
  guardianId: string;
  poseId: string;
  attempt: number;
}

export interface HatchCompositeMessage extends BaseQueueMessage {
  v: 1;
  type: 'HATCH_COMPOSITE';
  jobId: string;
  guardianId: string;
}

export interface RevalidateProfileMessage extends BaseQueueMessage {
  v: 1;
  type: 'REVALIDATE_PROFILE';
  username: string;
}

export type GenerationQueueMessage =
  | HatchReferenceMessage
  | HatchPoseMessage
  | HatchCompositeMessage
  | RevalidateProfileMessage;

export type ParseQueueMessageResult =
  | { ok: true; message: GenerationQueueMessage }
  | { ok: false; error: string };

const VALID_POSE_IDS = new Set(POSE_SET.map(p => p.id));

export function parseQueueMessage(raw: unknown): ParseQueueMessageResult {
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, error: 'Queue message payload must be a non-null JSON object.' };
  }

  const obj = raw as Record<string, unknown>;

  // Allow legacy messages without 'v' during migration if they contain identifiable legacy structure,
  // or enforce v: 1. Let's inspect 'v'.
  const version = obj.v !== undefined ? Number(obj.v) : 1;
  if (version !== 1) {
    return { ok: false, error: `Unsupported queue message version: ${String(obj.v)}. Expected version 1.` };
  }

  const type = String(obj.type || '');
  if (!type) {
    return { ok: false, error: 'Missing required "type" field in queue message.' };
  }

  switch (type) {
    case 'HATCH_REFERENCE': {
      const jobId = typeof obj.jobId === 'string' ? obj.jobId.trim() : '';
      const guardianId = typeof obj.guardianId === 'string' ? obj.guardianId.trim() : '';
      const attempt = typeof obj.attempt === 'number' ? obj.attempt : Number(obj.attempt || 1);

      if (!jobId || !guardianId) {
        return { ok: false, error: 'HATCH_REFERENCE message requires valid "jobId" and "guardianId" strings.' };
      }

      if (!Number.isInteger(attempt) || attempt < 1 || attempt > 10) {
        return { ok: false, error: `Invalid attempt count: ${attempt}. Must be an integer between 1 and 10.` };
      }

      return {
        ok: true,
        message: {
          v: 1,
          type: 'HATCH_REFERENCE',
          jobId,
          guardianId,
          attempt
        }
      };
    }

    case 'HATCH_POSE': {
      const jobId = typeof obj.jobId === 'string' ? obj.jobId.trim() : '';
      const guardianId = typeof obj.guardianId === 'string' ? obj.guardianId.trim() : '';
      const poseId = typeof obj.poseId === 'string' ? obj.poseId.trim() : '';
      const attempt = typeof obj.attempt === 'number' ? obj.attempt : Number(obj.attempt || 1);

      if (!jobId || !guardianId) {
        return { ok: false, error: 'HATCH_POSE message requires valid "jobId" and "guardianId" strings.' };
      }

      if (!poseId || !VALID_POSE_IDS.has(poseId)) {
        return { ok: false, error: `Invalid poseId: "${poseId}". Must be one of: ${Array.from(VALID_POSE_IDS).join(', ')}` };
      }

      if (!Number.isInteger(attempt) || attempt < 1 || attempt > 10) {
        return { ok: false, error: `Invalid attempt count: ${attempt}. Must be an integer between 1 and 10.` };
      }

      return {
        ok: true,
        message: {
          v: 1,
          type: 'HATCH_POSE',
          jobId,
          guardianId,
          poseId,
          attempt
        }
      };
    }

    case 'HATCH_COMPOSITE': {
      const jobId = typeof obj.jobId === 'string' ? obj.jobId.trim() : '';
      const guardianId = typeof obj.guardianId === 'string' ? obj.guardianId.trim() : '';

      if (!jobId || !guardianId) {
        return { ok: false, error: 'HATCH_COMPOSITE message requires valid "jobId" and "guardianId" strings.' };
      }

      return {
        ok: true,
        message: {
          v: 1,
          type: 'HATCH_COMPOSITE',
          jobId,
          guardianId
        }
      };
    }

    case 'REVALIDATE_PROFILE': {
      const username = typeof obj.username === 'string' ? obj.username.trim() : '';
      if (!username) {
        return { ok: false, error: 'REVALIDATE_PROFILE message requires valid "username" string.' };
      }

      return {
        ok: true,
        message: {
          v: 1,
          type: 'REVALIDATE_PROFILE',
          username
        }
      };
    }

    // Support legacy message payload { type: 'HATCH_JOB', guardianId }
    case 'HATCH_JOB':
    case 'GENERATE_GUARDIAN_ASSET': {
      const guardianId = typeof obj.guardianId === 'string' ? obj.guardianId.trim() : '';
      const jobId = typeof obj.jobId === 'string' ? obj.jobId.trim() : (guardianId ? `job-${guardianId}` : '');

      if (!guardianId) {
        return { ok: false, error: 'Legacy HATCH_JOB message requires "guardianId".' };
      }

      return {
        ok: true,
        message: {
          v: 1,
          type: 'HATCH_REFERENCE',
          jobId,
          guardianId
        }
      };
    }

    default:
      return { ok: false, error: `Unknown message type: "${type}".` };
  }
}
