// ============================================================================
// GitHoot Cost-Recovery Gate Modal (src/client/components/CheckoutModal.tsx)
// ============================================================================

import React, { useState } from 'react';

export interface CheckoutModalProps {
  username: string;
  isOpen: boolean;
  onClose: () => void;
  onVoucherRedeemed?: (code: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  username,
  isOpen,
  onClose,
  onVoucherRedeemed
}) => {
  const [voucherCode, setVoucherCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherCode.trim()) {
      setError('Please enter a valid voucher code');
      return;
    }
    if (onVoucherRedeemed) {
      onVoucherRedeemed(voucherCode.trim());
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(7, 9, 14, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px'
    }}>
      <div style={{
        background: '#0d111a',
        border: '2px solid #00f0ff',
        borderRadius: '16px',
        maxWidth: '520px',
        width: '100%',
        padding: '32px',
        boxShadow: '0 0 40px rgba(0, 240, 255, 0.35)',
        color: '#f0f6fc',
        fontFamily: "'Schibsted Grotesk', sans-serif"
      }}>
        <div style={{ display: 'inline-block', background: 'rgba(255, 42, 133, 0.15)', border: '1px solid #ff2a85', color: '#ff2a85', padding: '4px 12px', borderRadius: '9999px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 800, marginBottom: '16px' }}>
          ★ 100 FREE SLOTS CLAIMED ★
        </div>

        <h3 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '24px', fontWeight: 900, marginBottom: '8px' }}>
          Mở Khóa Hatching Cho @{username}
        </h3>

        <p style={{ fontSize: '14px', color: '#8b9bb4', lineHeight: 1.5, marginBottom: '24px' }}>
          100 suất Early Access miễn phí ban đầu đã được nhận hết. Để đảm bảo dự án vận hành bền vững không bị lỗ chi phí AI, mỗi lượt mở trứng tiếp theo có mức phí tượng trưng:
        </p>

        {/* Pricing Card */}
        <div style={{ background: '#141b27', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '12px', padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px' }}>1x Guardian AI Hatch</div>
            <div style={{ fontSize: '12px', color: '#8b9bb4' }}>Hero Portrait + 7 Poses Spritesheet trọn đời</div>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '24px', fontWeight: 900, color: '#00f0ff' }}>
            $0.99
          </div>
        </div>

        {/* Direct Checkout Button */}
        <a
          href={`/api/checkout/stripe?username=${encodeURIComponent(username)}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: '#00f0ff',
            color: '#000',
            padding: '14px',
            borderRadius: '8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '14px',
            fontWeight: 800,
            textDecoration: 'none',
            boxShadow: '0 0 20px rgba(0,240,255,0.3)',
            marginBottom: '16px'
          }}
        >
          ⚡ Thanh Toán $0.99 Qua Stripe / Card
        </a>

        {/* Voucher Form */}
        <form onSubmit={handleRedeem} style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
          <div style={{ fontSize: '12px', color: '#8b9bb4', marginBottom: '8px', fontWeight: 600 }}>
            Hoặc nhập mã Voucher / Sponsor Code:
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="VD: GITHOOT-DEV-2026"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              style={{
                flex: 1,
                background: '#07090e',
                border: '1px solid rgba(0,240,255,0.3)',
                borderRadius: '6px',
                padding: '10px 14px',
                color: '#fff',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px'
              }}
            />
            <button
              type="submit"
              style={{
                background: '#1c2637',
                border: '1px solid #00f0ff',
                color: '#00f0ff',
                padding: '10px 18px',
                borderRadius: '6px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Áp Dụng
            </button>
          </div>
          {error && <div style={{ color: '#ff2a85', fontSize: '11px', marginTop: '6px' }}>{error}</div>}
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#53627a', fontSize: '13px', cursor: 'pointer' }}
          >
            ← Quay lại trang xem trứng
          </button>
        </div>
      </div>
    </div>
  );
};
