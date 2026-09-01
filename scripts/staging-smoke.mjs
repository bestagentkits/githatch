// ============================================================================
// GitHoot Staging E2E Smoke & Operator Review Ceremony Runner
// (scripts/staging-smoke.mjs)
// Real Network Operations - Mandatory Operator Review Pause - No Self-Approval
// ============================================================================

import fs from 'fs';
import path from 'path';

function loadLocalEnv() {
  const envPath = process.env.GITHOOT_ENV_PATH || 'D:/www/oss/githatch/.env';
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadLocalEnv();

function getReportsDir() {
  const reportsDir = path.resolve(process.cwd(), 'plans/260831-1233-hatch-pipeline-production-hardening/reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  return reportsDir;
}

/**
 * Inspects a staging hatch job, fetches the immutable review bundle,
 * prints all frame and reference URLs for human review, and pauses.
 */
export async function inspectStagingJob(jobId, options = {}) {
  const stagingDomain = options.stagingDomain || process.env.STAGING_DOMAIN || 'githoot-staging.pages.dev';
  const adminSecret = options.adminSecret || process.env.ADMIN_REVIEW_SECRET;

  if (!adminSecret) {
    throw new Error('Missing ADMIN_REVIEW_SECRET in environment for staging inspection');
  }

  const reviewUrl = `https://${stagingDomain}/auth/admin/review/${jobId}`;
  console.log(`\n[StagingReview] Fetching immutable review bundle from ${reviewUrl}...`);

  const res = await fetch(reviewUrl, {
    headers: {
      Authorization: `Bearer ${adminSecret}`,
      Accept: 'application/json'
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch review bundle for ${jobId} (HTTP ${res.status}): ${errText}`);
  }

  const bundle = await res.json();
  const reportsDir = getReportsDir();
  const evidencePath = path.join(reportsDir, 'phase-08-e2e-evidence.json');

  const evidence = {
    timestamp: Date.now(),
    stagingDomain,
    jobId: bundle.jobId,
    guardianId: bundle.guardianId,
    guardianName: bundle.guardianName,
    species: bundle.species,
    element: bundle.element,
    rarity: bundle.rarity,
    referenceSha256: bundle.referenceSha256,
    referenceUrl: bundle.referenceUrl,
    manifestSha256: bundle.manifestSha256,
    manifestUrl: bundle.manifestUrl,
    bundleSha: bundle.bundleSha,
    framesCount: bundle.frames?.length || 0,
    frames: bundle.frames,
    status: 'PAUSED_FOR_OPERATOR_REVIEW',
    verdict: 'WITHHELD_AWAITING_OPERATOR_CEREMONY'
  };

  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');

  console.log('\n========================================================================');
  console.log('🏛️  GITHOOT STAGING REVIEW BUNDLE INSPECTION');
  console.log('========================================================================');
  console.log(`Job ID:          ${bundle.jobId}`);
  console.log(`Guardian ID:     ${bundle.guardianId}`);
  console.log(`Companion:       ${bundle.guardianName} (${bundle.species} / ${bundle.element} / ${bundle.rarity})`);
  console.log(`Reference Image: ${bundle.referenceUrl}`);
  console.log(`Manifest URL:    ${bundle.manifestUrl}`);
  console.log(`Canonical SHA:   ${bundle.bundleSha}`);
  console.log('------------------------------------------------------------------------');
  console.log('16 CANDIDATE FRAMES:');
  for (const f of bundle.frames || []) {
    console.log(`  [${String(f.poseIndex).padStart(2, '0')}] ${f.poseId.padEnd(20)} -> ${f.url} (${f.frameSha256.slice(0, 16)}...)`);
  }
  console.log('========================================================================');
  console.log('🛑 OPERATOR REVIEW PAUSE: Inspect the 16 frames and reference image above.');
  console.log('To submit an explicit review decision, run:');
  console.log(`  node scripts/staging-smoke.mjs decide ${jobId} --decision approve --reviewer <your-email> --bundle-sha ${bundle.bundleSha} [--notes <notes>]`);
  console.log('or');
  console.log(`  node scripts/staging-smoke.mjs decide ${jobId} --decision reject --reviewer <your-email> --bundle-sha ${bundle.bundleSha} --notes <reason>`);
  console.log('========================================================================\n');

  return evidence;
}

/**
 * Submits an explicit human/operator review decision to the staging review route.
 */
export async function submitStagingDecision(jobId, options = {}) {
  const stagingDomain = options.stagingDomain || process.env.STAGING_DOMAIN || 'githoot-staging.pages.dev';
  const adminSecret = options.adminSecret || process.env.ADMIN_REVIEW_SECRET;
  const decision = options.decision;
  const reviewer = options.reviewer;
  const bundleSha = options.bundleSha;
  const notes = options.notes || `Explicit ${decision} by ${reviewer}`;

  if (!adminSecret) {
    throw new Error('Missing ADMIN_REVIEW_SECRET in environment');
  }
  if (!decision || (decision !== 'approve' && decision !== 'reject')) {
    throw new Error('Missing or invalid --decision flag. Must be "approve" or "reject".');
  }
  if (!reviewer || reviewer.trim().length === 0) {
    throw new Error('Missing required --reviewer flag with human operator identity.');
  }
  if (!bundleSha || bundleSha.trim().length !== 64) {
    throw new Error('Missing or invalid --bundle-sha flag (must be 64-hex canonical SHA).');
  }

  const reviewUrl = `https://${stagingDomain}/auth/admin/review/${jobId}`;
  console.log(`\n[StagingDecision] Submitting ${decision.toUpperCase()} decision by ${reviewer} to ${reviewUrl}...`);

  const res = await fetch(reviewUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminSecret}`,
      Accept: 'application/json'
    },
    body: JSON.stringify({
      decision,
      bundleSha,
      notes
    })
  });

  const responseJson = await res.json();
  const reportsDir = getReportsDir();
  const evidencePath = path.join(reportsDir, 'phase-08-e2e-evidence.json');

  if (!res.ok) {
    console.error(`[StagingDecision] ❌ Decision submission failed (HTTP ${res.status}):`, responseJson);
    throw new Error(`Decision submission failed: ${responseJson?.error || JSON.stringify(responseJson)}`);
  }

  const evidence = {
    timestamp: Date.now(),
    stagingDomain,
    jobId,
    decision,
    reviewer,
    bundleSha,
    notes,
    response: responseJson,
    verdict: decision === 'approve' && responseJson?.status === 'ASSET_READY' ? 'GO' : 'REJECTED'
  };

  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');

  console.log(`[StagingDecision] ✅ Decision "${decision}" successfully recorded.`);
  if (decision === 'approve') {
    console.log(`[StagingDecision] 🏆 Companion published to ASSET_READY (Manifest: ${responseJson.manifestUrl})`);
  } else {
    console.log(`[StagingDecision] 🛑 Companion quarantined as requested.`);
  }

  return evidence;
}

// CLI runner
if (process.argv[1] && process.argv[1].endsWith('staging-smoke.mjs')) {
  const cmd = process.argv[2];
  const targetJobId = process.argv[3];

  const parseFlag = (flag) => {
    const idx = process.argv.indexOf(flag);
    return idx > 0 && idx < process.argv.length - 1 ? process.argv[idx + 1] : undefined;
  };

  if (cmd === 'inspect' && targetJobId) {
    inspectStagingJob(targetJobId).catch(err => {
      console.error('[StagingSmoke] Inspect error:', err.message);
      process.exit(1);
    });
  } else if (cmd === 'decide' && targetJobId) {
    submitStagingDecision(targetJobId, {
      decision: parseFlag('--decision'),
      reviewer: parseFlag('--reviewer'),
      bundleSha: parseFlag('--bundle-sha'),
      notes: parseFlag('--notes')
    }).catch(err => {
      console.error('[StagingSmoke] Decide error:', err.message);
      process.exit(1);
    });
  } else {
    console.log('Usage:');
    console.log('  node scripts/staging-smoke.mjs inspect <jobId>');
    console.log('  node scripts/staging-smoke.mjs decide <jobId> --decision <approve|reject> --reviewer <email> --bundle-sha <sha> [--notes <notes>]');
  }
}
