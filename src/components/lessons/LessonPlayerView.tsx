'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChartApp,
  HtmlAudioMedia,
  LessonPlayer,
  PLAYBACK_RATES,
  VirtualMedia,
  createPlaybackDependencies,
  type ChallengeDraft,
  type PlayerSnapshot,
} from '@/lib/app';
import { createIdGenerator } from '@/lib/core';
import {
  LessonDataProvider,
  type Lesson,
  type LessonChallenge,
  type LessonRepository,
} from '@/lib/lessons';
import { ChallengeCard } from './ChallengeCard';
import { ChallengeEditor } from './ChallengeEditor';
import { KIND_LABELS } from './challenge-ui';
import { ContextMenu } from '../drawing/ContextMenu';
import { DrawingToolbar } from '../drawing/DrawingToolbar';
import { FloatingToolbar } from '../drawing/FloatingToolbar';
import { TextEditorOverlay } from '../drawing/TextEditorOverlay';
import { DialogHost } from '../dialogs/DialogHost';
import { useGlobalKeyboard } from '../hooks/useGlobalKeyboard';
import { useThemeCssVars } from '../hooks/useThemeCssVars';
import { Toasts } from '../overlays/Toasts';
import { AppContext } from '../state/app-context';
import { connectBridge } from '../state/bridge';
import { useUiStore } from '../state/ui-store';
import { ChartControls } from '../chart/ChartControls';
import { Legend } from '../chart/Legend';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { formatDuration } from './format';

interface LessonPlayerViewProps {
  readonly repository: LessonRepository;
  readonly lessonId: string;
  readonly onExit: () => void;
}

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly lesson: Lesson };

const SEEK_STEP_MS = 5000;

/** Loads a lesson and plays it on a dedicated, isolated chart. */
export function LessonPlayerView({ repository, lessonId, onExit }: LessonPlayerViewProps) {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    repository
      .load(lessonId)
      .then((lesson) => {
        if (!alive) return;
        setLoad(
          lesson
            ? { kind: 'ready', lesson }
            : { kind: 'error', message: 'This lesson no longer exists.' },
        );
      })
      .catch((e: unknown) => {
        if (alive)
          setLoad({
            kind: 'error',
            message: `The lesson could not be opened: ${e instanceof Error ? e.message : String(e)}`,
          });
      });
    return () => {
      alive = false;
    };
  }, [repository, lessonId]);

  if (load.kind !== 'ready') {
    return (
      <PendingScreen
        kind={load.kind}
        message={load.kind === 'error' ? load.message : undefined}
        onExit={onExit}
      />
    );
  }
  return <Player lesson={load.lesson} repository={repository} onExit={onExit} />;
}

function PendingScreen({
  kind,
  message,
  onExit,
}: {
  readonly kind: 'loading' | 'error';
  readonly message?: string | undefined;
  readonly onExit: () => void;
}) {
  useThemeCssVars();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-chart text-fg">
      {kind === 'loading' ? (
        <div
          className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-accent"
          aria-label="Loading lesson"
        />
      ) : (
        <>
          <p role="alert" className="text-[13px] text-down">
            {message}
          </p>
          <Button onClick={onExit}>Back to library</Button>
        </>
      )}
    </div>
  );
}

/** Fits a box of the given aspect ratio into the available space (letterbox). */
function useLetterbox(aspect: number | null) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      if (!aspect || W <= 0 || H <= 0) return setBox({ w: W, h: H });
      const w = Math.min(W, H * aspect);
      setBox({ w: Math.floor(w), h: Math.floor(w / aspect) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);
  return { ref, box };
}

interface Authoring {
  readonly initial: LessonChallenge | null;
  readonly at: number;
}

function Player({
  lesson,
  repository,
  onExit,
}: {
  readonly lesson: Lesson;
  readonly repository: LessonRepository;
  readonly onExit: () => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [app, setApp] = useState<ChartApp | null>(null);
  const [player, setPlayer] = useState<LessonPlayer | null>(null);
  const [snap, setSnap] = useState<PlayerSnapshot | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [authoring, setAuthoring] = useState<Authoring | null>(null);
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  const pushToast = useUiStore((s) => s.pushToast);
  const newId = useMemo(() => (app ? createIdGenerator(app.deps.rng, 'challenge-') : null), [app]);

  const persistChallenges = async (list: readonly LessonChallenge[]) => {
    if (!player) return;
    player.setChallenges(list);
    try {
      await repository.save(
        lesson.meta,
        { ...lesson.timeline, challenges: [...list] },
        lesson.audio,
      );
    } catch (e) {
      pushToast(`Saving challenges failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  };

  const startAuthoring = (initial: LessonChallenge | null) => {
    if (!player) return;
    player.pause();
    const at = initial?.at ?? player.time;
    player.closeChallenge();
    if (initial) player.seek(initial.at);
    setAuthoring({ initial, at });
  };

  const saveAuthored = (draft: ChallengeDraft) => {
    if (!player || !authoring || !newId) return;
    const { initial, at } = authoring;
    const challenge: LessonChallenge = { ...draft, id: initial?.id ?? newId(), at };
    const list = initial
      ? player.challenges.map((c) => (c.id === initial.id ? challenge : c))
      : [...player.challenges, challenge];
    setAuthoring(null);
    void persistChallenges(list).then(() => pushToast('Challenge saved', 'info'));
  };

  const deleteChallenge = (id: string) => {
    if (!player) return;
    void persistChallenges(player.challenges.filter((c) => c.id !== id));
  };
  const editing = !snap || snap.mode === 'free';
  useThemeCssVars(editing);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const provider = new LessonDataProvider(lesson.timeline.datasets);
    const deps = createPlaybackDependencies(provider);
    const instance = new ChartApp(el, deps, { persistDrawings: false });
    const disconnect = connectBridge(instance);
    const perfNow = () => performance.now();
    let url: string | null = null;
    const media = lesson.audio
      ? new HtmlAudioMedia(new Audio((url = URL.createObjectURL(lesson.audio))), perfNow)
      : new VirtualMedia(lesson.timeline.duration, perfNow);
    const p = new LessonPlayer(instance, lesson, media, deps.runtime.frames);
    const offs = [
      p.events.on('state:changed', setSnap),
      p.events.on('error', ({ message }) => pushToast(`Playback failed: ${message}`, 'error')),
      p.events.on('frame', ({ cursor }) => {
        const c = cursorRef.current;
        if (!c) return;
        if (p.snapshot.mode === 'lesson' && cursor) {
          c.style.display = 'block';
          c.style.transform = `translate(${cursor.x}px, ${cursor.y}px)`;
        } else c.style.display = 'none';
      }),
    ];
    setApp(instance);
    setPlayer(p);
    setSnap(p.snapshot);
    return () => {
      offs.forEach((off) => off());
      p.destroy();
      disconnect();
      instance.destroy();
      if (url) URL.revokeObjectURL(url);
      setApp(null);
      setPlayer(null);
    };
  }, [lesson, pushToast]);

  const stage = snap?.stage;
  const { ref: areaRef, box } = useLetterbox(stage && stage.h > 0 ? stage.w / stage.h : null);
  const free = snap?.mode === 'free';

  useGlobalKeyboard(free ? app : null);
  const locked = authoring !== null;
  useEffect(() => {
    if (!player || locked) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))
      )
        return;
      if (useUiStore.getState().dialog) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        e.stopImmediatePropagation();
        player.toggle();
      } else if (
        player.snapshot.mode === 'lesson' &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        e.preventDefault();
        player.seek(player.time + (e.key === 'ArrowLeft' ? -SEEK_STEP_MS : SEEK_STEP_MS));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [player, locked]);

  return (
    <AppContext.Provider value={app}>
      <div className="flex h-full w-full flex-col bg-chart text-fg">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-panel px-2">
          <Button variant="ghost" onClick={onExit}>
            <Icon name="chevronLeft" size={16} />
            Library
          </Button>
          <h1 className="min-w-0 truncate text-[14px] font-semibold">{lesson.meta.title}</h1>
          <div className="flex-1" />
          <Button
            variant="ghost"
            aria-pressed={editMode}
            className={editMode ? 'text-accent' : ''}
            title="Add, edit or delete this lesson's challenges"
            onClick={() => {
              setEditMode((m) => !m);
              setAuthoring(null);
            }}
          >
            <Icon name="target" size={16} />
            {editMode ? 'Done editing' : 'Edit challenges'}
          </Button>
          <ModeBadge snap={snap} onReset={() => player?.resetToLesson()} />
        </header>
        <div className="flex min-h-0 flex-1">
          <div className="relative flex">
            {app ? (
              <DrawingToolbar />
            ) : (
              <div className="w-12 shrink-0 border-r border-line bg-panel" />
            )}
            {!free ? <div className="absolute inset-0 z-30 cursor-not-allowed" /> : null}
          </div>
          <div
            ref={areaRef}
            className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-panel"
          >
            <main
              aria-label="Lesson chart"
              className="relative bg-chart"
              style={box ? { width: box.w, height: box.h } : { width: '100%', height: '100%' }}
            >
              <div ref={chartRef} className="absolute inset-0" data-testid="lesson-chart" />
              {app ? (
                <>
                  <Legend />
                  {free ? (
                    <>
                      <ChartControls />
                      <FloatingToolbar />
                      <TextEditorOverlay />
                    </>
                  ) : null}
                </>
              ) : null}
              <div
                ref={cursorRef}
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 z-40"
                style={{ display: 'none' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow">
                  <path
                    d="M4 2l15 9-6.5 1.6L9.8 19z"
                    fill="var(--tc-accent, #2962ff)"
                    stroke="white"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
              {player && snap && app && authoring ? (
                <ChallengeEditor
                  key={authoring.initial?.id ?? `new-${authoring.at}`}
                  board={player.board}
                  data={() => app.market.data}
                  initial={authoring.initial}
                  timeLabel={formatDuration(authoring.at)}
                  onSave={saveAuthored}
                  onCancel={() => setAuthoring(null)}
                />
              ) : null}
              {player && snap?.challenge && !authoring ? (
                <ChallengeCard
                  player={player}
                  active={snap.challenge}
                  total={snap.challenges.length}
                  onEdit={editMode ? () => startAuthoring(snap.challenge!.challenge) : undefined}
                  onDelete={
                    editMode ? () => deleteChallenge(snap.challenge!.challenge.id) : undefined
                  }
                />
              ) : null}
              {player &&
              snap &&
              free &&
              !snap.challenge &&
              !authoring &&
              !summaryDismissed &&
              snap.challenges.length > 0 &&
              player.time >= snap.duration ? (
                <LessonSummary
                  snap={snap}
                  onOpen={(id) => player.goToChallenge(id)}
                  onClose={() => setSummaryDismissed(true)}
                />
              ) : null}
              {!free ? (
                // Lesson mode: the chart follows the teacher; a click pauses into free play.
                <div
                  className="absolute inset-0 z-30 cursor-pointer"
                  title="Pause to explore the chart"
                  onClick={() => player?.pause()}
                  onWheel={(e) => e.stopPropagation()}
                />
              ) : null}
            </main>
          </div>
        </div>
        {player && snap ? (
          <PlayerBar
            player={player}
            snap={snap}
            locked={authoring !== null}
            onAddChallenge={editMode && !authoring ? () => startAuthoring(null) : undefined}
            onPlay={() => setSummaryDismissed(false)}
          />
        ) : null}
        {app && free ? (
          <>
            <DialogHost />
            <ContextMenu />
          </>
        ) : null}
        <Toasts />
      </div>
    </AppContext.Provider>
  );
}

function ModeBadge({
  snap,
  onReset,
}: {
  readonly snap: PlayerSnapshot | null;
  readonly onReset: () => void;
}) {
  if (!snap) return null;
  if (snap.mode === 'lesson') {
    return (
      <span className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[12px] font-medium">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-down" />
        Lesson
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex items-center gap-2 rounded-full border border-accent px-3 py-1 text-[12px] font-medium text-accent"
        title="Explore freely. Your changes are discarded when the lesson resumes."
      >
        Free play
      </span>
      <Button disabled={!snap.modified} onClick={onReset}>
        <Icon name="reset" size={15} />
        Reset to lesson
      </Button>
    </div>
  );
}

function LessonSummary({
  snap,
  onOpen,
  onClose,
}: {
  readonly snap: PlayerSnapshot;
  onOpen(id: string): void;
  onClose(): void;
}) {
  const passed = snap.challenges.filter((c) => snap.results[c.id]?.passed).length;
  return (
    <div
      role="dialog"
      aria-label="Lesson summary"
      className="absolute left-1/2 top-1/2 z-40 w-[min(420px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-panel text-[13px] shadow-xl"
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="check" size={18} className="text-up" />
        <span className="text-[15px] font-semibold">Lesson complete</span>
        <div className="flex-1" />
        <button
          type="button"
          aria-label="Close"
          className="text-muted hover:text-fg"
          onClick={onClose}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <p className="px-4 pt-3 font-medium">
        {passed} of {snap.challenges.length} challenges passed
      </p>
      <ul className="max-h-64 overflow-y-auto px-2 py-2">
        {snap.challenges.map((c, i) => {
          const r = snap.results[c.id];
          return (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
                onClick={() => onOpen(c.id)}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                    r ? (r.passed ? 'bg-up' : 'bg-down') : 'bg-muted'
                  }`}
                />
                <span className="w-5 shrink-0 text-muted">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate">{c.prompt}</span>
                <span className="shrink-0 text-[12px] text-muted">
                  {r ? `${Math.round(r.score * 100)}%` : 'skipped'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChallengeMarkers({
  player,
  snap,
}: {
  readonly player: LessonPlayer;
  readonly snap: PlayerSnapshot;
}) {
  if (snap.duration <= 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0">
      {snap.challenges.map((c, i) => {
        const r = snap.results[c.id];
        const color = r ? (r.passed ? 'bg-up' : 'bg-down') : 'bg-accent';
        const current = snap.challenge?.challenge.id === c.id;
        return (
          <button
            key={c.id}
            type="button"
            aria-label={`Challenge ${i + 1}: ${c.prompt}`}
            title={`${formatDuration(c.at)} · ${KIND_LABELS[c.kind]}: ${c.prompt}`}
            onClick={() => player.goToChallenge(c.id)}
            className={`pointer-events-auto absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px] border-2 border-panel ${color} ${
              current ? 'ring-2 ring-accent' : ''
            }`}
            style={{ left: `${(Math.min(c.at, snap.duration) / snap.duration) * 100}%` }}
          />
        );
      })}
    </div>
  );
}

function PlayerBar({
  player,
  snap,
  locked,
  onAddChallenge,
  onPlay,
}: {
  readonly player: LessonPlayer;
  readonly snap: PlayerSnapshot;
  /** Playback controls are disabled (a challenge is being edited). */
  readonly locked: boolean;
  readonly onAddChallenge?: (() => void) | undefined;
  onPlay(): void;
}) {
  const [time, setTime] = useState(player.time);
  useEffect(() => player.events.on('frame', ({ time: t }) => setTime(t)), [player]);
  const playing = snap.mode === 'lesson';
  return (
    <div
      role="region"
      aria-label="Lesson playback"
      className="flex h-12 shrink-0 items-center gap-2 border-t border-line bg-panel px-3 text-[13px]"
    >
      <IconButton
        icon={playing ? 'pause' : 'play'}
        label={playing ? 'Pause' : 'Play'}
        shortcut="Space"
        tooltipSide="top"
        disabled={locked}
        onClick={() => {
          if (!playing) onPlay();
          player.toggle();
        }}
      />
      <span className="w-24 shrink-0 tabular-nums text-muted">
        {formatDuration(time)} / {formatDuration(snap.duration)}
      </span>
      <div className="relative flex min-w-0 flex-1 items-center">
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={Math.max(1, snap.duration)}
          step={100}
          disabled={locked}
          value={Math.min(time, snap.duration)}
          onChange={(e) => player.seek(Number(e.target.value))}
          className="h-1 w-full min-w-0 cursor-pointer accent-[var(--tc-accent)]"
        />
        {locked ? null : <ChallengeMarkers player={player} snap={snap} />}
      </div>
      {onAddChallenge && !playing ? (
        <Button onClick={onAddChallenge}>
          <Icon name="plus" size={15} />
          Add challenge here
        </Button>
      ) : null}
      <div role="group" aria-label="Speed" className="flex shrink-0 items-center gap-0.5">
        {PLAYBACK_RATES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={snap.rate === r}
            onClick={() => player.setRate(r)}
            className={`h-7 rounded-md px-2 text-[12px] font-medium tabular-nums hover:bg-hover ${
              snap.rate === r ? 'bg-hover text-accent' : 'text-muted'
            }`}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  );
}
