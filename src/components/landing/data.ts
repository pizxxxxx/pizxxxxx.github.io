export type Track = {
  id: string;
  title: string;
  artist: string;
  cover: string;
  duration: number;
  lines: string[];
};

export const tracks: Track[] = [
  {
    id: "listen",
    title: "Послушайте!",
    artist: "Владимир Маяковский",
    cover: "/covers/listen.jpg",
    duration: 97,
    lines: [
      "Послушайте!",
      "Ведь, если звезды зажигают —",
      "значит — это кому-нибудь нужно?",
      "Значит — кто-то хочет, чтобы они были?",
      "Значит — кто-то называет эти плевочки жемчужиной?",
      "И, надрываясь в метелях полуденной пыли,",
      "врывается к богу,",
      "боится, что опоздал,",
      "плачет,",
      "целует ему жилистую руку,",
      "просит — чтоб обязательно была звезда!",
      "клянется — не перенесет эту беззвездную муку!",
      "А после ходит тревожный,",
      "но спокойный наружно.",
      "Говорит кому-то:",
      "Ведь теперь тебе ничего?",
      "Не страшно?",
      "Да?!",
      "Послушайте!",
      "Ведь, если звезды зажигают —",
      "значит — это кому-нибудь нужно?",
      "Значит — это необходимо,",
      "чтобы каждый вечер над крышами",
      "загоралась хоть одна звезда?!",
    ],
  },
  {
    id: "night",
    title: "Ночь, улица, фонарь, аптека",
    artist: "Александр Блок",
    cover: "/covers/night.jpg",
    duration: 48,
    lines: [
      "Ночь, улица, фонарь, аптека,",
      "Бессмысленный и тусклый свет.",
      "Живи ещё хоть четверть века —",
      "Всё будет так. Исхода нет.",
      "Умрёшь — начнёшь опять сначала",
      "И повторится всё, как встарь:",
      "Ночь, ледяная рябь канала,",
      "Аптека, улица, фонарь.",
    ],
  },
];

export type LyricModel = {
  lineOffsets: number[][];
  trackLens: number[];
  total: number;
};

export type LyricCursor = {
  track: number;
  line: number;
  sung: number;
  lineLen: number;
  local: number;
  global: number;
};

export function buildModel(list: Track[]): LyricModel {
  const lineOffsets = list.map((track) => {
    const offsets: number[] = [];
    let acc = 0;
    for (const line of track.lines) {
      offsets.push(acc);
      acc += line.length;
    }
    return offsets;
  });
  const trackLens = lineOffsets.map((offsets, index) => {
    const lines = list[index].lines;
    return offsets[offsets.length - 1] + lines[lines.length - 1].length;
  });
  const total = trackLens.reduce((sum, len) => sum + len, 0);
  return { lineOffsets, trackLens, total };
}

export function cursorAt(model: LyricModel, list: Track[], progress: number): LyricCursor {
  const lastTrack = list.length - 1;
  const lastLine = list[lastTrack].lines.length - 1;
  const lastLen = list[lastTrack].lines[lastLine].length;
  const clamped = Math.min(1, Math.max(0, progress));
  if (clamped >= 1 || model.total === 0) {
    return { track: lastTrack, line: lastLine, sung: lastLen, lineLen: lastLen, local: 1, global: 1 };
  }

  let within = clamped * model.total;
  let track = 0;
  for (let i = 0; i < list.length; i++) {
    const len = model.trackLens[i];
    if (within < len || i === list.length - 1) {
      track = i;
      within = Math.min(within, len);
      break;
    }
    within -= len;
  }

  const lines = list[track].lines;
  const offsets = model.lineOffsets[track];
  let line = 0;
  let sung = 0;
  for (let i = 0; i < lines.length; i++) {
    const end = offsets[i] + lines[i].length;
    if (within < end || i === lines.length - 1) {
      line = i;
      sung = Math.max(0, Math.min(lines[i].length, Math.floor(within - offsets[i])));
      break;
    }
  }

  const local = model.trackLens[track] === 0 ? 0 : within / model.trackLens[track];
  return { track, line, sung, lineLen: lines[line].length, local, global: clamped };
}

export function formatClock(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export const libraryRows = [
  { title: "Послушайте!", artist: "Владимир Маяковский", time: "1:37", cover: "/covers/listen.jpg", on: true },
  { title: "Ночь, улица, фонарь, аптека", artist: "Александр Блок", time: "0:48", cover: "/covers/night.jpg", on: false },
];

export const sideLinks = ["Главная", "Поиск", "Моя волна", "Текст песни", "Любимые"];

export const themes = [
  {
    id: "classic",
    name: "Классический",
    text: "Мягкое стекло, спокойная типографика",
    preview: "preview-classic",
  },
  {
    id: "aurora",
    name: "Aurora",
    text: "Контраст, акцентные кромки, плотный набор",
    preview: "preview-aurora",
  },
  {
    id: "mister",
    name: "Некий мистер C",
    text: "По умолчанию. Цвета обложки и стеклянные панели",
    preview: "preview-mister",
  },
  {
    id: "matte",
    name: "Матовый",
    text: "Компоновка третьего стиля, ровное размытие и шесть цветовых пар",
    preview: "preview-matte",
  },
] as const;

export type SkinId = (typeof themes)[number]["id"];
