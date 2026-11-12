import { useEffect, useRef } from "react";

type Ridge = {
  amp: number; // амплитуда, доля высоты
  len: number; // длина волны, в периодах на ширину
  speed: number; // фазовая скорость, периодов в секунду
  yBase: number; // базовая линия, доля высоты
  thick: number; // толщина штриха, px
  alpha: number; // прозрачность
  tint: "hot" | "violet"; // из токенов темы
};

// Оранжевые хребты спереди, фиолетовые уходят в тыл — глубина без 3D.
const RIDGES: Ridge[] = [
  { amp: 0.07, len: 1.5, speed: 0.09, yBase: 0.44, thick: 3, alpha: 1, tint: "hot" },
  { amp: 0.1, len: 1.1, speed: -0.065, yBase: 0.49, thick: 2.5, alpha: 0.75, tint: "hot" },
  { amp: 0.12, len: 0.85, speed: 0.048, yBase: 0.55, thick: 2, alpha: 0.5, tint: "hot" },
  { amp: 0.15, len: 0.62, speed: -0.036, yBase: 0.61, thick: 1.6, alpha: 0.5, tint: "violet" },
  { amp: 0.18, len: 0.45, speed: 0.026, yBase: 0.67, thick: 1.4, alpha: 0.32, tint: "violet" },
  { amp: 0.21, len: 0.32, speed: -0.02, yBase: 0.73, thick: 1.2, alpha: 0.2, tint: "violet" },
];

/**
 * Живая волна в hero. 2D canvas со слоями синус-хребтов; цвета читаются из
 * токенов темы (--color-hot / --color-violet), поэтому волна переодевается
 * вместе со скином. Пауза вне вьюпорта и на скрытой вкладке; статичный кадр
 * при prefers-reduced-motion.
 */
export function WaveCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let width = 0;
    let height = 0;
    let frame = 0;
    let inView = true;
    let palette = { hot: "#ff4a17", violet: "#8b5cf6" };

    const readPalette = () => {
      const styles = getComputedStyle(document.documentElement);
      palette = {
        hot: styles.getPropertyValue("--color-hot").trim() || "#ff4a17",
        violet: styles.getPropertyValue("--color-violet").trim() || "#8b5cf6",
      };
    };

    const ridgeColor = (ridge: Ridge) => {
      const base = ridge.tint === "hot" ? palette.hot : palette.violet;
      // hex → rgba с альфой хребта; exotic-форматы токенов не ждём.
      if (base.startsWith("#") && (base.length === 7 || base.length === 4)) {
        const raw = base.slice(1);
        const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${ridge.alpha})`;
      }
      return base;
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, width, height);
      for (let i = RIDGES.length - 1; i >= 0; i -= 1) {
        const ridge = RIDGES[i];
        ctx.beginPath();
        const steps = Math.max(64, Math.round(width / 7));
        for (let x = 0; x <= steps; x += 1) {
          const px = (x / steps) * width;
          const phase = (x / steps) * Math.PI * 2 * ridge.len + t * ridge.speed * Math.PI * 2;
          // Огибающая гасит хребты к краям, чтобы волна растворялась в фоне.
          const envelope = Math.pow(Math.sin((x / steps) * Math.PI), 0.8);
          const py =
            height * ridge.yBase +
            Math.sin(phase) * height * ridge.amp * envelope +
            Math.sin(phase * 2.7 + i * 1.7) * height * ridge.amp * 0.24 * envelope;
          if (x === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = ridgeColor(ridge);
        ctx.lineWidth = ridge.thick;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (!inView || document.hidden || reduced) return;
      draw(now);
    };

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
    });
    io.observe(canvas);

    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    ro.observe(canvas);

    // Скин меняет --color-hot на лету — волна перекрашивается следом.
    const observer = new MutationObserver(() => {
      readPalette();
      draw(performance.now());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-skin"] });

    readPalette();
    resize();
    if (reduced) {
      draw(start); // статичный кадр вместо анимации
    } else {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      io.disconnect();
      ro.disconnect();
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={ref} className="hero-canvas" aria-hidden="true" />;
}
