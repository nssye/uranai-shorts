// 台本・キャプション・ハッシュタグをテンプレートと辞書から生成(LLM不使用)
import type { FortuneType, Scene, Script } from "../../remotion/src/schema";
import { rng } from "../lib/common";
import { BASE_HASHTAGS, CTAS, HOOKS, LUCKY_COLORS, LUCKY_ITEMS, NUMBERS, SIGNS, TAROT, TIPS, TYPE_HASHTAGS, YOMI } from "./data";

export type GenerateOptions = {
  type: FortuneType;
  date: string; // YYYY-MM-DD
  styleId: string;
  sign?: string; // zodiac: aries など。省略時は日付で12星座を巡回
  card?: number; // tarot: 0-21。省略時は日付から決定
  hook?: string; // daily | question | message。省略時は日付から決定
};

export type Generated = { script: Script; meta: { hookType: string } };

const lines = (text: string) => text.split("\n");
const say = (text: string) => {
  let s = text.replace(/\n/g, "");
  for (const [k, v] of Object.entries(YOMI)) s = s.split(k).join(v);
  return s;
};

const WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const dateLabel = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  return `${date.slice(5, 7)}.${date.slice(8, 10)} ${WEEK[d.getUTCDay()]}`;
};
const dateJa = (date: string) => `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;

const dayOfYear = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000);
};

// 日付の数字をすべて足して1桁に(11と22はマスターナンバーとして残す)
export const dayNumber = (date: string) => {
  const digits = date.replace(/-/g, "").split("").map(Number);
  const steps: string[] = [];
  let n = digits.reduce((a, b) => a + b, 0);
  steps.push(`${digits.join("+")}=${n}`);
  while (n > 9 && n !== 11 && n !== 22) {
    const ds = String(n).split("").map(Number);
    n = ds.reduce((a, b) => a + b, 0);
    steps.push(`${ds.join("+")}=${n}`);
  }
  return { value: n, calc: steps.join("\n") };
};

const scene = (s: Omit<Scene, "visual"> & Partial<Pick<Scene, "visual">>): Scene => ({ visual: { kind: "none" }, ...s });

export const generate = (opts: GenerateOptions): Generated => {
  const { type, date, styleId } = opts;
  const pre = rng(`${date}:${type}:${opts.sign ?? ""}:${opts.card ?? ""}`);
  const hookPool = HOOKS[type];
  const hook = (opts.hook && hookPool.find((h) => h.id === opts.hook)) || pre.pick(hookPool);
  const cta = pre.pick(CTAS);
  const credit = ""; // TTS後に埋める
  let target: string;
  let title: string;
  let scenes: Scene[];
  let captionBody: string;
  let extraTags: string[] = [];

  if (type === "zodiac") {
    const sign = opts.sign
      ? SIGNS.find((s) => s.id === opts.sign || s.ja === opts.sign)
      : SIGNS[dayOfYear(date) % 12];
    if (!sign) throw new Error(`星座 "${opts.sign}" が不明です。${SIGNS.map((s) => s.id).join(", ")}`);
    const r = rng(`${date}:zodiac:${sign.id}`);
    const message = r.pick(sign.messages);
    const color = r.pick(LUCKY_COLORS);
    const item = r.pick(LUCKY_ITEMS);
    const tip = r.pick(TIPS);
    const hookText = hook.text.replace("{sign}", sign.ja);
    const medallion = { kind: "zodiac" as const, index: SIGNS.indexOf(sign), nameJa: sign.ja, nameEn: sign.en, element: sign.element };
    target = sign.id;
    title = `${dateJa(date)} ${sign.ja}の運勢`;
    scenes = [
      scene({ kind: "hook", heading: dateLabel(date), lines: lines(hookText), narration: hook.narration.replace("{sign}", sign.ja) }),
      scene({ kind: "reveal", heading: "今日の流れ", lines: lines(message), narration: say(message),
        visual: medallion }),
      scene({ kind: "lucky", heading: "LUCKY", lines: [`カラー：${color}`, `アイテム：${item}`],
        narration: `ラッキーカラーは${color}、ラッキーアイテムは${item}です。`, visual: { ...medallion, enter: false } }),
      scene({ kind: "tip", heading: "ひとことアドバイス", lines: lines(tip), narration: say(tip), visual: { ...medallion, enter: false } }),
      scene({ kind: "cta", lines: lines(cta.text), narration: cta.narration }),
    ];
    captionBody = `${dateJa(date)}の${sign.ja}さんへ\n\n${say(message)}\n\nラッキーカラー：${color}\nラッキーアイテム：${item}\n\n今日のひとこと：${say(tip)}`;
    extraTags = [`#${sign.ja}`];
  } else if (type === "tarot") {
    const r = rng(`${date}:tarot`);
    const index = opts.card ?? Math.floor(r.next() * TAROT.length);
    const card = TAROT[index];
    if (!card) throw new Error("--card は 0〜21 で指定してください");
    target = `card${index}`;
    const tarot = { kind: "tarot" as const, index, numeral: card.numeral, nameJa: card.ja, nameEn: card.en };
    title = `${dateJa(date)} 今日のタロット`;
    scenes = [
      scene({ kind: "hook", heading: dateLabel(date), lines: lines(hook.text), narration: hook.narration }),
      scene({ kind: "reveal", lines: [`${card.ja}のカード`], narration: `出たのは、${card.ja}のカードです。`,
        visual: tarot }),
      scene({ kind: "message", heading: card.keyword, lines: lines(card.message), narration: `キーワードは${card.keyword}。${say(card.message)}。`, visual: { ...tarot, enter: false } }),
      scene({ kind: "tip", heading: "ひとことアドバイス", lines: lines(card.tip), narration: say(card.tip), visual: { ...tarot, enter: false } }),
      scene({ kind: "cta", lines: lines(cta.text), narration: cta.narration }),
    ];
    captionBody = `${dateJa(date)}の1枚は【${card.ja}】\nキーワード：${card.keyword}\n\n${say(card.message)}\n\n今日のひとこと：${say(card.tip)}`;
  } else {
    const { value, calc } = dayNumber(date);
    const entry = NUMBERS[value];
    target = `n${value}`;
    title = `${dateJa(date)} 今日の数字`;
    scenes = [
      scene({ kind: "hook", heading: dateLabel(date), lines: lines(hook.text), narration: hook.narration }),
      scene({ kind: "calc", lines: [], narration: `今日の日付の数字を、すべて足していくと、${value}になります。`,
        visual: { kind: "number", value, calc } }),
      scene({ kind: "reveal", heading: entry.keyword, lines: lines(entry.message), narration: `${value}のキーワードは${entry.keyword}。${say(entry.message)}。`,
        visual: { kind: "number", value } }),
      scene({ kind: "tip", heading: "ひとことアドバイス", lines: [...lines(entry.tip), `ラッキーカラー：${entry.color}`],
        narration: `${say(entry.tip)}。ラッキーカラーは${entry.color}です。`, visual: { kind: "number", value, enter: false } }),
      scene({ kind: "cta", lines: lines(cta.text), narration: cta.narration }),
    ];
    captionBody = `${dateJa(date)}の数字は【${value}】\nキーワード：${entry.keyword}\n\n${say(entry.message)}\n\n今日のひとこと：${say(entry.tip)}\nラッキーカラー：${entry.color}`;
  }

  const hashtags = [...BASE_HASHTAGS, ...TYPE_HASHTAGS[type], ...extraTags];
  const caption = `${captionBody}\n\n※占いは毎日を楽しむヒントとしてお楽しみください\n保存して見返してね`;
  return {
    script: { jobId: `${date}_${type}_${target}_${styleId}`, type, date, target, title, scenes, caption, hashtags, credit },
    meta: { hookType: hook.id },
  };
};
