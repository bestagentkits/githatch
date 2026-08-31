---
title: "hatch-eggs-pipeline"
description: "Kế hoạch triển khai quy trình Hatch Eggs & Sinh Linh Thú (Guardian) cho từng user dựa trên dữ liệu GitHub và Gemini Nano Banana 2"
status: completed
priority: P1
effort: "4d"
tags: ["gemini-nano-banana-2", "hatch-eggs", "deterministic-dna", "16-pose-landing", "contour-slicing", "cloudflare-queue", "gacha-reveal", "d1-r2-persistence"]
created: 2026-08-30
---

# Kế Hoạch Triển Khai Quy Trình Hatch Eggs & Sinh Linh Thú (GitHoot Architecture)

## Overview

Kế hoạch này hệ thống hoá toàn bộ quy trình **Hatch Eggs & Sinh Linh Thú Guardian** cho từng lập trình viên trên `githoot.com`. Hệ thống kết hợp giữa **tính tất định tuyệt đối (Deterministic DNA Engine)** và **sức mạnh tạo hình ấn tượng của Gemini Nano Banana 2**, giải quyết triệt để các bài toán khó đã được kiểm chứng thực nghiệm:
- Bảo toàn bất biến `1 GitHub ID = 1 Immutable Guardian DNA` qua namespace `githoot:dna:v1:<github_user_id>`.
- Đưa nền tảng Persistence (D1 Migration v2, R2 Key Scheme, State Machine, Manifest v1) lên **Phase 1** làm nền móng vững chắc thay vì trì hoãn về cuối.
- Trích xuất 12 chỉ số GitHub thành `IdentitySpec` thuần enum, suy diễn loài (8 loài chính xác theo hệ nguyên tố) và giới hạn kiểu hình tương thích sinh học.
- Quy trình 2 bước cho user mới: **Bootstrap Reference Candidate** (state `VERIFYING` trên R2/D1) → **Approve Reference** (ký duyệt có gắn mã băm SHA-256) → **Pin Canonical Reference**.
- Chuyển đổi hàng đợi Cloudflare Queue sang mô hình **16 pose đơn lẻ (1 pose / 1 API call)** + ghép lưới local, loại bỏ 100% rủi ro model trả sai số ô hoặc lặp pose.
- Bộ cắt lọc viền xanh **Connected-Component Contour Detection** (cắt theo vùng biên thực tế, không cắt theo toạ độ mù).
- Trình diễn Gacha Hatch Reveal với hoạt ảnh **Superhero Landing (16 khung hình CSS steps(15))**, hiệu ứng chấn động camera shake, nứt sàn và nổ pháo hoa hạt năng lượng.

---

## Goals

| # | Goal | Target Metric | Priority |
|---|------|---------------|----------|
| 1 | **Persistence & Deterministic Identity Foundation** | D1 Migration v2, R2 Schema, State Machine và 100% byte-identical IdentitySpec | P1 |
| 2 | **Durable Reference Bootstrap & Approval** | Candidate lưu R2/D1, duyệt ngữ nghĩa có chữ ký mã băm trước khi sinh poses | P1 |
| 3 | **Nano Banana 2 Queue Pipeline (16 Poses)** | 16 poses độc lập, kiểm duyệt 4 cổng tự động, ghép thành 4x4 sheet (1024²) & strip (4096x256) | P1 |
| 4 | **Superhero Landing Player UI & Gacha Reveal** | 16 frames mượt mà @ 1.1s, đồng bộ chấn động F7 (tiếp đất 3 điểm) & F8 (nứt sàn), offset $-(k-1)\times 256\text{px}$ | P1 |
| 5 | **Publication Preflight Gate & Staging E2E QA** | Cổng kiểm tra trước xuất bản fail-closed, xác thực toàn bộ mã băm PNG/WebP và 0 lỗi console | P1 |

---

## Phases Roadmap

| # | Phase | File | Status | Priority | Effort |
|---|-------|------|--------|----------|--------|
| 1 | **Contracts, D1 Schema & Identity Engine** | [phase-01-deterministic-identity-engine.md](./phase-01-deterministic-identity-engine.md) | In-Progress | P1 | 1.0d |
| 2 | **Durable Reference Bootstrap & Approval** | [phase-02-bootstrap-reference-minting.md](./phase-02-bootstrap-reference-minting.md) | Pending | P1 | 0.8d |
| 3 | **Nano Banana 2 Async Queue (16 Poses)** | [phase-03-nano-banana-async-queue.md](./phase-03-nano-banana-async-queue.md) | Pending | P1 | 1.0d |
| 4 | **Gacha Reveal & 16-Frame Player UI** | [phase-04-gacha-reveal-and-player-ui.md](./phase-04-gacha-reveal-and-player-ui.md) | Pending | P1 | 0.8d |
| 5 | **Publication Preflight & Autonomous QA** | [phase-05-production-hardening-and-qa.md](./phase-05-production-hardening-and-qa.md) | Pending | P1 | 0.4d |

---

## Core Invariants

1. **Deterministic DNA (1 GitHub ID = 1 Guardian):** Hạt giống `dna_seed = SHA-256("githoot:dna:v1:" + github_user_id)` là bất biến. Không bao giờ cho phép reroll miễn phí hoặc đổi linh thú tuỳ tiện.
2. **Species-Constrained Phenotype:** Mỗi hệ nguyên tố ánh xạ duy nhất 1 loài kinh điển (`emberfox`, `neonbyte`, `abyssal`, `verdant`, `solargriffin`, `voidstalker`, `rustgolem`, `celestialdrake`). Kiểu hình (silhouette, crest, build) bắt buộc phải nằm trong tập hợp tương thích của loài đó.
3. **No Blind Grid Slicing:** Không bao giờ yêu cầu AI sinh cả lưới ảnh rồi cắt mù theo toạ độ cố định. Luôn sinh từng pose riêng lẻ có đính kèm ảnh reference để giữ danh tính, sau đó ghép lưới tại máy chủ.
4. **Shared Strict Validation:** Mọi khung hình (dù sinh mới hay đọc từ cache) đều phải vượt qua bộ lọc `validateFrame()`: loại bỏ ảnh collage (>4 vùng lớn), ảnh đa nhân vật (vùng 2 > 30% vùng 1), subject quá nhỏ (<6%) hoặc bbox quá rộng (aspect > 3.2).
5. **No Key Leaks & Portability:** Khởi tạo `GEMINI_API_KEY` ưu tiên `process.env` (CI/Cloudflare), sau đó mới tới `.env` local. Tuyệt đối không in giá trị key ra log, prompt hay chat.
6. **Publication Preflight Gate:** Trạng thái `status = 'ASSET_READY'` chỉ được ghi vào D1 khi và chỉ khi: Reference đã APPROVED, đủ 16 poses đã qua raw gate + semantic review trong `guardian_hatch_frames`, cả 2 định dạng PNG và WebP khớp mã băm SHA-256 trên R2, và browser verify ghi nhận 0 lỗi console.

---

## Success Criteria

- [ ] D1 Migration v2 áp dụng thành công trên local và production, khởi tạo đầy đủ các bảng quản lý job, candidate và hatch frames.
- [ ] Toàn bộ 35+ tests trong test suite determinism & gates pass 100%.
- [ ] Quy trình hatch user mới tạo ra reference candidate trên R2/D1, yêu cầu duyệt ngữ nghĩa trước khi cho phép sinh 16 poses.
- [ ] Queue worker sinh thành công 16 pose superhero landing chất lượng cao, xuất bản đồng thời PNG + WebP trên R2.
- [ ] Gacha reveal modal trên frontend phát mượt mà hoạt ảnh tiếp đất 3 điểm và rung màn hình với công thức offset chính xác $-(k-1)\times 256\text{px}$.
- [ ] Browser QA tự động kiểm tra đạt điểm chất lượng 100/100, 0 lỗi console, không rò rỉ secret.

---

## Red Team Review

### Session — 2026-08-30
**Findings:** 5 (5 accepted, 0 rejected)
**Severity breakdown:** 3 Critical, 2 High, 0 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | **Queue Binding & Export Handler Mismatch:** wrangler.toml dùng `AI_QUEUE` nhưng plan đặt tên `githoot-generation-queue`; thiếu queue export trong `src/server/index.ts` | Critical | Accept | Phase 1 |
| 2 | **Claim Authentication & Principal Derivation:** `POST /api/claim` thiếu ràng buộc session OAuth có thể bị injection user ID giả | Critical | Accept | Phase 2 |
| 3 | **Two-Phase Safe CAS Reference Approval:** R2 copy và D1 approval không cùng transaction có thể gây mồ côi reference khi R2 lỗi | Critical | Accept | Phase 2 |
| 4 | **Per-Pose Frame Checkpointing:** Thiếu lưu vết từng frame vào D1 làm lặp chi phí và dễ timeout 15 phút khi queue retry | High | Accept | Phase 1, Phase 3 |
| 5 | **Publication Preflight Gate on 16 Semantic Verdicts:** Preflight phải kiểm tra đủ 16 rows trong `guardian_hatch_frames` thay vì chỉ kiểm tra reference | High | Accept | Phase 5 |

### Whole-Plan Consistency Sweep
- **Tất cả các phase đã được đồng bộ:** D1 migration tạo bảng `guardian_hatch_frames`, binding thống nhất `AI_QUEUE`, claim lấy `github_user_id` từ session cookie, R2 copy trước D1 CAS approve, offset tua frame $-(k-1)\times 256\text{px}$, và preflight kiểm tra 16 bản ghi.
- **Không còn mâu thuẫn tồn đọng:** 0 unresolved contradictions.

<!-- slug: hatch-eggs-pipeline -->
