import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AudioLines,
  Headphones,
  Maximize2,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Star,
  Volume2,
} from "lucide-react";
import { MorphIcon } from "morphicons/react";
import { Check, Eye, EyeOff, Heart as HeartData, Pause, Play, Share2 } from "lucide";
import { buildModel, cursorAt, formatClock, tracks, type LyricCursor } from "./data";

/* Залитое сердце для морфа «нравится»: тот же путь lucide, но с заливкой —
   контур и полный глиф перетекают друг в друга. */
const HEART_FILL = HeartData.map(
  ([tag, attrs]) => [tag, { ...attrs, fill: "currentColor" }] as [string, typeof attrs],
);

/* Значки площадок у трека: официальные глифы без подложки — de jure едет
   с Яндекс Музыки, «ты любишь танцевать» с SoundCloud. Смена трека
   перещёлкивает значок, как обложку и подпись. */
function YandexMusicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 22 22" aria-hidden="true">
      <path
        fill="#ffbc0d"
        d="M21.79 8.39l-.09-.43-3.63-.63 2.11-2.85-.25-.27-3.1 1.49.39-3.95-.32-.18-1.89 3.19L12.91 0h-.37l.5 4.6L7.71.33l-.45.13 4.11 5.16L3.24 2.91l-.37.41 7.26 4.13L.11 8.29l-.11.62 10.41 1.13L1.73 17.22l.37.5 10.33-5.62-2.05 9.9h.63l3.96-9.31 2.41 7.29.43-.33-.99-7.41 3.76 4.27.25-.39-2.88-5.29 4.02 1.49.04-.45-3.6-2.66 3.4-.82Z"
      />
    </svg>
  );
}

function SoundCloudIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#ff5500"
        d="M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z"
      />
    </svg>
  );
}

function fillSlider(el: HTMLInputElement, ratio: number) {
  const pct = `${Math.round(Math.min(1, Math.max(0, ratio)) * 1000) / 10}%`;
  el.style.setProperty("--seek", pct);
  el.style.backgroundImage = `linear-gradient(to right, var(--color-fg) ${pct}, color-mix(in oklab, var(--color-fg) 18%, transparent) ${pct})`;
}
const model = buildModel(tracks);
const PLAY_SECONDS = 52;

/* Витрина шрифтов строки «Шрифты на вкус»: те же двенадцать, что и в
   выборе шрифта приложения (см. скрин раздела «Тексты»). Начертание
   строки листается по ходу скролла — прокрутка листает список. */
const FONT_CYCLE = [
  "Inter Variable",
  "Manrope Variable",
  "Onest Variable",
  "Golos Text Variable",
  "Playfair Display Variable",
  "Unbounded Variable",
  "Caveat Variable",
  "Comfortaa Variable",
  "Cormorant Garamond Variable",
  "Jost Variable",
  "Raleway Variable",
  "Rubik Variable",
];

/**
 * Декоративные адлибы-«выкрики» поверх обложки: междометия из трека, не строки
 * текста. at — момент появления, доля локального хода трека (0..1): выкрик
 * вспыхивает вовремя, пока идёт «воспроизведение», и гаснет к следующему.
 */
type Shout = { text: string; x: number; y: number; rot: number; size: number; at: number; outline?: boolean };
const SHOUTS: Record<string, Shout[]> = {
  dejure: [
    { text: "Е", x: 70, y: 15, rot: -10, size: 3.6, at: 0.04 },
    { text: "М-м", x: 8, y: 40, rot: 7, size: 2.4, at: 0.12 },
    { text: "Да-да", x: 52, y: 53, rot: -5, size: 2.2, at: 0.24 },
    { text: "Ага", x: 12, y: 69, rot: -9, size: 2.4, at: 0.36 },
    { text: "У-у", x: 9, y: 10, rot: 6, size: 2.2, at: 0.48 },
    { text: "Я-я", x: 62, y: 76, rot: 8, size: 2.2, at: 0.62 },
    { text: "Е", x: 30, y: 26, rot: -7, size: 2.8, at: 0.78 },
  ],
  cupsize: [
    { text: "муа", x: 58, y: 33, rot: -8, size: 3.4, at: 0.06 },
    { text: "м-м", x: 10, y: 13, rot: 8, size: 2.2, at: 0.22 },
    { text: "а-а", x: 78, y: 57, rot: 6, size: 2.1, at: 0.42 },
    { text: "да", x: 40, y: 75, rot: -6, size: 2, at: 0.58 },
    { text: "муа", x: 24, y: 18, rot: 7, size: 2.7, at: 0.8 },
  ],
};

// Доли треков в общем ходе сцены + глобальные моменты показа с окном до
// следующего выкрика (массивы SHOUTS составлены в хронологическом порядке).
const trackFracs = model.trackLens.map((len) => len / model.total);
const trackStarts = model.trackLens.map((_, index) =>
  model.trackLens.slice(0, index).reduce((sum, len) => sum + len, 0) / model.total,
);
type ShoutCue = Shout & { hold: number };
const SHOUT_CUES: Record<string, ShoutCue[]> = {};
tracks.forEach((track, trackIndex) => {
  const shouts = SHOUTS[track.id];
  if (!shouts) return;
  SHOUT_CUES[track.id] = shouts.map((shout, index) => {
    const nextAt = shouts[index + 1]?.at ?? shout.at + 0.1;
    const hold = Math.min(0.09, Math.max(0.045, nextAt - shout.at - 0.012));
    return {
      ...shout,
      at: trackStarts[trackIndex] + shout.at * trackFracs[trackIndex],
      hold,
    };
  });
});

type LyricApi = {
  scrollToProgress: (progress: number) => void;
  tick: (now: number) => void;
  stop: () => void;
  resetClock: () => void;
  progress: () => number;
};

function progressFrom(stage: HTMLElement, sticky: HTMLElement) {
  const total = stage.offsetHeight - sticky.offsetHeight;
  if (total <= 0) return 0;
  const scrolled = Math.min(total, Math.max(0, -stage.getBoundingClientRect().top));
  return scrolled / total;
}

export function LyricsStage() {
  const stageRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const remainRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLElement>(null);
  const artistRef = useRef<HTMLElement>(null);
  const thumbRef = useRef<HTMLImageElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const progressRef = useRef(0);
  const playingRef = useRef(false);
  const driveAt = useRef(0);
  const reducedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [lyricsOn, setLyricsOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const paintRef = useRef<(progress: number, force?: boolean) => void>(() => {});

  /* «Поделиться» — копирует адрес сайта; значок на секунду превращается
     в галочку. На http-протоколе clipboard бывает недоступен — fallback
     через временный textarea. */
  const copyTimer = useRef(0);
  const copyLink = () => {
    const done = () => {
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1400);
    };
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = "https://pizxxxxx.github.io/";
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      done();
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText("https://pizxxxxx.github.io/").then(done).catch(fallback);
    } else {
      fallback();
    }
  };

  useEffect(() => {
    const stage = stageRef.current;
    const sticky = stickyRef.current;
    const viewport = viewportRef.current;
    if (!stage || !sticky || !viewport) return;

    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastKey = "";
    let frame = 0;

    const paint = (progress: number, force = false) => {
      const liveBlocks = Array.from(viewport.querySelectorAll<HTMLElement>("[data-track]"));
      const cursor: LyricCursor = reducedRef.current
        ? { track: 0, line: 0, sung: 10_000, lineLen: 1, local: progress, global: progress }
        : cursorAt(model, tracks, progress);
      progressRef.current = cursor.global;

      if (rangeRef.current) {
        const dragging = document.activeElement === rangeRef.current;
        if (!dragging) rangeRef.current.value = String(Math.round(cursor.global * 1000));
        fillSlider(rangeRef.current, dragging ? Number(rangeRef.current.value) / 1000 : cursor.global);
      }

      const track = tracks[cursor.track];
      const elapsed = cursor.local * track.duration;
      const remain = Math.max(0, track.duration - elapsed);
      if (elapsedRef.current) elapsedRef.current.textContent = formatClock(elapsed);
      if (remainRef.current) remainRef.current.textContent = `-${formatClock(remain)}`;

      stage.querySelectorAll<HTMLImageElement>("[data-cover]").forEach((img) => {
        img.classList.toggle("is-on", img.dataset.cover === track.id);
      });
      stage.querySelectorAll<HTMLElement>("[data-shouts]").forEach((layer) => {
        const active = layer.dataset.shouts === track.id;
        layer.classList.toggle("is-on", active);
        // Выкрик вспыхивает в свой момент и гаснет к следующему — вовремя.
        layer.querySelectorAll<HTMLElement>("[data-shout]").forEach((el) => {
          if (!active) {
            el.classList.remove("is-on");
            return;
          }
          const at = Number(el.dataset.at);
          const hold = Number(el.dataset.hold);
          el.classList.toggle("is-on", cursor.global >= at && cursor.global <= at + hold);
        });
      });
      const wash = stage.querySelector<HTMLImageElement>(".stage-wash");
      if (wash && !wash.src.endsWith(track.cover)) wash.src = track.cover;

      const key = reducedRef.current ? `all:${cursor.track}` : `${cursor.track}:${cursor.line}:${cursor.sung}`;
      if (force || key !== lastKey) {
        lastKey = key;
        if (titleRef.current) titleRef.current.textContent = track.title;
        if (artistRef.current) artistRef.current.textContent = track.artist;
        if (thumbRef.current && !thumbRef.current.src.endsWith(track.cover)) {
          thumbRef.current.src = track.cover;
        }
        stage.querySelectorAll<HTMLElement>("[data-src]").forEach((el) => {
          el.classList.toggle("is-on", el.dataset.src === track.id);
        });
        if (liveRef.current) liveRef.current.textContent = `${track.title}, ${track.artist}`;

        liveBlocks.forEach((block, index) => {
          block.classList.toggle("is-off", index !== cursor.track);
        });

        const block = liveBlocks[cursor.track];
        if (!block) return;
        const lines = Array.from(block.querySelectorAll<HTMLElement>("[data-line]"));
        lines.forEach((line, index) => {
          line.classList.remove("line-current", "line-past", "line-next");
          const chars = line.querySelectorAll<HTMLElement>(".ch");
          if (reducedRef.current) {
            line.classList.add(index === 0 ? "line-current" : "line-past");
            chars.forEach((ch) => ch.classList.add("on"));
            line.style.fontFamily = "";
            return;
          }
          if (index < cursor.line) line.classList.add("line-past");
          else if (index > cursor.line) line.classList.add("line-next");
          else line.classList.add("line-current");
          chars.forEach((ch, charIndex) => {
            const on = index < cursor.line || (index === cursor.line && charIndex < cursor.sung);
            ch.classList.toggle("on", on);
            ch.classList.toggle("edge", index === cursor.line && cursor.sung > 0 && charIndex === cursor.sung - 1);
          });
          // Строка «Шрифты на вкус»: начертание листается списком по ходу
          // пропевания — прокрутка вверх возвращает предыдущие шрифты.
          if (line.dataset.fontline !== undefined) {
            if (index === cursor.line) {
              const step = Math.min(
                FONT_CYCLE.length - 1,
                Math.floor((cursor.sung / Math.max(1, line.childElementCount)) * FONT_CYCLE.length),
              );
              line.style.fontFamily = `"${FONT_CYCLE[step]}", "Segoe UI", sans-serif`;
            } else {
              line.style.fontFamily = "";
            }
          }
        });

        const current = lines[cursor.line];
        if (current) {
          const target = viewport.clientHeight * 0.38 - current.offsetHeight / 2;
          block.style.transform = `translateY(${target - current.offsetTop}px)`;
        }
      }
    };

    paintRef.current = paint;

    // Сцена ведётся прокруткой, как раньше: листаешь страницу — текст едет
    // за скроллом. Play просто прокручивает сцену сам; ручной скролл его
    // перебивает. Окно закреплено ПОД навигацией и у конца диапазона мягко
    // гаснет — без «слипания» транспорта с пилюлей и рывков у краёв.
    let last = 0;

    const updateFrame = () => {
      const win = windowRef.current;
      if (!win) return;
      const vh = window.innerHeight;
      const sectionRect = stage.getBoundingClientRect();
      const stickyRect = sticky.getBoundingClientRect();
      const enter = Math.min(1, Math.max(0, (vh - stickyRect.top) / (vh * 0.5)));
      const remaining = sectionRect.bottom - stickyRect.bottom;
      const exit = Math.min(1, Math.max(0, remaining / (vh * 0.6)));
      const k = Math.min(enter, exit);
      win.style.opacity = k.toFixed(3);
      if (!reducedRef.current) win.style.transform = `scale(${(0.94 + 0.06 * k).toFixed(4)})`;
    };

    const scrollToProgress = (progress: number) => {
      const total = stage.offsetHeight - sticky.offsetHeight;
      driveAt.current = performance.now();
      // «instant»: CSS scroll-behavior: smooth не должен анимировать
      // служебные прокрутки сцены — они кадровые.
      window.scrollTo({
        top: stage.offsetTop + progress * Math.max(0, total),
        behavior: "instant",
      });
      paint(progress);
      updateFrame();
    };

    const stop = () => {
      playingRef.current = false;
      setPlaying(false);
      // На телефоне после паузы текст остаётся на позиции Play, пока
      // пользователь не смахнёт сам.
      if (!autoScroll) followPaused = true;
      if (frame) cancelAnimationFrame(frame);
    };

    // На телефоне Play не уводит страницу сам: караоке едет по времени,
    // экран остаётся на месте; ручной скролл по-прежнему перебивает.
    const autoScroll = !window.matchMedia("(max-width: 719px)").matches;

    // На тач-экранах сцену листают свайпами: инерция флинга даёт рывки
    // по буквам. Ведём сглаженный прогресс — нарисованный догоняет целевой
    // за несколько кадров. На десктопе с колесиком остаётся прямая
    // привязка: там она и так плавная.
    const touchScroll =
      (window.matchMedia("(pointer: coarse)").matches ||
        new URLSearchParams(window.location.search).has("qa-touch")) &&
      !reducedRef.current;
    let painted = 0;
    let followPaused = false;
    let followFrame = 0;

    const follow = () => {
      followFrame = requestAnimationFrame(follow);
      if (!touchScroll || playingRef.current || followPaused) return;
      const target = progressFrom(stage, sticky);
      const prev = painted;
      painted += (target - painted) * 0.2;
      if (Math.abs(target - painted) < 0.0008) painted = target;
      if (painted === prev) return;
      progressRef.current = painted;
      paint(painted);
      updateFrame();
    };

    const tick = (now: number) => {
      if (!playingRef.current) return;
      const dt = last === 0 ? 0 : (now - last) / 1000;
      last = now;
      const next = Math.min(1, progressRef.current + dt / PLAY_SECONDS);
      if (autoScroll) {
        scrollToProgress(next);
      } else {
        driveAt.current = performance.now();
        followPaused = true; // Play ведёт текст сам — сглаживание ждёт
        paint(next);
        updateFrame();
      }
      if (next >= 1) {
        stop();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      if (playingRef.current && performance.now() - driveAt.current > 180) stop();
      if (touchScroll) {
        // Свайп освобождает сглаживание: продолжаем с текущей позиции.
        if (followPaused) {
          followPaused = false;
          painted = progressRef.current;
        }
        return;
      }
      paint(progressFrom(stage, sticky));
      updateFrame();
    };

    const onRange = () => {
      const value = Number(rangeRef.current?.value ?? 0) / 1000;
      scrollToProgress(value);
    };

    painted = progressFrom(stage, sticky);
    progressRef.current = painted;
    paint(painted);
    updateFrame();
    document.fonts?.ready.then(() => paint(progressRef.current)).catch(() => undefined);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    rangeRef.current?.addEventListener("input", onRange);
    follow();

    const api: LyricApi = {
      scrollToProgress,
      tick,
      stop,
      resetClock: () => { last = 0; },
      progress: () => progressRef.current,
    };
    stage.dataset.ready = "1";
    (stage as HTMLElement & { __lyric?: LyricApi }).__lyric = api;

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      rangeRef.current?.removeEventListener("input", onRange);
      if (frame) cancelAnimationFrame(frame);
      cancelAnimationFrame(followFrame);
      playingRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    paintRef.current(progressRef.current, true);
  });

  const togglePlay = () => {
    const api = (stageRef.current as (HTMLElement & { __lyric?: LyricApi }) | null)?.__lyric;
    if (!api) return;
    if (playingRef.current) {
      api.stop();
      return;
    }
    if (progressRef.current >= 0.995) api.scrollToProgress(0);
    playingRef.current = true;
    setPlaying(true);
    api.resetClock();
    requestAnimationFrame(api.tick);
  };

  return (
    <section
      ref={stageRef}
      className={lyricsOn ? "lyric-stage stage" : "lyric-stage stage is-lyrics-hidden"}
    >
      <div className="stage-sticky" ref={stickyRef}>
        <div className="stage-window" ref={windowRef}>
          <div className="stage-blob stage-blob--a" />
          <div className="stage-blob stage-blob--b" />
          <div className="stage-blob stage-blob--c" />
          <img className="stage-wash" src="/covers/dejure.jpg" alt="" />
          <div className="stage-haze" />
          <div className="stage-inner">
          <div className="stage-grid">
            <button
              type="button"
              className="cover-wrap"
              aria-pressed={lyricsOn}
              aria-label={lyricsOn ? "Скрыть текст" : "Показать текст"}
              onClick={() => setLyricsOn((value) => !value)}
            >
              <img data-cover="dejure" className="cover-img is-on" src="/covers/dejure.jpg" alt="Обложка сингла de jure — королевский XVII" />
              <img data-cover="cupsize" className="cover-img" src="/covers/cupsize.png" alt="Обложка сингла ты любишь танцевать — CUPSIZE" />
              {tracks.map((track) => {
                const cues = SHOUT_CUES[track.id];
                if (!cues) return null;
                return (
                  <div key={track.id} data-shouts={track.id} className="shouts">
                    {cues.map((cue, index) => (
                      <span
                        key={`${track.id}-${index}`}
                        data-shout="1"
                        data-at={cue.at.toFixed(4)}
                        data-hold={cue.hold.toFixed(4)}
                        className="shout"
                        style={{
                          left: `${cue.x}%`,
                          top: `${cue.y}%`,
                          fontSize: `${cue.size}rem`,
                          transform: `rotate(${cue.rot}deg)`,
                        }}
                      >
                        {cue.text}
                      </span>
                    ))}
                  </div>
                );
              })}
              <span className="hide-lyrics" aria-hidden="true">
                <MorphIcon icon={lyricsOn ? Eye : EyeOff} size={16} reducedMotion="user" />
                {lyricsOn ? "Скрыть текст" : "Показать текст"}
              </span>
            </button>
            <div className="lyrics-wrap">
              <div ref={viewportRef} className="lyrics-viewport">
                {tracks.map((track, trackIndex) => (
                  <div
                    key={track.id}
                    data-track={trackIndex}
                    className={trackIndex === 0 ? "track-block" : "track-block is-off"}
                  >
                {track.lines.map((line, lineIndex) => (
                  <p
                    key={`${track.id}-${lineIndex}`}
                    data-line={lineIndex}
                    data-fontline={track.fontLine === lineIndex ? "1" : undefined}
                    className={
                      lineIndex === 0 && trackIndex === 0
                        ? "lyric lyric--display line-current"
                        : lineIndex < 2
                          ? "lyric lyric--display line-next"
                          : "lyric line-next"
                    }
                    onClick={() => rewindToLine(stageRef.current, trackIndex, lineIndex)}
                  >
                    {Array.from(line).map((char, charIndex) => (
                      <span key={`${lineIndex}-${charIndex}`} className="ch">
                        {char}
                      </span>
                    ))}
                  </p>
                ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={playing ? "transport glass is-playing" : "transport glass"}>
            <div className="transport-seek">
              <span ref={elapsedRef} className="time">0:00</span>
              <input
                ref={rangeRef}
                className="seek"
                type="range"
                min={0}
                max={1000}
                defaultValue={0}
                aria-label="Позиция в тексте"
                onPointerDown={() => {
                  playingRef.current = false;
                  setPlaying(false);
                }}
              />
              <span ref={remainRef} className="time">-1:37</span>
            </div>
            <div className="transport-row">
              <div className="transport-controls">
                <button type="button" className="icon-btn" aria-label="Перемешать">
                  <Shuffle size={16} />
                </button>
                <button type="button" className="icon-btn" aria-label="Предыдущая строфа" onClick={() => jump(stageRef.current, -1)}>
                  <SkipBack size={16} />
                </button>
                <button type="button" className="icon-btn play-btn" aria-label={playing ? "Пауза" : "Играть текст"} aria-pressed={playing} onClick={togglePlay}>
                  <MorphIcon icon={playing ? Pause : Play} size={18} reducedMotion="user" />
                </button>
                <button type="button" className="icon-btn" aria-label="Следующая строфа" onClick={() => jump(stageRef.current, 1)}>
                  <SkipForward size={16} />
                </button>
                <button type="button" className="icon-btn transport-extra" aria-label="Повтор">
                  <Repeat size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn transport-extra"
                  aria-label="Нравится"
                  aria-pressed={liked}
                  onClick={() => setLiked((value) => !value)}
                >
                  <MorphIcon icon={liked ? HEART_FILL : HeartData} size={16} reducedMotion="user" />
                </button>
                <button type="button" className="icon-btn transport-extra" aria-label="Оценка">
                  <Star size={16} />
                </button>
                <button type="button" className="icon-btn transport-extra" aria-label="Волна">
                  <AudioLines size={16} />
                </button>
              </div>
              <div className="transport-meta">
                <img ref={thumbRef} src="/covers/dejure.jpg" alt="" />
                <div>
                  <b ref={titleRef}>de jure</b>
                  <small ref={artistRef}>королевский XVII</small>
                </div>
                <span className="t-src-slot" aria-hidden="true">
                  <span className="t-src is-on" data-src="dejure">
                    <YandexMusicIcon />
                  </span>
                  <span className="t-src" data-src="cupsize">
                    <SoundCloudIcon />
                  </span>
                </span>
                <button
                  type="button"
                  className={copied ? "t-share is-copied" : "t-share"}
                  aria-label="Скопировать ссылку на сайт"
                  title="Скопировать ссылку на сайт"
                  onClick={copyLink}
                >
                  <MorphIcon icon={copied ? Check : Share2} size={14} reducedMotion="user" />
                </button>
              </div>
              <div className="transport-volume">
                <Volume2 size={16} />
                <input
                  className="volume"
                  type="range"
                  min={0}
                  max={100}
                  defaultValue={70}
                  aria-label="Громкость"
                  onInput={(event) => fillSlider(event.currentTarget, Number(event.currentTarget.value) / 100)}
                />
                <Headphones size={16} />
                <Maximize2 size={16} />
              </div>
            </div>
          </div>
          <p ref={liveRef} className="sr-only" aria-live="polite" />
          </div>
        </div>
      </div>
    </section>
  );
}

function jump(stage: HTMLElement | null, direction: number) {
  if (!stage) return;
  const api = (stage as HTMLElement & { __lyric?: LyricApi }).__lyric;
  if (!api) return;
  api.stop();
  const current = cursorAt(model, tracks, api.progress());
  let track = current.track;
  let line = current.line + direction;
  if (line < 0) {
    track = Math.max(0, track - 1);
    line = tracks[track].lines.length - 1;
  } else if (line >= tracks[current.track].lines.length) {
    if (track < tracks.length - 1) {
      track += 1;
      line = 0;
    } else {
      line = tracks[track].lines.length - 1;
    }
  }
  const before = model.trackLens.slice(0, track).reduce((sum, len) => sum + len, 0);
  const char = before + model.lineOffsets[track][line];
  // Полсимвола внутрь строки: на стыке треков скролл не остаётся на прошлом треке.
  api.scrollToProgress(model.total === 0 ? 0 : (char + 0.5) / model.total);
}

/* Клик по строке караоке — перемотка на неё. */
function rewindToLine(stage: HTMLElement | null, trackIndex: number, lineIndex: number) {
  if (!stage) return;
  const api = (stage as HTMLElement & { __lyric?: LyricApi }).__lyric;
  if (!api) return;
  api.stop();
  const before = model.trackLens.slice(0, trackIndex).reduce((sum, len) => sum + len, 0);
  const char = before + model.lineOffsets[trackIndex][lineIndex];
  api.scrollToProgress(model.total === 0 ? 0 : (char + 0.5) / model.total);
}
