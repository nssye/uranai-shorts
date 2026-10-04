import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import type { Style } from "../schema";

const gradient = (style: Style) => {
  const { background } = style.palette;
  const { type, angle } = style.background;
  if (type === "solid" || background.length === 1) return background[0];
  if (type === "radial") return `radial-gradient(circle at 50% 40%, ${background.join(", ")})`;
  return `linear-gradient(${angle}deg, ${background.join(", ")})`;
};

const Stars: React.FC<{ style: Style }> = ({ style }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const count = Math.round(style.background.particleDensity * 160);
  const stars = useMemo(
    () =>
      new Array(count).fill(0).map((_, i) => ({
        x: random(`sx${i}`) * width,
        y: random(`sy${i}`) * height,
        r: 1.5 + random(`sr${i}`) * 3.5,
        phase: random(`sp${i}`) * Math.PI * 2,
        speed: 0.6 + random(`sv${i}`) * 1.6,
        sparkle: random(`sk${i}`) > 0.9,
      })),
    [count, width, height],
  );
  const t = frame / fps;
  return (
    <svg width={width} height={height} style={{ position: "absolute" }}>
      {stars.map((s, i) => {
        const o = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.speed * 2 + s.phase));
        const color = s.sparkle ? style.palette.accent : style.palette.text;
        if (!s.sparkle) return <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={color} opacity={o} />;
        const l = s.r * 5 * o;
        return (
          <path
            key={i}
            d={`M${s.x} ${s.y - l} Q${s.x} ${s.y} ${s.x + l} ${s.y} Q${s.x} ${s.y} ${s.x} ${s.y + l} Q${s.x} ${s.y} ${s.x - l} ${s.y} Q${s.x} ${s.y} ${s.x} ${s.y - l}Z`}
            fill={color}
            opacity={o}
          />
        );
      })}
    </svg>
  );
};

const Bokeh: React.FC<{ style: Style }> = ({ style }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const count = Math.round(style.background.particleDensity * 24);
  const light = style.palette.background.some((c) => parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16) > 384);
  const colors = [style.palette.accent, style.palette.accent2, light ? "#ffffff" : style.palette.textSub];
  const t = frame / fps;
  return (
    <AbsoluteFill>
      {new Array(count).fill(0).map((_, i) => {
        const size = 80 + random(`bs${i}`) * 260;
        const x = random(`bx${i}`) * width + Math.sin(t * 0.3 + i) * 40;
        const y = ((random(`by${i}`) * (height + size) - t * (12 + random(`bv${i}`) * 25)) % (height + size) + height + size) % (height + size) - size;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - size / 2,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: colors[i % colors.length],
              opacity: 0.18 + random(`bo${i}`) * 0.22,
              filter: `blur(${10 + random(`bb${i}`) * 20}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// 背景(グラデ+粒子+ビネット)。シーンをまたいで連続させるためシーン外に置く
export const Background: React.FC<{ style: Style }> = ({ style }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / Math.max(1, durationInFrames - 1);
  const camera = style.animation.cameraMotion;
  const transform =
    camera === "kenBurns"
      ? `scale(${interpolate(progress, [0, 1], [1, 1.12])})`
      : camera === "pan"
        ? `translateX(${interpolate(progress, [0, 1], [-40, 40])}px) scale(1.08)`
        : undefined;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: gradient(style), transform }}>
        {style.background.particles === "stars" && <Stars style={style} />}
        {style.background.particles === "bokeh" && <Bokeh style={style} />}
      </AbsoluteFill>
      {style.background.vignette > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at 50% 45%, transparent 45%, ${style.palette.shadow} 120%)`,
            opacity: style.background.vignette,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// フィルムグレイン(最前面)
export const Grain: React.FC<{ amount: number }> = ({ amount }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (amount <= 0) return null;
  return (
    <svg width={width} height={height} style={{ position: "absolute", opacity: amount, mixBlendMode: "overlay" }}>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 30} />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
};
