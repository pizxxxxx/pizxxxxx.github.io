// QA: сглаживание свайпов карaoke-сцены на тач-вьюпорте + стиль кнопки play.
// Запуск: node scripts/qa-touch.mjs [baseURL]  (по умолчанию http://localhost:8080)
// Печатает JSON-вердикт; код возврата 1 при провале.
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:8080";
const url = `${base}/?qa-touch=${Date.now()}`;
const out = { pass: true, checks: {} };
const fail = (name, detail) => {
  out.pass = false;
  out.checks[name] = { ok: false, detail };
};
const ok = (name, detail) => {
  out.checks[name] = { ok: true, ...detail };
};

const browser = await chromium.launch();

try {
  // --- Мобильный тач-вьюпорт ---
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await mobile.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(url, { waitUntil: "load" });
  await page.waitForSelector('.lyric-stage[data-ready="1"]', { timeout: 15000 });
  await page.waitForTimeout(800);

  // Пилюля: стили кнопки play
  const playStyle = await page.evaluate(() => {
    const el = document.querySelector(".icon-btn.play-btn");
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, color: cs.color, w: Math.round(el.getBoundingClientRect().width) };
  });
  (playStyle.bg === "rgba(0, 0, 0, 0)"
    ? ok("playBtnNoFill", playStyle)
    : fail("playBtnNoFill", playStyle));

  // Догон до 30% и стационар
  const base30 = await page.evaluate(async () => {
    const stage = document.querySelector(".lyric-stage");
    const sticky = document.querySelector(".stage-sticky");
    const total = stage.offsetHeight - sticky.offsetHeight;
    window.scrollTo({ top: stage.offsetTop + total * 0.3, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 900));
    return { total, value: Number(document.querySelector(".transport-seek input").value), y: window.scrollY };
  });
  (
    Math.abs(base30.value - 300) <= 2
      ? ok("settleAt30", base30)
      : fail("settleAt30", base30)
  );

  // Флинг: скачок +15% — range должен ехать по кадрам (eased), а не прыгать
  const fling = await page.evaluate(async () => {
    const stage = document.querySelector(".lyric-stage");
    const sticky = document.querySelector(".stage-sticky");
    const total = stage.offsetHeight - sticky.offsetHeight;
    const range = document.querySelector(".transport-seek input");
    const start = Number(range.value);
    window.scrollTo({ top: window.scrollY + total * 0.15, behavior: "instant" });
    const samples = [];
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 60));
      samples.push(Number(range.value));
    }
    return { start, target: start + 150, samples };
  });
  const s = fling.samples;
  const target = fling.target;
  const eased = s[0] < target && s.some((v, i) => i > 0 && v > s[i - 1]) && s[s.length - 1] > fling.start + 60;
  const converged = Math.abs(s[s.length - 1] - target) <= 2;
  (eased && converged
    ? ok("flingEased", { start: fling.start, target, last: s[s.length - 1], samples: s })
    : fail("flingEased", { start: fling.start, target, last: s[s.length - 1], samples: s }));

  // Play: без заливки, глиф белый; при игре — акцент; морф; страница стоит
  const pathBefore = await page.evaluate(
    () => document.querySelector(".icon-btn.play-btn svg path")?.getAttribute("d")?.slice(0, 24),
  );
  const y0 = await page.evaluate(() => window.scrollY);
  await page.click(".icon-btn.play-btn");
  await page.mouse.move(5, 5); // уводим курсор, чтобы hover не подмешивался в стили
  await page.waitForTimeout(700);
  const playAfter = await page.evaluate(() => {
    const el = document.querySelector(".icon-btn.play-btn");
    return {
      label: el.getAttribute("aria-label"),
      color: getComputedStyle(el).color,
      bg: getComputedStyle(el).backgroundColor,
      path: el.querySelector("svg path")?.getAttribute("d")?.slice(0, 24),
      y: window.scrollY,
    };
  });
  (
    playAfter.label === "Пауза" && playAfter.bg === "rgba(0, 0, 0, 0)" && playAfter.color !== playStyle.color
      ? ok("playAccent", playAfter)
      : fail("playAccent", playAfter)
  );
  (
    pathBefore !== playAfter.path
      ? ok("playMorph", { pathBefore, pathAfter: playAfter.path })
      : fail("playMorph", { pathBefore, pathAfter: playAfter.path })
  );
  (Math.abs(playAfter.y - y0) <= 2 ? ok("playNoPageMove", { y0, y1: playAfter.y }) : fail("playNoPageMove", { y0, y1: playAfter.y }));
  await page.click(".icon-btn.play-btn"); // пауза
  await mobile.close();

  // --- Десктоп: прямая привязка, без qa-touch ---
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dpage = await desk.newPage();
  dpage.on("pageerror", (e) => errors.push(String(e)));
  await dpage.goto(base + "/", { waitUntil: "load" });
  await dpage.waitForSelector('.lyric-stage[data-ready="1"]', { timeout: 15000 });
  const deskCheck = await dpage.evaluate(async () => {
    const stage = document.querySelector(".lyric-stage");
    const sticky = document.querySelector(".stage-sticky");
    const total = stage.offsetHeight - sticky.offsetHeight;
    window.scrollTo({ top: stage.offsetTop + total * 0.3, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 120));
    return Number(document.querySelector(".transport-seek input").value);
  });
  (Math.abs(deskCheck - 300) <= 2 ? ok("desktopDirect", { value: deskCheck }) : fail("desktopDirect", { value: deskCheck }));
  await desk.close();

  (
    errors.length === 0 ? ok("consoleClean", { errors }) : fail("consoleClean", { errors })
  );
} finally {
  await browser.close();
}

console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
