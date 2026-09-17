import { useRef, useEffect, useCallback } from 'react';

/**
 * A canvas overlay that draws a small radial "spark" burst wherever the
 * page is clicked - pure tactile feedback, no functional purpose. Renders
 * above everything (`children` included) but with pointer-events disabled,
 * so it never intercepts the click it's reacting to.
 *
 * Respects prefers-reduced-motion: the click still registers normally,
 * it just doesn't draw a burst for someone who's asked for less motion.
 */
export default function ClickSpark({
  sparkColor = '#10b981', // the app's emerald accent - reads on both light and dark surfaces, unlike a flat white
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  children,
}) {
  const canvasRef = useRef(null);
  const sparksRef = useRef([]);
  const rafRef = useRef(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const easeFn = useCallback(
    (t) => {
      switch (easing) {
        case 'linear':
          return t;
        case 'ease-in':
          return t * t;
        case 'ease-in-out':
          return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        case 'ease-out':
        default:
          return 1 - (1 - t) ** 2;
      }
    },
    [easing]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = performance.now();

      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = now - spark.startTime;
        if (elapsed >= duration) return false;

        const progress = easeFn(elapsed / duration);
        const distance = progress * sparkRadius;
        const lineLength = sparkSize * (1 - progress);

        ctx.strokeStyle = spark.color;
        ctx.globalAlpha = 1 - progress;
        ctx.lineWidth = 2;

        spark.angles.forEach((angle) => {
          const x1 = spark.x + distance * Math.cos(angle);
          const y1 = spark.y + distance * Math.sin(angle);
          const x2 = spark.x + (distance + lineLength) * Math.cos(angle);
          const y2 = spark.y + (distance + lineLength) * Math.sin(angle);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        });

        return true;
      });

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    const handleClick = (e) => {
      if (reducedMotionRef.current) return;
      const angles = Array.from({ length: sparkCount }, (_, i) => (2 * Math.PI * i) / sparkCount);
      sparksRef.current.push({
        x: e.clientX,
        y: e.clientY,
        startTime: performance.now(),
        color: sparkColor,
        angles,
      });
    };
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('click', handleClick);
      cancelAnimationFrame(rafRef.current);
    };
  }, [sparkColor, sparkSize, sparkRadius, sparkCount, duration, easeFn]);

  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[999]" />
      {children}
    </>
  );
}