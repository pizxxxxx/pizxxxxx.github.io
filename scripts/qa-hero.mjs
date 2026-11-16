// QA витрины первого экрана: дефолтная тема Матовый и новая левая панель.
// Запуск: node scripts/qa-hero.mjs [baseURL]
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:8080";
const browser = await chromium.launch();
const out = { pass: true, checks: {} };
const check = (name, value, expect) => {
  const ok = JSON.stringify(value) === JSON.stringify(expect);
  out.checks[name] = { ok, value, expect };
  if (!ok) out.pass = false;
};
const errors = [];

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + "/?fresh=" + Date.now(), { waitUntil: "load" });
  await page.waitForSelector(".app-side .side-now", { timeout: 15000 });
  await page.waitForTimeout(700);

  const d = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const cs = (s) => getComputedStyle(q(s));
    const side = q(".app-side");
    const now = q(".side-now");
    return {
      skin: document.documentElement.dataset.skin,
      pressed: q('.theme-card[aria-pressed="true"] h3')?.textContent,
      sideShown: cs(".app-side").display !== "none",
      brand: q(".side-brand b")?.textContent,
      tagline: q(".side-brand small")?.textContent,
      iconLoaded: q(".side-watermark")?.complete && q(".side-watermark")?.naturalWidth > 0,
      watermarkW: Math.round(q(".side-watermark")?.getBoundingClientRect().width ?? 0),
      watermarkOffset: q(".side-watermark")?.offsetTop ?? 0,
      watermarkOpacity: Number(getComputedStyle(q(".side-watermark")).opacity),
      versionGone: !q(".side-ver"),
      navCount: side.querySelectorAll(".side-link").length,
      onCount: side.querySelectorAll(".side-link.is-on").length,
      counter: q(".side-count")?.textContent,
      nowShown: now.getBoundingClientRect().height > 40,
      coverLoaded: q(".side-now-cover img")?.complete && q(".side-now-cover img")?.naturalWidth > 0,
      eq: side.querySelectorAll(".side-now-eq i").length,
      bar: q(".side-now-bar i")?.getBoundingClientRect().width > 5,
      hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      sideBottom: Math.round(side.getBoundingClientRect().bottom),
      frameBottom: Math.round(q(".app-frame").getBoundingClientRect().bottom),
    };
  });
  check("skin", d.skin, "matte");
  check("pressed", d.pressed, "Матовый");
  check("sideShown", d.sideShown, true);
  check("brand", d.brand, "LomifyNEXT");
  check("tagline", d.tagline, "Твоя музыка, без лишнего");
  check("iconLoaded", d.iconLoaded, true);
  check("watermarkBig", d.watermarkW >= 200 && d.watermarkOpacity < 0.3, true);
  check("watermarkRaised", d.watermarkOffset <= -30, true);
  check("versionGone", d.versionGone, true);
  check("navCount", d.navCount, 5);
  check("onCount", d.onCount, 1);
  check("counter", d.counter, "2");
  check("nowShown", d.nowShown, true);
  check("coverLoaded", d.coverLoaded, true);
  check("eq", d.eq, 4);
  check("bar", d.bar, true);
  check("hscroll", d.hscroll, false);

  // Проверка синусоиды: по y и наклону каждой буквы восстанавливаем её фазу
  // и вычитаем k*cx. У всех букв всех строк остаток должен быть одинаков —
  // значит центры лежат на одной волне, а не прыгают независимо.
  const wave = await page.evaluate(async () => {
    const A = 23;
    const k = (Math.PI * 2) / 670;
    const lines = [...document.querySelectorAll(".d1-line")];
    const read = () =>
      lines.map((line) =>
        [...line.querySelectorAll(".wave-ch")].map((el) => {
          const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
          const y = m.m42;
          const rot = Math.atan2(m.b, m.a);
          const cx = el.offsetLeft + el.offsetWidth / 2;
          const phase = Math.atan2(y / A, Math.tan(rot) / (A * k)) - k * cx;
          return { y, phase };
        }),
      );
    const a = read();
    await new Promise((r) => setTimeout(r, 400));
    const b = read();
    const flatA = a.flat();
    const flatB = b.flat();
    const phases = flatA.map((p) => p.phase);
    const offsets = phases.map((p) =>
      Math.atan2(Math.sin(p - phases[0]), Math.cos(p - phases[0])),
    );
    return {
      lines: lines.length,
      count: flatA.length,
      phaseSpread: Math.round((Math.max(...offsets) - Math.min(...offsets)) * 1000) / 1000,
      moving: flatA.some((p, i) => Math.abs(p.y - flatB[i].y) > 1),
      maxY: Math.max(...flatA.map((p) => Math.abs(p.y))),
      heading: document.querySelector("h1").getAttribute("aria-label"),
    };
  });
  check("waveLines", wave.lines, 3);
  check("waveChars", wave.count, 12);
  check("oneSine", wave.phaseSpread < 0.05, true);
  check("waveMoves", wave.moving, true);
  check("waveAmplitude", wave.maxY <= 23.5, true);
  check("headingLabel", wave.heading, "Lomify для ПК.");
  await page.screenshot({ path: "D:/lomisite/screenshots/hero-matte.png", fullPage: false });

  // Переключение тем работает и возвращается на Матовый
  await page.locator(".theme-card").filter({ hasText: "Некий мистер C" }).click();
  const switched = await page.evaluate(() => document.documentElement.dataset.skin);
  check("switchToMister", switched, "mister");
  await page.locator(".theme-card").filter({ hasText: "Матовый" }).click();
  const back = await page.evaluate(() => document.documentElement.dataset.skin);
  check("switchBack", back, "matte");
  await ctx.close();

  const m = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const mp = await m.newPage();
  mp.on("pageerror", (e) => errors.push(String(e)));
  await mp.goto(base + "/?fresh=" + Date.now(), { waitUntil: "load" });
  await mp.waitForSelector(".hero-grid", { timeout: 15000 });
  await mp.waitForTimeout(500);
  const mob = await mp.evaluate(() => ({
    hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    sideHidden: getComputedStyle(document.querySelector(".app-side")).display === "none",
    skin: document.documentElement.dataset.skin,
  }));
  check("mobileNoOverflow", mob.hscroll, false);
  check("mobileSideHidden", mob.sideHidden, true);
  check("mobileSkin", mob.skin, "matte");
  await m.close();

  // При «меньше движения» анимация не стартует — буквы остаются на месте
  const rm = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const rp = await rm.newPage();
  await rp.goto(base + "/?fresh=" + Date.now(), { waitUntil: "load" });
  await rp.waitForSelector(".d1-line .wave-ch");
  await rp.waitForTimeout(400);
  const still = await rp.evaluate(() =>
    [...document.querySelectorAll(".d1-line .wave-ch")].every(
      (el) => getComputedStyle(el).transform === "none",
    ),
  );
  check("reducedMotionStill", still, true);
  await rm.close();

  check("consoleClean", errors, []);
} finally {
  await browser.close();
}
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
