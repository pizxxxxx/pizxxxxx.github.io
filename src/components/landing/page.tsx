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
  Pause,
  Search,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Smartphone,
  Waves,
} from "lucide-react";
import { MorphIcon } from "morphicons/react";
import { Menu as MenuData, X as XData } from "lucide";
import { libraryRows, sideLinks, themes, type SkinId } from "./data";
import { LyricsStage } from "./lyrics-stage";
import { ReceiptPrinter } from "./receipt-printer";
import { WaveCanvas } from "./wave-canvas";

// Кнопки ведут на внутренний редиректор: он спрашивает GitHub API о последнем
// релизе и сразу перекидывает на файл ассета (exe/apk). Если API недоступен,
// редиректор пробует прямой адрес ассета, а затем страницу релизов. Имена
// файлов с версиями больше не ломают ссылку.
const WIN_DL = "/download.html?app=desktop";
const APK_DL = "/download.html?app=mobile";
const SOURCE = "https://github.com/pizxxxxx/LomifyNEXT";
// ЮMoney — та же ссылка, что в настройках плеера (перевод на кошелёк):
// чек на сайте нулевой, но поблагодарить автора можно отдельно.
const YOOMONEY = "https://yoomoney.ru/to/4100116984624656";

const sideIcons = [Library, Search, Waves, AudioLines, Heart];

/* Одна бегущая синусоида на строку заголовка. Фаза буквы зависит только от
   её x — поэтому центры всех букв строки лежат на одной волне. Один общий
   rAF на все строки; никаких keyframes и задержек по индексу. */
function WaveLine({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={className ? `d1-line ${className}` : "d1-line"} aria-hidden="true">
      {Array.from(text).map((char, index) => (
        <span key={index} className="wave-ch">
          {char === " " ? "\u00a0" : char}
        </span>
      ))}
    </span>
  );
}

// Темп и длина волны подобраны на локальном пульте: 0.195 об/с и L=1000 —
// строка течёт заметно, но буквы не мечутся вверх-вниз.
const HEADLINE_WAVE_SPEED = 0.195;

function WaveTitle() {
  const rootRef = useRef<HTMLHeadingElement>(null);
  const [speed, setSpeed] = useState(HEADLINE_WAVE_SPEED);
  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lines = Array.from(root.querySelectorAll<HTMLElement>(".d1-line"));
    const chars = lines.map((line) => Array.from(line.querySelectorAll<HTMLElement>(".wave-ch")));
    let centers: number[][] = [];
    const measure = () => {
      centers = chars.map((row) => row.map((el) => el.offsetLeft + el.offsetWidth / 2));
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => undefined);

    const A = 23;
    const L = 1000;
    const k = (Math.PI * 2) / L;
    let turns = 0; // накопленные обороты фазы: менять скорость можно без скачка
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const elapsed = (now - last) / 1000;
      last = now;
      // Не обрезаем обычные просадки кадров: в превью rAF может идти в 10 fps,
      // и жёсткий лимит dt тормозил бы волну вдвое. Защита только от спячки.
      if (elapsed < 0.5) turns += elapsed * speedRef.current; // обороты в секунду
      for (let li = 0; li < chars.length; li++) {
        const row = chars[li];
        for (let i = 0; i < row.length; i++) {
          const phase = k * (centers[li]?.[i] ?? 0) + turns * Math.PI * 2; // плюс — влево
          const y = A * Math.sin(phase);
          const rot = (Math.atan(A * k * Math.cos(phase)) * 180) / Math.PI;
          row[i].style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
        }
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const showControl =
    import.meta.env.DEV ||
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("qa-speed"));

  return (
    <>
      <h1 ref={rootRef} className="d1" aria-label="Lomify для ПК.">
        <WaveLine text="Lomify" />
        <WaveLine text="для" className="alt" />
        <WaveLine text="ПК." className="alt" />
      </h1>
      {showControl && (
        <label className="qa-speed">
          <span>
            скорость: <b>{speed.toFixed(3)}</b> об/с · {(speed * Math.PI * 2).toFixed(3)} рад/с · {" "}
            {speed > 0 ? (1 / speed).toFixed(1) : "∞"}с период
          </span>
          <input
            type="range"
            min={0.005}
            max={0.2}
            step={0.005}
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
        </label>
      )}
    </>
  );
}

export function Landing() {
  const [open, setOpen] = useState(false);
  // Матовый — тема с тремя фото в витрине; её и держим по умолчанию.
  const [skin, setSkin] = useState<SkinId>("matte");

  useEffect(() => {
    document.documentElement.dataset.skin = skin;
    document.documentElement.dataset.glass = "high";
  }, [skin]);

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
          <a className="btn btn-primary nav-cta" href={WIN_DL}>
            <Download size={16} />
            <span className="nav-cta-text">Скачать</span>
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-icon menu-toggle"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <MorphIcon icon={open ? XData : MenuData} size={18} reducedMotion="user" />
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
              <WaveTitle />
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
                  <img className="side-watermark" src="/brand/side-icon.png" alt="" />
                  <div className="side-brand">
                    <b>Lomify<span className="side-next">NEXT</span></b>
                    <small>Твоя музыка, без лишнего</small>
                  </div>
                  <p className="side-label mono">библиотека</p>
                  <div className="side-nav">
                    {sideLinks.map((label, index) => {
                      const Icon = sideIcons[index];
                      // подсвечены «Любимые» — витрина плеера стоит на ней
                      return (
                        <div key={label} className={index === 4 ? "side-link is-on" : "side-link"}>
                          <Icon size={14} />
                          <span>{label}</span>
                          {index === 4 && <i className="side-count mono">2</i>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="side-now">
                    <div className="side-now-top">
                      <span className="side-now-cover"><img src="/covers/dejure.jpg" alt="" /></span>
                      <span className="side-now-text">
                        <small>сейчас играет</small>
                        <b>de jure</b>
                        <span>королевский XVII</span>
                      </span>
                      <span className="side-now-eq"><i /><i /><i /><i /></span>
                    </div>
                    <div className="side-now-ctrl">
                      <SkipBack size={12} />
                      <span className="side-play"><Pause size={10} fill="currentColor" /></span>
                      <SkipForward size={12} />
                      <span className="side-clock mono">0:41 / 1:37</span>
                    </div>
                    <div className="side-now-bar"><i /></div>
                  </div>
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
                Цвет темы и плотность панелей. По умолчанию стоит Матовый — он держит выбранную
                палитру; Некий мистер C подбирает цвета по обложке. Нажми стиль — страница переоденется.
              </p>
            </div>
            {/* Подпись над первым рядом тем — тем же тоном, что подписи
                карточек: тихая, строчными. */}
            <p className="theme-note" aria-hidden="true">ну почти тёмный</p>
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

        <ReceiptPrinter />
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
