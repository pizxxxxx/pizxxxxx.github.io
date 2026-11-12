import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  AudioLines,
  Headphones,
  Heart,
  ListMusic,
  Maximize2,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Star,
  Sun,
  Volume2,
} from "lucide-react";
import { buildModel, cursorAt, formatClock, tracks, type LyricCursor } from "./data";

function fillSlider(el: HTMLInputElement, ratio: number) {
  const pct = `${Math.round(Math.min(1, Math.max(0, ratio)) * 1000) / 10}%`;
  el.style.setProperty("--seek", pct);
  el.style.backgroundImage = `linear-gradient(to right, var(--color-fg) ${pct}, color-mix(in oklab, var(--color-fg) 18%, transparent) ${pct})`;
}
const model = buildModel(tracks);
const PLAY_SECONDS = 52;

/** Декоративные адлибы-«выкрики» поверх обложки (междометия из трека, не строки текста). */
type Shout = { text: string; x: number; y: number; rot: number; size: number; outline?: boolean };
const SHOUTS: Record<string, Shout[]> = {
  dejure: [
    { text: "Е", x: 70, y: 15, rot: -10, size: 2.1, outline: true },
    { text: "М-м", x: 8, y: 40, rot: 7, size: 1.35 },
    { text: "Да-да", x: 52, y: 53, rot: -5, size: 1.15 },
    { text: "Ага", x: 12, y: 69, rot: -9, size: 1.3 },
    { text: "У-у", x: 9, y: 10, rot: 6, size: 1, outline: true },
  ],
  cupsize: [
    { text: "муа", x: 58, y: 33, rot: -8, size: 1.9, outline: true },
    { text: "м-м", x: 10, y: 13, rot: 8, size: 1.2 },
    { text: "а-а", x: 78, y: 57, rot: 6, size: 1.15 },
    { text: "да", x: 40, y: 75, rot: -6, size: 1.05 },
  ],
};

function progressFrom(stage: HTMLElement) {
  const total = stage.offsetHeight - window.innerHeight;
  if (total <= 0) return 0;
  const scrolled = Math.min(total, Math.max(0, -stage.getBoundingClientRect().top));
  return scrolled / total;
}

export function LyricsStage() {
  const stageRef = useRef<HTMLElement>(null);
  const hairRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
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
  const paintRef = useRef<(progress: number, force?: boolean) => void>(() => {});

  useEffect(() => {
    const stage = stageRef.current;
    const viewport = viewportRef.current;
    if (!stage || !viewport) return;

    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastKey = "";
    let frame = 0;

    const paint = (progress: number, force = false) => {
      const liveBlocks = Array.from(viewport.querySelectorAll<HTMLElement>("[data-track]"));
      const cursor: LyricCursor = reducedRef.current
        ? { track: 0, line: 0, sung: 10_000, lineLen: 1, local: progress, global: progress }
        : cursorAt(model, tracks, progress);
      progressRef.current = cursor.global;

      if (hairRef.current) hairRef.current.style.transform = `scaleX(${cursor.global})`;
      if (hintRef.current) hintRef.current.style.opacity = String(Math.max(0, 1 - cursor.global * 5));
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
        layer.classList.toggle("is-on", layer.dataset.shouts === track.id);
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
        });

        const current = lines[cursor.line];
        if (current) {
          const target = viewport.clientHeight * 0.38 - current.offsetHeight / 2;
          block.style.transform = `translateY(${target - current.offsetTop}px)`;
        }
      }
    };

    paintRef.current = paint;

    const scrollToProgress = (progress: number) => {
      const total = stage.offsetHeight - window.innerHeight;
      driveAt.current = performance.now();
      window.scrollTo(0, stage.offsetTop + progress * Math.max(0, total));
      paint(progress);
    };

    const stop = () => {
      playingRef.current = false;
      setPlaying(false);
      if (frame) cancelAnimationFrame(frame);
    };

    let last = 0;
    const tick = (now: number) => {
      if (!playingRef.current) return;
      const dt = last === 0 ? 0 : (now - last) / 1000;
      last = now;
      const next = Math.min(1, progressRef.current + dt / PLAY_SECONDS);
      scrollToProgress(next);
      if (next >= 1) {
        stop();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      if (playingRef.current && performance.now() - driveAt.current > 180) stop();
      paint(progressFrom(stage));
    };

    const onRange = () => {
      const value = Number(rangeRef.current?.value ?? 0) / 1000;
      scrollToProgress(value);
    };

    paint(progressFrom(stage));
    document.fonts?.ready.then(() => paint(progressRef.current)).catch(() => undefined);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    rangeRef.current?.addEventListener("input", onRange);

    const api = { scrollToProgress, tick, stop, resetClock: () => { last = 0; } };
    stage.dataset.ready = "1";
    (stage as HTMLElement & { __lyric?: typeof api }).__lyric = api;

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      rangeRef.current?.removeEventListener("input", onRange);
      if (frame) cancelAnimationFrame(frame);
      playingRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    paintRef.current(progressRef.current, true);
  });

  const togglePlay = () => {
    const stage = stageRef.current as (HTMLElement & {
      __lyric?: { scrollToProgress: (p: number) => void; tick: (n: number) => void; stop: () => void; resetClock: () => void };
    }) | null;
    const api = stage?.__lyric;
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
      id="text"
      ref={stageRef}
      className={lyricsOn ? "lyric-stage stage" : "lyric-stage stage is-lyrics-hidden"}
    >
      <div className="stage-sticky">
        <img className="stage-wash" src="/covers/dejure.jpg" alt="" />
        <div ref={hairRef} className="stage-hair" />
        <div className="stage-inner">
          <p ref={hintRef} className="stage-hint">
            Мотай вниз — de jure и CUPSIZE. Полные тексты — на Genius, ссылки у каждой карточки
          </p>
          <div className="stage-grid">
            <div className="cover-wrap">
              <img data-cover="dejure" className="cover-img is-on" src="/covers/dejure.jpg" alt="Обложка сингла de jure — королевский XVII" />
              <img data-cover="cupsize" className="cover-img" src="/covers/cupsize.png" alt="Обложка сингла ты любишь танцевать — CUPSIZE" />
              {tracks.map((track) => {
                const shouts = SHOUTS[track.id];
                if (!shouts) return null;
                return (
                  <div key={track.id} data-shouts={track.id} className="shouts">
                    {shouts.map((s, index) => (
                      <span
                        key={s.text}
                        className={s.outline ? "shout is-outline" : "shout"}
                        style={{
                          left: `${s.x}%`,
                          top: `${s.y}%`,
                          fontSize: `${s.size}rem`,
                          transform: `rotate(${s.rot}deg)`,
                          transitionDelay: `${index * 70}ms`,
                        }}
                      >
                        {s.text}
                      </span>
                    ))}
                  </div>
                );
              })}
              <button type="button" className="hide-lyrics" onClick={() => setLyricsOn((value) => !value)}>
                <ListMusic size={18} />
                {lyricsOn ? "Скрыть текст" : "Показать текст"}
              </button>
            </div>
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
                        className={lineIndex === 0 ? "lyric line-current" : "lyric line-next"}
                      >
                        {Array.from(line).map((char, charIndex) => (
                          <span key={`${lineIndex}-${charIndex}`} className="ch">
                            {char}
                          </span>
                        ))}
                      </p>
                    ))}
                    {track.lyricsUrl ? (
                      <a className="lyrics-link" href={track.lyricsUrl} target="_blank" rel="noreferrer">
                        Полный текст песни — на Genius
                        <ArrowUpRight size={14} />
                      </a>
                    ) : null}
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
                <button type="button" className="icon-btn" aria-label={playing ? "Пауза" : "Играть текст"} aria-pressed={playing} onClick={togglePlay}>
                  {playing ? <Pause size={16} /> : <Play size={16} />}
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
                  <Heart size={16} fill={liked ? "currentColor" : "none"} />
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
                <Sun size={14} className="transport-extra" />
                <AudioLines size={14} className="transport-extra" />
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
    </section>
  );
}

function jump(stage: HTMLElement | null, direction: number) {
  if (!stage) return;
  const api = (stage as HTMLElement & { __lyric?: { scrollToProgress: (p: number) => void; stop: () => void } }).__lyric;
  if (!api) return;
  api.stop();
  const current = cursorAt(model, tracks, progressFrom(stage));
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
  api.scrollToProgress(model.total === 0 ? 0 : char / model.total);
}
