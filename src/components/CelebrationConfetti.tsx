"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  opacity: number;
  shape: "rect" | "circle";
}

const COLORS = [
  "#10B981", // emerald
  "#34D399", // light emerald
  "#F59E0B", // amber / gold
  "#FBBF24", // bright gold
  "#3B82F6", // blue
  "#6366F1", // indigo
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
];

export function CelebrationConfetti({
  active,
  durationMs = 2400,
  onComplete,
}: {
  active: boolean;
  durationMs?: number;
  onComplete?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: Particle[] = [];
    const count = 140;

    // Generate burst from 2 bottom corners + center
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 3 === 0;
      const fromRight = i % 3 === 1;
      const originX = fromLeft ? width * 0.15 : fromRight ? width * 0.85 : width * 0.5;
      const originY = fromLeft || fromRight ? height * 0.85 : height * 0.7;

      const angle = fromLeft
        ? -Math.PI / 4 + (Math.random() * 0.5 - 0.25)
        : fromRight
          ? (-3 * Math.PI) / 4 + (Math.random() * 0.5 - 0.25)
          : -Math.PI / 2 + (Math.random() * 0.9 - 0.45);

      const speed = 12 + Math.random() * 18;

      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 7 + Math.random() * 7,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#6366f1",
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.05 + Math.random() * 0.08,
        opacity: 1,
        shape: Math.random() > 0.3 ? "rect" : "circle",
      });
    }

    let animationId: number;
    const startTime = Date.now();

    const render = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / durationMs;

      if (progress >= 1) {
        ctx.clearRect(0, 0, width, height);
        onCompleteRef.current?.();
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const gravity = 0.42;
      const drag = 0.985;
      const globalOpacity = progress > 0.65 ? Math.max(0, 1 - (progress - 0.65) / 0.35) : 1;

      for (const p of particles) {
        p.vx *= drag;
        p.vy = p.vy * drag + gravity;
        p.x += p.vx + Math.sin(p.wobble) * 1.5;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity * globalOpacity);
        ctx.fillStyle = p.color;

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Perspective width flutter
          const flutterWidth = Math.cos(p.wobble) * p.size;
          ctx.fillRect(-flutterWidth / 2, -p.size / 2, flutterWidth, p.size);
        }

        ctx.restore();
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    const safetyTimer = setTimeout(() => {
      cancelAnimationFrame(animationId);
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      onCompleteRef.current?.();
    }, durationMs + 80);

    return () => {
      clearTimeout(safetyTimer);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [active, durationMs]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[120] h-full w-full"
      aria-hidden="true"
    />
  );
}
