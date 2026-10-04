// スタイル定義 / 台本 / コンポジションpropsのスキーマ。
// Remotion側とscripts側(解析・生成)の両方がこのファイルを唯一の定義として使う。
import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "#RRGGBB 形式");

export const TEXT_IN = ["none", "fade", "slideUp", "pop", "typewriter", "blur", "zoom"] as const;
export const TRANSITIONS = ["cut", "fade", "slide", "wipe", "flip"] as const;
export const CAMERA = ["none", "kenBurns", "pan"] as const;
export const TEXT_MOOD = ["mincho", "gothic", "maru", "pop"] as const;

export const styleSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  name: z.string(),
  source: z
    .object({
      file: z.string(),
      analyzedAt: z.string(),
      durationSec: z.number(),
      width: z.number(),
      height: z.number(),
      fps: z.number(),
    })
    .optional(),
  palette: z.object({
    background: z.array(hex).min(1).max(3),
    text: hex,
    textSub: hex,
    accent: hex,
    accent2: hex,
    shadow: hex,
  }),
  background: z.object({
    type: z.enum(["solid", "linear", "radial"]),
    angle: z.number(),
    particles: z.enum(["none", "stars", "bokeh"]),
    particleDensity: z.number().min(0).max(1),
    grain: z.number().min(0).max(1),
    vignette: z.number().min(0).max(1),
  }),
  typography: z.object({
    textMood: z.enum(TEXT_MOOD),
    fontFamily: z.string(),
    fontCandidates: z.array(z.object({ family: z.string(), reason: z.string() })),
    headingWeight: z.number(),
    bodyWeight: z.number(),
    headingSize: z.number(),
    bodySize: z.number(),
    lineHeight: z.number(),
    letterSpacing: z.number(),
    stroke: z.object({ width: z.number().min(0), color: hex }),
    shadow: z.object({ blur: z.number().min(0), color: hex, opacity: z.number().min(0).max(1) }),
  }),
  layout: z.object({
    textAnchor: z.enum(["top", "center", "bottom"]),
    textAreaY: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
    align: z.enum(["left", "center", "right"]),
    marginX: z.number().min(0).max(0.4),
    maxCharsPerLine: z.number().int().min(4).max(30),
    panel: z.object({ enabled: z.boolean(), color: hex, opacity: z.number().min(0).max(1), radius: z.number() }),
    showCredit: z.boolean(),
  }),
  animation: z.object({
    textIn: z.enum(TEXT_IN),
    stagger: z.number().min(0),
    emphasis: z.enum(["none", "pulse", "glow"]),
    transition: z.enum(TRANSITIONS),
    transitionSec: z.number().min(0).max(2),
    cameraMotion: z.enum(CAMERA),
  }),
  tempo: z.object({
    pace: z.enum(["slow", "medium", "fast"]),
    avgCutSec: z.number(),
    minSceneSec: z.number(),
    paddingSec: z.number(),
  }),
  text: z.object({
    density: z.enum(["low", "medium", "high"]),
    maxLinesPerScene: z.number().int().min(1).max(8),
  }),
  voice: z.object({
    speaker: z.number().int(),
    speedScale: z.number(),
    pitchScale: z.number(),
    intonationScale: z.number(),
    volumeScale: z.number(),
  }),
  bgm: z.object({ file: z.string(), volume: z.number().min(0).max(1) }).optional(),
  analysis: z.record(z.string(), z.unknown()).optional(),
});
export type Style = z.infer<typeof styleSchema>;

export const FORTUNE_TYPES = ["zodiac", "tarot", "numerology"] as const;
export type FortuneType = (typeof FORTUNE_TYPES)[number];

export const visualSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("tarot"), enter: z.boolean().optional(), index: z.number().int(), numeral: z.string(), nameJa: z.string(), nameEn: z.string() }),
  z.object({ kind: z.literal("zodiac"), enter: z.boolean().optional(), index: z.number().int(), nameJa: z.string(), nameEn: z.string(), element: z.string() }),
  z.object({ kind: z.literal("number"), enter: z.boolean().optional(), value: z.number().int(), calc: z.string().optional() }),
]);
export type Visual = z.infer<typeof visualSchema>;

export const sceneSchema = z.object({
  kind: z.enum(["hook", "calc", "reveal", "message", "lucky", "tip", "cta"]),
  heading: z.string().optional(),
  // 表示テキスト。要素1つ = 1行
  lines: z.array(z.string()),
  // 読み上げテキスト(VOICEVOXに渡す)
  narration: z.string(),
  visual: visualSchema,
  audio: z.object({ src: z.string(), durationSec: z.number() }).optional(),
  durationSec: z.number().optional(),
});
export type Scene = z.infer<typeof sceneSchema>;

export const scriptSchema = z.object({
  jobId: z.string(),
  type: z.enum(FORTUNE_TYPES),
  date: z.string(),
  target: z.string(),
  title: z.string(),
  scenes: z.array(sceneSchema).min(1),
  caption: z.string(),
  hashtags: z.array(z.string()),
  credit: z.string(),
});
export type Script = z.infer<typeof scriptSchema>;

export const uranaiPropsSchema = z.object({ style: styleSchema, script: scriptSchema });
export type UranaiProps = z.infer<typeof uranaiPropsSchema>;

// 1シーンの尺(秒)。音声があれば音声長+余白、なければ文字数から推定
export const sceneSeconds = (scene: Scene, style: Style): number => {
  if (scene.durationSec) return scene.durationSec;
  const speech = scene.audio
    ? scene.audio.durationSec
    : estimateSpeechSec(scene.narration, style.voice.speedScale);
  return Math.max(style.tempo.minSceneSec, speech + style.tempo.paddingSec);
};

// VOICEVOX標準速度で日本語おおよそ毎秒7.5文字
export const estimateSpeechSec = (text: string, speedScale = 1): number => {
  const chars = text.replace(/[\s、。！？!?「」『』…・]/g, "").length;
  const pauses = (text.match(/[、。！？!?…]/g) ?? []).length;
  return (chars / 7.5 + pauses * 0.25) / speedScale;
};

// エディタ補完用の JSON Schema(npm run schema で styles/schema.json に出力)
export const styleJsonSchema = () => z.toJSONSchema(styleSchema);
