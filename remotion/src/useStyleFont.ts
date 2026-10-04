import { getAvailableFonts } from "@remotion/google-fonts";
import { useEffect, useState } from "react";
import { useDelayRender } from "remotion";

const cache = new Map<string, Promise<void>>();

const load = (family: string, weights: number[]): Promise<void> => {
  const key = `${family}:${weights.join(",")}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const promise = (async () => {
    const entry = getAvailableFonts().find((f) => f.fontFamily === family);
    if (!entry) {
      console.warn(`Google Fontsに "${family}" が見つかりません。システムフォントで描画します`);
      return;
    }
    const font = await entry.load();
    const available = Object.keys(font.getInfo().fonts.normal ?? {});
    const wanted = weights.map(String).filter((w) => available.includes(w));
    const { waitUntilDone } = font.loadFont("normal", {
      weights: wanted.length ? wanted : available,
      ignoreTooManyRequestsWarning: true,
    });
    await waitUntilDone();
  })();
  cache.set(key, promise);
  return promise;
};

// スタイルJSONのフォント名(Google Fontsの表記)を動的に読み込む
export const useStyleFont = (family: string, weights: number[]) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender(`font: ${family}`));
  useEffect(() => {
    load(family, weights)
      .then(() => continueRender(handle))
      .catch((err) => cancelRender(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family, handle]);
  return family;
};
