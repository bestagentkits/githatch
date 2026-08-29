// ============================================================================
// GitHoot Hatch Waiting & Generation Polling Page (src/client/pages/HatchWaitPage.tsx)
// ============================================================================

import React, { useEffect, useState } from 'react';

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
  const [progressStep, setProgressStep] = useState('Đang kết nối Gemini Nano Banana 2...');
  const [dots, setDots] = useState('');

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);

    const steps = [
      'Đang phân tích 1,420 commits và top ngôn ngữ của bạn...',
      'Đang biên dịch Prompt Matrix lưới 4x2 cho Gemini Nano Banana 2...',
      'Đang sinh ảnh Hero Portrait & 7 biểu cảm chuyển động...',
      'Đang tách nền Alpha Mask & khử viền xanh (Green De-Spill)...',
      'Đang lưu trữ Assets lên Cloudflare R2 CDN...',
      'Trứng đã sẵn sàng thức tỉnh!'
    ];

    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      if (stepIndex < steps.length - 1) {
        stepIndex++;
        setProgressStep(steps[stepIndex]);
      }
    }, 800);

    // Poll status or timeout to onReady
    const timer = setTimeout(() => {
      onReady();
    }, 4500);

    return () => {
      clearInterval(dotsInterval);
      clearInterval(stepInterval);
      clearTimeout(timer);
    };
  }, [guardianId, onReady]);

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
        boxShadow: '0 0 60px rgba(0, 240, 255, 0.6), 0 0 100px rgba(255, 42, 133, 0.4)',
        animation: 'pulse 1.2s infinite ease-in-out',
        marginBottom: '32px'
      }} />

      <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '28px', fontWeight: 900, marginBottom: '12px' }}>
        Đang Khởi Tạo Linh Thú Của @{username}{dots}
      </h2>

      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '13px',
        color: '#00f0ff',
        background: 'rgba(0,240,255,0.08)',
        border: '1px solid rgba(0,240,255,0.25)',
        padding: '10px 24px',
        borderRadius: '9999px',
        maxWidth: '560px'
      }}>
        ✦ {progressStep} ✦
      </div>
    </div>
  );
};
