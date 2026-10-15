import { used } from "./used";
import { z } from "zod";

export async function start(name: string) {
  const lazy = await import("./lazy");
  const plugin = "loaded-by-name";
  return [used, lazy.lazyValue, z, `${plugin}:${name}`];
}
