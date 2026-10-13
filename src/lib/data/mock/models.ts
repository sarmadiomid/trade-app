/** Parameters of a synthetic instrument: price anchors the daily path is bridged through. */
export interface MockModel {
  readonly symbol: string;
  readonly seed: number;
  /** First UTC day with data (inclusive) and the exclusive end. */
  readonly start: number;
  readonly end: number;
  /** Long-run daily volatility of log returns. */
  readonly dailyVol: number;
  /** GARCH(1,1) persistence: variance = ω + α·r² + β·variance. */
  readonly garch: { readonly alpha: number; readonly beta: number };
  /** (UTC date, close) points the daily closes pass through, ascending. */
  readonly anchors: ReadonlyArray<readonly [number, number]>;
  readonly tickSize: number;
}

const d = (y: number, m: number, day: number) => Date.UTC(y, m - 1, day);

/**
 * Gold, 2019–2025. The anchors follow the broad shape of the real market (the 2020 rally, the
 * 2022 dip, the 2024–25 bull run) so levels and volatility feel familiar; everything in between
 * is seeded noise.
 */
export const GOLD_MODEL: MockModel = {
  symbol: 'XAUUSD',
  seed: 0x60_1d,
  start: d(2019, 1, 1),
  end: d(2026, 1, 1),
  dailyVol: 0.0092,
  garch: { alpha: 0.07, beta: 0.9 },
  tickSize: 0.01,
  anchors: [
    [d(2019, 1, 1), 1282],
    [d(2019, 9, 3), 1545],
    [d(2020, 1, 2), 1528],
    [d(2020, 3, 16), 1478],
    [d(2020, 8, 6), 2062],
    [d(2021, 3, 8), 1683],
    [d(2021, 6, 1), 1905],
    [d(2022, 1, 3), 1801],
    [d(2022, 3, 8), 2045],
    [d(2022, 11, 3), 1631],
    [d(2023, 5, 3), 2041],
    [d(2023, 10, 5), 1821],
    [d(2024, 1, 2), 2058],
    [d(2024, 4, 12), 2370],
    [d(2024, 10, 30), 2785],
    [d(2024, 12, 31), 2624],
    [d(2025, 4, 22), 3420],
    [d(2025, 10, 20), 4310],
    [d(2025, 12, 31), 4260],
  ],
};

export const MOCK_MODELS: Readonly<Record<string, MockModel>> = { XAUUSD: GOLD_MODEL };
