// 占いビジュアル。すべてSVGで描くオリジナル素材(外部画像なし)
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Style, Visual } from "../schema";

type Box = { top: number; height: number };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const starPath = (cx: number, cy: number, points: number, outer: number, inner: number, rot = -Math.PI / 2) =>
  new Array(points * 2)
    .fill(0)
    .map((_, i) => {
      const r = i % 2 === 0 ? outer : inner;
      const a = rot + (i * Math.PI) / points;
      return `${i === 0 ? "M" : "L"}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(" ") + "Z";

const useEnter = (delay = 0, enabled = true) => {
  const frame = useCurrentFrame() + (enabled ? 0 : 10000);
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 120 } });
};

const Centered: React.FC<{ box: Box; children: React.ReactNode }> = ({ box, children }) => (
  <div
    style={{
      position: "absolute",
      top: box.top,
      height: box.height,
      left: 0,
      right: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {children}
  </div>
);

// タロット: 裏面→表面へ回転して登場。表の紋章は番号から決まる幾何学模様
const TarotCard: React.FC<{ style: Style; v: Extract<Visual, { kind: "tarot" }>; box: Box }> = ({ style, v, box }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { accent, accent2, text, shadow } = style.palette;
  const h = Math.min(box.height * 0.92, 860);
  const w = h * 0.6;
  const appear = useEnter(0, v.enter !== false);
  const flip = v.enter === false ? 0 : interpolate(frame, [0.5 * fps, 1.3 * fps], [180, 0], { ...clamp });
  const showFront = flip < 90;
  const float = Math.sin((frame / fps) * 1.6) * 10;
  const points = 4 + (v.index % 5);
  const rings = 1 + (v.index % 3);

  const back = (
    <svg viewBox="0 0 300 500" width={w} height={h}>
      <rect x="4" y="4" width="292" height="492" rx="18" fill={shadow} stroke={accent} strokeWidth="6" />
      <rect x="20" y="20" width="260" height="460" rx="10" fill="none" stroke={accent2} strokeWidth="2" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={150 - 30 - i * 20} y={250 - 30 - i * 20} width={60 + i * 40} height={60 + i * 40} fill="none"
          stroke={accent} strokeOpacity={0.25 + i * 0.12} strokeWidth="2" transform="rotate(45 150 250)" />
      ))}
      <path d={starPath(150, 250, 8, 38, 14)} fill={accent} />
    </svg>
  );
  const front = (
    <svg viewBox="0 0 300 500" width={w} height={h}>
      <rect x="4" y="4" width="292" height="492" rx="18" fill={shadow} stroke={accent} strokeWidth="6" />
      <rect x="18" y="18" width="264" height="464" rx="10" fill="none" stroke={accent} strokeOpacity="0.5" strokeWidth="2" />
      <text x="150" y="70" textAnchor="middle" fill={accent} fontSize="40" fontFamily="serif" letterSpacing="4">{v.numeral}</text>
      {new Array(rings).fill(0).map((_, i) => (
        <circle key={i} cx="150" cy="240" r={70 + i * 18} fill="none" stroke={accent2} strokeOpacity={0.7 - i * 0.2} strokeWidth="2" />
      ))}
      <path d={starPath(150, 240, points, 62, 26)} fill={accent} opacity="0.95" />
      <circle cx="150" cy="240" r="14" fill={shadow} stroke={text} strokeWidth="2" />
      <text x="150" y="400" textAnchor="middle" fill={text} fontSize="34" fontWeight="700">{v.nameJa}</text>
      <text x="150" y="440" textAnchor="middle" fill={accent} fontSize="20" letterSpacing="3" fontFamily="serif">{v.nameEn.toUpperCase()}</text>
    </svg>
  );
  return (
    <Centered box={box}>
      <div
        style={{
          transform: `perspective(1600px) translateY(${float}px) rotateY(${showFront ? flip : flip - 180}deg) scale(${0.6 + 0.4 * appear})`,
          opacity: appear,
          filter: `drop-shadow(0 0 ${showFront ? 40 : 20}px ${accent}88)`,
        }}
      >
        {showFront ? front : back}
      </div>
    </Centered>
  );
};

// 星座: 12個の点が並ぶリングが回り、該当星座の点が上に来て光る
const ZodiacMedallion: React.FC<{ style: Style; v: Extract<Visual, { kind: "zodiac" }>; box: Box }> = ({ style, v, box }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { accent, accent2, text } = style.palette;
  const size = Math.min(box.height * 0.9, 820);
  const appear = useEnter(0, v.enter !== false);
  const target = -v.index * 30;
  const rot =
    v.enter === false
      ? target + Math.sin((frame / fps) * 0.8) * 4
      : interpolate(frame, [0, 1.4 * fps], [target - 120, target], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  return (
    <Centered box={box}>
      <svg viewBox="0 0 400 400" width={size} height={size} style={{ opacity: appear, transform: `scale(${0.7 + 0.3 * appear})` }}>
        <circle cx="200" cy="200" r="186" fill="none" stroke={accent} strokeWidth="3" />
        <circle cx="200" cy="200" r="150" fill="none" stroke={accent2} strokeOpacity="0.6" strokeWidth="2" />
        <g transform={`rotate(${rot} 200 200)`}>
          {new Array(12).fill(0).map((_, i) => {
            const a = ((i * 30 - 90) * Math.PI) / 180;
            const on = i === v.index;
            return (
              <g key={i}>
                <line x1={200 + 150 * Math.cos(a)} y1={200 + 150 * Math.sin(a)} x2={200 + 186 * Math.cos(a)} y2={200 + 186 * Math.sin(a)}
                  stroke={accent} strokeOpacity="0.35" strokeWidth="1.5" transform={`rotate(15 200 200)`} />
                <path d={starPath(200 + 168 * Math.cos(a), 200 + 168 * Math.sin(a), on ? 5 : 4, on ? 14 : 5, on ? 6 : 2)}
                  fill={on ? accent : text} opacity={on ? 1 : 0.6} />
              </g>
            );
          })}
        </g>
        <text x="200" y="196" textAnchor="middle" fill={text} fontSize="46" fontWeight="700">{v.nameJa}</text>
        <text x="200" y="236" textAnchor="middle" fill={accent} fontSize="20" letterSpacing="5" fontFamily="serif">{v.nameEn.toUpperCase()}</text>
        <text x="200" y="272" textAnchor="middle" fill={accent2} fontSize="18">{v.element}</text>
      </svg>
    </Centered>
  );
};

// 数秘: 数字の周りを数字の数だけ星が回る。calcがあれば計算式を順に表示
const NumberMedallion: React.FC<{ style: Style; v: Extract<Visual, { kind: "number" }>; box: Box }> = ({ style, v, box }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { accent, text } = style.palette;
  const size = Math.min(box.height * 0.85, 760);
  const appear = useEnter(v.calc ? Math.round(1.2 * fps) : 0, v.enter !== false);
  const orbit = Math.min(v.value, 12);
  const spin = (frame / fps) * 20;
  const calcChars = v.calc ? Math.floor(interpolate(frame, [0, 1.2 * fps], [0, [...v.calc].length], clamp)) : 0;
  return (
    <Centered box={box}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {v.calc && (
          <div style={{ color: text, fontSize: 64, fontWeight: 700, letterSpacing: "0.04em", marginBottom: 24, whiteSpace: "pre", textAlign: "center", lineHeight: 1.4 }}>
            {[...v.calc].slice(0, calcChars).join("") || " "}
          </div>
        )}
        <svg viewBox="0 0 400 400" width={size * (v.calc ? 0.8 : 1)} height={size * (v.calc ? 0.8 : 1)}
          style={{ opacity: appear, transform: `scale(${0.5 + 0.5 * appear})` }}>
          <circle cx="200" cy="200" r="170" fill="none" stroke={accent} strokeWidth="3" />
          <g transform={`rotate(${spin} 200 200)`}>
            {new Array(orbit).fill(0).map((_, i) => {
              const a = (i / orbit) * Math.PI * 2;
              return <path key={i} d={starPath(200 + 170 * Math.cos(a), 200 + 170 * Math.sin(a), 4, 12, 4)} fill={accent} />;
            })}
          </g>
          <text x="200" y="200" textAnchor="middle" dominantBaseline="central" fill={text} fontSize={v.value >= 10 ? 150 : 190} fontWeight="700">
            {v.value}
          </text>
        </svg>
      </div>
    </Centered>
  );
};

// ビジュアルなしのシーン用の装飾(月と光輪)
const Ornament: React.FC<{ style: Style; box: Box }> = ({ style, box }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { accent, accent2, shadow } = style.palette;
  const size = Math.min(box.height * 0.7, 560);
  const appear = useEnter();
  const spin = (frame / fps) * 8;
  return (
    <Centered box={box}>
      <svg viewBox="0 0 400 400" width={size} height={size} style={{ opacity: appear * 0.95 }}>
        <g transform={`rotate(${spin} 200 200)`}>
          <circle cx="200" cy="200" r="180" fill="none" stroke={accent} strokeOpacity="0.5" strokeWidth="2" strokeDasharray="4 14" />
          <path d={starPath(200, 200, 12, 160, 128)} fill="none" stroke={accent2} strokeOpacity="0.5" strokeWidth="2" />
        </g>
        <circle cx="200" cy="200" r="96" fill={accent} />
        <circle cx="236" cy="176" r="88" fill={shadow} />
        <path d={starPath(300, 110, 4, 22, 6)} fill={accent} />
        <path d={starPath(110, 290, 4, 14, 4)} fill={accent2} />
      </svg>
    </Centered>
  );
};

export const VisualView: React.FC<{ style: Style; visual: Visual; box: Box }> = ({ style, visual, box }) => {
  switch (visual.kind) {
    case "tarot":
      return <TarotCard style={style} v={visual} box={box} />;
    case "zodiac":
      return <ZodiacMedallion style={style} v={visual} box={box} />;
    case "number":
      return <NumberMedallion style={style} v={visual} box={box} />;
    case "none":
      return <Ornament style={style} box={box} />;
  }
};
