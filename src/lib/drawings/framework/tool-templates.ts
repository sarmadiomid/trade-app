import type { DrawingStyle } from './types';

export interface ToolTemplate {
  readonly id: string;
  readonly name: string;
  readonly style: DrawingStyle;
}

const EMPTY: readonly ToolTemplate[] = [];

/** Named, user-created style templates per tool. Persisted by the app layer. */
export class ToolTemplates {
  private byTool = new Map<string, ToolTemplate[]>();
  private listeners = new Set<() => void>();

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  list(toolId: string): readonly ToolTemplate[] {
    return this.byTool.get(toolId) ?? EMPTY;
  }

  get(toolId: string, id: string): ToolTemplate | undefined {
    return this.list(toolId).find((t) => t.id === id);
  }

  /** Saves `style` under `name`; a template with the same name is overwritten. */
  save(toolId: string, id: string, name: string, style: DrawingStyle): ToolTemplate {
    const trimmed = name.trim();
    const list = [...this.list(toolId)];
    const existing = list.findIndex((t) => t.name === trimmed);
    const template: ToolTemplate = {
      id: existing >= 0 ? list[existing]!.id : id,
      name: trimmed,
      style: structuredClone(style),
    };
    if (existing >= 0) list[existing] = template;
    else list.push(template);
    this.byTool.set(toolId, list);
    this.emit();
    return template;
  }

  remove(toolId: string, id: string): void {
    const list = this.list(toolId);
    const next = list.filter((t) => t.id !== id);
    if (next.length === list.length) return;
    if (next.length) this.byTool.set(toolId, next);
    else this.byTool.delete(toolId);
    this.emit();
  }

  snapshot(): Record<string, ToolTemplate[]> {
    return Object.fromEntries([...this.byTool].map(([k, v]) => [k, structuredClone(v)]));
  }

  load(data: Record<string, ToolTemplate[]>): void {
    this.byTool = new Map(Object.entries(data).map(([k, v]) => [k, structuredClone(v)]));
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
