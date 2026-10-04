import type { Script } from "./schema";

// Studioでの見た目確認用(音声なし・推定尺)
export const demoScript: Script = {
  jobId: "demo",
  type: "tarot",
  date: "2026-10-05",
  target: "star",
  title: "今日のタロット",
  scenes: [
    { kind: "hook", heading: "10.05 SUN", lines: ["今日のあなたに", "届く1枚"], narration: "今日のあなたに届く、タロットを1枚引きます。", visual: { kind: "none" } },
    {
      kind: "reveal",
      lines: ["XVII 星"],
      narration: "出たのは、星のカードです。",
      visual: { kind: "tarot", index: 17, numeral: "XVII", nameJa: "星", nameEn: "The Star" },
    },
    { kind: "message", heading: "希望", lines: ["遠くに見えていた願いが", "少し近づくかも"], narration: "遠くに見えていた願いが、少し近づくかもしれません。", visual: { kind: "none" } },
    { kind: "cta", lines: ["保存して", "あとで見返してね"], narration: "保存して、あとで見返してね。", visual: { kind: "none" } },
  ],
  caption: "",
  hashtags: [],
  credit: "",
};
