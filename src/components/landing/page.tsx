import { useEffect, useState } from "react";
import {
  AudioLines,
  Cloud,
  Download,
  Github,
  Heart,
  Keyboard,
  Library,
  Menu,
  Monitor,
  Search,
  SlidersHorizontal,
  Smartphone,
  Waves,
  X,
} from "lucide-react";
import { libraryRows, sideLinks, themes, type SkinId } from "./data";
import { LyricsStage } from "./lyrics-stage";

const WIN = "https://github.com/pizxxxxx/LomifyNEXT/releases/latest";
const ANDROID = "https://github.com/pizxxxxx/LomifyNEXT-Mobile/releases/latest";
const SOURCE = "https://github.com/pizxxxxx/LomifyNEXT";

const sideIcons = [Library, Search, Waves, AudioLines, Heart];

export function Landing() {
  const [open, setOpen] = useState(false);
  const [skin, setSkin] = useState<SkinId>("mister");

  useEffect(() => {
    document.documentElement.dataset.skin = skin;
    document.documentElement.dataset.glass = "high";
  }, [skin]);

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
          <a className="btn btn-primary" href={WIN} rel="noreferrer">
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
          <img className="hero-mark" src="/brand/mark.webp" alt="" />
          <div className="hero-grid">
            <div className="rise">
              <p className="kicker">Десктоп, Windows</p>
              <h1>Строчки идут по буквам</h1>
              <p className="lede">
                LomifyNEXT — тихий плеер для компьютера. Яндекс Музыка, SoundCloud и твоя медиатека
                в одном окне. Прокрути вниз: текст зажигается так же, как в полноэкранном режиме.
              </p>
              <div className="hero-actions">
                <a className="btn btn-primary" href={WIN} rel="noreferrer">
                  <Monitor size={16} />
                  Windows
                </a>
                <a className="btn btn-ghost" href="#text">
                  Смотреть текст
                </a>
              </div>
              <ul className="facts">
                <li>
                  <b>4 стиля</b>
                  <span>от стекла до матового</span>
                </li>
                <li>
                  <b>2 сервиса</b>
                  <span>плюс свои файлы</span>
                </li>
                <li>
                  <b>Волна</b>
                  <span>от трека или просто так</span>
                </li>
              </ul>
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

        <LyricsStage />

        <section className="section" id="themes">
          <div className="section-inner">
            <h2>Глобальный дизайн</h2>
            <p className="section-lead">
              Цвет темы и плотность панелей. Некий мистер C подбирает цвета по обложке, Матовый
              держит выбранную палитру. Нажми стиль — страница переоденется.
            </p>
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
                    <div className="bar" style={{ width: "70%" }} />
                    <div className="bar short" />
                    <div className="chip" />
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
            <h2>Что умеет плеер</h2>
            <p className="section-lead">
              Поиск с опечатками, свои плейлисты, очередь и звук. Для Яндекс Музыки нужны аккаунт и
              подписка. SoundCloud зависит от сети — в настройках есть подбор обхода.
            </p>
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

        <section className="section" id="download">
          <div className="section-inner">
            <div className="download-panel glass">
              <div>
                <p className="kicker">
                  <b>релиз</b>
                  последний
                </p>
                <h2>Поставить на компьютер</h2>
                <p className="section-lead">
                  Открой последний релиз, скачай установщик LomifyNEXT для Windows x64 и запусти его.
                  Права администратора нужны не всегда. Версия для Android живёт отдельно.
                </p>
              </div>
              <div>
                <div className="dl-actions">
                  <a className="btn btn-primary" href={WIN} rel="noreferrer">
                    <Download size={16} />
                    Windows
                  </a>
                  <a className="btn btn-ghost" href={ANDROID} rel="noreferrer">
                    <Smartphone size={16} />
                    Android
                  </a>
                  <a className="btn btn-ghost" href={SOURCE} rel="noreferrer">
                    <Github size={16} />
                    Исходники
                  </a>
                </div>
                <p className="fine">
                  После установки: Настройки → Сервисы, подключи музыку и открой Поиск. Яндекс Музыка и
                  SoundCloud — знаки своих владельцев. Lomify их не заменяет.
                </p>
              </div>
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
