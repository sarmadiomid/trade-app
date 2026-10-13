import { EventBus, lastLessOrEqual, type FrameScheduler, type Theme } from '@/lib/core';
import {
  LessonDataProvider,
  TimelineIndex,
  gradeChallenge,
  type ChallengeResult,
  type Lesson,
  type LessonChallenge,
  type LessonState,
} from '@/lib/lessons';
import { shiftThemeForEdit } from '@/lib/themes';
import type { ChartApp } from '../chart-app';
import type { PlaybackMedia } from './audio';
import { ChallengeBoard } from './challenge-board';
import {
  CHART_SLICE_BEHAVIORS,
  applyChartState,
  type CursorValue,
  type StageValue,
} from './chart-slices';

/** 'lesson': the chart follows the recording (read-only). 'free': paused, the student explores. */
export type PlayerMode = 'lesson' | 'free';

export const PLAYBACK_RATES = [1, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export interface PlayerSnapshot {
  readonly mode: PlayerMode;
  readonly playing: boolean;
  readonly rate: PlaybackRate;
  readonly duration: number;
  /** True once the student changed the chart since the last sync with the lesson. */
  readonly modified: boolean;
  readonly stage: StageValue | null;
  readonly challenges: readonly LessonChallenge[];
  /** The challenge being answered, null when none is open. */
  readonly challenge: ActiveChallenge | null;
  /** Latest graded attempt per challenge id. */
  readonly results: Readonly<Record<string, ChallengeResult>>;
}

export interface ActiveChallenge {
  readonly challenge: LessonChallenge;
  /** 1-based position among the lesson's challenges. */
  readonly number: number;
  readonly result: ChallengeResult | null;
  readonly showingSolution: boolean;
}

export interface PlayerFrame {
  readonly time: number;
  /** Teacher pointer in chart pixels, null when hidden. */
  readonly cursor: { readonly x: number; readonly y: number } | null;
}

export interface PlayerEventMap {
  'state:changed': PlayerSnapshot;
  frame: PlayerFrame;
  error: { readonly message: string };
}

/**
 * Plays a lesson on a dedicated, storage-less ChartApp. Lesson time comes from the media (the
 * voice), so audio and chart cannot drift; every frame the chart is set to the timeline's state
 * at that time. The timeline is read-only: whatever the student does while paused is discarded
 * by the next resume, seek or reset.
 */
export class LessonPlayer {
  readonly events = new EventBus<PlayerEventMap>();
  readonly index: TimelineIndex;
  /** Collects the student's answers on the chart. */
  readonly board: ChallengeBoard;
  private readonly data: LessonDataProvider;
  private challengeList: LessonChallenge[];
  private active: ActiveChallenge | null = null;
  private results: Record<string, ChallengeResult> = {};
  /** The engine shows a cut copy of the bars (challenge hides the future). */
  private truncated = false;
  private readonly offs: Array<() => void> = [];
  private mode: PlayerMode = 'free';
  private rate: PlaybackRate = 1;
  private modified = false;
  private applying = false;
  private prev: LessonState | null = null;
  private frameHandle = 0;
  private looping = false;
  private current = 0;
  private stage: StageValue | null = null;
  /** Real theme the edit tint was built from. Null while playback shows the recorded theme. */
  private tintSource: Theme | null = null;

  constructor(
    readonly app: ChartApp,
    readonly lesson: Lesson,
    private readonly media: PlaybackMedia,
    private readonly frames: FrameScheduler,
  ) {
    this.index = new TimelineIndex(lesson.timeline, CHART_SLICE_BEHAVIORS);
    this.data = new LessonDataProvider(lesson.timeline.datasets);
    this.challengeList = sortChallenges(lesson.timeline.challenges ?? []);
    this.board = new ChallengeBoard(app.engine);
    const markModified = () => {
      if (this.applying || this.mode !== 'free' || this.modified) return;
      this.modified = true;
      this.emitState();
    };
    const e = app.engine.events;
    const d = app.drawings.events;
    this.offs.push(
      media.onEnded(() => this.onEnded()),
      e.on('viewport:changed', markModified),
      e.on('options:changed', markModified),
      d.on('drawings:changed', markModified),
      d.on('drawing:updated', markModified),
      d.on('selection:changed', markModified),
      d.on('tool:changed', markModified),
      d.on('modes:changed', markModified),
      d.on('placement:changed', markModified),
      app.events.on('themes:changed', markModified),
      e.on('theme:changed', () => {
        if (!this.applying) this.refreshEditTint();
      }),
      e.on('resize', () => {
        if (this.mode === 'lesson' || !this.modified) this.sync(this.current, 'view');
      }),
    );
    this.sync(0, 'all');
  }

  get snapshot(): PlayerSnapshot {
    return {
      mode: this.mode,
      playing: this.mode === 'lesson',
      rate: this.rate,
      duration: this.index.duration,
      modified: this.modified,
      stage: this.stage,
      challenges: this.challengeList,
      challenge: this.active,
      results: this.results,
    };
  }

  get challenges(): readonly LessonChallenge[] {
    return this.challengeList;
  }

  /** Replaces the lesson's challenges (authoring after recording). Closes an open one. */
  setChallenges(list: readonly LessonChallenge[]): void {
    this.closeChallenge();
    this.challengeList = sortChallenges(list);
    const ids = new Set(this.challengeList.map((c) => c.id));
    this.results = Object.fromEntries(Object.entries(this.results).filter(([id]) => ids.has(id)));
    this.emitState();
  }

  // ---- challenges -------------------------------------------------------------------------

  /** First challenge with `from < at <= to` (playback crossed it). */
  private challengeCrossed(from: number, to: number): LessonChallenge | null {
    return this.challengeList.find((c) => c.at > from && c.at <= to) ?? null;
  }

  /** Stops playback exactly at the challenge and hands the chart to the student. */
  private stopAtChallenge(c: LessonChallenge): void {
    this.stopLoop();
    this.media.pause();
    this.seekMedia(c.at);
    this.sync(c.at, 'diff');
    this.mode = 'free';
    this.modified = false;
    this.refreshEditTint();
    this.openChallenge(c);
  }

  /** Jumps to a challenge and opens it (e.g. from its timeline marker). */
  goToChallenge(id: string): void {
    const c = this.challengeList.find((x) => x.id === id);
    if (!c) return;
    if (this.mode === 'lesson') {
      this.media.pause();
      this.stopLoop();
      this.mode = 'free';
    }
    this.seek(c.at);
    this.refreshEditTint();
    this.openChallenge(c);
  }

  private openChallenge(c: LessonChallenge): void {
    this.closeChallenge(false);
    const number = this.challengeList.findIndex((x) => x.id === c.id) + 1;
    this.active = { challenge: c, number, result: null, showingSolution: false };
    if (c.hideFuture && c.region) this.hideBarsAfter(c.region.to);
    this.board.start({ kind: c.kind, label: c.label, region: c.region });
    if (this.prev) this.emitFrame(this.prev);
    this.emitState();
  }

  /** Closes the open challenge (answers are kept in `results` once validated). */
  closeChallenge(emit = true): void {
    if (!this.active) return;
    this.active = null;
    this.board.stop();
    this.showAllBars();
    if (emit) this.emitState();
  }

  private hideBarsAfter(time: number): void {
    const full = this.app.market.data;
    const i = lastLessOrEqual(full.time, full.length, time);
    if (i < 0 || i >= full.length - 1) return;
    this.applying = true;
    try {
      this.app.engine.setData(full.clone(0, i), { resetView: false });
    } finally {
      this.applying = false;
    }
    this.truncated = true;
  }

  private showAllBars(): void {
    if (!this.truncated) return;
    this.truncated = false;
    this.applying = true;
    try {
      this.app.engine.setData(this.app.market.data, { resetView: false });
    } finally {
      this.applying = false;
    }
  }

  /** Grades what the student marked and shows the feedback on the chart. */
  validate(): ChallengeResult | null {
    const a = this.active;
    if (!a) return null;
    const result = gradeChallenge(a.challenge, this.board.marks, this.app.market.data);
    this.results = { ...this.results, [a.challenge.id]: result };
    this.active = { ...a, result, showingSolution: false };
    this.board.showResult(result);
    this.emitState();
    return result;
  }

  /** Back to answering, keeping the current marks. */
  retry(): void {
    const a = this.active;
    if (!a) return;
    this.active = { ...a, result: null, showingSolution: false };
    this.board.edit();
    this.emitState();
  }

  clearAnswer(): void {
    if (!this.active) return;
    this.board.setMarks({ candles: [], points: [], zones: [] });
  }

  toggleSolution(): void {
    const a = this.active;
    if (!a) return;
    if (a.showingSolution) {
      if (a.result) this.board.showResult(a.result);
      else this.board.edit();
    } else {
      this.board.showSolution(a.challenge.answer);
    }
    this.active = { ...a, showingSolution: !a.showingSolution };
    this.emitState();
  }

  /** Closes the challenge and resumes the lesson from it. */
  continueLesson(): Promise<void> {
    this.closeChallenge();
    return this.play();
  }

  get time(): number {
    return this.current;
  }

  private emitState(): void {
    this.events.emit('state:changed', this.snapshot);
  }

  /** Applies the lesson state at `time`: 'all' re-applies everything, 'diff' only changes. */
  private sync(time: number, what: 'all' | 'diff' | 'view'): void {
    this.current = Math.max(0, Math.min(this.index.duration, time));
    const state = this.index.stateAt(this.current);
    let prev: LessonState | null = what === 'all' ? null : this.prev;
    if (what === 'view' && prev) prev = { ...prev, view: undefined, cursor: undefined };
    this.applying = true;
    try {
      applyChartState(this.app, state, prev, { data: this.data });
    } finally {
      this.applying = false;
    }
    if (what === 'all') {
      this.app.history.clear();
      this.modified = false;
    }
    this.prev = state;
    this.refreshEditTint();
    const stage = (state.stage as StageValue | undefined) ?? null;
    if (stage !== this.stage) {
      this.stage = stage;
      this.emitState();
    }
    this.emitFrame(state);
  }

  /** Teacher pointer is playback-only. Pausing hides it; the chart's own crosshair is lesson state. */
  private emitFrame(state: LessonState): void {
    this.events.emit('frame', {
      time: this.current,
      cursor: this.mode === 'lesson' ? this.cursorPixels(state) : null,
    });
  }

  /**
   * While paused, paint a slightly shifted surface so editing reads differently from playback.
   * The stored theme is unchanged, so resume, seek and reset still restore the recording.
   */
  private refreshEditTint(): void {
    if (this.mode !== 'free') {
      if (this.tintSource === null) return;
      this.tintSource = null;
      this.app.engine.setPaintTheme(null);
      return;
    }
    const source = this.app.engine.getTheme();
    if (source === this.tintSource) return;
    this.tintSource = source;
    this.app.engine.setPaintTheme(shiftThemeForEdit(source));
  }

  private cursorPixels(state: LessonState): PlayerFrame['cursor'] {
    const c = state.cursor as CursorValue | null | undefined;
    if (!c) return null;
    const { width, height } = this.app.engine.getLayout();
    return { x: c.x * width, y: c.y * height };
  }

  async play(): Promise<void> {
    if (this.mode === 'lesson') return;
    this.closeChallenge(false);
    if (this.current >= this.index.duration) this.seekMedia(0);
    // Mode flips first so the frame from this sync still draws the teacher pointer.
    this.mode = 'lesson';
    // Resuming always returns to the recorded state; student changes are discarded.
    this.sync(this.current, 'all');
    this.refreshEditTint();
    this.emitState();
    try {
      await this.media.play();
    } catch (e) {
      this.mode = 'free';
      this.refreshEditTint();
      if (this.prev) this.emitFrame(this.prev);
      this.emitState();
      this.events.emit('error', {
        message: e instanceof Error ? e.message : 'Playback failed',
      });
      return;
    }
    this.startLoop();
  }

  pause(): void {
    if (this.mode === 'free') return;
    this.media.pause();
    this.stopLoop();
    this.sync(this.media.time, 'diff');
    this.mode = 'free';
    this.modified = false;
    this.refreshEditTint();
    if (this.prev) this.emitFrame(this.prev);
    this.emitState();
  }

  toggle(): void {
    if (this.mode === 'lesson') this.pause();
    else void this.play();
  }

  /** Jumps to `ms` instantly, in sync, and shows the lesson state there. */
  seek(ms: number): void {
    const t = Math.max(0, Math.min(this.index.duration, ms));
    this.closeChallenge(false);
    this.seekMedia(t);
    this.sync(t, 'all');
    this.emitState();
  }

  private seekMedia(t: number): void {
    this.media.seek(t);
    this.current = t;
  }

  /** Discards the student's changes and shows the lesson state at the current time. */
  resetToLesson(): void {
    this.sync(this.current, 'all');
    this.emitState();
  }

  setRate(rate: PlaybackRate): void {
    this.rate = rate;
    this.media.setRate(rate);
    this.emitState();
  }

  private startLoop(): void {
    if (this.looping) return;
    this.looping = true;
    const step = () => {
      if (!this.looping) return;
      const t = this.media.time;
      const challenge = this.challengeCrossed(this.current, Math.min(t, this.index.duration));
      if (challenge) {
        this.stopAtChallenge(challenge);
        return;
      }
      if (t >= this.index.duration) {
        this.onEnded();
        return;
      }
      this.sync(t, 'diff');
      this.frameHandle = this.frames.request(step);
    };
    this.frameHandle = this.frames.request(step);
  }

  private stopLoop(): void {
    this.looping = false;
    this.frames.cancel(this.frameHandle);
  }

  private onEnded(): void {
    if (this.mode !== 'lesson') return;
    const challenge = this.challengeCrossed(this.current, this.index.duration);
    if (challenge) {
      this.stopAtChallenge(challenge);
      return;
    }
    this.stopLoop();
    this.media.pause();
    this.sync(this.index.duration, 'diff');
    this.mode = 'free';
    this.modified = false;
    this.refreshEditTint();
    if (this.prev) this.emitFrame(this.prev);
    this.emitState();
  }

  destroy(): void {
    this.stopLoop();
    this.board.destroy();
    for (const off of this.offs.splice(0)) off();
    this.media.destroy();
    this.events.clear();
  }
}

const sortChallenges = (list: readonly LessonChallenge[]): LessonChallenge[] =>
  [...list].sort((a, b) => a.at - b.at);
