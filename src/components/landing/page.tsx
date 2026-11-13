import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  AudioLines,
  Cloud,
  Download,
  Github,
  Heart,
  Keyboard,
  Library,
  Menu,
  Search,
  SlidersHorizontal,
  Smartphone,
  Waves,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { libraryRows, sideLinks, themes, type SkinId } from "./data";
import { LyricsStage } from "./lyrics-stage";
import { WaveCanvas } from "./wave-canvas";

// Кнопки ведут на внутренний редиректор: он спрашивает GitHub API о последнем
// релизе и сразу перекидывает на файл ассета (exe/apk). Если API недоступен,
// редиректор пробует прямой адрес ассета, а затем страницу релизов. Имена
// файлов с версиями больше не ломают ссылку.
const WIN_DL = "/download.html?app=desktop";
const APK_DL = "/download.html?app=mobile";
const SOURCE = "https://github.com/pizxxxxx/LomifyNEXT";

const sideIcons = [Library, Search, Waves, AudioLines, Heart];

/* Штрихкод чека: статичные «случайные» полосы — без рантайма и без SSR-дрейфа. */
const RECEIPT_BARS = [3, 1, 2, 1, 1, 3, 2, 1, 3, 1, 2, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 2, 1];

function ReceiptBarcode() {
  let x = 0;
  return (
    <svg className="r-code" viewBox="0 0 143 32" preserveAspectRatio="none" aria-hidden="true">
      {RECEIPT_BARS.map((w, i) => {
        const rect = <rect key={i} x={x} y={0} width={w * 1.4} height={32} />;
        x += w * 1.4 + 2.2;
        return rect;
      })}
    </svg>
  );
}

/* Рваный нижний край чека: зубцы идут справа налево от правого края листа. */
const RECEIPT_TEAR =
  "M0 0H320V6L310 11L300 4L290 10L280 3L270 9L260 5L250 11L240 4L230 9L220 3L210 10L200 5L190 11L180 4L170 9L160 3L150 10L140 5L130 11L120 4L110 9L100 3L90 10L80 5L70 11L60 4L50 9L40 3L30 10L20 5L10 11L0 6Z";

export function Landing() {
  const [open, setOpen] = useState(false);
  const [skin, setSkin] = useState<SkinId>("mister");
  // звук плюха: включён по умолчанию, кнопка mute в углу секции
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.skin = skin;
    document.documentElement.dataset.glass = "high";
  }, [skin]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Чек падает в лужу, как только секция входит в экран: armed → falling →
  // landed, запуск только из armed; чек целиком ушёл из вьюпорта — снова
  // armed, при следующем появлении упадёт опять. В момент удара о воду
  // (~62% падения) от основания чека расходятся кольца-волны и брызги,
  // играет тихий плюх. Рисует один canvas поверх секции: кольца живут
  // над текстом, чек — над кольцами. Клик по фону секции пускает рябь.
  useEffect(() => {
    const section = document.getElementById("download");
    const holder = section?.querySelector<HTMLElement>(".price-receipt");
    const receipt = section?.querySelector<HTMLElement>(".receipt");
    const canvas = section?.querySelector<HTMLCanvasElement>(".receipt-canvas");
    if (!section || !holder || !receipt || !canvas) return;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    type Ripple = { x: number; y: number; born: number; spread: number; dur: number; lw: number };
    type Droplet = { x: number; y: number; vx: number; vy: number; born: number; dur: number; r: number };
    const ripples: Ripple[] = [];
    const droplets: Droplet[] = [];

    let raf = 0;
    let running = false;
    let state: "armed" | "falling" | "landed" = "armed";
    let dropT0 = 0;
    let splashed = false;
    let restRot = 0;
    let startRot = -2.5;
    const DROP_MS = 700;
    const HIT = 0.62; // удар о воду — на 62% длительности падения

    /* ── canvas: размер секции, DPR не выше двух ── */
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    const fit = () => {
      cssW = section.clientWidth;
      cssH = section.clientHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(section);

    /* Точка удара — от layout-бокса чека: стабильная обёртка без
       transform, вода там, где лежит лист, в любой момент анимации. */
    const impactPoint = () => {
      const s = section.getBoundingClientRect();
      const h = holder.getBoundingClientRect();
      return { x: h.left + h.width / 2 - s.left, y: h.bottom - s.top - 2 };
    };

    /* ── звук: тихий плюх на WebAudio; пока политика автоплея молчит —
       звук тихо пропускается до первого жеста пользователя ── */
    let audio: AudioContext | null = null;
    const playSplash = (vol: number) => {
      if (mutedRef.current || reduced) return;
      try {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        if (!audio) audio = new AC();
        if (audio.state === "suspended") void audio.resume();
        if (audio.state !== "running") return;
        const t = audio.currentTime + 0.01;
        const out = audio.createGain();
        out.connect(audio.destination);
        // тональный плюх: провал 430 → 120 Гц
        const osc = audio.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(430, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.2);
        const og = audio.createGain();
        og.gain.setValueAtTime(0.0001, t);
        og.gain.exponentialRampToValueAtTime(0.16 * vol, t + 0.015);
        og.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        osc.connect(og).connect(out);
        osc.start(t);
        osc.stop(t + 0.3);
        // короткий шумовой всплеск
        const n = Math.floor(0.16 * audio.sampleRate);
        const buf = audio.createBuffer(1, n, audio.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
        const src = audio.createBufferSource();
        src.buffer = buf;
        const bp = audio.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1100;
        bp.Q.value = 0.7;
        const ng = audio.createGain();
        ng.gain.value = 0.09 * vol;
        src.connect(bp).connect(ng).connect(out);
        src.start(t);
      } catch {
        // звук не критичен
      }
    };

    /* ── спавн: кольца выходят с интервалом 140мс, капли — дугой ── */
    const spawnRings = (x: number, y: number, big: boolean) => {
      const n = big ? 4 : 2;
      for (let i = 0; i < n; i++) {
        ripples.push({
          x,
          y,
          born: performance.now() + i * 140,
          spread: big ? 140 : 80,
          dur: big ? 1600 : 1100,
          lw: big ? 9 : 6,
        });
      }
      start();
    };
    const spawnDroplets = (x: number, y: number) => {
      const n = 7 + Math.floor(Math.random() * 3); // 7–9 капель
      for (let i = 0; i < n; i++) {
        droplets.push({
          x: x + (Math.random() - 0.5) * 70,
          y: y - 2,
          vx: (Math.random() - 0.5) * 170,
          vy: -(130 + Math.random() * 150),
          born: performance.now(),
          dur: 600,
          r: 1 + Math.random() * 0.5, // 2–3px
        });
      }
      start();
    };

    /* ── удар: волны + брызги + звук ── */
    const impact = () => {
      const { x, y } = impactPoint();
      spawnRings(x, y, true);
      spawnDroplets(x, y);
      playSplash(1);
    };

    /* Падение: разгон (ease-in), удар на 62%, микро-отскок ~12px,
       затем покой — покачивание берёт на себя класс is-rest. */
    const advanceDrop = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - dropT0) / DROP_MS));
      let y = 0;
      let rot = restRot;
      let op = 1;
      if (p < HIT) {
        const q = p / HIT;
        const e = q * q; // ускорение свободного падения
        y = -320 * (1 - e);
        rot = startRot + (restRot - startRot) * e;
        op = Math.min(1, p / 0.09);
      } else {
        const q = Math.min(1, (p - HIT) / 0.24);
        y = -12 * Math.sin(Math.PI * q); // отскок и возврат на воду
      }
      if (p >= HIT && !splashed) {
        splashed = true;
        impact();
      }
      if (p >= 1) {
        state = "landed";
        receipt.style.willChange = "";
        receipt.style.transform = "";
        receipt.style.opacity = "";
        receipt.classList.add("is-rest");
        return;
      }
      receipt.style.opacity = op.toFixed(3);
      receipt.style.transform = `perspective(1100px) translateY(${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
    };

    /* Единственный rAF-цикл: ведёт падение и рисует волны, пока есть
       что рисовать; без активных волн — спит. */
    const loop = (now: number) => {
      if (state === "falling") advanceDrop(now);
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);
        const amp = 0.55; // полупрозрачные: текст читается под волнами
        for (let i = ripples.length - 1; i >= 0; i--) {
          const w = ripples[i];
          const t = (now - w.born) / w.dur;
          if (t >= 1) {
            ripples.splice(i, 1);
            continue;
          }
          if (t < 0) continue; // кольца выходят с интервалом 140мс
          const e = 1 - Math.pow(1 - t, 3); // радиус растёт с ease-out
          const r = w.spread * e;
          const fade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
          // тёмная ложбина позади светлого гребня — рельеф воды
          ctx.beginPath();
          ctx.ellipse(w.x, w.y, r + 9, (r + 9) * 0.38, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(44, 52, 66, ${(0.45 * amp * fade).toFixed(3)})`;
          ctx.lineWidth = Math.max(1, w.lw - 3);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(w.x, w.y, r, r * 0.38, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${(0.85 * amp * fade).toFixed(3)})`;
          ctx.lineWidth = w.lw;
          ctx.stroke();
        }
        for (let i = droplets.length - 1; i >= 0; i--) {
          const d = droplets[i];
          const t = (now - d.born) / d.dur;
          if (t >= 1) {
            droplets.splice(i, 1);
            continue;
          }
          const sec = (t * d.dur) / 1000;
          const dy = d.y + d.vy * sec + 450 * sec * sec; // гравитация
          if (dy > d.y + 5) {
            droplets.splice(i, 1); // упала обратно в воду
            continue;
          }
          ctx.beginPath();
          ctx.arc(d.x + d.vx * sec, dy, d.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${(0.9 * (1 - t)).toFixed(3)})`;
          ctx.fill();
        }
      }
      if (state === "falling" || ripples.length > 0 || droplets.length > 0) {
        raf = requestAnimationFrame(loop);
      } else {
        running = false;
        raf = 0;
      }
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };

    /* Запуск падения: свой случайный угол посадки на каждый заход. */
    const arm = (delay: number) => {
      state = "falling";
      splashed = false;
      restRot = Math.random() * 4.4 - 2.2;
      startRot = -(2.2 + Math.random() * 1.6);
      receipt.classList.remove("is-rest");
      receipt.style.setProperty("--rest-rot", `${restRot.toFixed(2)}deg`);
      receipt.style.willChange = "transform, opacity";
      ripples.length = 0; // старые волны не тащим в новый заход
      droplets.length = 0;
      dropT0 = performance.now() + delay;
      start();
    };

    /* reduced motion: без падения и брызг — чек просто появляется,
       кольца проявляются и гаснут. */
    const showReduced = () => {
      receipt.style.opacity = "1";
      receipt.style.transform = "";
      const { x, y } = impactPoint();
      spawnRings(x, y, true);
    };

    /* Наблюдение за обёрткой чека: порог 0.4 — чек виден на 40%. */
    const ioStart = performance.now();
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.intersectionRatio >= 0.4 && state === "armed") {
            // секция уже на экране при загрузке — пауза на entrance;
            // при скролле падение стартует сразу
            const delay = performance.now() - ioStart < 300 ? 220 : 0;
            if (reduced) showReduced();
            else arm(delay);
          } else if (!en.isIntersecting) {
            // чек целиком ушёл из вьюпорта — снова armed
            state = "armed";
            receipt.classList.remove("is-rest");
            receipt.style.willChange = "";
            receipt.style.opacity = "";
            receipt.style.transform = "";
            ripples.length = 0;
            droplets.length = 0;
          }
        }
      },
      { threshold: [0, 0.4] },
    );
    io.observe(holder);

    /* Клик по фону секции — маленькая рябь и тихий плюх; чек, кнопка
       звука и ссылки — не триггер. */
    const onSceneClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest(".receipt, .pool-mute, a, button")) return;
      const s = section.getBoundingClientRect();
      spawnRings(e.clientX - s.left, e.clientY - s.top, false);
      playSplash(0.55);
    };
    section.addEventListener("click", onSceneClick);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      running = false;
      ro.disconnect();
      io.disconnect();
      section.removeEventListener("click", onSceneClick);
      if (audio) void audio.close().catch(() => {});
    };
  }, []);

  // Навигация-пилюля: стекло после прокрутки, бумага над светлыми секциями
  // (оформление и цена).
  useEffect(() => {
    const nav = document.querySelector(".site-nav");
    const papers = Array.from(document.querySelectorAll("#themes, #download"));
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("is-solid", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    let io: IntersectionObserver | null = null;
    if (papers.length > 0) {
      const visible = new Set<string>();
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target.id);
            else visible.delete(entry.target.id);
          }
          nav.classList.toggle("is-paper", visible.size > 0);
        },
        { rootMargin: "-72px 0px -82% 0px", threshold: 0 },
      );
      for (const section of papers) io.observe(section);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, []);

  return (
    <div>
      <header className="site-nav">
        <a className="logo" href="#top">
          <img className="mark" src="/brand/icon.png" alt="" />
          <span>
            Lomify<span className="logo-next">NEXT</span>
          </span>
        </a>
        <nav className="nav-links" aria-label="Разделы">
          <a href="#text">Текст</a>
          <a href="#themes">Оформление</a>
          <a href="#features">Возможности</a>
          <a href="#download">Скачать</a>
        </nav>
        <div className="nav-actions">
          <a className="btn btn-primary" href={WIN_DL}>
            <Download size={16} />
            Скачать
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-icon menu-toggle"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>
      {open ? (
        <div className="menu-panel">
          <a href="#text" onClick={() => setOpen(false)}>Текст</a>
          <a href="#themes" onClick={() => setOpen(false)}>Оформление</a>
          <a href="#features" onClick={() => setOpen(false)}>Возможности</a>
          <a href="#download" onClick={() => setOpen(false)}>Скачать</a>
        </div>
      ) : null}

      <main id="top">
        <section className="hero">
          <WaveCanvas />
          <p className="hero-corner hero-corner--tl mono">
            сайт и так тёмный — с dark reader он хуже: выключи его
          </p>
          <p className="hero-corner hero-corner--tr mono">
            open source · gpl-3.0
          </p>
          <div className="hero-ruler mono" aria-hidden="true">
            <span>31</span>
            <span>125</span>
            <span>500</span>
            <span>2k</span>
            <span>8k</span>
            <span>16k Hz</span>
          </div>
          <div className="hero-grid">
            <div className="rise">
              <p className="ticker mono">
                <span className="ticker-dot" />
                сейчас играет · de jure — королевский XVII
              </p>
              <h1 className="d1">
                <span className="d1-line">Lomify</span>
                <span className="d1-line alt">для ПК.</span>
              </h1>
              <p className="lede">
                Тихий плеер для Windows: Яндекс Музыка, SoundCloud и твоя медиатека в одном окне.
                Текст идёт по буквам, как в полноэкранном режиме. Листай вниз — увидишь.
              </p>
              <div className="hero-actions">
                <a className="btn btn-primary" href={WIN_DL}>
                  <Download size={16} />
                  Скачать для Windows
                </a>
              </div>
              <p className="hero-meta mono">x64 · бесплатно · GPL-3.0</p>
              <ul className="hero-stats mono">
                <li>
                  <b>0 ₽</b>
                  <span>цена</span>
                </li>
                <li>
                  <b>4</b>
                  <span>оформления</span>
                </li>
                <li>
                  <b>2</b>
                  <span>сервиса + файлы</span>
                </li>
                <li>
                  <b>GPL-3.0</b>
                  <span>лицензия</span>
                </li>
                <li>
                  <b>26</b>
                  <span>обновлений</span>
                </li>
              </ul>
              <p className="hero-note mono">* без рекламы и трекеров · обновления — через GitHub Releases</p>
            </div>

            <div className="app-frame" aria-hidden="true">
              <div className="app-glow" />
              <div className="app-body">
                <aside className="app-side">
                  {sideLinks.map((label, index) => {
                    const Icon = sideIcons[index];
                    // подсвечены «Любимые» — витрина плеера стоит на ней
                    return (
                      <div key={label} className={index === 4 ? "side-link is-on" : "side-link"}>
                        <Icon size={14} />
                        {label}
                      </div>
                    );
                  })}
                </aside>
                <div className="app-main">
                  <div className="app-main-head">
                    <b>Медиатека</b>
                    <span>2 трека</span>
                  </div>
                  {libraryRows.map((row, index) => (
                    <div key={row.title} className={row.on ? "track-row is-on" : "track-row"}>
                      <span>{index + 1}</span>
                      {row.cover ? <img src={row.cover} alt="" /> : <span className="swatch" />}
                      <span>
                        <b>{row.title}</b>
                        <small>{row.artist}</small>
                      </span>
                      <span>{row.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div id="text">
          <section className="section sec-band">
            <div className="section-inner">
              <div className="sec-head">
                <p className="sec-kicker">01 / текст</p>
                <h2 className="sec-title">
                  Подпевай <span className="alt">по буквам.</span>
                </h2>
                <p className="section-lead">
                  В полноэкранном режиме строчка зажигается по таймкоду трека — буква за буквой.
                  Ниже то же самое, только прокруткой: едут преимущества плеера, строка за строкой.
                  У строки «Шрифты на вкус» начертание листается по ходу скролла — все двенадцать из плеера.
                </p>
              </div>
            </div>
          </section>
          <LyricsStage />
          <section className="section text-merits">
            <div className="section-inner">
              <p className="text-merits-kicker mono">что уже умеет плеер</p>
              <ul className="text-merits-list mono">
                <li>текст по буквам — полный экран и таймкоды</li>
                <li>эквалайзер с профилями и своими пресетами</li>
                <li>моя волна, очередь и поиск с опечатками</li>
                <li>темы: цвета подбираются по обложке</li>
                <li>клавиши медиа, Last.fm, старт с системой</li>
                <li>без рекламы, трекеров и подписок</li>
              </ul>
            </div>
          </section>
        </div>

        <section className="section sec--paper" id="themes">
          <div className="section-inner">
            <div className="sec-head">
              <p className="sec-kicker">02 / оформление</p>
              <h2 className="sec-title">
                Свой вид <span className="alt">под настроение.</span>
              </h2>
              <p className="section-lead">
                Цвет темы и плотность панелей. Некий мистер C подбирает цвета по обложке, Матовый
                держит выбранную палитру. Нажми стиль — страница переоденется.
              </p>
            </div>
            <div className="theme-grid" role="group" aria-label="Стиль оформления">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className="theme-card"
                  aria-pressed={skin === theme.id}
                  onClick={() => setSkin(theme.id)}
                >
                  <div className={`theme-preview ${theme.preview}`}>
                    <div className="tp-head"><i /><i /><i /></div>
                    <div className="tp-row">
                      <span className="tp-cover" />
                      <span className="tp-lines">
                        <i className="tp-l1" />
                        <i className="tp-l2" />
                      </span>
                      <span className="tp-play" />
                    </div>
                    <div className="tp-progress"><i /></div>
                  </div>
                  <h3>{theme.name}</h3>
                  <p>{theme.text}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="features">
          <div className="section-inner">
            <div className="sec-head">
              <p className="sec-kicker">03 / возможности</p>
              <h2 className="sec-title">
                Два сервиса <span className="alt">и свои файлы.</span>
              </h2>
              <p className="section-lead">
                Поиск с опечатками, свои плейлисты, очередь и звук. Для Яндекс Музыки нужны аккаунт
                и подписка. SoundCloud зависит от сети — в настройках есть подбор обхода.
              </p>
              <a className="sec-link" href={SOURCE} target="_blank" rel="noreferrer">
                Исходники — на GitHub
                <ArrowUpRight size={14} />
              </a>
            </div>
            <div className="feature-grid">
              <article className="feature wide">
                <AudioLines size={22} />
                <h3>Полноэкранный текст</h3>
                <p>
                  Обложка, видеофон и синхронный текст. В приложении буквы идут по таймкоду трека.
                  Здесь их ведёт скролл — тот же ритм, только руками.
                </p>
              </article>
              <article className="feature">
                <Cloud size={22} />
                <h3>Яндекс, SoundCloud, файлы</h3>
                <p>Поиск, любимые и плейлисты из двух сервисов. Свои треки скачиваются и играют без сети.</p>
              </article>
              <article className="feature">
                <Waves size={22} />
                <h3>Моя волна по треку</h3>
                <p>
                  Яндекс ведёт свою станцию. SoundCloud собирает похожее сам: два пропуска исполнителя
                  убирают его из сеанса.
                </p>
              </article>
              <article className="feature">
                <SlidersHorizontal size={22} />
                <h3>Эквалайзер с профилями</h3>
                <p>Полосы и пресет остаются после перезапуска. Свои настройки можно назвать и переключать.</p>
              </article>
              <article className="feature">
                <Keyboard size={22} />
                <h3>Клавиши, очередь, Last.fm</h3>
                <p>
                  Системные кнопки воспроизведения, история прослушиваний и синхронизация плейлистов
                  Яндекса между телефоном и компьютером.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section sec--paper sec--price" id="download">
          {/* Сцена «лужа»: canvas с волнами лежит поверх текста и под чеком
              (слои: фон → текст → canvas → чек), плюс кнопка звука плюха.
              Рисует и ведёт всё движок чека в useEffect выше. */}
          <canvas className="receipt-canvas" aria-hidden="true" />
          <button
            type="button"
            className="pool-mute mono"
            onClick={() => setMuted((m) => !m)}
            aria-pressed={muted}
          >
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            {muted ? "звук выкл" : "звук вкл"}
          </button>
          <div className="section-inner">
            <div className="price-grid">
              <div className="price-copy">
                <p className="sec-kicker">04 / цена</p>
                <h2 className="sec-title">
                  Бесплатно. <span className="alt">Без подвоха.</span>
                </h2>
                <p className="price-zero" aria-label="Ноль рублей">
                  <span>0</span>
                  <i>₽</i>
                </p>
                <p className="section-lead">
                  Весь плеер целиком: тексты песен, темы, эквалайзер, волна и очередь. Платных планов
                  нет — качай последнюю сборку и слушай.
                </p>
                <div className="price-links">
                  <a className="sec-link" href={APK_DL}>
                    <Smartphone size={14} />
                    Android · APK
                  </a>
                  <a className="sec-link" href={SOURCE} target="_blank" rel="noreferrer">
                    <Github size={14} />
                    Исходники · GPL-3.0
                  </a>
                </div>
                <p className="price-fine">
                  Кнопка на чеке качает последний релиз с GitHub Releases. Яндекс Музыка и SoundCloud —
                  знаки своих владельцев, Lomify их не заменяет.
                </p>
              </div>
              <div className="price-receipt">
                {/* Лужа под чеком: стабильный layout-слой без transform —
                    от него движок считает точку удара. */}
                <i className="receipt-pool" aria-hidden="true" />
                <div className="receipt">
                  <div className="receipt-sheet">
                    <p className="r-brand">LOMIFY·STORE</p>
                    <p className="r-meta">касса №1 · чек №1337 · без сдачи</p>
                    <ul className="r-lines">
                      <li><span>Плеер</span><i /><b>0 ₽</b></li>
                      <li><span>Тексты песен</span><i /><b>0 ₽</b></li>
                      <li><span>Темы</span><i /><b>0 ₽</b></li>
                      <li><span>Эквалайзер</span><i /><b>0 ₽</b></li>
                      <li><span>Волна и очередь</span><i /><b>0 ₽</b></li>
                      <li><span>Реклама</span><i /><b className="r-no">нет</b></li>
                      <li><span>Подписка</span><i /><b className="r-no">не заводилась</b></li>
                    </ul>
                    <p className="r-total"><span>ИТОГО</span><i /><b>0 ₽</b></p>
                    <ReceiptBarcode />
                    <p className="r-num">4020 0000 0000 000 · СКИДКА 100%</p>
                    <p className="r-thanks">СПАСИБО, ЧТО СЛУШАЕШЬ</p>
                    <a className="btn btn-primary r-btn" href={WIN_DL}>
                      <Download size={16} />
                      БЕСПЛАТНО
                    </a>
                  </div>
                  <svg className="r-tear" viewBox="0 0 320 12" preserveAspectRatio="none" aria-hidden="true">
                    <path d={RECEIPT_TEAR} fill="currentColor" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="dl-finale">
              <div className="dl-finale-actions">
                <a className="btn btn-primary" href={WIN_DL}>
                  <Download size={16} />
                  Скачать для Windows
                </a>
                <a className="btn btn-ghost" href={APK_DL}>
                  <Smartphone size={16} />
                  Android · APK
                </a>
              </div>
              <p className="dl-finale-meta mono">
                LomifyNEXT · GPL-3.0 · обновления — через GitHub Releases
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <span>LomifyNEXT · GPL-3.0</span>
          <a href={SOURCE} rel="noreferrer">
            github.com/pizxxxxx/LomifyNEXT
          </a>
        </div>
      </footer>
    </div>
  );
}
