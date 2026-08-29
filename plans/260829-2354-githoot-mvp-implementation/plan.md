---
title: "githoot-mvp-implementation"
description: "Kế hoạch thực thi chi tiết cho GitHoot (githoot.com) - Nền tảng Gamified Developer Identity & Viral Gacha Hatch tại Edge."
status: in-progress
priority: P1
effort: "7d"
tags: ["cloudflare-edge", "gemini-nano-banana-2", "spritesheet", "gacha-funnel", "viral-distribution", "github-resilience"]
created: 2026-08-29
---

# GitHoot MVP Implementation Plan (githoot.com)

## Overview

**GitHoot** (`githoot.com`) biến đổi profile GitHub thành một sinh vật huyền bí sống động (Fantasy Developer Guardian). Dự án tập trung vào phễu phân phối lan truyền (Viral Distribution Funnel) với trải nghiệm mở trứng phong cách Gacha cực kỳ cuốn hút, hoạt ảnh Spritesheet mượt mà cho cả Trứng và Pet (Gemini Nano Banana 2), thẻ chia sẻ động (Animated OpenGraph Previews), cùng cơ chế Early Access 100 suất miễn phí và kiến trúc Cloudflare Edge-First siêu chịu tải chống nghẽn GitHub API.

## Goals

| # | Goal | Target Metric | Priority |
|---|------|---------------|----------|
| 1 | **Chịu tải và Kháng nghẽn GitHub API** | 0% lỗi rate limit khi đạt 100k req/hr (Pool Tokens + SWR Cache + Degraded Seed) | P1 |
| 2 | **Trải nghiệm Mở trứng Sinh động (Spritesheets)** | 8–10 loại Trứng AI + Pet Nano Banana 2 có Spritesheet 60fps (Idle, Emotions, Actions) | P1 |
| 3 | **Cơ chế Early Access & Quản lý Chi phí** | 100 slots miễn phí đầu tiên; kiểm soát chi phí sinh ảnh AI không bị âm ngân sách | P1 |
| 4 | **Tỷ lệ Chuyển đổi & Lan truyền (Viral Share)** | > 20% Claim Rate (Egg -> Claim) và > 25% Share Rate (Hatch -> Social Share) | P1 |
| 5 | **Hiển thị Chia sẻ Động (Animated OG Previews)** | Dynamic Share Cards (GIF/APNG/WebP/MP4) tối ưu hiển thị trên X, LinkedIn, Discord | P2 |
| 6 | **Vận hành Tiệm cận 0đ Máy chủ** | Triển khai 100% trên Cloudflare Pages/Workers + D1 + R2 + KV | P1 |

## Phases Overview

| # | Phase | File | Status | Priority | Effort |
|---|-------|------|--------|----------|--------|
| 1 | **Foundation & GitHub Resilient Resolver** | [phase-01-foundation-and-resolver.md](./phase-01-foundation-and-resolver.md) | In Progress | P1 | 1.5d |
| 2 | **Pre-Generated AI Eggs & Spritesheet Engine** | [phase-02-ai-eggs-and-spritesheet.md](./phase-02-ai-eggs-and-spritesheet.md) | Pending | P1 | 1.0d |
| 3 | **GitHub OAuth, Early Access Gate & Claim Transaction** | [phase-03-oauth-and-early-access.md](./phase-03-oauth-and-early-access.md) | Pending | P1 | 1.0d |
| 4 | **Gemini Nano Banana 2 Pipeline & Pet Spritesheet** | [phase-04-nano-banana-pet-spritesheet.md](./phase-04-nano-banana-pet-spritesheet.md) | Pending | P1 | 1.5d |
| 5 | **Gacha Reveal, Viral Distribution & Animated Share** | [phase-05-gacha-reveal-and-viral-share.md](./phase-05-gacha-reveal-and-viral-share.md) | Pending | P1 | 1.0d |
| 6 | **Retention Loop, Tamagotchi State & Launch** | [phase-06-retention-and-launch.md](./phase-06-retention-and-launch.md) | Pending | P2 | 1.0d |

## Core Architectural Invariants

1. **Kháng nghẽn GitHub API (Anti-Throttling Architecture):** Mọi lượt xem ẩn danh `/:username` đều được phục vụ từ Cloudflare KV (Stale-While-Revalidate). Nếu API GitHub bị rate limit, hệ thống chuyển sang chế độ *Degraded Seed Mode* (sinh trứng dựa trên hàm băm của username mà không làm sập trang).
2. **Deterministic DNA & 1 Account = 1 Pet:** Mỗi `github_user_id` (numeric ID) tạo ra duy nhất một hạt giống DNA bất biến. Không cho phép reroll tùy tiện.
3. **AI Generation Gate:** Chỉ tài khoản GitHub đã OAuth thành công và nằm trong quota Early Access (hoặc đã xác nhận chi phí) mới được phép trigger API Gemini Nano Banana 2.
4. **Spritesheet Matrix Contract:** Ảnh Pet sinh ra từ Nano Banana 2 sử dụng prompt layout dạng lưới 3x3 / 4x2 chuẩn hóa để trích xuất các khung hình Idle, Emotions (Happy, Sleepy, Proud, Angry) và Actions (Work, Celebrate).
5. **Zero Infrastructure Cost:** Tận dụng tối đa Cloudflare Free/Pro Tier (Workers, D1, R2, KV).

## Success Criteria

- [ ] Route `githoot.com/:username` phản hồi < 150ms tại Edge và chịu được tải 100k requests/hr không dính lỗi GitHub rate-limit.
- [ ] 8–10 loại Trứng AI có spritesheet chuyển động mượt mà (idle, wobble, crack, hatch).
- [ ] Quá trình sinh Pet qua Gemini Nano Banana 2 tạo ra Hero Portrait + Spritesheet hoàn chỉnh trong thời gian < 5s.
- [ ] Cổng Early Access kiểm soát chính xác 100 lượt hatch miễn phí và khóa chuyển trạng thái minh bạch.
- [ ] Trải nghiệm Hatch Reveal phong cách Gacha đạt tỷ lệ click share X/LinkedIn > 25%.
- [ ] Thẻ OpenGraph động (Animated preview) hiển thị sắc nét trên Twitter/X và LinkedIn.
- [ ] Endpoint `/badge/:username.svg` nhúng trực tiếp vào GitHub README hoạt động ổn định.

<!-- slug: githoot-mvp-implementation -->
