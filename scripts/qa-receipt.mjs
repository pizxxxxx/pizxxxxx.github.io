// QA секции чека: печать по скроллу, строки, ширина, QR, отрыв, пятна.
// Запуск: node scripts/qa-receipt.mjs [baseURL]
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:8080";
const out = { pass: true, checks: {} };
const check = (name, value, expect) => {
  const ok = JSON.stringify(value) === JSON.stringify(expect);
  out.checks[name] = { ok, value, expect };
  if (!ok) out.pass = false;
};
const errors = [];
const browser = await chromium.launch();

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + "/?fresh=" + Date.now(), { waitUntil: "load" });
  await page.waitForSelector(".rf-paper .rf-line", { timeout: 15000 });
  await page.waitForTimeout(700);

  const geom = await page.evaluate(() => {
    const feed = document.querySelector(".receipt-feed");
    const paper = document.querySelector(".rf-paper");
    const win = document.querySelector(".rf-win");
    const lines = [...document.querySelectorAll(".rf-paper .rf-line")];
    const paperRect = paper.getBoundingClientRect();
    const over = lines.filter((el) => el.scrollWidth > paper.clientWidth + 1);
    return {
      feedVh: Math.round(feed.offsetHeight / window.innerHeight),
      sticky: getComputedStyle(document.querySelector(".rf-sticky")).position,
      lineCount: lines.length,
      invisible: lines.filter((el) => Number(getComputedStyle(el).opacity) <= 0.05).length,
      clipped: over.length,
      paperW: paper.offsetWidth, // до масштаба fit(), не визуальный rect
      paperH: Math.round(paperRect.height),
      paperFixedH: getComputedStyle(paper).height !== "auto" && paper.style.height !== "",
      qrCount: document.querySelectorAll(".rf-qr").length,
      qrW: document.querySelector(".rf-qr")?.width ?? 0,
      winH: Math.round(win.getBoundingClientRect().height),
    };
  });
  check("feedHeight", geom.feedVh >= 2 && geom.feedVh <= 3, true);
  check("sticky", geom.sticky, "sticky");
  check("linesVisible", geom.invisible, 0);
  check("linesMany", geom.lineCount >= 35, true);
  check("noClipping", geom.clipped, 0);
  check("paperWidth", geom.paperW >= 350 && geom.paperW <= 380, true);
  check("paperAutoHeight", geom.paperFixedH, false);
  check("qrPresent", geom.qrCount, 1);
  check("qrCanvas", geom.qrW >= 100, true);
  check("winStartsClosed", geom.winH <= 2, true);

  // Скролл до 40% секции: лента вышла частично, CTA ещё скрыт
  const middle = await page.evaluate(async () => {
    const feed = document.querySelector(".receipt-feed");
    const total = feed.offsetHeight - window.innerHeight;
    window.scrollTo({ top: feed.offsetTop + total * 0.4, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 1200));
    const win = document.querySelector(".rf-win");
    const paper = document.querySelector(".rf-paper");
    return {
      winH: Math.round(win.getBoundingClientRect().height),
      paperH: Math.round(paper.getBoundingClientRect().height),
      cta: getComputedStyle(document.querySelector(".rf-cta")).opacity,
      feedY: new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".rf-paper-wrap")).transform).m42,
      slot: !!document.querySelector(".rf-feedslot"),
      stains: document.querySelectorAll(".rf-stain").length,
      tailVisible: (() => {
        const lines = document.querySelectorAll(".rf-line");
        const last = lines[lines.length - 1].getBoundingClientRect();
        const w = win.getBoundingClientRect();
        return last.top >= w.top - 2 && last.bottom <= w.bottom + 2;
      })(),
      headHidden: (() => {
        const first = document.querySelector(".rf-line").getBoundingClientRect();
        return first.bottom < win.getBoundingClientRect().top + 2;
      })(),
    };
  });
  check("printsTailFirst", middle.tailVisible && middle.headHidden, true);
  check("printingPartial", middle.winH > 40 && middle.winH < middle.paperH - 40, true);
  check("ctaHiddenMid", Number(middle.cta) < 0.1, true);
  check("stainsAroundPaper", middle.stains, 3);
  check("invisibleSlot", middle.slot, true);
  check("paperFeedsDown", middle.feedY < -1, true);
  await page.screenshot({ path: "D:/lomisite/screenshots/receipt-printing.png" });

  // 88% секции: печать уже закончилась (на 72%), чек ещё целиком в кадре
  const end = await page.evaluate(async () => {
    const feed = document.querySelector(".receipt-feed");
    const total = feed.offsetHeight - window.innerHeight;
    window.scrollTo({ top: feed.offsetTop + total * 0.88, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 1500));
    const win = document.querySelector(".rf-win");
    const paper = document.querySelector(".rf-paper");
    const r = paper.getBoundingClientRect();
    return {
      paperTop: Math.round(r.top),
      paperBottom: Math.round(r.bottom),
      winH: win.offsetHeight,
      paperH: paper.offsetHeight, // rect у наклонённого листа больше на ~4px
      done: win.classList.contains("is-done"),
      overflow: getComputedStyle(win).overflow,
      cta: getComputedStyle(document.querySelector(".rf-cta")).opacity,
      noPrinter: !document.querySelector(".rf-printer"),
      noStatus: !document.querySelector(".rf-status"),
      restY: new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".rf-paper-wrap")).transform).m42,
      clip: getComputedStyle(paper).clipPath.slice(0, 20),
    };
  });
  check("fullTape", Math.abs(end.winH - end.paperH) <= 3, true);
  check("wholeReceiptInView", end.paperTop >= -2 && end.paperBottom <= 902, true);
  check("tornEdgesVisible", end.done && end.overflow === "visible", true);
  check("ctaVisibleEnd", Number(end.cta) > 0.9, true);
  check("noPrinter", end.noPrinter, true);
  check("noStatusLabel", end.noStatus, true);
  check("paperSettled", Math.abs(end.restY) < 2, true);
  check("clipPathJagged", end.clip.startsWith("polygon"), true);
  await page.screenshot({ path: "D:/lomisite/screenshots/receipt-full.png" });

  // QR: структурная проверка трёх finder-паттернов + адрес в исходнике
  const qrShape = await page.evaluate(() => {
    const c = document.querySelector(".rf-qr");
    const ctx = c?.getContext("2d");
    if (!ctx) return null;
    const scale = 3;
    const quiet = 4;
    const S = 33;
    const dark = (mx, my) => {
      const d = ctx.getImageData((mx + quiet) * scale + 1, (my + quiet) * scale + 1, 1, 1).data;
      return d[3] > 0 && d[0] < 128;
    };
    const finder = (ox, oy) => {
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 7; x++) {
          const expected = x === 0 || y === 0 || x === 6 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
          if (dark(ox + x, oy + y) !== expected) return false;
        }
      return true;
    };
    return {
      tl: finder(0, 0),
      tr: finder(S - 7, 0),
      bl: finder(0, S - 7),
    };
  });
  check("qrFinders", qrShape, { tl: true, tr: true, bl: true });
  const source = await (await import("node:fs/promises")).readFile(
    "src/components/landing/receipt-printer.tsx",
    "utf8",
  );
  check("qrUrl", source.includes('QR_URL = "https://pizxxxxx.github.io/"'), true);

  // Один лист, одна сборка строк — без дублей
  const single = await page.evaluate(() => ({
    papers: document.querySelectorAll(".rf-paper").length,
    qr: document.querySelectorAll(".rf-qr").length,
    lines: document.querySelectorAll(".rf-line").length,
    qrCaption: [...document.querySelectorAll(".rf-line")].some((el) => el.textContent.includes("GITHUB.IO")),
    legal: [...document.querySelectorAll(".rf-line")].some((el) =>
      el.textContent.includes("НЕ ФИСКАЛЬНЫЙ"),
    ),
  }));
  check("oneReceipt", single.papers, 1);
  check("oneQr", single.qr, 1);
  check("linesCount", single.lines, 36);
  check("noQrCaption", single.qrCaption, false);
  check("legalStillThere", single.legal, true);
  await ctx.close();

  // Мобильная версия: лист и пятна помещаются, QR и CTA видны
  const m = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const mp = await m.newPage();
  mp.on("pageerror", (e) => errors.push(String(e)));
  await mp.goto(base + "/?fresh=" + Date.now(), { waitUntil: "load" });
  await mp.waitForSelector(".rf-paper .rf-line");
  const mob = await mp.evaluate(async () => {
    const feed = document.querySelector(".receipt-feed");
    const total = feed.offsetHeight - window.innerHeight;
    window.scrollTo({ top: feed.offsetTop + total * 1.1, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 1500));
    const paper = document.querySelector(".rf-paper");
    const stage = document.querySelector(".rf-stage");
    const pr = paper.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    return {
      hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      paperInView: pr.left >= -2 && pr.right <= window.innerWidth + 2,
      stains: document.querySelectorAll(".rf-stain").length,
      stageVisible: sr.width > 150,
      cta: Number(getComputedStyle(document.querySelector(".rf-cta")).opacity) > 0.9,
      ctaBottom: Math.round(document.querySelector(".rf-cta").getBoundingClientRect().bottom),
      navClear: getComputedStyle(document.querySelector(".rf-sticky")).paddingTop === "92px",
      scale: new DOMMatrixReadOnly(getComputedStyle(stage).transform).a,
    };
  });
  check("mobileNoOverflow", mob.hscroll, false);
  check("mobilePaperFits", mob.paperInView, true);
  check("mobileStains", mob.stains, 3);
  check("mobileCta", mob.cta, true);
  check("mobileCtaFits", mob.ctaBottom <= 846, true);
  check("mobileNavClear", mob.navClear, true);
  check("mobileScaled", mob.scale < 1, true);
  await mp.screenshot({ path: "D:/lomisite/screenshots/receipt-mobile.png" });
  await m.close();

  // Reduced motion: лента сразу целиком
  const rm = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const rp = await rm.newPage();
  await rp.goto(base + "/?fresh=" + Date.now(), { waitUntil: "load" });
  await rp.waitForSelector(".rf-paper .rf-line");
  await rp.waitForTimeout(500);
  const rmState = await rp.evaluate(() => {
    const win = document.querySelector(".rf-win");
    return {
      full: Math.abs(win.offsetHeight - document.querySelector(".rf-paper").offsetHeight) <= 3,
      cta: Number(getComputedStyle(document.querySelector(".rf-cta")).opacity) > 0.9,
    };
  });
  check("reducedFull", rmState.full, true);
  check("reducedCta", rmState.cta, true);
  await rm.close();

  check("consoleClean", errors, []);
} finally {
  await browser.close();
}
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
