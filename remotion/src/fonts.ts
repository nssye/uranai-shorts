// 雰囲気ごとの商用利用可フォント候補(すべてGoogle Fonts / SIL Open Font License)
import type { Style } from "./schema";

type Mood = Style["typography"]["textMood"];

export const FONT_CANDIDATES: Record<Mood, { family: string; reason: string }[]> = {
  mincho: [
    { family: "Shippori Mincho", reason: "明朝体。上品で神秘的な占い系の定番の雰囲気" },
    { family: "Zen Old Mincho", reason: "古風な明朝体。和・伝統寄りの落ち着いたトーン" },
    { family: "Noto Serif JP", reason: "癖の少ない明朝体。ウェイトが多く可読性が高い" },
  ],
  gothic: [
    { family: "Zen Kaku Gothic New", reason: "すっきりしたゴシック。ミニマルで読みやすい" },
    { family: "Noto Sans JP", reason: "標準的なゴシック。テロップ向きでウェイトが豊富" },
    { family: "M PLUS 1p", reason: "やや柔らかいゴシック。親しみやすさを足したい時に" },
  ],
  maru: [
    { family: "Zen Maru Gothic", reason: "丸ゴシック。やさしくパステル系と相性が良い" },
    { family: "M PLUS Rounded 1c", reason: "丸ゴシック。太字でも柔らかい印象" },
    { family: "Kiwi Maru", reason: "手書き感のある丸文字。かわいい・ゆるい雰囲気" },
  ],
  pop: [
    { family: "Dela Gothic One", reason: "極太ゴシック。インパクト重視のフック向き" },
    { family: "RocknRoll One", reason: "丸みのある太字。ポップで元気な印象" },
    { family: "Mochiy Pop One", reason: "丸く太いポップ体。かわいさと目立ちを両立" },
  ],
};
