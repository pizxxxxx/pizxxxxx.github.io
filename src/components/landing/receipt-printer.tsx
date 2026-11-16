import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Download, Heart, Smartphone, Github } from "lucide-react";
import "@fontsource/pt-mono/400.css";

/* Чек печатается по скроллу: лента проявляется геометрически (высота окна),
   а не послойной анимацией строк. Все строки видны по умолчанию. */

const CPL = 42;
const FS = 13;
const QR_URL = "https://pizxxxxx.github.io/";
const DOWNLOAD_URL = "/download.html?app=desktop";
const APK_URL = "/download.html?app=mobile";
const SOURCE_URL = "https://github.com/pizxxxxx/LomifyNEXT";
const TIPS_URL = "https://yoomoney.ru/to/4100116984624656";

type ReceiptLine = { t: string; cls: string; ink: number; qr?: boolean };

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* QR v4-L, 33×33, mask 0 — настоящий сканируемый код, не картинка.
   Содержимое — адрес этого сайта. */
function makeQR(str: string): boolean[][] {
  const S = 33;
  const DATA = 80;
  const EC = 20;
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

  const bits: number[] = [];
  const push = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  push(4, 4);
  push(str.length, 8);
  for (const c of str) push(c.charCodeAt(0), 8);
  push(0, Math.min(4, DATA * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const cw: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    cw.push(b);
  }
  for (let p = 0; cw.length < DATA; p++) cw.push(p % 2 ? 0x11 : 0xec);
  let g = [1];
  for (let i = 0; i < EC; i++) {
    const r = new Array(g.length + 1).fill(0) as number[];
    for (let j = 0; j < g.length; j++) {
      r[j] ^= g[j];
      r[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = r;
  }
  const res = new Array(EC).fill(0) as number[];
  for (const b of cw) {
    const f = b ^ res[0];
    res.shift();
    res.push(0);
    if (f) for (let j = 0; j < EC; j++) res[j] ^= mul(g[j + 1], f);
  }
  const all = cw.concat(res);

  const M: boolean[][] = Array.from({ length: S }, () => new Array(S).fill(false));
  const F: boolean[][] = Array.from({ length: S }, () => new Array(S).fill(false));
  const setF = (xx: number, yy: number, v: boolean) => {
    M[yy][xx] = v;
    F[yy][xx] = true;
  };
  for (let i = 0; i < S; i++) {
    setF(6, i, i % 2 === 0);
    setF(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx < 0 || yy < 0 || xx >= S || yy >= S) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        setF(xx, yy, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(S - 4, 3);
  finder(3, S - 4);
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++)
      setF(26 + dx, 26 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  const data = 1 << 3;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const fb = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((fb >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) setF(8, i, bit(i));
  setF(8, 7, bit(6));
  setF(8, 8, bit(7));
  setF(7, 8, bit(8));
  for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) setF(S - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setF(8, S - 15 + i, bit(i));
  setF(8, S - 8, true);
  let i = 0;
  for (let right = S - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < S; vert++)
      for (let j = 0; j < 2; j++) {
        const xx = right - j;
        const up = ((right + 1) & 2) === 0;
        const yy = up ? S - 1 - vert : vert;
        if (!F[yy][xx] && i < all.length * 8) {
          M[yy][xx] = ((all[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
  }
  for (let yy = 0; yy < S; yy++)
    for (let xx = 0; xx < S; xx++) if (!F[yy][xx] && (xx + yy) % 2 === 0) M[yy][xx] = !M[yy][xx];
  return M;
}

function drawQR(canvas: HTMLCanvasElement) {
  const QR = makeQR(QR_URL);
  const scale = 3;
  const quiet = 4;
  const S = 33;
  canvas.width = canvas.height = (S + quiet * 2) * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#2b2822";
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      if (QR[y][x]) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
}

/* Кольцо от кружки: feTurbulence + displacement, тёмный ободок, капли. */
function ringSVG(size: number, seed: number, key: string) {
  const R = rng(seed);
  const id = `cf-${key}`;
  const drops = Array.from({ length: 4 + Math.floor(R() * 4) }, () => {
    const a = R() * 6.283;
    const d = size * (0.42 + R() * 0.22);
    return `<circle cx="${(size / 2 + Math.cos(a) * d).toFixed(1)}" cy="${(
      size / 2 +
      Math.sin(a) * d
    ).toFixed(1)}" r="${(1.5 + R() * 3.5).toFixed(1)}" fill="rgba(122,90,48,${(0.08 + R() * 0.1).toFixed(
      2,
    )})"/>`;
  }).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="3" seed="${seed}" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="${(size * 0.06).toFixed(1)}"/>
    </filter></defs>
    <g filter="url(#${id})">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.34}" fill="none" stroke="rgba(122,90,48,.20)" stroke-width="${(
        size * 0.055
      ).toFixed(1)}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.34}" fill="rgba(140,105,55,.045)"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.3}" fill="none" stroke="rgba(122,90,48,.07)" stroke-width="${(
        size * 0.02
      ).toFixed(1)}"/>
    </g>${drops}</svg>`;
}

function buildLines(): ReceiptLine[] {
  const R = rng(1337);
  const out: ReceiptLine[] = [];
  const add = (t: string, cls = "") =>
    out.push({ t, cls, ink: Number((0.8 + R() * 0.2).toFixed(3)) });
  const C = (t: string, cls = "") => add(" ".repeat(Math.max(0, Math.floor((CPL - t.length) / 2))) + t, cls);
  const LR = (a: string, b: string, cls = "") =>
    add(a + " ".repeat(Math.max(1, CPL - a.length - b.length)) + b, cls);
  const sep = (ch: string) => add(ch.repeat(CPL));
  const p2 = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const date = `${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${String(now.getFullYear()).slice(
    2,
  )} ${p2(now.getHours())}:${p2(now.getMinutes())}`;

  C("LOMIFY STORE", "b");
  C("ООО «ЛОМИФАЙ СОФТ»");
  C("ИНН 7712045678 КПП 771201001");
  C("115280, Г.МОСКВА, УЛ.ЛЕНИНСКАЯ");
  C("СЛОБОДА, Д.19, ОФ.404");
  sep("-");
  [
    "ПЛЕЕР ДЛЯ WINDOWS",
    "ТЕКСТЫ ПЕСЕН ПО БУКВАМ",
    "ТЁМНАЯ И СВЕТЛАЯ ТЕМЫ",
    "ЭКВАЛАЙЗЕР",
    "ВОЛНА И ОЧЕРЕДЬ",
    "ОБНОВЛЕНИЯ НАВСЕГДА",
  ].forEach((item) => {
    LR(item, "0.00");
    LR("  1.000 X 0.00", "= 0.00");
  });
  sep("-");
  LR("ИТОГО", "0.00", "tot");
  LR("БЕЗНАЛИЧНЫМИ", "0.00");
  add("БЕЗ НДС");
  sep("=");
  add("ФН: 7281440700441234", "sm");
  LR("ФД: 1337", "ФП: 3033443423", "sm");
  add("РН ККТ: 0000000012345678", "sm");
  add("СНО: УСН ДОХОД", "sm");
  add("КАССИР: LOMIFY BOT", "sm");
  LR(date, "СМЕНА 26", "sm");
  out.push({ t: "", cls: "qrl", ink: 1, qr: true });
  sep("-");
  C("СПАСИБО, ЧТО СЛУШАЕШЬ!", "b");
  C("РЕКЛАМА: НЕТ");
  C("ПОДПИСКА: НЕ ЗАВОДИЛАСЬ");
  C("ЧАЕВЫЕ: ПО СОВЕСТИ");
  C("* СУВЕНИРНЫЙ · НЕ ФИСКАЛЬНЫЙ · 0 РУБ", "sm");
  return out;
}

export function ReceiptPrinter() {
  const feedRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const paperCoffeeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const paper = paperRef.current;
    const win = winRef.current;
    const feed = feedRef.current;
    const inner = innerRef.current;
    const cta = ctaRef.current;
    const wrap = wrapRef.current;
    if (!paper || !win || !feed || !inner || !cta || !wrap) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Один лист, одна сборка строк — эффект может сработать дважды (StrictMode).
    const lines = buildLines();
    const host = paper.querySelector<HTMLElement>("[data-lines]");
    if (host) {
      host.replaceChildren();
      lines.forEach((line) => {
        const div = document.createElement("div");
        div.className = `rf-line${line.cls ? ` ${line.cls}` : ""}`;
        div.style.setProperty("--li", String(line.ink));
        if (line.qr) {
          const canvas = document.createElement("canvas");
          canvas.className = "rf-qr";
          div.appendChild(canvas);
          drawQR(canvas);
        } else div.textContent = line.t;
        host.appendChild(div);
      });
    }
    if (paperCoffeeRef.current) paperCoffeeRef.current.innerHTML = ringSVG(150, 777, "paper");

    // Рваные края только сверху и снизу, по горизонтали текст не режется.
    const R = rng(4242);
    const pts: string[] = [];
    const teeth = 26;
    for (let i = 0; i <= teeth; i++)
      pts.push(`${((i / teeth) * 100).toFixed(2)}% ${i % 2 ? (2 + R() * 3.5).toFixed(1) : 0}px`);
    pts.push("100% calc(100% - 6px)");
    for (let i = teeth; i >= 0; i--)
      pts.push(
        `${((i / teeth) * 100).toFixed(2)}% calc(100% - ${
          i % 2 ? (3 + R() * 4.5).toFixed(1) : 0
        }px)`,
      );
    paper.style.clipPath = `polygon(${pts.join(",")})`;

    let H = paper.offsetHeight;
    const measure = () => {
      H = paper.offsetHeight;
      fit();
    };
    // Вмещается лист целиком: по высоте экрана и по ширине с запасом на пятна.
    const fit = () => {
      const narrow = window.innerWidth < 900;
      const s = Math.min(
        1,
        (window.innerHeight - (narrow ? 230 : 40)) / (H + (narrow ? 170 : 130)),
        (window.innerWidth - 28) / (paper.offsetWidth + 70),
      );
      inner.style.transform = `scale(${s.toFixed(4)})`;
    };
    const ro = new ResizeObserver(measure);
    ro.observe(paper);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => undefined);
    measure();

    let cur = reduced ? 1 : 0;
    const loop = () => {
      const total = Math.max(1, feed.offsetHeight - window.innerHeight);
      // Печать заканчивается на 72% секции: дальше чек стоит целым в кадре,
      // пока sticky-сцена не отпустит у самого края секции.
      const raw = Math.min(1, Math.max(0, -feed.getBoundingClientRect().top / total));
      const target = reduced ? 1 : Math.min(1, raw / 0.72);
      cur += (target - cur) * 0.14;
      if (Math.abs(target - cur) < 0.0006) cur = target;

      // Геометрия, а не анимация строк: открываем окно ровно на долю чека.
      win.style.height = `${(cur * paper.offsetHeight).toFixed(1)}px`;
      const done = cur > 0.995;
      win.classList.toggle("is-done", done);
      cta.classList.toggle("is-done", cur > 0.98);
      const sway = Math.sin(cur * Math.PI) * 0.6 * (1 - cur * 0.4);
      // Печать идёт с хвоста: нижний край листа выходит первым и опускается,
      // а шапка появляется последней у щели. Окно растёт сверху вниз, лист
      // сдвинут вверх на нераспечатанную высоту — видно нижнюю часть чека.
      const feedShift = -(1 - cur) * paper.offsetHeight;
      wrap.style.transform = `translate3d(0, ${feedShift.toFixed(1)}px, 0) rotate(${(-0.8 + sway).toFixed(3)}deg)`;
      requestAnimationFrame(loop);
    };
    const frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <section
      className="receipt-feed sec--paper"
      id="download"
      ref={feedRef}
      aria-label="Чек печатается по скроллу"
    >
      <div className="rf-sticky">
        <div className="rf-copy">
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
            <a className="sec-link" href={APK_URL}>
              <Smartphone size={14} />
              Android · APK
            </a>
            <a className="sec-link" href={SOURCE_URL} target="_blank" rel="noreferrer">
              <Github size={14} />
              Исходники · GPL-3.0
            </a>
          </div>
          <p className="price-fine">
            Реквизиты в чеке вымышлены, денег не брали. QR ведёт на этот сайт. Яндекс Музыка и
            SoundCloud — знаки своих владельцев.
          </p>
        </div>

        <div className="rf-stage" ref={innerRef}>
          {/* Пятна зафиксированы вокруг листа, как картинка, а не по экрану. */}
          <div className="rf-stains" aria-hidden="true">
            <span className="rf-stain rf-stain--a" dangerouslySetInnerHTML={{ __html: ringSVG(150, 41, "a") }} />
            <span className="rf-stain rf-stain--b" dangerouslySetInnerHTML={{ __html: ringSVG(126, 97, "b") }} />
            <span className="rf-stain rf-stain--c" dangerouslySetInnerHTML={{ __html: ringSVG(104, 12, "c") }} />
          </div>
          {/* Щель невидимого принтера: тёмная линия и мягкая тень под ней. */}
          <div className="rf-feedslot" aria-hidden="true" />
          <div className="rf-win" ref={winRef}>
            <div className="rf-paper-wrap" ref={wrapRef}>
              <div
                className="rf-paper"
                ref={paperRef}
                style={
                  { "--ink": 0.7, "--wear": 0.67, "--crumple": 1, "--coffee": 0.79 } as CSSProperties
                }
              >
                <div data-lines />
                <div className="rf-ov rf-grain" />
                <div className="rf-ov rf-band" />
                <div className="rf-ov rf-edge" />
                <div className="rf-ov rf-crease" />
                <div className="rf-ov rf-coffeewash" />
                <div className="rf-ov rf-coffee" ref={paperCoffeeRef} />
              </div>
            </div>
          </div>

          <div className="rf-cta" ref={ctaRef}>
            <div className="rf-cta-row">
              <a className="btn btn-primary" href={DOWNLOAD_URL}>
                <Download size={16} />
                СКАЧАТЬ · 0 ₽
              </a>
              <a className="rf-tips" href={TIPS_URL} target="_blank" rel="noreferrer">
                <Heart size={13} />
                ЧАЕВЫЕ
              </a>
            </div>
            <small className="mono">чек — 0 ₽, но есть чаевые</small>
          </div>
        </div>
      </div>
    </section>
  );
}
