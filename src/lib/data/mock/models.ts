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

/** Euro / U.S. Dollar, 2019–2025. */
export const EURUSD_MODEL: MockModel = {
  symbol: 'EURUSD',
  seed: 0xe0_05,
  start: d(2019, 1, 1),
  end: d(2026, 1, 1),
  dailyVol: 0.0045,
  garch: { alpha: 0.06, beta: 0.91 },
  tickSize: 0.00001,
  anchors: [
    [d(2019, 1, 1), 1.146],
    [d(2019, 10, 1), 1.09],
    [d(2020, 3, 20), 1.069],
    [d(2020, 12, 31), 1.222],
    [d(2021, 6, 1), 1.222],
    [d(2022, 3, 7), 1.086],
    [d(2022, 9, 27), 0.96],
    [d(2023, 7, 18), 1.124],
    [d(2023, 10, 3), 1.045],
    [d(2023, 12, 28), 1.11],
    [d(2024, 4, 16), 1.062],
    [d(2024, 9, 25), 1.12],
    [d(2025, 1, 13), 1.02],
    [d(2025, 7, 1), 1.18],
    [d(2025, 12, 31), 1.165],
  ],
};

/** British Pound / U.S. Dollar, 2019–2025. */
export const GBPUSD_MODEL: MockModel = {
  symbol: 'GBPUSD',
  seed: 0x6b_9d,
  start: d(2019, 1, 1),
  end: d(2026, 1, 1),
  dailyVol: 0.005,
  garch: { alpha: 0.07, beta: 0.9 },
  tickSize: 0.00001,
  anchors: [
    [d(2019, 1, 1), 1.275],
    [d(2019, 9, 3), 1.196],
    [d(2019, 12, 13), 1.333],
    [d(2020, 3, 20), 1.149],
    [d(2021, 2, 24), 1.415],
    [d(2022, 9, 26), 1.035],
    [d(2023, 7, 14), 1.313],
    [d(2023, 10, 4), 1.205],
    [d(2024, 9, 27), 1.343],
    [d(2025, 1, 13), 1.211],
    [d(2025, 7, 1), 1.375],
    [d(2025, 12, 31), 1.34],
  ],
};

/** Australian Dollar / U.S. Dollar, 2019–2025. */
export const AUDUSD_MODEL: MockModel = {
  symbol: 'AUDUSD',
  seed: 0xa0_d5,
  start: d(2019, 1, 1),
  end: d(2026, 1, 1),
  dailyVol: 0.0055,
  garch: { alpha: 0.07, beta: 0.9 },
  tickSize: 0.00001,
  anchors: [
    [d(2019, 1, 1), 0.705],
    [d(2020, 3, 19), 0.574],
    [d(2021, 2, 25), 0.8],
    [d(2022, 10, 13), 0.622],
    [d(2023, 2, 2), 0.714],
    [d(2023, 10, 26), 0.63],
    [d(2024, 9, 30), 0.694],
    [d(2025, 4, 8), 0.597],
    [d(2025, 12, 31), 0.665],
  ],
};

/** Nasdaq 100 index CFD, 2019–2025. */
export const NAS100_MODEL: MockModel = {
  symbol: 'NAS100',
  seed: 0x4a_51,
  start: d(2019, 1, 1),
  end: d(2026, 1, 1),
  dailyVol: 0.013,
  garch: { alpha: 0.09, beta: 0.88 },
  tickSize: 0.1,
  anchors: [
    [d(2019, 1, 1), 6330],
    [d(2020, 2, 19), 9718],
    [d(2020, 3, 23), 6994],
    [d(2021, 11, 19), 16573],
    [d(2022, 12, 28), 10679],
    [d(2023, 12, 29), 16826],
    [d(2024, 7, 10), 20675],
    [d(2024, 12, 16), 22097],
    [d(2025, 4, 7), 16540],
    [d(2025, 10, 29), 26100],
    [d(2025, 12, 31), 25200],
  ],
};

export const MOCK_MODELS: Readonly<Record<string, MockModel>> = {
  XAUUSD: GOLD_MODEL,
  EURUSD: EURUSD_MODEL,
  GBPUSD: GBPUSD_MODEL,
  AUDUSD: AUDUSD_MODEL,
  NAS100: NAS100_MODEL,
};
