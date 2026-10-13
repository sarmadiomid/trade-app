'use client';

import type { ActiveChallenge, LessonPlayer } from '@/lib/app';
import { marksCount } from '@/lib/lessons';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import {
  KIND_HINTS,
  KIND_LABELS,
  countLabel,
  resultSummary,
  useBoardVersion,
} from './challenge-ui';

interface ChallengeCardProps {
  readonly player: LessonPlayer;
  readonly active: ActiveChallenge;
  readonly total: number;
  /** Author tools (edit / delete) are shown when set. */
  readonly onEdit?: (() => void) | undefined;
  readonly onDelete?: (() => void) | undefined;
}

/** The student's side of a challenge: prompt, answer count, Validate, feedback. */
export function ChallengeCard({ player, active, total, onEdit, onDelete }: ChallengeCardProps) {
  useBoardVersion(player.board);
  const { challenge: c, result, showingSolution } = active;
  const marked = marksCount(c.kind, player.board.marks);

  return (
    <div
      role="dialog"
      aria-label="Challenge"
      className="absolute left-1/2 top-3 z-40 w-[min(460px,calc(100%-24px))] -translate-x-1/2 rounded-lg border border-line bg-panel text-[13px] shadow-xl"
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Icon name="target" size={16} className="text-accent" />
        <span className="font-semibold">
          Challenge {active.number} of {total}
        </span>
        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
          {KIND_LABELS[c.kind]}
        </span>
        <div className="flex-1" />
        {onEdit ? (
          <button
            type="button"
            className="text-muted hover:text-fg"
            aria-label="Edit challenge"
            onClick={onEdit}
          >
            <Icon name="edit" size={15} />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            className="text-muted hover:text-down"
            aria-label="Delete challenge"
            onClick={onDelete}
          >
            <Icon name="trash" size={15} />
          </button>
        ) : null}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[14px] font-medium leading-snug">{c.prompt}</p>
        {result ? (
          <div className="mt-2.5" aria-live="polite">
            <div
              className={`flex items-center gap-2 font-semibold ${result.passed ? 'text-up' : 'text-down'}`}
            >
              <Icon name={result.passed ? 'check' : 'close'} size={16} />
              {result.passed ? 'Correct!' : 'Not quite'}
              <span className="font-normal text-muted">
                {Math.round(result.score * 100)}% · {resultSummary(result)}
              </span>
            </div>
            <Legend />
            {c.explanation ? (
              <p className="mt-2 text-[12px] leading-snug text-muted">{c.explanation}</p>
            ) : null}
          </div>
        ) : showingSolution ? (
          <p className="mt-1.5 text-[12px] text-muted">
            The correct answer is highlighted in green.
          </p>
        ) : (
          <p className="mt-1.5 text-[12px] text-muted">
            {KIND_HINTS[c.kind]}{' '}
            <span className="text-fg">{countLabel(c.kind, marked)} marked.</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
        {!result && !showingSolution ? (
          <>
            <Button variant="ghost" disabled={marked === 0} onClick={() => player.clearAnswer()}>
              Clear
            </Button>
            <Button variant="ghost" onClick={() => void player.continueLesson()}>
              Skip
            </Button>
            <div className="flex-1" />
            <Button variant="primary" disabled={marked === 0} onClick={() => player.validate()}>
              <Icon name="check" size={15} />
              Validate
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => player.retry()}>
              <Icon name="reset" size={15} />
              Retry
            </Button>
            <Button onClick={() => player.toggleSolution()}>
              <Icon name={showingSolution ? 'eyeOff' : 'eye'} size={15} />
              {showingSolution ? (result ? 'Show my answer' : 'Hide solution') : 'Show solution'}
            </Button>
            <div className="flex-1" />
            <Button variant="primary" onClick={() => void player.continueLesson()}>
              Continue
              <Icon name="play" size={14} />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Legend() {
  const item = (color: string, text: string, dashed = false) => (
    <span className="flex items-center gap-1">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={dashed ? { border: `1.5px dashed ${color}` } : { background: color }}
      />
      {text}
    </span>
  );
  return (
    <div className="mt-1.5 flex gap-3 text-[11px] text-muted">
      {item('#26a69a', 'correct')}
      {item('#ef5350', 'wrong')}
      {item('#f5a623', 'missed', true)}
    </div>
  );
}
