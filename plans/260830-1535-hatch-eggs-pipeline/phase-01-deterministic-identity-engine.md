---
phase: 1
title: "Contracts, D1 Schema & Identity Engine"
status: in-progress
priority: P1
effort: "1.0d"
dependencies: []
---

# Phase 1: Contracts, D1 Schema & Identity Engine

## Overview
Xây dựng nền tảng Persistence và Queue Topology vững chắc cho toàn bộ quy trình Hatch Eggs: thiết kế và áp dụng file di trú Cloudflare D1 Schema Migration v2 (bao gồm bảng quản lý job và lưu vết từng pose `guardian_hatch_frames`), cấu hình R2 Storage Key Scheme bất biến, chuẩn hoá Queue Binding `AI_QUEUE` / `githoot-ai-queue` kèm export queue handler tại `src/server/index.ts`, định nghĩa State Machine vòng đời Guardian (`PENDING` -> `GENERATING` -> `VERIFYING` -> `QUARANTINED` -> `ASSET_READY`), và tích hợp động cơ định danh tất định (`IdentitySpec`) vào runtime backend của GitHoot.

## Requirements
- **Functional:**
  - **D1 Schema Migration v2 (`0002_hatch_pipeline_v2.sql`):**
    - Mở rộng bảng `guardians`: thêm `dna_version` (TEXT), `status` (TEXT DEFAULT 'PENDING'), `telemetry_snapshot` (TEXT), `identity_spec` (TEXT), `reference_sha256` (TEXT), `request_fingerprint` (TEXT), `manifest_url` (TEXT). Cho phép `hero_image_url` mang giá trị `NULL` khi linh thú đang ở trạng thái chờ sinh ảnh.
    - Tạo bảng `guardian_reference_candidates`: `id` (TEXT PK), `guardian_id` (TEXT FK), `candidate_sha256` (TEXT), `identity_hash` (TEXT), `prompt_hash` (TEXT), `model_id` (TEXT), `raw_sha256` (TEXT), `state` (TEXT DEFAULT 'VERIFYING'), `reviewer` (TEXT), `verdict_data` (TEXT), `created_at` (INTEGER).
    - Tạo bảng `guardian_hatch_jobs`: `id` (TEXT PK), `guardian_id` (TEXT FK), `request_fingerprint` (TEXT UNIQUE), `state` (TEXT), `model_id` (TEXT), `attempts_count` (INTEGER), `frames_completed` (INTEGER), `manifest_url` (TEXT), `error_log` (TEXT), `created_at` (INTEGER), `updated_at` (INTEGER).
    - Tạo bảng `guardian_hatch_frames` (Lưu vết độc lập từng pose để chống lặp chi phí khi retry): `id` (TEXT PK), `job_id` (TEXT FK), `pose_id` (TEXT), `pose_index` (INTEGER), `frame_sha256` (TEXT), `raw_sha256` (TEXT), `state` (TEXT), `raw_gate_metrics` (TEXT), `semantic_verdict` (TEXT), `created_at` (INTEGER), UNIQUE(`job_id`, `pose_id`).
  - **R2 Storage Key Scheme:**
    - Canonical References: `references/{reference_sha256}.png` và `references/{reference_sha256}.json` (Bất biến, Cache-Control immutable 1 năm).
    - Reference Candidates: `candidates/{guardian_id}/{candidate_sha256}.png`.
    - Per-Pose Frames: `guardians/{guardian_id}/frames/f{NN}_{frame_sha256}.png`.
    - 16-Pose Composites: `guardians/{guardian_id}/landing16-sheet.png`, `landing16-sheet.webp`, `landing16-strip.png`, `landing16-strip.webp`, `manifest.json`.
  - **Wrangler Queue Binding & Server Export:**
    - Chuẩn hoá sử dụng binding `AI_QUEUE` và queue `githoot-ai-queue` trong `wrangler.toml` (thống nhất với producer hiện có tại `src/server/services/github/resolver.ts:49-50`).
    - Cập nhật `src/server/index.ts` export đồng thời cả `fetch` (Hono app) và `queue(batch, env, ctx)` handler để phân luồng xử lý: điều phối tác vụ `HATCH_JOB` sang `generation-worker.ts` và tác vụ `REVALIDATE_PROFILE` sang resolver.
  - **Deterministic Identity Compiler (`compiler.ts` & `contracts.ts`):**
    - Port toàn bộ logic từ `.agents/skills/githoot-hatch/scripts/lib/` vào `src/server/services/dna/`.
    - 8 loài kinh điển theo hệ nguyên tố (`SPECIES`), kiểu hình tương thích sinh học (`SPECIES_PHENOTYPE`, `SPECIES_BUILDS`), và hỗ trợ `identityPin` cho các nhân vật mẫu.
- **Non-functional:**
  - Thời gian thực thi trích xuất `IdentitySpec` < 2ms.
  - 100% tests kiểm thử determinism và migration chạy thành công.

## Architecture
```
Cloudflare D1 Migration (0002_hatch_pipeline_v2.sql)
  ├─ guardians (Bổ sung status, telemetry_snapshot, identity_spec, reference_sha256)
  ├─ guardian_reference_candidates (Lưu vết duyệt candidate)
  ├─ guardian_hatch_jobs (Idempotent job tracking via request_fingerprint)
  └─ guardian_hatch_frames (Lưu vết từng frame đã accepted để resume không tốn tiền)
        ↓
Wrangler Topology & Entrypoint Export (wrangler.toml + src/server/index.ts)
  ├─ [[queues.producers]] binding = "AI_QUEUE" -> githoot-ai-queue
  ├─ [[queues.consumers]] queue = "githoot-ai-queue"
  └─ export default { fetch: app.fetch, queue: handleQueueMessages }
        ↓
Deterministic Identity Engine (src/server/services/dna/)
  ├─ normalizeTelemetry() -> compileIdentitySpec() -> compileAllPosePrompts()
  └─ Pure math & hashing (SHA-256 namespaced githoot:dna:v1:<id>)
```

## Related Code Files
- Create:
  - `src/server/db/migrations/0002_hatch_pipeline_v2.sql` (File migration D1 mở rộng bảng guardians, jobs, và hatch frames)
  - `src/server/services/dna/contracts.ts` (Bảng enum, versions, thresholds, allowlist)
  - `src/server/services/dna/compiler.ts` (Module compile IdentitySpec và prompts)
- Modify:
  - `src/server/db/schema.sql` (Đồng bộ schema tổng thể của dự án)
  - `src/server/index.ts` (Export queue handler bên cạnh fetch handler)
  - `src/server/services/dna/seed.ts` (Chuyển giao public interface `deriveGuardianDNA` sang compiler mới)
  - `src/server/types/index.ts` (Định nghĩa TypeScript types cho IdentitySpec, HatchFrameRecord, Manifest)
  - `wrangler.toml` (Thêm consumer binding chuẩn cho `githoot-ai-queue`)
- Tests:
  - `tests/unit/deterministic-identity.test.ts` (Kiểm thử 35+ assertions về tính tất định và chống mâu thuẫn sinh học)
  - `tests/unit/d1-schema-migration.test.ts` (Kiểm thử áp dụng migration 0002 trên in-memory SQLite / D1 local)

## Implementation Steps
1. Soạn thảo file migration `src/server/db/migrations/0002_hatch_pipeline_v2.sql` bổ sung 3 bảng mới và mở rộng bảng `guardians`. Cập nhật `src/server/db/schema.sql`.
2. Cập nhật `wrangler.toml` thiết lập consumer binding cho `githoot-ai-queue`. Sửa `src/server/index.ts` để export `queue` handler điều phối cả 2 loại message `HATCH_JOB` và `REVALIDATE_PROFILE`.
3. Xây dựng `src/server/services/dna/contracts.ts` và `src/server/services/dna/compiler.ts` chuyển đổi từ skill lib sang TypeScript an toàn.
4. Cập nhật `src/server/types/index.ts` bổ sung các kiểu dữ liệu `IdentitySpec`, `HatchFrameRecord`, `GuardianStatus`.
5. Viết unit tests `tests/unit/deterministic-identity.test.ts` và `tests/unit/d1-schema-migration.test.ts` đảm bảo 100% tests chạy thành công.

## Success Criteria
- [x] D1 Migration 0002 áp dụng mượt mà không xung đột với dữ liệu hiện có.
- [x] `src/server/index.ts` export đầy đủ cả fetch và queue consumer handler.
- [x] 35+ test assertions trong test suite determinism pass hoàn toàn.
- [x] Cùng 1 GitHub user ID sinh 1.000 lần luôn ra byte-identical `identityHash`.

## Risk Assessment
- **Rủi ro:** Queue consumer nhận cả 2 loại message (hatch pet và revalidate profile) nếu không kiểm tra `type` sẽ gây crash worker.
  - **Tín hiệu nhận biết:** Worker ném lỗi JSON parse hoặc thiếu trường dữ liệu.
  - **Phương án xử lý:** Sử dụng Discriminated Union pattern kiểm tra `msg.body.type === 'HATCH_JOB'` trước khi chuyển tiếp sang handler tương ứng.
