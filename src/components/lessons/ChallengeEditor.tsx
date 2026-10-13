'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ChallengeBoard, ChallengeDraft } from '@/lib/app';
import type { SeriesData } from '@/lib/core';
import {
  CANDLE_RULES,
  DEFAULT_TOLERANCE,
  EMPTY_MARKS,
  detectCandles,
  marksCount,
  type CandleRuleId,
  type ChallengeKind,
  type ChallengeMarks,
  type LessonChallenge,
  type TimeRange,
} from '@/lib/lessons';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { KIND_HINTS, KIND_LABELS, countLabel, useBoardVersion } from './challenge-ui';

interface ChallengeEditorProps {
  readonly board: ChallengeBoard;
  /** Bars the challenge is authored on (full loaded history). */
  readonly data: () => SeriesData;
  /** Editing an existing challenge; null creates a new one. */
  readonly initial: LessonChallenge | null;
  /** Lesson time shown in the header. */
  readonly timeLabel: string;
  onSave(draft: ChallengeDraft): void;
  onCancel(): void;
}

const KINDS: readonly ChallengeKind[] = ['candles', 'points', 'zones'];

const DEFAULT_PROMPTS: Record<ChallengeKind, string> = {
  candles: 'Select every Doji candle in the highlighted area.',
  points: 'Mark every Break of Structure (BOS).',
  zones: 'Draw the demand zones.',
};

const inRegion = (t: number, r: TimeRange | null) => !r || (t >= r.from && t <= r.to);

/** Keeps only the marks of `kind` inside `region` (the answer key). */
function answerFor(
  kind: ChallengeKind,
  marks: ChallengeMarks,
  region: TimeRange | null,
): ChallengeMarks {
  return {
    ...EMPTY_MARKS,
    ...(kind === 'candles' ? { candles: marks.candles.filter((t) => inRegion(t, region)) } : {}),
    ...(kind === 'points' ? { points: marks.points.filter((p) => inRegion(p.time, region)) } : {}),
    ...(kind === 'zones' ? { zones: marks.zones } : {}),
  };
}

/**
 * Authoring panel: the teacher picks the task type, writes the prompt, marks the correct answer
 * on the chart (or generates it from a candle rule) and sets how strictly it is graded.
 */
export function ChallengeEditor({
  board,
  data,
  initial,
  timeLabel,
  onSave,
  onCancel,
}: ChallengeEditorProps) {
  const [kind, setKind] = useState<ChallengeKind>(initial?.kind ?? 'candles');
  const [prompt, setPrompt] = useState(initial?.prompt ?? DEFAULT_PROMPTS.candles);
  const [promptTouched, setPromptTouched] = useState(initial !== null);
  const [explanation, setExplanation] = useState(initial?.explanation ?? '');
  const [label, setLabel] = useState(initial?.label || 'BOS');
  const [rule, setRule] = useState<CandleRuleId | null>(initial?.rule ?? null);
  const [hideFuture, setHideFuture] = useState(initial?.hideFuture ?? false);
  const [bars, setBars] = useState(initial?.tolerance.bars ?? DEFAULT_TOLERANCE.bars);
  const [pricePct, setPricePct] = useState(
    Math.round((initial?.tolerance.price ?? DEFAULT_TOLERANCE.price) * 1000) / 10,
  );
  const [overlapPct, setOverlapPct] = useState(
    Math.round((initial?.tolerance.overlap ?? DEFAULT_TOLERANCE.overlap) * 100),
  );
  const [passPct, setPassPct] = useState(Math.round((initial?.pass ?? 1) * 100));
  useBoardVersion(board);

  // The board is (re)started once per editor; later changes go through configure/setMarks.
  useEffect(() => {
    board.start(
      {
        kind: initial?.kind ?? 'candles',
        label: initial?.label || 'BOS',
        region: initial?.region ?? null,
      },
      initial?.answer ?? EMPTY_MARKS,
    );
    return () => board.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  const region = board.region;

  // A new region re-runs the candle rule so the answer stays "all matches in the region".
  const regionSeen = useRef(region);
  useEffect(() => {
    if (region === regionSeen.current) return;
    regionSeen.current = region;
    if (kind === 'candles' && rule)
      board.setMarks({ ...board.marks, candles: detectCandles(data(), rule, region) });
  }, [region, kind, rule, board, data]);
  const answer = answerFor(kind, board.marks, region);
  const count = marksCount(kind, answer);
  const pickingRegion = board.tool === 'region';

  const changeKind = (k: ChallengeKind) => {
    setKind(k);
    if (!promptTouched) setPrompt(DEFAULT_PROMPTS[k]);
    board.configure({ kind: k, label: k === 'points' ? label : '' });
  };

  const applyRule = (r: CandleRuleId | null) => {
    setRule(r);
    if (r) board.setMarks({ ...board.marks, candles: detectCandles(data(), r, region) });
  };

  const save = () => {
    onSave({
      kind,
      prompt: prompt.trim(),
      explanation: explanation.trim(),
      label: kind === 'points' ? label.trim() : '',
      rule: kind === 'candles' ? rule : null,
      region,
      hideFuture: hideFuture && region !== null,
      tolerance: {
        bars: Math.max(0, Math.round(bars)),
        price: Math.max(0, pricePct) / 100,
        overlap: Math.min(1, Math.max(0.01, overlapPct / 100)),
      },
      pass: Math.min(1, Math.max(0, passPct / 100)),
      answer,
    });
  };

  return (
    <div
      role="dialog"
      aria-label={initial ? 'Edit challenge' : 'Add challenge'}
      className="absolute right-3 top-3 z-40 flex max-h-[calc(100%-24px)] w-[330px] flex-col overflow-hidden rounded-lg border border-line bg-panel text-[13px] shadow-xl"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Icon name="target" size={16} className="text-accent" />
        <span className="font-semibold">{initial ? 'Edit challenge' : 'New challenge'}</span>
        <span className="text-muted">at {timeLabel}</span>
        <div className="flex-1" />
        <button
          type="button"
          aria-label="Cancel"
          className="text-muted hover:text-fg"
          onClick={onCancel}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto px-3 py-3">
        <Field label="Task">
          <div role="radiogroup" className="grid grid-cols-3 gap-1">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => changeKind(k)}
                className={`h-8 rounded-md border text-[12px] font-medium ${
                  kind === k
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-line hover:bg-hover'
                }`}
              >
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Question">
          <textarea
            value={prompt}
            rows={2}
            maxLength={300}
            onChange={(e) => {
              setPrompt(e.target.value);
              setPromptTouched(true);
            }}
            className={inputCls}
          />
        </Field>
        <Field label="Region">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-muted">
              {pickingRegion ? 'Drag across the chart…' : region ? 'Custom area' : 'Whole chart'}
            </span>
            <Button
              className="h-7 px-2 text-[12px]"
              variant={pickingRegion ? 'primary' : 'secondary'}
              onClick={() => board.setTool(pickingRegion ? 'marks' : 'region')}
            >
              {pickingRegion ? 'Cancel' : 'Drag region'}
            </Button>
            {region ? (
              <Button
                className="h-7 px-2 text-[12px]"
                onClick={() => board.configure({ region: null })}
              >
                Clear
              </Button>
            ) : null}
          </div>
          <label className="mt-1.5 flex items-center gap-2 text-[12px] text-muted">
            <input
              type="checkbox"
              checked={hideFuture}
              disabled={!region}
              onChange={(e) => setHideFuture(e.target.checked)}
            />
            Hide candles after the region while answering
          </label>
        </Field>
        {kind === 'candles' ? (
          <Field label="Answer from">
            <select
              value={rule ?? ''}
              onChange={(e) => applyRule((e.target.value || null) as CandleRuleId | null)}
              className={inputCls}
            >
              <option value="">My own selection</option>
              {CANDLE_RULES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {kind === 'points' ? (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Mark label">
              <input
                value={label}
                maxLength={12}
                onChange={(e) => {
                  setLabel(e.target.value);
                  board.configure({ label: e.target.value });
                }}
                className={inputCls}
              />
            </Field>
            <Field label="± bars">
              <NumberInput value={bars} min={0} max={20} onChange={setBars} />
            </Field>
            <Field label="± price %">
              <NumberInput value={pricePct} min={0} max={50} step={0.5} onChange={setPricePct} />
            </Field>
          </div>
        ) : null}
        {kind === 'zones' ? (
          <Field label="Minimum overlap %">
            <NumberInput value={overlapPct} min={5} max={100} onChange={setOverlapPct} />
          </Field>
        ) : null}
        <div className="rounded-md border border-line bg-chart px-2.5 py-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">Answer: {countLabel(kind, count)}</span>
            <div className="flex-1" />
            {count > 0 ? (
              <button
                type="button"
                className="text-[12px] text-muted hover:text-fg"
                onClick={() => {
                  setRule(null);
                  board.setMarks({ ...board.marks, [kind]: [] });
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-[12px] text-muted">{KIND_HINTS[kind]}</p>
        </div>
        <Field label="Pass score %">
          <NumberInput value={passPct} min={0} max={100} step={5} onChange={setPassPct} />
        </Field>
        <Field label="Explanation (shown after validating)">
          <textarea
            value={explanation}
            rows={2}
            maxLength={500}
            placeholder="e.g. A BOS needs a candle close beyond the last swing high."
            onChange={(e) => setExplanation(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <div className="flex-1" />
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={!prompt.trim() || count === 0} onClick={save}>
          <Icon name="check" size={15} />
          Save challenge
        </Button>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-line bg-chart px-2 py-1.5 text-[13px] text-fg outline-none focus:border-accent';

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1 block text-[12px] text-muted">{label}</span>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  onChange(v: number): void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
      }}
      className={inputCls}
    />
  );
}
