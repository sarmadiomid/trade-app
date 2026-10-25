'use client';

import { currentPlan, drawingToolDenial, guardPlan } from '@/lib/app';

/** Selects a drawing tool, or leaves the current tool when the plan does not include it. */
export function selectDrawingTool(
  setTool: (id: string | null) => void,
  id: string | null,
): void {
  if (id && !guardPlan(drawingToolDenial(currentPlan(), id))) return;
  setTool(id);
}
