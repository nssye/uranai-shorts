import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Style } from "../schema";

type TextIn = Style["animation"]["textIn"];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// 1行ぶんの登場アニメ。typewriterは表示文字数で表現する
const enter = (kind: TextIn, frame: number, fps: number, text: string) => {
  if (kind === "none" || frame < 0) {
    return { style: { opacity: frame < 0 ? 0 : 1 } as React.CSSProperties, text };
  }
  const p = spring({ frame, fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.6) });
  switch (kind) {
    case "fade":
      return { style: { opacity: p }, text };
    case "slideUp":
      return { style: { opacity: p, transform: `translateY(${(1 - p) * 70}px)` }, text };
    case "pop": {
      const s = spring({ frame, fps, config: { damping: 11, stiffness: 160 } });
      return { style: { opacity: Math.min(1, p * 2), transform: `scale(${0.4 + 0.6 * s})` }, text };
    }
    case "blur":
      return { style: { opacity: p, filter: `blur(${(1 - p) * 18}px)`, transform: `scale(${1.06 - 0.06 * p})` }, text };
    case "zoom":
      return { style: { opacity: p, transform: `scale(${1.6 - 0.6 * p})` }, text };
    case "typewriter": {
      const chars = Math.floor((frame / fps) * 18);
      return { style: { opacity: 1 }, text: [...text].slice(0, chars).join("") };
    }
  }
};

export const TextBlock: React.FC<{
  style: Style;
  heading?: string;
  lines: string[];
  // 行の登場開始(フレーム)
  delay?: number;
}> = ({ style, heading, lines, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { typography: ty, layout, palette, animation } = style;
  const [top, bottom] = layout.textAreaY;
  const innerWidth = width * (1 - layout.marginX * 2);

  // 1行がはみ出す場合だけ縮小
  const fit = (text: string, size: number) =>
    Math.min(size, innerWidth / Math.max(1, [...text].length * (1 + ty.letterSpacing)));

  const shadow =
    ty.shadow.opacity > 0
      ? `0 4px ${ty.shadow.blur}px ${ty.shadow.color}${Math.round(ty.shadow.opacity * 255)
          .toString(16)
          .padStart(2, "0")}`
      : undefined;
  const glow =
    animation.emphasis === "glow"
      ? `0 0 ${interpolate(Math.sin((frame / fps) * 3), [-1, 1], [12, 36])}px ${palette.accent}`
      : undefined;
  const pulse = animation.emphasis === "pulse" ? 1 + 0.035 * Math.sin((frame / fps) * 5) : 1;

  const base: React.CSSProperties = {
    letterSpacing: `${ty.letterSpacing}em`,
    lineHeight: ty.lineHeight,
    whiteSpace: "pre",
    WebkitTextStroke: ty.stroke.width > 0 ? `${ty.stroke.width}px ${ty.stroke.color}` : undefined,
    paintOrder: "stroke fill",
  };

  if (!heading && lines.length === 0) return null;
  const items = [
    ...(heading ? [{ text: heading, heading: true }] : []),
    ...lines.slice(0, style.text.maxLinesPerScene).map((text) => ({ text, heading: false })),
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: top * height,
        height: (bottom - top) * height,
        left: width * layout.marginX,
        width: innerWidth,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: layout.align === "left" ? "flex-start" : layout.align === "right" ? "flex-end" : "center",
        textAlign: layout.align,
      }}
    >
      <div
        style={{
          padding: layout.panel.enabled ? "36px 48px" : 0,
          borderRadius: layout.panel.radius,
          position: "relative",
        }}
      >
        {layout.panel.enabled && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: layout.panel.radius,
              background: layout.panel.color,
              opacity: layout.panel.opacity,
            }}
          />
        )}
        {items.map((item, i) => {
          const local = frame - delay - Math.round(i * animation.stagger * fps);
          const anim = enter(animation.textIn, local, fps, item.text);
          const size = fit(item.text, item.heading ? ty.headingSize : ty.bodySize);
          return (
            <div
              key={i}
              style={{
                ...base,
                ...anim.style,
                position: "relative",
                fontSize: size,
                fontWeight: item.heading ? ty.headingWeight : ty.bodyWeight,
                color: item.heading ? palette.accent : palette.text,
                textShadow: [shadow, item.heading ? glow : undefined].filter(Boolean).join(", ") || undefined,
                transform: [anim.style.transform, item.heading && pulse !== 1 ? `scale(${pulse})` : undefined]
                  .filter(Boolean)
                  .join(" ") || undefined,
                marginBottom: item.heading ? size * 0.25 : 0,
                opacity: interpolate(local, [-1, 0], [0, 1], clamp) * Number(anim.style.opacity ?? 1),
              }}
            >
              {anim.text || " "}
            </div>
          );
        })}
      </div>
    </div>
  );
};
