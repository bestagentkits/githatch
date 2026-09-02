// ============================================================================
// GitHoot Publication Preflight Gate (src/server/services/claim/publication-preflight.ts)
// Cryptographic Byte-Digest & Cross-Field Agreement Verification
// ============================================================================

import type { Env, ReferenceCandidateRecord, HatchFrameRecord, IdentitySpec } from '../../types';
import { sha256Hex } from '../crypto/web-crypto';
import { validateAndNormalizeFrame, type FrameGateMetrics } from '../image/frame-gate';
import { fetchRawObjectFromR2 } from '../ai/reference-manager';
import { parseGuardianManifest, type GuardianManifest } from './manifest-schema';
import { validateSemanticVerdict } from './verdict-contract';
import { POSE_SET } from '../dna/contracts';
export interface PreflightResult {
  ready: boolean;
  reasons: string[];
  manifest?: GuardianManifest;
  manifestSha256?: string;
  manifestKey?: string;
  spritesheetSha256?: string;
  spritesheetKey?: string;
}

export interface PreflightEvaluationInput {
  referenceApproved: boolean;
  referenceSha256: string | null;
  framesCount: number;
  framesAccepted: number;
  hasUniquePoseIndices: boolean;
  framesHaveGateMetrics: boolean;
  framesHaveSemanticVerdicts: boolean;
  hasSheetPng: boolean;
  hasSheetWebp: boolean;
  hasStripPng: boolean;
  hasStripWebp: boolean;
  hasManifest: boolean;
  manifestHasArtifactHashes: boolean;
}

export function evaluatePreflightCriteria(input: PreflightEvaluationInput): PreflightResult {
  const reasons: string[] = [];

  if (!input.referenceApproved || !input.referenceSha256) {
    reasons.push('Reference hero frame not approved in guardian_reference_candidates');
  }

  if (input.framesCount !== 16 || input.framesAccepted !== 16) {
    reasons.push(`Incomplete frames: ${input.framesAccepted}/${input.framesCount} accepted (expected 16)`);
  }

  if (!input.hasUniquePoseIndices) {
    reasons.push('Missing or duplicate pose indices in 16-frame set');
  }

  if (!input.framesHaveGateMetrics) {
    reasons.push('Some frames are missing raw bounding box & contour gate metrics');
  }

  if (!input.framesHaveSemanticVerdicts) {
    reasons.push('Some frames lack hash-bound semantic review approval');
  }

  if (!input.hasSheetPng) {
    reasons.push('Missing landing16-sheet.png on R2 storage');
  }

  if (!input.hasSheetWebp) {
    reasons.push('Missing landing16-sheet.webp on R2 storage');
  }

  if (!input.hasStripPng) {
    reasons.push('Missing landing16-strip.png on R2 storage');
  }

  if (!input.hasStripWebp) {
    reasons.push('Missing landing16-strip.webp on R2 storage');
  }

  if (!input.hasManifest) {
    reasons.push('Missing manifest.json on R2 storage');
  }

  if (!input.manifestHasArtifactHashes) {
    reasons.push('Manifest JSON is missing SHA-256 hashes for all 4 output master artifacts');
  }

  return {
    ready: reasons.length === 0,
    reasons
  };
}
export async function verifyPublicationReady(
  guardianId: string,
  env: Env,
  targetManifestKey?: string
): Promise<PreflightResult> {
  const reasons: string[] = [];

  if (!env.DB) {
    return { ready: false, reasons: ['D1 Database unavailable'] };
  }
  if (!env.ASSETS_BUCKET) {
    return { ready: false, reasons: ['R2 ASSETS_BUCKET unavailable'] };
  }

  // 1. Fetch Guardian record
  const guardian = await env.DB.prepare(
    'SELECT id, reference_sha256, status, identity_spec, dna_seed FROM guardians WHERE id = ?1'
  ).bind(guardianId).first<{ id: string; reference_sha256: string | null; status: string; identity_spec: string; dna_seed: string }>();

  if (!guardian) {
    return { ready: false, reasons: [`Guardian ${guardianId} not found in D1`] };
  }

  // 2. Check Reference Approval status (Strict Fail-Closed)
  const refSha = guardian.reference_sha256;
  if (!refSha) {
    reasons.push('Reference hero frame not set on guardian record');
  } else {
    const candidate = await env.DB.prepare(
      'SELECT state, candidate_sha256, verdict_data FROM guardian_reference_candidates WHERE guardian_id = ?1 AND candidate_sha256 = ?2 AND (state = "APPROVED" OR state = \'APPROVED\')'
    ).bind(guardianId, refSha).first<ReferenceCandidateRecord>();

    if (!candidate || candidate.state !== 'APPROVED' || candidate.candidate_sha256 !== refSha) {
      reasons.push(`Reference ${refSha} not approved in guardian_reference_candidates`);
    } else {
      // Verify Reference Image bytes in R2
      const refObj = await env.ASSETS_BUCKET.get(`references/${refSha}.png`);
      if (!refObj) {
        reasons.push(`Reference image references/${refSha}.png missing from R2 storage`);
      } else {
        const refBuf = new Uint8Array(await refObj.arrayBuffer());
        const actualRefSha = await sha256Hex(refBuf);
        if (actualRefSha !== refSha) {
          reasons.push(`Reference image references/${refSha}.png SHA mismatch: expected ${refSha}, got ${actualRefSha}`);
        }
      }
    }
  }

  // 3. Fetch Hatch Job & Frames from D1
  const job = await env.DB.prepare(
    'SELECT id, state, model_id, manifest_url FROM guardian_hatch_jobs WHERE guardian_id = ?1 ORDER BY created_at DESC LIMIT 1'
  ).bind(guardianId).first<{ id: string; state: string; model_id: string; manifest_url: string | null }>();

  if (!job) {
    return { ready: false, reasons: [`No hatch job found for guardian ${guardianId}`] };
  }

  const frames = await env.DB.prepare(
    'SELECT * FROM guardian_hatch_frames WHERE job_id = ?1'
  ).bind(job.id).all<HatchFrameRecord>();

  const frameList: HatchFrameRecord[] = frames.results || [];
  if (frameList.length !== 16) {
    reasons.push(`Incomplete frames in D1: ${frameList.length}/16 total frames found (expected 16)`);
  }

  // Strict check: every single frame in D1 MUST have state === 'ACCEPTED'
  const acceptedFrames = frameList.filter(f => f.state === 'ACCEPTED');
  if (acceptedFrames.length !== 16) {
    reasons.push(`Unaccepted frames in D1: only ${acceptedFrames.length}/16 frames are in ACCEPTED state`);
  }

  const poseIndices = frameList.map(f => f.pose_index);
  if (new Set(poseIndices).size !== 16 || !frameList.every(f => typeof f.pose_index === 'number' && f.pose_index >= 0 && f.pose_index < 16)) {
    reasons.push('Missing or duplicate pose indices in 16-frame set');
  }

  // 4. Fetch and Validate Content-Addressed Manifest from R2
  let manifestKey = targetManifestKey || '';
  if (!manifestKey && job.manifest_url) {
    try {
      const url = new URL(job.manifest_url);
      manifestKey = url.pathname.replace(/^\/+/, '');
    } catch {
      manifestKey = job.manifest_url.replace(/^\/+/, '');
    }
  }
  if (!manifestKey) {
    manifestKey = `guardians/${guardianId}/manifest.json`;
  }

  const manifestObj = await env.ASSETS_BUCKET.get(manifestKey);
  if (!manifestObj) {
    return { ready: false, reasons: [...reasons, `Manifest object ${manifestKey} missing from R2`] };
  }

  const manifestBuf = new Uint8Array(await manifestObj.arrayBuffer());
  const actualManifestSha = await sha256Hex(manifestBuf);
  let parsedRawManifest: unknown;
  try {
    parsedRawManifest = JSON.parse(new TextDecoder().decode(manifestBuf));
  } catch (err) {
    return { ready: false, reasons: [...reasons, `Manifest JSON parse failed: ${(err as Error).message}`] };
  }

  const parseResult = await parseGuardianManifest(parsedRawManifest);
  if (!parseResult.ok) {
    return { ready: false, reasons: [...reasons, `Manifest schema validation failed: ${parseResult.error}`] };
  }

  const manifest = parseResult.manifest;

  // Enforce manifest state must be ASSET_READY for publication
  if (manifest.state !== 'ASSET_READY') {
    reasons.push(`Manifest state is "${manifest.state}", expected "ASSET_READY" for publication`);
  }

  // 5. Cross-Field Agreement Verification
  if (guardian.reference_sha256 && manifest.referenceSha256 !== guardian.reference_sha256) {
    reasons.push(`Cross-field mismatch: guardian.reference_sha256 (${guardian.reference_sha256}) != manifest.referenceSha256 (${manifest.referenceSha256})`);
  }

  let parsedGuardianSpec: IdentitySpec | null = null;
  try {
    parsedGuardianSpec = typeof guardian.identity_spec === 'string' ? JSON.parse(guardian.identity_spec) : guardian.identity_spec;
  } catch {}

  if (parsedGuardianSpec) {
    if (parsedGuardianSpec.identityHash !== manifest.identityHash) {
      reasons.push(`Cross-field mismatch: guardian identityHash (${parsedGuardianSpec.identityHash}) != manifest identityHash (${manifest.identityHash})`);
    }
    if (parsedGuardianSpec.dnaSeed !== manifest.identity.dnaSeed) {
      reasons.push(`Cross-field mismatch: guardian DNA seed (${parsedGuardianSpec.dnaSeed}) != manifest DNA seed (${manifest.identity.dnaSeed})`);
    }
  }

  if (job.model_id && manifest.modelId !== job.model_id) {
    reasons.push(`Cross-field mismatch: job modelId (${job.model_id}) != manifest modelId (${manifest.modelId})`);
  }

  // 6. Pose-by-Pose D1 <-> Manifest <-> Bytes Tri-Directional Agreement
  const d1FramesMap = new Map(frameList.map(f => [f.pose_id, f]));
  const manifestFramesMap = new Map(manifest.frames.map(f => [f.poseId, f]));

  for (const pose of POSE_SET) {
    const d1Frame = d1FramesMap.get(pose.id);
    const mFrame = manifestFramesMap.get(pose.id);

    if (!d1Frame) {
      reasons.push(`Pose ${pose.id} missing from D1 frames`);
      continue;
    }
    if (!mFrame) {
      reasons.push(`Pose ${pose.id} missing from manifest frames`);
      continue;
    }

    // Compare D1 and Manifest frame metadata
    if (d1Frame.pose_index !== mFrame.poseIndex) {
      reasons.push(`Pose ${pose.id} pose_index mismatch: D1 (${d1Frame.pose_index}) != manifest (${mFrame.poseIndex})`);
    }
    if (d1Frame.frame_sha256 !== mFrame.frameSha256) {
      reasons.push(`Pose ${pose.id} frame_sha256 mismatch: D1 (${d1Frame.frame_sha256}) != manifest (${mFrame.frameSha256})`);
    }
    if (d1Frame.raw_sha256 !== mFrame.rawSha256) {
      reasons.push(`Pose ${pose.id} raw_sha256 mismatch: D1 (${d1Frame.raw_sha256}) != manifest (${mFrame.rawSha256})`);
    }

    // Check and parse raw_gate_metrics in D1
    let storedMetrics: FrameGateMetrics | null = null;
    if (!d1Frame.raw_gate_metrics) {
      reasons.push(`Frame ${d1Frame.pose_id} is missing raw_gate_metrics in D1`);
    } else {
      try {
        const parsed = typeof d1Frame.raw_gate_metrics === 'string' ? JSON.parse(d1Frame.raw_gate_metrics) : d1Frame.raw_gate_metrics;
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          typeof parsed.componentsCount !== 'number' ||
          typeof parsed.dominanceRatio !== 'number' ||
          typeof parsed.fillRatio !== 'number' ||
          typeof parsed.aspectRatio !== 'number'
        ) {
          reasons.push(`Frame ${d1Frame.pose_id} has invalid raw_gate_metrics schema in D1 (missing componentsCount, dominanceRatio, fillRatio, or aspectRatio)`);
        } else {
          storedMetrics = parsed as FrameGateMetrics;
        }
      } catch (metricsErr) {
        reasons.push(`Frame ${d1Frame.pose_id} raw_gate_metrics JSON parse failed: ${(metricsErr as Error).message}`);
      }
    }

    // Verify R2 Raw Frame Bytes + Re-run Contour Gate
    const rawResult = await fetchRawObjectFromR2(env.ASSETS_BUCKET, guardianId, d1Frame.raw_sha256);
    if (!rawResult) {
      reasons.push(`Raw frame with SHA ${d1Frame.raw_sha256} missing from R2 for pose ${d1Frame.pose_id}`);
    } else {
      const rawBuf = new Uint8Array(await rawResult.object.arrayBuffer());
      const actualRawSha = await sha256Hex(rawBuf);
      if (actualRawSha !== d1Frame.raw_sha256) {
        reasons.push(`Raw frame SHA mismatch for pose ${d1Frame.pose_id}: expected ${d1Frame.raw_sha256}, got ${actualRawSha}`);
      } else {
        const rawKey = rawResult.key;
        // Re-run Phase 3 contour gate over retained raw input
        const gateResult = await validateAndNormalizeFrame(rawBuf);
        if (!gateResult.ok) {
          reasons.push(`Raw frame ${rawKey} failed contour gate re-evaluation: ${gateResult.reasons.join('; ')}`);
        } else if (gateResult.frameSha256 !== d1Frame.frame_sha256) {
          reasons.push(`Raw frame ${rawKey} gate re-evaluation produced frameSha ${gateResult.frameSha256} != recorded ${d1Frame.frame_sha256}`);
        } else if (storedMetrics) {
          // Cross-check stored gate metrics against authoritative recomputed gate metrics
          if (storedMetrics.componentsCount !== gateResult.metrics.componentsCount) {
            reasons.push(`Frame ${d1Frame.pose_id} gate metrics componentsCount mismatch: stored ${storedMetrics.componentsCount} != recomputed ${gateResult.metrics.componentsCount}`);
          }
          if (Math.abs(storedMetrics.dominanceRatio - gateResult.metrics.dominanceRatio) > 0.001) {
            reasons.push(`Frame ${d1Frame.pose_id} gate metrics dominanceRatio mismatch: stored ${storedMetrics.dominanceRatio} != recomputed ${gateResult.metrics.dominanceRatio}`);
          }
          if (Math.abs(storedMetrics.fillRatio - gateResult.metrics.fillRatio) > 0.001) {
            reasons.push(`Frame ${d1Frame.pose_id} gate metrics fillRatio mismatch: stored ${storedMetrics.fillRatio} != recomputed ${gateResult.metrics.fillRatio}`);
          }
          if (Math.abs(storedMetrics.aspectRatio - gateResult.metrics.aspectRatio) > 0.001) {
            reasons.push(`Frame ${d1Frame.pose_id} gate metrics aspectRatio mismatch: stored ${storedMetrics.aspectRatio} != recomputed ${gateResult.metrics.aspectRatio}`);
          }
        }
      }
    }
    // Verify R2 Normalized Frame Bytes
    const frameKey = `guardians/${guardianId}/frames/f${d1Frame.pose_id}_${d1Frame.frame_sha256}.png`;
    const fObj = await env.ASSETS_BUCKET.get(frameKey);
    if (!fObj) {
      reasons.push(`Normalized frame ${frameKey} missing from R2`);
    } else {
      const fBuf = new Uint8Array(await fObj.arrayBuffer());
      const actualFrameSha = await sha256Hex(fBuf);
      if (actualFrameSha !== d1Frame.frame_sha256) {
        reasons.push(`Normalized frame ${frameKey} SHA mismatch: expected ${d1Frame.frame_sha256}, got ${actualFrameSha}`);
      }
    }

    // Check semantic review verdict
    if (!d1Frame.semantic_verdict) {
      reasons.push(`Frame ${d1Frame.pose_id} is missing semantic review verdict`);
    } else {
      let parsedVerdict: unknown;
      try {
        parsedVerdict = typeof d1Frame.semantic_verdict === 'string' ? JSON.parse(d1Frame.semantic_verdict) : d1Frame.semantic_verdict;
      } catch {
        parsedVerdict = null;
      }
      const verdictCheck = validateSemanticVerdict(parsedVerdict, d1Frame.frame_sha256);
      if (!verdictCheck.valid) {
        reasons.push(`Frame ${d1Frame.pose_id} invalid semantic verdict: ${verdictCheck.reason}`);
      }
    }
  }

  // 7. Verify All 4 Master Artifacts on R2 (SHA-256 recomputation over actual bytes)
  const masterArtifactEntries = [
    { name: 'sheetPng', art: manifest.artifacts.sheetPng },
    { name: 'sheetWebp', art: manifest.artifacts.sheetWebp },
    { name: 'stripPng', art: manifest.artifacts.stripPng },
    { name: 'stripWebp', art: manifest.artifacts.stripWebp }
  ];

  for (const item of masterArtifactEntries) {
    const art = item.art;
    const artKey = art.key || (art.url ? new URL(art.url).pathname.replace(/^\/+/, '') : '');
    if (!artKey) {
      reasons.push(`Master artifact ${item.name} is missing R2 key`);
      continue;
    }

    const obj = await env.ASSETS_BUCKET.get(artKey);
    if (!obj) {
      reasons.push(`Master artifact ${item.name} (${artKey}) missing from R2`);
      continue;
    }

    const buf = new Uint8Array(await obj.arrayBuffer());
    const actualSha = await sha256Hex(buf);
    if (actualSha !== art.sha256) {
      reasons.push(`Master artifact ${item.name} (${artKey}) SHA mismatch: expected ${art.sha256}, got ${actualSha}`);
    }
  }

  const stripPngKey = manifest.artifacts.stripPng.key || `masters/${manifest.artifacts.stripPng.sha256}.png`;

  return {
    ready: reasons.length === 0,
    reasons,
    manifest,
    manifestSha256: actualManifestSha,
    manifestKey,
    spritesheetSha256: manifest.artifacts.stripPng.sha256,
    spritesheetKey: stripPngKey
  };
}
