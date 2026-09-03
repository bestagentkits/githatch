import fs from 'fs';
import { execSync } from 'child_process';
import { compileIdentitySpec, validateIdentitySpec, canonicalJson } from '../src/server/services/dna/compiler';
import { sha256Hex } from '../src/server/services/crypto/web-crypto';

async function main() {
  const seed = 'a8173c3451b8d0e03c5a6606dc5ea833cd8ba23ec203074af0556b1024d5b0b2';
  const githubUserId = '6857382';
  const guardianId = 'ceb01e3f-4e68-4d3c-9d1c-54f2e87b572f';
  const jobId = `job-prod-${guardianId.slice(0, 8)}`;
  const now = Date.now();

  const spec = await compileIdentitySpec({
    githubUserId,
    telemetry: {},
    pin: { element: 'Cosmic', rarity: 'Common' }
  });

  const val = await validateIdentitySpec(spec, { githubUserId: Number(githubUserId) });
  if (!val.valid) {
    throw new Error(`Spec validation failed: ${val.reason}`);
  }
  if (spec.speciesName !== 'Zenith Celestial Drake') {
    throw new Error(`Species mismatch: expected Zenith Celestial Drake, got ${spec.speciesName}`);
  }

  const specJson = canonicalJson(spec);
  const requestFingerprint = await sha256Hex(`hatch:job:${guardianId}:${spec.identityHash}`);
  const outboxId = `outbox-prod-${guardianId.slice(0, 8)}`;

  console.log('Backfilling Guardian on Production D1:');
  console.log('  Guardian ID:', guardianId);
  console.log('  Species:', spec.species, '(', spec.speciesName, ')');
  console.log('  Element:', spec.element);
  console.log('  Identity Hash:', spec.identityHash);
  console.log('  Fingerprint:', requestFingerprint);

  const escapedSpec = specJson.replace(/'/g, "''");

  const sqlStatements = [
    `UPDATE guardians SET species = '${spec.species}', species_name = '${spec.speciesName}', anatomy = '${spec.anatomy}', element = '${spec.element}', rarity_tier = '${spec.rarity}', identity_spec = '${escapedSpec}', request_fingerprint = '${requestFingerprint}', hero_image_url = '/assets/sample-pets/${spec.species}.jpg' WHERE id = '${guardianId}';`,
    `INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, reserved_cents, spent_cents, created_at, updated_at) VALUES ('${jobId}', '${guardianId}', '${requestFingerprint}', 'PENDING', 'nano-banana-pro-preview', 0, 0, 0, 0, ${now}, ${now}) ON CONFLICT(request_fingerprint) DO UPDATE SET updated_at = ${now};`,
    `INSERT INTO guardian_outbox (id, claim_key, queue_name, payload, state, attempts, next_attempt_at, created_at, updated_at) VALUES ('${outboxId}', 'claim:${guardianId}', 'githoot-ai-queue', '{"v":1,"type":"HATCH_REFERENCE","jobId":"${jobId}","guardianId":"${guardianId}","attempt":1}', 'PENDING', 0, 0, ${now}, ${now}) ON CONFLICT(claim_key) DO UPDATE SET state = 'PENDING', attempts = 0, next_attempt_at = 0;`
  ];

  const tmpSql = 'tmp-backfill.sql';
  fs.writeFileSync(tmpSql, sqlStatements.join('\n'));

  try {
    execSync(`npx wrangler d1 execute githoot_db --remote --file ${tmpSql} --env-file D:/www/oss/githatch/.env`, { stdio: 'inherit' });
    console.log('✓ Successfully backfilled guardian, hatch job, and outbox on production D1');
  } finally {
    if (fs.existsSync(tmpSql)) fs.unlinkSync(tmpSql);
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
