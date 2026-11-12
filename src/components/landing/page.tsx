import { useEffect, useState } from "react";
import {
  ArrowDown,
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
const GENIUS_DEJURE = "https://genius.com/Xvii-de-jure-lyrics";

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

  useEffect(() => {
    document.documentElement.dataset.skin = skin;
    document.documentElement.dataset.glass = "high";
  }, [skin]);

  // Чек выезжает из бумаги по мере прокрутки: чем глубже зашли в секцию цены,
  // тем выше поднимается лист. 0 — лежит внутри секции, 1 — висит над срезом.
  useEffect(() => {
    const receipt = document.querySelector<HTMLElement>(".receipt");
    const section = document.getElementById("download");
    if (!receipt || !section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const vh = window.innerHeight;
      const top = section.getBoundingClientRect().top;
      // Линейная привязка к скроллу: лист лезет ровно по мере прокрутки.
      const p = Math.min(1, Math.max(0, (vh - top) / (vh * 0.55)));
      receipt.style.setProperty("--rise", p.toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
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
            open source · gpl-3.0 · v9.6.4
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
                <a className="btn btn-ghost" href="#text">
                  Смотреть текст
                  <ArrowDown size={16} />
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
              </ul>
              <p className="hero-note mono">* без рекламы и трекеров · обновления — через GitHub Releases</p>
            </div>

            <div className="app-frame" aria-hidden="true">
              <div className="app-glow" />
              <div className="app-body">
                <aside className="app-side">
                  {sideLinks.map((label, index) => {
                    const Icon = sideIcons[index];
                    return (
                      <div key={label} className={index === 3 ? "side-link is-on" : "side-link"}>
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
                  Ниже то же самое, только прокруткой. Полные тексты публикуем не здесь: их читают
                  на Genius.
                </p>
                <a className="sec-link" href={GENIUS_DEJURE} target="_blank" rel="noreferrer">
                  Полные тексты — на Genius
                  <ArrowUpRight size={14} />
                </a>
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
                <div className="receipt">
                  <div className="receipt-rod" aria-hidden="true" />
                  <div className="receipt-sheet">
                    <p className="r-brand">LOMIFY·STORE</p>
                    <p className="r-meta">касса №1 · чек №0001 · без сдачи</p>
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
                LomifyNEXT v9.6.4 · APK 1.0.37 · GPL-3.0 · обновления — через GitHub Releases
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
