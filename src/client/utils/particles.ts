// ============================================================================
// GitHoot Lightweight Canvas Confetti Engine (src/client/utils/particles.ts)
// ============================================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
  vRot: number;
}

export function launchConfettiBurst(canvas: HTMLCanvasElement, primaryColor = '#00f0ff') {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);

  const colors = [primaryColor, '#ff2a85', '#ffa800', '#00ff88', '#ffffff'];
  const particles: Particle[] = [];

  const count = 120;
  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 12 + 4;
    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)] ?? '#00f0ff',
      alpha: 1,
      rotation: Math.random() * 360,
      vRot: Math.random() * 10 - 5
    });
  }

  let animationFrameId: number;

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    let aliveCount = 0;

    for (const p of particles) {
      if (p.alpha <= 0) continue;
      aliveCount++;

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25; // gravity
      p.vx *= 0.98; // air resistance
      p.alpha -= 0.012;
      p.rotation += p.vRot;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }

    if (aliveCount > 0) {
      animationFrameId = requestAnimationFrame(render);
    }
  }

  render();

  return () => {
    cancelAnimationFrame(animationFrameId);
  };
}
