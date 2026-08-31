/**
 * GitHoot Guardian Publication Manifest Schema & Parser (src/server/services/claim/manifest-schema.ts)
 *
 * Defines the canonical immutable content-addressed manifest format for published guardians.
 */

import type { IdentitySpec } from '../../types';
import { validateIdentitySpec } from '../dna/compiler';
import { POSE_SET } from '../dna/contracts';

export interface ManifestArtifact {
  url: string;
  key: string;
  sha256: string;
}

export interface ManifestFrameRecord {
  poseId: string;
  poseIndex: number;
  frameSha256: string;
  rawSha256: string;
}

export interface GuardianManifest {
  v: 1;
  guardianId: string;
  versions: Record<string, string>;
  identityHash: string;
  telemetrySnapshotHash?: string;
  identity: IdentitySpec;
  modelId: string;
  referenceSha256: string;
  state: 'ASSET_READY' | 'VERIFYING';
  frames: ManifestFrameRecord[];
  artifacts: {
    sheetPng: ManifestArtifact;
    sheetWebp: ManifestArtifact;
    stripPng: ManifestArtifact;
    stripWebp: ManifestArtifact;
  };
  publishedAt?: number;
}

export type ParseManifestResult =
  | { ok: true; manifest: GuardianManifest }
  | { ok: false; error: string };

const VALID_POSE_IDS = new Set(POSE_SET.map(p => p.id));

export async function parseGuardianManifest(raw: unknown): Promise<ParseManifestResult> {
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, error: 'Manifest payload must be a non-null object' };
  }

  const obj = raw as Record<string, unknown>;

  const version = Number(obj.v || 1);
  if (version !== 1) {
    return { ok: false, error: `Unsupported manifest version: ${obj.v}. Expected 1.` };
  }

  const guardianId = typeof obj.guardianId === 'string' ? obj.guardianId.trim() : '';
  if (!guardianId) {
    return { ok: false, error: 'Missing or empty guardianId in manifest' };
  }

  const modelId = typeof obj.modelId === 'string' ? obj.modelId.trim() : '';
  if (!modelId) {
    return { ok: false, error: 'Missing or empty modelId in manifest' };
  }

  const referenceSha256 = typeof obj.referenceSha256 === 'string' ? obj.referenceSha256.trim() : '';
  if (!referenceSha256 || referenceSha256.length !== 64) {
    return { ok: false, error: 'Invalid referenceSha256 in manifest (must be 64-hex SHA-256)' };
  }

  const state = obj.state === 'ASSET_READY' || obj.state === 'VERIFYING' ? obj.state : null;
  if (!state) {
    return { ok: false, error: `Invalid manifest state: "${String(obj.state)}". Must be VERIFYING or ASSET_READY.` };
  }

  // Validate Identity Spec
  if (!obj.identity || typeof obj.identity !== 'object') {
    return { ok: false, error: 'Missing identity spec in manifest' };
  }

  const validId = await validateIdentitySpec(obj.identity);
  if (!validId.valid) {
    return { ok: false, error: `Invalid identity spec in manifest: ${validId.reason}` };
  }

  const identity = obj.identity as IdentitySpec;
  const identityHash = typeof obj.identityHash === 'string' ? obj.identityHash.trim() : identity.identityHash;
  if (!identityHash || identityHash !== identity.identityHash) {
    return { ok: false, error: `Manifest identityHash "${identityHash}" does not match identity spec "${identity.identityHash}"` };
  }

  // Validate Artifacts (all 4 master artifacts required)
  const artifacts = obj.artifacts as Record<string, Record<string, unknown>> | undefined;
  if (!artifacts || typeof artifacts !== 'object') {
    return { ok: false, error: 'Missing artifacts object in manifest' };
  }

  const requiredArtifactKeys = ['sheetPng', 'sheetWebp', 'stripPng', 'stripWebp'] as const;
  const parsedArtifacts: Partial<GuardianManifest['artifacts']> = {};

  for (const artKey of requiredArtifactKeys) {
    const art = artifacts[artKey];
    if (!art || typeof art !== 'object') {
      return { ok: false, error: `Missing required artifact "${artKey}" in manifest` };
    }

    const sha256 = typeof art.sha256 === 'string' ? art.sha256.trim() : '';
    if (!sha256 || sha256.length !== 64) {
      return { ok: false, error: `Invalid sha256 for artifact "${artKey}" (must be 64-hex SHA-256)` };
    }

    const key = typeof art.key === 'string' ? art.key.trim() : (art.url ? String(art.url).split('/').pop() || '' : '');
    const url = typeof art.url === 'string' ? art.url.trim() : '';

    parsedArtifacts[artKey] = {
      sha256,
      key,
      url
    };
  }

  // Validate Frames (must contain exactly 16 valid frames)
  const frames: ManifestFrameRecord[] = [];
  if (!Array.isArray(obj.frames) || obj.frames.length !== 16) {
    return { ok: false, error: `Manifest frames array must contain exactly 16 frames, got ${Array.isArray(obj.frames) ? obj.frames.length : 'non-array'}` };
  }

  const seenPoses = new Set<string>();
  const seenIndices = new Set<number>();

  for (let i = 0; i < obj.frames.length; i++) {
    const f = obj.frames[i] as Record<string, unknown>;
    const poseId = typeof f?.poseId === 'string' ? f.poseId.trim() : '';
    const poseIndex = typeof f?.poseIndex === 'number' ? f.poseIndex : -1;
    const frameSha256 = typeof f?.frameSha256 === 'string' ? f.frameSha256.trim() : '';
    const rawSha256 = typeof f?.rawSha256 === 'string' ? f.rawSha256.trim() : '';

    if (!poseId || !VALID_POSE_IDS.has(poseId)) {
      return { ok: false, error: `Invalid poseId "${poseId}" at index ${i}` };
    }
    if (poseIndex < 0 || poseIndex >= 16) {
      return { ok: false, error: `Invalid poseIndex ${poseIndex} for pose "${poseId}"` };
    }
    if (!frameSha256 || frameSha256.length !== 64) {
      return { ok: false, error: `Invalid frameSha256 for pose "${poseId}"` };
    }
    if (!rawSha256 || rawSha256.length !== 64) {
      return { ok: false, error: `Invalid rawSha256 for pose "${poseId}"` };
    }

    seenPoses.add(poseId);
    seenIndices.add(poseIndex);

    frames.push({
      poseId,
      poseIndex,
      frameSha256,
      rawSha256
    });
  }

  if (seenPoses.size !== 16 || seenIndices.size !== 16) {
    return { ok: false, error: 'Duplicate pose IDs or indices in manifest frames' };
  }

  const manifest: GuardianManifest = {
    v: 1,
    guardianId,
    versions: (obj.versions as Record<string, string>) || {},
    identityHash,
    telemetrySnapshotHash: typeof obj.telemetrySnapshotHash === 'string' ? obj.telemetrySnapshotHash : undefined,
    identity,
    modelId,
    referenceSha256,
    state,
    frames,
    artifacts: parsedArtifacts as GuardianManifest['artifacts'],
    publishedAt: typeof obj.publishedAt === 'number' ? obj.publishedAt : undefined
  };

  return { ok: true, manifest };
}
