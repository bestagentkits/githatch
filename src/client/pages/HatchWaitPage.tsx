// ============================================================================
// GitHoot Hatch Waiting & Realtime Generation Polling Page (src/client/pages/HatchWaitPage.tsx)
// ============================================================================

import React, { useEffect, useState } from 'react';
import type { ResolvedProfile } from '../../server/types';

export interface HatchWaitPageProps {
  username: string;
  guardianId: string;
  onReady: () => void;
}

export const HatchWaitPage: React.FC<HatchWaitPageProps> = ({
  username,
  guardianId,
  onReady
}) => {
  const [statusMessage, setStatusMessage] = useState('Connecting to Cloudflare AI Queue DAG...');
  const [dots, setDots] = useState('');
  const [isTakingLong, setIsTakingLong] = useState(false);

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);

    const warnTimer = setTimeout(() => {
      setIsTakingLong(true);
    }, 20000);
    let isSubscribed = true;

    // Real status polling
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/profile/${encodeURIComponent(username)}`);
        if (!res.ok) return;

        const data = (await res.json()) as ResolvedProfile;
        if (!isSubscribed) return;

        if (data.guardian) {
          const status = data.guardian.status;
          if (status === 'ASSET_READY' || data.guardian.spritesheet_url) {
            setStatusMessage('Linh thú đã thức tỉnh hoàn tất!');
            clearInterval(pollInterval);
            onReady();
          } else if (status === 'VERIFYING') {
            setStatusMessage('Đang thực hiện kiểm tra chất lượng và kiểm duyệt ngữ nghĩa...');
          } else if (status === 'GENERATING') {
            setStatusMessage('Gemini Nano Banana 2 đang sinh 16 poses tiếp đất...');
          } else {
            setStatusMessage('Đang phân tích dòng code và hạt giống DNA...');
          }
        }
      } catch {
        // Polling error non-fatal
      }
    }, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(dotsInterval);
      clearInterval(pollInterval);
      clearTimeout(warnTimer);
    };
  }, [username, guardianId, onReady]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #1b0a2a 0%, #050608 100%)',
      color: '#f0f6fc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Schibsted Grotesk', sans-serif",
      padding: '24px',
      textAlign: 'center'
    }}>
      {/* Glowing Energy Orb */}
      <div style={{
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, #ff2a85, #00f0ff)',
        boxShadow: '0 0 50px rgba(0, 240, 255, 0.6), 0 0 100px rgba(255, 42, 133, 0.4)',
        marginBottom: '32px',
        animation: 'pulseGlow 2s infinite ease-in-out'
      }} />

      <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '28px', fontWeight: 900, marginBottom: '12px' }}>
        Awakening Guardian for @{username}{dots}
      </h2>

      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '13px',
        color: '#00f0ff',
        background: 'rgba(0,240,255,0.08)',
        border: '1px solid rgba(0,240,255,0.25)',
        padding: '10px 24px',
        borderRadius: '9999px',
        maxWidth: '560px',
        marginBottom: '16px'
      }}>
        Connecting to Cloudflare AI Queue DAG...
      </div>
      <p style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '14px',
        color: '#00f0ff',
        marginBottom: '8px',
        minHeight: '24px'
      }}>
        {statusMessage}
        <span>{dots}</span>
      </p>

      <p style={{ fontSize: '13px', color: '#8b9bb4', maxWidth: '480px' }}>
        Cloudflare Queue đang điều phối 16 poses đơn lẻ có reference conditioning. Linh thú sẽ thức tỉnh ngay khi hoàn tất.
      </p>

      {isTakingLong && (
        <div style={{ marginTop: '24px' }}>
          <button
            onClick={onReady}
            style={{
              background: 'rgba(255,168,0,0.1)',
              border: '1px solid #ffa800',
              color: '#ffa800',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Mở xem trước ngay (Dùng ảnh đệm) →
          </button>
        </div>
      )}
    </div>
  );
};
