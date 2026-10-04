// styles/schema.json(JSON Schema)を Zod 定義から生成する。エディタでの補完・検証用
import path from "node:path";
import { styleJsonSchema } from "../remotion/src/schema";
import { P, writeJson } from "./lib/common";

writeJson(path.join(P.styles, "schema.json"), styleJsonSchema());
console.log("styles/schema.json を更新しました");
