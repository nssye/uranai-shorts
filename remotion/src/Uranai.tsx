import { Audio } from "@remotion/media";
import { linearTiming, TransitionPresentation, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React from "react";
import { AbsoluteFill, CalculateMetadataFunction, Sequence, staticFile, useVideoConfig } from "remotion";
import { Background, Grain } from "./components/Background";
import { TextBlock } from "./components/TextBlock";
import { VisualView } from "./components/Visuals";
import type { Scene, Style, UranaiProps } from "./schema";
import { buildTimeline, visualArea } from "./timeline";
import { useStyleFont } from "./useStyleFont";

const presentation = (kind: Style["animation"]["transition"]): TransitionPresentation<Record<string, unknown>> => {
  switch (kind) {
    case "slide":
      return slide({ direction: "from-bottom" }) as TransitionPresentation<Record<string, unknown>>;
    case "wipe":
      return wipe({ direction: "from-left" }) as TransitionPresentation<Record<string, unknown>>;
    case "flip":
      return flip() as TransitionPresentation<Record<string, unknown>>;
    default:
      return fade() as TransitionPresentation<Record<string, unknown>>;
  }
};

const SceneView: React.FC<{ scene: Scene; style: Style; audioDelay: number }> = ({ scene, style, audioDelay }) => {
  const { fps, height } = useVideoConfig();
  const [vTop, vBottom] = visualArea(style);
  return (
    <AbsoluteFill>
      <VisualView style={style} visual={scene.visual} box={{ top: vTop * height, height: (vBottom - vTop) * height }} />
      <TextBlock style={style} heading={scene.heading} lines={scene.lines} delay={audioDelay + Math.round(fps * 0.15)} />
      {scene.audio && (
        <Sequence from={audioDelay} premountFor={fps}>
          <Audio src={staticFile(scene.audio.src)} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

export const Uranai: React.FC<UranaiProps> = ({ style, script }) => {
  const { fps } = useVideoConfig();
  const fontFamily = useStyleFont(style.typography.fontFamily, [style.typography.headingWeight, style.typography.bodyWeight]);
  const { items, transitionFrames } = buildTimeline(script, style, fps);

  const children: React.ReactNode[] = [];
  script.scenes.forEach((scene, i) => {
    if (i > 0 && transitionFrames > 0) {
      children.push(
        <TransitionSeries.Transition
          key={`t${i}`}
          presentation={presentation(style.animation.transition)}
          timing={linearTiming({ durationInFrames: transitionFrames })}
        />,
      );
    }
    children.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={items[i].frames} premountFor={fps}>
        <SceneView scene={scene} style={style} audioDelay={items[i].audioDelay} />
      </TransitionSeries.Sequence>,
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: style.palette.background[0], fontFamily: `"${fontFamily}", sans-serif` }}>
      <Background style={style} />
      <TransitionSeries>{children}</TransitionSeries>
      {style.bgm && <Audio src={staticFile(style.bgm.file)} volume={style.bgm.volume} loop />}
      <Grain amount={style.background.grain} />
      {style.layout.showCredit && script.credit && (
        <div
          style={{
            position: "absolute",
            bottom: 28,
            right: 36,
            fontSize: 26,
            color: style.palette.text,
            opacity: 0.7,
            fontFamily: "sans-serif",
          }}
        >
          {script.credit}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const calculateMetadata: CalculateMetadataFunction<UranaiProps> = ({ props }) => ({
  durationInFrames: Math.max(1, buildTimeline(props.script, props.style).totalFrames),
});
