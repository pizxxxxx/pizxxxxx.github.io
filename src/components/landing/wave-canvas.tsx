import { useEffect, useRef } from "react";

type Ridge = {
  amp: number; // амплитуда, доля высоты
  len: number; // длина волны, в периодах на ширину
  speed: number; // фазовая скорость, периодов в секунду
  yBase: number; // базовая линия, доля высоты
  thick: number; // толщина штриха, px
  alpha: number; // прозрачность
  tint: "hot" | "glow"; // из токенов темы
};

// Тихие тёплые хребты у низа hero — текстура, а не неоновая заставка.
const RIDGES: Ridge[] = [
  { amp: 0.05, len: 1.6, speed: 0.06, yBase: 0.6, thick: 2.2, alpha: 0.85, tint: "hot" },
  { amp: 0.075, len: 1.15, speed: -0.045, yBase: 0.66, thick: 1.8, alpha: 0.5, tint: "hot" },
  { amp: 0.1, len: 0.8, speed: 0.03, yBase: 0.73, thick: 1.4, alpha: 0.32, tint: "glow" },
  { amp: 0.13, len: 0.5, speed: -0.02, yBase: 0.8, thick: 1.1, alpha: 0.18, tint: "glow" },
];

/**
 * Живая волна в hero. 2D canvas со слоями синус-хребтов; цвета читаются из
 * токенов темы (--color-hot / --color-glow), поэтому волна переодевается
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
    let palette = { hot: "#ff4a17", glow: "#7a3413" };

    const readPalette = () => {
      const styles = getComputedStyle(document.documentElement);
      palette = {
        hot: styles.getPropertyValue("--color-hot").trim() || "#ff4a17",
        glow: styles.getPropertyValue("--color-glow").trim() || "#7a3413",
      };
    };

    const ridgeColor = (ridge: Ridge) => {
      const base = ridge.tint === "hot" ? palette.hot : palette.glow;
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
