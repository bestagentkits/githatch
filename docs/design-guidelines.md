# GitHoot Design Guidelines & Design System

## 1. Aesthetic Direction: Option 1 - Cyber-Arcade Fantasy

GitHoot (`githoot.com`) sử dụng ngôn ngữ thiết kế **Cyber-Arcade Fantasy**, kết hợp giữa thẩm mỹ kỳ ảo viễn tưởng (Dark Terminal / Cosmic Fantasy) và phong cách máy game Gacha Nhật Bản. Giao diện tối ưu hóa cho lập trình viên với cảm giác hiện đại, công nghệ cao, lôi cuốn và kích thích lan truyền trên mạng xã hội (X/Twitter, LinkedIn).

---

## 2. Design Tokens & Color Palette

Hệ màu tuân thủ tỷ lệ phân bổ thị giác 60 / 30 / 10 và sử dụng các sắc độ OKLCH / Hex có độ tương phản cao:

### Color Roles

| Token | Hex | Role | Usage |
|---|---|---|---|
| `--bg-base` | `#07090E` | Nền chính (Deep Cosmic Black) | Nền toàn trang, độ sâu vũ trụ |
| `--bg-surface-1` | `#0D111A` | Bề mặt cấp 1 | Thẻ card chính, panel nội dung |
| `--bg-surface-2` | `#141B27` | Bề mặt cấp 2 | Hộp thống kê, sidebar, sub-panel |
| `--bg-surface-3` | `#1C2637` | Bề mặt cấp 3 | Khung Canvas, vùng hover, input |
| `--text-primary` | `#F0F6FC` | Chữ chính (High Contrast) | Tiêu đề H1-H3, nhãn quan trọng |
| `--text-secondary` | `#8B9BB4` | Chữ phụ | Đoạn mô tả, thông tin chi tiết |
| `--text-muted` | `#53627A` | Chữ mờ | Metadata, footer, timestamp |
| `--accent-cyan` | `#00F0FF` | Điểm nhấn chính (Primary Accent) | Nút bấm chính, viền phát sáng, icon |
| `--accent-magenta` | `#FF2A85` | Điểm nhấn Gacha (Secondary Pop) | Độ hiếm Legendary, nút vỡ trứng, badges |
| `--accent-amber` | `#FFA800` | Cảnh báo / Điểm nhấn phụ | Sao vàng, Primary Realm, năng lượng |
| `--accent-green` | `#00FF88` | Trạng thái tích cực | Đèn online, commit < 24h, cache hit |

### Shadow & Glow Effects
- `--glow-cyan`: `0 0 24px rgba(0, 240, 255, 0.35)`
- `--glow-magenta`: `0 0 24px rgba(255, 42, 133, 0.35)`
- `--card-shadow`: `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 240, 255, 0.12)`

---

## 3. Typography Hierarchy

| Cấp bậc | Phông chữ | Kích thước | Trọng lượng | Line Height |
|---|---|---|---|---|
| **Display / H1** | `Archivo`, sans-serif | `clamp(28px, 4vw, 42px)` | 900 (Black) | 1.15 |
| **Section H2** | `Archivo`, sans-serif | `24px - 32px` | 800 (ExtraBold) | 1.2 |
| **Card Title H3** | `Archivo`, sans-serif | `18px - 20px` | 700 (Bold) | 1.3 |
| **Body Text** | `Schibsted Grotesk`, sans-serif | `15px - 16px` | 400 (Regular) | 1.6 |
| **Data / Numbers** | `JetBrains Mono`, monospace | `14px - 18px` | 700 (Bold, Tabular) | 1.4 |
| **Micro Labels** | `JetBrains Mono`, monospace | `11px - 12px` | 700 (Uppercase +0.08em) | 1.2 |

---

## 4. Spacing Scale (4pt Base)

| Token | Giá trị | Ứng dụng |
|---|---|---|
| `--sp-1` | `4px` | Padding trong micro-badge, khoảng cách icon nhỏ |
| `--sp-2` | `8px` | Khoảng cách giữa các phần tử nội bộ (icon + text) |
| `--sp-3` | `12px` | Padding nút bấm nhỏ, khoảng cách nhãn |
| `--sp-4` | `16px` | Padding thẻ card mặc định, gap danh sách |
| `--sp-6` | `24px` | Padding panel lớn, khoảng cách giữa các khối |
| `--sp-8` | `32px` | Khoảng cách giữa các section con |
| `--sp-12` | `48px` | Khoảng cách giữa các phần lớn |
| `--sp-16` | `64px` | Padding dọc của section trên desktop |

---

## 5. Animation & Motion Tokens

- **Timing Rules:**
  - Tương tác phản hồi tức thì (Hover, Active): `100ms - 150ms`.
  - Chuyển đổi trạng thái (Modal, Tooltip): `200ms - 300ms`.
  - Hoạt ảnh nứt mở trứng (Egg Hatching Sequence): `800ms - 1200ms`.
- **Easing:**
  - `--ease-out-expo`: `cubic-bezier(0.16, 1, 0.3, 1)`
  - `--ease-spring`: `cubic-bezier(0.175, 0.885, 0.32, 1.275)`
- **Accessibility:** Tôn trọng `@media (prefers-reduced-motion: reduce)` bằng cách tắt chuyển động rung lắc và giữ ảnh tĩnh.

---

## 6. Spritesheet Specifications

- **Egg Spritesheet:** 4 dải hoạt ảnh (`idle` 6 frames, `wobble` 8 frames, `crack` 10 frames, `hatch_burst` 16 frames).
- **Pet Spritesheet (Gemini Nano Banana 2):** Lưới 4x2 chuẩn hóa gồm Hero Portrait (512x512) và 7 tư thế (`idle`, `happy`, `sleepy`, `proud`, `angry`, `work`, `celebrate`) đã xử lý tách nền Alpha và Green De-spill.
