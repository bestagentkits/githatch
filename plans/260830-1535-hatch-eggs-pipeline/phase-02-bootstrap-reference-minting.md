---
phase: 2
title: "Durable Reference Bootstrap & Approval"
status: pending
priority: P1
effort: "0.8d"
dependencies: ["1"]
---

# Phase 2: Durable Reference Bootstrap & Approval

## Overview
Xây dựng quy trình tạo và phê duyệt ảnh mẫu gốc (Canonical Identity Reference) an toàn, chống rò rỉ quyền hạn và chống race condition trên nền tảng Cloudflare D1 và R2. Đảm bảo luồng Claim HTTP bắt buộc phải xác thực thông qua OAuth session của GitHub (không tin cậy JSON client gửi lên), quy trình sinh candidate chạy bất đồng bộ qua Queue, và quy trình phê duyệt (Approval) thực hiện theo nguyên tắc khôi phục 2 pha an toàn: upload và xác minh mã băm trên R2 trước, sau đó mới cập nhật trạng thái `APPROVED` trên D1.

## Requirements
- **Functional:**
  - **Xác Thực Phiên Làm Việc Cho Luồng Claim (`POST /api/claim`):**
    - Bắt buộc phải có Session Middleware xác thực phiên đăng nhập GitHub OAuth hợp lệ từ cookie (`src/server/routes/auth.ts:47-64`).
    - Trích xuất `github_user_id` trực tiếp từ server-side session principal, từ chối mọi request cố ý gửi đè `github_user_id` trong body để ngăn chặn tấn công mạo danh người khác để tiêu tốn ngân sách AI.
    - Chạy Atomic D1 Transaction: kiểm tra quota/payment, tạo Guardian `status = 'PENDING'`, ghi nhận job vào `guardian_hatch_jobs` và đẩy message vào `AI_QUEUE`. Phản hồi HTTP 200 tức thì (<100ms).
  - **Durable Reference Minting (Queue Worker Step 1):**
    - Nếu Guardian chưa có canonical reference (user mới): Worker gọi `compileReferencePrompt(spec)`, gửi tới Gemini Nano Banana 2.
    - Lọc viền xanh và cổng hình học `validateFrame({ stage: 'raw' })`.
    - Upload R2 candidate: `candidates/{guardian_id}/{candidate_sha256}.png`.
    - Ghi D1 `guardian_reference_candidates`: lưu vết toàn bộ mã băm và đặt `state = 'VERIFYING'`.
  - **Quy Trình Phê Duyệt Khôi Phục 2 Pha (Two-Phase Safe CAS Approval):**
    - Bước 1 (R2 Idempotent Put & Hash Check): Đọc ảnh candidate từ R2, tính toán lại mã băm SHA-256 thực tế, sao chép sang đường dẫn bất biến `references/{reference_sha256}.png` và gán header `Cache-Control: public, max-age=31536000, immutable`. Nếu bước R2 lỗi, dừng lại và KHÔNG chạm vào D1.
    - Bước 2 (D1 Atomic Finalize): Thực thi lệnh D1 Transaction:
      ```sql
      UPDATE guardian_reference_candidates
      SET state = 'APPROVED', reviewer = ?, verdict_data = ?
      WHERE id = ? AND state = 'VERIFYING';
      
      UPDATE guardians
      SET reference_sha256 = ?
      WHERE id = ?;
      ```
  - **Khóa Bất Biến Vĩnh Viễn:**
    - Nghiêm cấm mọi hành vi re-bootstrap hay re-approve khi đã có canonical reference.
- **Non-functional:**
  - Cổng phê duyệt reference có thể chạy độc lập không cần `GEMINI_API_KEY`.

## Architecture
```
Authenticated User Claim (POST /api/claim)
  ├─ Xác thực GitHub OAuth Session Cookie (Lấy github_user_id chuẩn từ Server)
  └─ Atomic D1 Batch: Quota Check + Create Pending Guardian + Enqueue AI_QUEUE
        ↓
Cloudflare Queue Worker (Bước 1: Reference Minting)
        ↓
compileReferencePrompt(spec) → Gemini API → Raw Gate & De-spill
        ↓
Upload R2: candidates/{guardian_id}/{candidate_sha256}.png
Ghi D1: guardian_reference_candidates (state: 'VERIFYING')
        ↓
┌────────────────────────────────────────────────────────────┐
│ QUY TRÌNH DUYỆT NGỮ NGHĨA 2 PHA (Two-Phase Safe Approval)  │
│  ├─ Pha 1: Copy R2 references/{sha256}.png & Verify Hash   │
│  └─ Pha 2: D1 Transaction (state='APPROVED' & set pointer) │
└────────────────────────────────────────────────────────────┘
        ↓
Sẵn Sàng Cho Bước Tiếp Theo: Sinh 16 Poses
```

## Related Code Files
- Create:
  - `src/server/services/ai/reference-manager.ts` (Quản lý vòng đời candidate, lưu R2/D1, và Two-Phase CAS approval)
- Modify:
  - `src/server/routes/auth.ts` (Tích hợp Session Middleware và bảo vệ endpoint claim)
  - `src/server/services/claim/transaction.ts` (Cập nhật schema lưu guardian pending và enqueue)
  - `src/server/queue/generation-worker.ts` (Tích hợp kiểm tra và sinh reference candidate)
- Tests:
  - `tests/unit/reference-manager.test.ts` (Kiểm thử 2 pha approval, chống race condition, và khóa bất biến)
  - `tests/unit/claim-auth.test.ts` (Kiểm thử chặn request claim không có session hoặc mạo danh user ID)

## Implementation Steps
1. Xây dựng module `src/server/services/ai/reference-manager.ts` chứa các hàm: `mintCandidateOnR2`, `twoPhaseApproveReference`, `getCanonicalReference`.
2. Sửa `src/server/routes/auth.ts`: bảo vệ route claim bằng session cookie của GitHub OAuth, chặn mọi tham số user ID truyền tự do từ body.
3. Tích hợp `reference-manager` vào `src/server/queue/generation-worker.ts`: nếu guardian chưa có `reference_sha256`, worker sinh candidate, upload R2, ghi D1 và dừng ở bước chờ duyệt ngữ nghĩa.
4. Viết unit tests `tests/unit/reference-manager.test.ts` và `tests/unit/claim-auth.test.ts` kiểm thử toàn diện cả về bảo mật và tính toàn vẹn 2 pha của dữ liệu.

## Success Criteria
- [x] Endpoint `/api/claim` từ chối 100% các request không có session OAuth hợp lệ.
- [x] Reference candidate được lưu an toàn trên R2 và D1 với trạng thái `VERIFYING`.
- [x] Quy trình duyệt 2 pha đảm bảo không bao giờ có trường hợp D1 ghi nhận `APPROVED` nhưng file R2 canonical bị thiếu.
- [x] Không thể sinh 16 poses nếu chưa có canonical reference ở trạng thái `APPROVED`.

## Risk Assessment
- **Rủi ro:** Khi R2 bị timeout ở pha 1, thao tác duyệt bị dừng lại.
  - **Tín hiệu nhận biết:** Error log ghi nhận R2 network failure.
  - **Phương án xử lý:** Trạng thái D1 vẫn là `VERIFYING`, reviewer có thể bấm Approve lại mà không bị khoá chết hệ thống.
