import type { Script, Style } from "./schema";
import { sceneSeconds } from "./schema";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export type TimelineItem = { frames: number; audioDelay: number };

// トランジションは前後シーンを重ねるため、2シーン目以降は重なり分を足して
// ナレーション開始をその分遅らせる(音声が重ならず、総尺 = Σシーン秒数 になる)
export const buildTimeline = (script: Script, style: Style, fps = FPS) => {
  const transitionFrames =
    style.animation.transition === "cut" ? 0 : Math.round(style.animation.transitionSec * fps);
  const items: TimelineItem[] = script.scenes.map((scene, i) => {
    const base = Math.round(sceneSeconds(scene, style) * fps);
    const delay = i === 0 ? 0 : transitionFrames;
    return { frames: base + delay, audioDelay: delay };
  });
  const total = items.reduce((sum, it) => sum + it.frames, 0) - transitionFrames * (items.length - 1);
  return { items, transitionFrames, totalFrames: total };
};

// テキスト領域と重ならないビジュアル配置領域(高さ比)
export const visualArea = (style: Style): [number, number] => {
  const [top, bottom] = style.layout.textAreaY;
  return (top + bottom) / 2 >= 0.5 ? [0.1, Math.max(0.3, top - 0.02)] : [Math.min(0.7, bottom + 0.02), 0.85];
};

// 最低尺に満たない場合、不足分を各シーンに均等に足して引き延ばす(テンポの速いスタイル向け)
export const stretchToMin = (script: Script, style: Style, minSec: number, fps = FPS): Script => {
  const total = buildTimeline(script, style, fps).totalFrames / fps;
  if (total >= minSec) return script;
  const extra = (minSec - total + 0.1) / script.scenes.length;
  return { ...script, scenes: script.scenes.map((s) => ({ ...s, durationSec: sceneSeconds(s, style) + extra })) };
};
