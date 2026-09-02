// ============================================================================
// GitHoot Admin & Reviewer Hatch Publication Manager (src/server/services/ai/hatch-admin.ts)
// Single-Row D1 Pointer Winner Election & Idempotent Projections
// ============================================================================

import type { Env, HatchJobRecord, HatchFrameRecord } from '../../types';
import { verifyPublicationReady } from '../claim/publication-preflight';
import { createSemanticVerdict } from '../claim/verdict-contract';

export interface ApprovePosesOptions {
  guardianId: string;
  reviewer: string;
  verdict?: 'pass';
  env: Env;
}

export interface ApprovePosesResult {
  success: boolean;
  status: 'ASSET_READY' | 'QUARANTINED' | 'VERIFYING' | 'CONFLICT';
  manifestUrl: string | null;
  reasons?: string[];
  error?: string;
}

export interface GuardianPublicationRecord {
  guardian_id: string;
  job_id: string;
  manifest_sha256: string;
  manifest_key: string;
  spritesheet_sha256: string;
  spritesheet_key: string;
  state: string;
  reviewer: string;
  published_at: number;
  created_at: number;
}

/**
 * Executes independent semantic review approval for all 16 poses and triggers
 * the single-row D1 pointer publication CAS to atomically transition to ASSET_READY.
 */
export async function approveGuardianPosesAndPublish({
  guardianId,
  reviewer,
  verdict = 'pass',
  env
}: ApprovePosesOptions): Promise<ApprovePosesResult> {
  if (verdict !== 'pass' || !reviewer || reviewer.trim().length === 0) {
    throw new Error('Approval requires verdict: pass and a non-empty reviewer identity.');
  }

  const cdnHost = env.CDN_DOMAIN || 'cdn.githoot.com';

  // 1. Check if guardian is already published via guardian_publication pointer (Idempotent winner)
  const existingPub = await env.DB.prepare(
    'SELECT * FROM guardian_publication WHERE guardian_id = ?1'
  ).bind(guardianId).first<GuardianPublicationRecord>();
  if (existingPub && existingPub.state === 'ASSET_READY') {
    const pubManifestUrl = `https://${cdnHost}/${existingPub.manifest_key}`;
    const pubSpritesheetUrl = `https://${cdnHost}/${existingPub.spritesheet_key}`;

    // Reconcile/converge idempotent projections from the authoritative pointer
    try {
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE guardians
          SET status = 'ASSET_READY', spritesheet_url = ?1, manifest_url = ?2
          WHERE id = ?3;
        `).bind(pubSpritesheetUrl, pubManifestUrl, guardianId),

        env.DB.prepare(`
          UPDATE guardian_hatch_jobs
          SET state = 'ASSET_READY', manifest_url = ?1, updated_at = ?2
          WHERE guardian_id = ?3;
        `).bind(pubManifestUrl, Date.now(), guardianId)
      ]);
    } catch (reconcileErr) {
      console.warn('[HatchAdmin] Projection reconciliation failed:', reconcileErr);
    }

    return {
      success: true,
      status: 'ASSET_READY',
      manifestUrl: pubManifestUrl
    };
  }
  // 2. Fetch Guardian and Job
  const guardian = await env.DB.prepare(
    'SELECT id, name, status, reference_sha256 FROM guardians WHERE id = ?1'
  ).bind(guardianId).first<{ id: string; name: string; status: string; reference_sha256: string | null }>();

  if (!guardian) {
    throw new Error(`Guardian ${guardianId} not found in D1.`);
  }

  const job = await env.DB.prepare(
    'SELECT * FROM guardian_hatch_jobs WHERE guardian_id = ?1 ORDER BY created_at DESC LIMIT 1'
  ).bind(guardianId).first<HatchJobRecord>();

  if (!job) {
    throw new Error(`No hatch job found for guardian ${guardianId}.`);
  }

  // Strict dual-state validation: both guardian and job MUST be in VERIFYING state
  if (job.state !== 'VERIFYING' || guardian.status !== 'VERIFYING') {
    throw new Error(`Cannot approve mismatched state: job is "${job.state}" and guardian is "${guardian.status}" (both must be in VERIFYING state).`);
  }
  // 2. Fetch all 16 frames & validate pose indices
  const frames = await env.DB.prepare(
    'SELECT * FROM guardian_hatch_frames WHERE job_id = ?1 AND state = "ACCEPTED"'
  ).bind(job.id).all<HatchFrameRecord>();

  const frameList: HatchFrameRecord[] = frames.results || [];
  if (frameList.length !== 16) {
    throw new Error(`Cannot approve incomplete pose set: expected 16 frames, got ${frameList.length}`);
  }

  const indices = frameList.map(f => f.pose_index);
  if (new Set(indices).size !== 16) {
    throw new Error('Cannot approve: Duplicate or missing pose indices detected in frame set.');
  }
  // 3. Generate & Upload Authoritative Content-Addressed ASSET_READY Manifest
  // 4. Generate & Upload Authoritative Content-Addressed ASSET_READY Manifest
  let verifyingManifestKey = '';
  if (job.manifest_url) {
    try {
      verifyingManifestKey = new URL(job.manifest_url).pathname.replace(/^\/+/, '');
    } catch {
      verifyingManifestKey = job.manifest_url.replace(/^\/+/, '');
    }
  }
  if (!verifyingManifestKey) {
    verifyingManifestKey = `guardians/${guardianId}/manifest.json`;
  }

  const rawManifestObj = await env.ASSETS_BUCKET.get(verifyingManifestKey);
  let readyManifestKey = verifyingManifestKey;
  const publishedAt = Date.now();

  if (rawManifestObj) {
    let parsedManifestRaw: any = null;
    if (typeof (rawManifestObj as any).json === 'function') {
      parsedManifestRaw = await (rawManifestObj as any).json();
    } else if (typeof (rawManifestObj as any).text === 'function') {
      parsedManifestRaw = JSON.parse(await (rawManifestObj as any).text());
    } else if (typeof rawManifestObj.arrayBuffer === 'function') {
      parsedManifestRaw = JSON.parse(new TextDecoder().decode(await rawManifestObj.arrayBuffer()));
    }

    if (parsedManifestRaw) {
      const readyManifestData = {
        ...parsedManifestRaw,
        state: 'ASSET_READY',
        publishedAt
      };

      const { sha256Hex } = await import('../crypto/web-crypto');
      const readyManifestBytes = new TextEncoder().encode(JSON.stringify(readyManifestData, null, 2));
      const readyManifestSha = await sha256Hex(readyManifestBytes);
      readyManifestKey = `manifests/${readyManifestSha}.json`;

      await env.ASSETS_BUCKET.put(readyManifestKey, readyManifestBytes, {
        httpMetadata: { contentType: 'application/json', cacheControl: 'public, max-age=31536000, immutable' }
      });

      await env.DB.prepare('UPDATE guardian_hatch_jobs SET manifest_url = ?1 WHERE id = ?2')
        .bind(`https://${cdnHost}/${readyManifestKey}`, job.id).run();
    }
  }

  // 5. Run Strict Cryptographic Publication Preflight Gate over the ASSET_READY manifest
  const preflight = await verifyPublicationReady(guardianId, env, readyManifestKey);
  if (!preflight.ready || !preflight.manifestSha256 || !preflight.manifestKey) {
    console.warn(`[HatchAdmin] Preflight failed during approval for ${guardianId}:`, preflight.reasons);
    await env.DB.batch([
      env.DB.prepare('UPDATE guardians SET status = "QUARANTINED" WHERE id = ?1').bind(guardianId),
      env.DB.prepare('UPDATE guardian_hatch_jobs SET state = "QUARANTINED", error_log = ?1, updated_at = ?2 WHERE id = ?3')
        .bind(`PREFLIGHT_FAILED: ${preflight.reasons.join('; ')}`, Date.now(), job.id)
    ]);
    return {
      success: false,
      status: 'QUARANTINED',
      manifestUrl: `https://${cdnHost}/${readyManifestKey}`,
      reasons: preflight.reasons
    };
  }

  const manifestSha = preflight.manifestSha256;
  const manifestKey = preflight.manifestKey;
  const spritesheetSha = preflight.spritesheetSha256 || 'strip-sha';
  const spritesheetKey = preflight.spritesheetKey || `masters/${spritesheetSha}.png`;
  const manifestUrl = `https://${cdnHost}/${manifestKey}`;
  const spritesheetUrl = `https://${cdnHost}/${spritesheetKey}`;
  // 5. Authoritative Single-Row D1 CAS Winner Election
  try {
    const insertRes = await env.DB.prepare(`
      INSERT INTO guardian_publication (
        guardian_id, job_id, manifest_sha256, manifest_key, spritesheet_sha256, spritesheet_key, state, reviewer, published_at, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'ASSET_READY', ?7, ?8, ?8);
    `).bind(
      guardianId,
      job.id,
      manifestSha,
      manifestKey,
      spritesheetSha,
      spritesheetKey,
      reviewer.trim(),
      publishedAt
    ).run();

    const changes = insertRes.meta?.changes ?? (insertRes as unknown as { changes?: number })?.changes ?? 1;
    if (changes === 0) {
      return {
        success: false,
        status: 'CONFLICT',
        manifestUrl,
        error: 'CONCURRENT_PUBLICATION_CONFLICT: Another reviewer won the publication pointer.'
      };
    }
  } catch (casErr) {
    console.warn(`[HatchAdmin] Publication CAS conflict for ${guardianId}:`, casErr);
    return {
      success: false,
      status: 'CONFLICT',
      manifestUrl,
      error: `CONCURRENT_PUBLICATION_CONFLICT: ${(casErr as Error).message}`
    };
  }

  // 6. Post-CAS Idempotent Projections (Tolerant of changes: 0)
  try {
    await env.DB.prepare(`
      UPDATE guardians
      SET status = 'ASSET_READY', spritesheet_url = ?1, manifest_url = ?2
      WHERE id = ?3;
    `).bind(spritesheetUrl, manifestUrl, guardianId).run();

    await env.DB.prepare(`
      UPDATE guardian_hatch_jobs
      SET state = 'ASSET_READY', manifest_url = ?1, updated_at = ?2
      WHERE id = ?3;
    `).bind(manifestUrl, publishedAt, job.id).run();
  } catch (projErr) {
    console.warn(`[HatchAdmin] Post-CAS projection failed (non-fatal, pointer row is authoritative):`, projErr);
  }
  if (env.CACHE_KV) {
    try {
      const ghAccount = await env.DB.prepare('SELECT login FROM github_accounts WHERE user_id = (SELECT user_id FROM guardians WHERE id = ?1)').bind(guardianId).first<{ login: string }>();
      if (ghAccount && ghAccount.login) {
        await env.CACHE_KV.delete(`gh:profile:v3:${ghAccount.login.toLowerCase()}`);
        await env.CACHE_KV.delete(`gh:profile:${ghAccount.login.toLowerCase()}`);
      }
    } catch {}
  }

  console.log(`[HatchAdmin] Successfully published guardian ${guardianId} to ASSET_READY (manifest: ${manifestSha})`);

  return {
    success: true,
    status: 'ASSET_READY',
    manifestUrl
  };
}
