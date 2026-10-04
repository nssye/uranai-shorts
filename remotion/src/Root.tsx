import { Composition } from "remotion";
import mystic from "../../styles/mystic.json";
import { demoScript } from "./demo";
import { styleSchema, uranaiPropsSchema } from "./schema";
import { FPS, HEIGHT, WIDTH } from "./timeline";
import { calculateMetadata, Uranai } from "./Uranai";

// 実データは `npm run make` / `npm run studio` が --props で渡す。defaultPropsはプレビュー用のデモ
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Uranai"
      component={Uranai}
      schema={uranaiPropsSchema}
      calculateMetadata={calculateMetadata}
      durationInFrames={FPS * 20}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ style: styleSchema.parse(mystic), script: demoScript }}
    />
  );
};
