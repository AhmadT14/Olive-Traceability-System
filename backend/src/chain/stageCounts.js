import { Stage } from "./enums.js";

export function countByStage(stages) {
  const counts = new Map(Stage.map((stage) => [stage, 0]));
  for (const stage of stages) {
    if (counts.has(stage)) counts.set(stage, counts.get(stage) + 1);
  }
  return Stage.map((stage) => ({ stage, count: counts.get(stage) }));
}
