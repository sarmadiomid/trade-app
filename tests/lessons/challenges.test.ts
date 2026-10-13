import { describe, expect, it } from 'vitest';
import { SeriesData, createIdGenerator, createRng, type Candle } from '@/lib/core';
import { dataProviderRegistry, FALLBACK_PROVIDER_ID } from '@/lib/data';
import { MemoryStorage } from '@/lib/storage';
import {
  CapturingProvider,
  DEFAULT_TOLERANCE,
  EMPTY_MARKS,
  StorageLessonRepository,
  decodeTimeline,
  detectCandles,
  encodeTimeline,
  gradeChallenge,
  type LessonChallenge,
} from '@/lib/lessons';
import { ChartApp, LessonPlayer, RecordingSession, VirtualMedia, recoverDraft } from '@/lib/app';
import { fakeContainer, fakeRuntime } from '../helpers/fake-dom';

const HOUR = 3_600_000;

/** Bars with given [open, high, low, close]. */
function series(bars: Array<[number, number, number, number]>): SeriesData {
  const candles: Candle[] = bars.map(([open, high, low, close], i) => ({
    time: i * HOUR,
    open,
    high,
    low,
    close,
    volume: 1,
  }));
  return SeriesData.fromCandles(candles);
}

function challenge(patch: Partial<LessonChallenge>): LessonChallenge {
  return {
    id: 'c1',
    at: 1000,
    kind: 'candles',
    prompt: 'q',
    explanation: '',
    label: '',
    rule: null,
    region: null,
    hideFuture: false,
    tolerance: DEFAULT_TOLERANCE,
    pass: 1,
    answer: EMPTY_MARKS,
    ...patch,
  };
}

const data = series([
  [10, 12, 8, 10.1], // doji
  [10, 14, 9, 13.5],
  [13.5, 15, 12, 12.1],
  [12, 13, 11, 12.05], // doji
  [12, 16, 11.5, 15.8],
  [15.8, 16, 15, 15.2],
]);

describe('candle rules', () => {
  it('finds doji candles, optionally inside a region', () => {
    expect(detectCandles(data, 'doji', null)).toEqual([0, 3 * HOUR]);
    expect(detectCandles(data, 'doji', { from: HOUR, to: 5 * HOUR })).toEqual([3 * HOUR]);
  });

  it('finds engulfing and inside bars from the previous bar', () => {
    const d = series([
      [10, 10.5, 8.5, 9], // bearish
      [8.8, 11, 8.6, 10.8], // bullish engulfing
      [10, 10.5, 9, 9.5], // inside bar
    ]);
    expect(detectCandles(d, 'bullish-engulfing', null)).toEqual([HOUR]);
    expect(detectCandles(d, 'inside-bar', null)).toEqual([2 * HOUR]);
  });
});

describe('grading', () => {
  it('scores candle selections by hits, misses and extras', () => {
    const ch = challenge({ answer: { ...EMPTY_MARKS, candles: [0, 3 * HOUR] } });
    const perfect = gradeChallenge(ch, { ...EMPTY_MARKS, candles: [3 * HOUR, 0] }, data);
    expect(perfect).toMatchObject({ passed: true, score: 1, hits: 2, misses: 0, extras: 0 });

    const partial = gradeChallenge(ch, { ...EMPTY_MARKS, candles: [0, HOUR] }, data);
    expect(partial).toMatchObject({ passed: false, hits: 1, misses: 1, extras: 1 });
    expect(partial.score).toBeCloseTo(1 / 3);
    expect(partial.candles.map((c) => c.status).sort()).toEqual(['extra', 'hit', 'miss']);
  });

  it('accepts points within the bar and price tolerance', () => {
    const ch = challenge({
      kind: 'points',
      label: 'BOS',
      tolerance: { bars: 1, price: 0.05, overlap: 0.5 },
      answer: { ...EMPTY_MARKS, points: [{ time: 2 * HOUR, price: 15 }] },
    });
    // Price span of all bars is 16 - 8 = 8, so the price tolerance is 0.4.
    const near = gradeChallenge(
      ch,
      { ...EMPTY_MARKS, points: [{ time: 3 * HOUR, price: 15.3 }] },
      data,
    );
    expect(near.passed).toBe(true);
    const farBars = gradeChallenge(
      ch,
      { ...EMPTY_MARKS, points: [{ time: 4 * HOUR, price: 15 }] },
      data,
    );
    expect(farBars).toMatchObject({ passed: false, hits: 0, misses: 1, extras: 1 });
    const farPrice = gradeChallenge(
      ch,
      { ...EMPTY_MARKS, points: [{ time: 2 * HOUR, price: 14 }] },
      data,
    );
    expect(farPrice.passed).toBe(false);
  });

  it('matches zones by overlap and pairs each answer with one mark', () => {
    const zone = { from: HOUR, to: 3 * HOUR, top: 12, bottom: 10 };
    const ch = challenge({
      kind: 'zones',
      tolerance: { bars: 0, price: 0, overlap: 0.5 },
      answer: { ...EMPTY_MARKS, zones: [zone] },
    });
    const close = { from: HOUR, to: 3 * HOUR, top: 12.2, bottom: 10.3 };
    const twice = gradeChallenge(ch, { ...EMPTY_MARKS, zones: [close, close] }, data);
    expect(twice).toMatchObject({ hits: 1, extras: 1, misses: 0, passed: false });
    const off = { from: 4 * HOUR, to: 5 * HOUR, top: 12, bottom: 10 };
    expect(gradeChallenge(ch, { ...EMPTY_MARKS, zones: [off] }, data).passed).toBe(false);
    expect(
      gradeChallenge({ ...ch, pass: 0.5 }, { ...EMPTY_MARKS, zones: [close, close] }, data).passed,
    ).toBe(true);
  });

  it('round-trips challenges through the lesson codec; old lessons have none', async () => {
    const ch = challenge({
      answer: { ...EMPTY_MARKS, candles: [0] },
      region: { from: 0, to: HOUR },
    });
    const base = { version: 1, duration: 5000, initial: {}, ops: [], datasets: [] };
    expect((await decodeTimeline(await encodeTimeline(base))).challenges).toBeUndefined();
    const decoded = await decodeTimeline(await encodeTimeline({ ...base, challenges: [ch] }));
    expect(decoded.challenges).toEqual([ch]);
  });
});

function createClock() {
  let now = 1_700_000_000_000;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

async function createTeacher() {
  const clock = createClock();
  const { container } = fakeContainer(1000, 600);
  const { runtime, frames, timer } = fakeRuntime(clock);
  const synthetic = dataProviderRegistry
    .require(FALLBACK_PROVIDER_ID)
    .create({ clock, fetch: () => Promise.reject(new Error('offline')) });
  const provider = new CapturingProvider(synthetic);
  const app = new ChartApp(
    container,
    { runtime, clock, rng: createRng(1), storage: new MemoryStorage(), provider },
    { initialBars: 300 },
  );
  await app.start();
  frames.flush();
  return { app, clock, frames, timer, provider };
}

describe('challenges in a recorded lesson', () => {
  it('records a challenge while paused and stops playback there for the student', async () => {
    const t = await createTeacher();
    const repo = new StorageLessonRepository(new MemoryStorage());
    const session = new RecordingSession({
      app: t.app,
      repository: repo,
      provider: t.provider,
      clock: t.clock,
      timer: t.timer,
      newId: createIdGenerator(createRng(3)),
      audio: null,
    });
    await session.start();
    t.clock.advance(1500);
    const d = t.app.market.data;
    const region = { from: d.time[200]!, to: d.time[240]! };
    const answer = detectCandles(d, 'bullish', region);
    expect(() =>
      session.addChallenge({
        kind: 'candles',
        prompt: 'Select the bullish candles',
        explanation: 'Close above open.',
        label: '',
        rule: 'bullish',
        region,
        hideFuture: true,
        tolerance: DEFAULT_TOLERANCE,
        pass: 1,
        answer: { ...EMPTY_MARKS, candles: answer },
      }),
    ).toThrow();
    session.pause();
    const added = session.addChallenge({
      kind: 'candles',
      prompt: 'Select the bullish candles',
      explanation: 'Close above open.',
      label: '',
      rule: 'bullish',
      region,
      hideFuture: true,
      tolerance: DEFAULT_TOLERANCE,
      pass: 1,
      answer: { ...EMPTY_MARKS, candles: answer },
    });
    expect(added.at).toBe(1500);
    session.resume();
    t.clock.advance(1000);
    const meta = await session.stop('With challenge');
    const lesson = (await repo.load(meta.id))!;
    expect(lesson.timeline.challenges).toHaveLength(1);

    const { container } = fakeContainer(1000, 600);
    const s = fakeRuntime(t.clock);
    const student = new ChartApp(
      container,
      {
        runtime: s.runtime,
        clock: t.clock,
        rng: createRng(9),
        storage: new MemoryStorage(),
        provider: dataProviderRegistry
          .require(FALLBACK_PROVIDER_ID)
          .create({ clock: t.clock, fetch: () => Promise.reject(new Error('offline')) }),
      },
      { persistDrawings: false },
    );
    const player = new LessonPlayer(
      student,
      lesson,
      new VirtualMedia(lesson.timeline.duration, t.clock.now),
      s.frames,
    );
    await player.play();
    t.clock.advance(2000);
    s.frames.flush();
    expect(player.time).toBe(1500);
    expect(player.snapshot.mode).toBe('free');
    expect(player.snapshot.challenge?.challenge.id).toBe(added.id);
    // Future bars are hidden from the chart while answering.
    const full = student.market.data;
    expect(student.engine.seriesData.length).toBeLessThan(full.length);
    expect(student.engine.seriesData.time[student.engine.seriesData.length - 1]).toBe(region.to);

    player.board.setMarks({ ...EMPTY_MARKS, candles: answer.slice(1) });
    expect(player.validate()!.passed).toBe(answer.length <= 1);
    player.retry();
    player.board.setMarks({ ...EMPTY_MARKS, candles: answer });
    expect(player.validate()!.passed).toBe(true);
    expect(player.snapshot.results[added.id]!.passed).toBe(true);

    await player.continueLesson();
    expect(player.snapshot.challenge).toBeNull();
    expect(student.engine.seriesData.length).toBe(full.length);
    t.clock.advance(5000);
    s.frames.flush();
    expect(player.time).toBe(lesson.timeline.duration);
    player.destroy();
    student.destroy();
  });

  it('keeps challenges in the autosaved draft', async () => {
    const t = await createTeacher();
    const repo = new StorageLessonRepository(new MemoryStorage());
    const session = new RecordingSession({
      app: t.app,
      repository: repo,
      provider: t.provider,
      clock: t.clock,
      timer: t.timer,
      newId: createIdGenerator(createRng(4)),
      audio: null,
    });
    await session.start();
    t.clock.advance(800);
    session.pause();
    session.addChallenge({
      kind: 'points',
      prompt: 'Mark the BOS',
      explanation: '',
      label: 'BOS',
      rule: null,
      region: null,
      hideFuture: false,
      tolerance: DEFAULT_TOLERANCE,
      pass: 1,
      answer: { ...EMPTY_MARKS, points: [{ time: t.app.market.data.time[10]!, price: 1 }] },
    });
    await session.autosave();
    const drafts = await repo.listDrafts();
    const meta = await recoverDraft(repo, drafts[0]!.id, '');
    const lesson = (await repo.load(meta!.id))!;
    expect(lesson.timeline.challenges?.map((c) => c.label)).toEqual(['BOS']);
  });
});
