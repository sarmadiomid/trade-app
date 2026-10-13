import { z } from 'zod';
import { DEFAULT_CHART_OPTIONS, ENGINE_CONFIG, LINE_STYLES, type ChartOptions } from '@/lib/core';

const { volume } = ENGINE_CONFIG;

const color = z.string().max(64);
const priceSource = z.enum(['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4']);
const boxMethod = z.enum(['atr', 'traditional']);
const brickSource = z.enum(['close', 'hl']);
const atrLength = z.number().int().min(1).max(500);
const positive = z.number().positive().finite();
const percent = z.number().min(1).max(100);

/** Validation for persisted chart options. Unknown keys are dropped, missing ones defaulted. */
export const chartOptionsSchema = z
  .object({
    chartType: z.string().max(40),
    showBody: z.boolean(),
    showBorders: z.boolean(),
    showWicks: z.boolean(),
    barsColorOnPrevClose: z.boolean(),
    barsHlc: z.boolean(),
    barsThin: z.boolean(),
    lineSource: priceSource,
    lineColor: color,
    lineWidth: z.number().min(1).max(4),
    areaTopColor: color,
    areaBottomColor: color,
    hlcHighColor: color,
    hlcLowColor: color,
    hlcCloseColor: color,
    hlcHighFill: color,
    hlcLowFill: color,
    baselineLevel: z.number().min(0).max(100),
    baselineTopLine: color,
    baselineTopFill1: color,
    baselineTopFill2: color,
    baselineBottomLine: color,
    baselineBottomFill1: color,
    baselineBottomFill2: color,
    columnsColorOnPrevClose: z.boolean(),
    columnsUpColor: color,
    columnsDownColor: color,
    hlShowBody: z.boolean(),
    hlBodyColor: color,
    hlShowBorders: z.boolean(),
    hlBorderColor: color,
    hlShowLabels: z.boolean(),
    hlLabelsColor: color,
    footprintType: z.enum(['buySell', 'volume', 'delta']),
    footprintTicksPerRow: z.number().int().min(0).max(100000),
    footprintImbalance: z.boolean(),
    footprintValueArea: percent,
    tpoMode: z.enum(['letters', 'blocks']),
    tpoPeriod: z.number().int().min(1).max(1440),
    tpoTicksPerRow: z.number().int().min(0).max(100000),
    tpoValueArea: percent,
    tpoShowPoc: z.boolean(),
    tpoShowValueArea: z.boolean(),
    tpoShowInitialBalance: z.boolean(),
    svpRows: z.number().int().min(1).max(500),
    svpValueArea: percent,
    svpWidth: percent,
    svpPlacement: z.enum(['left', 'right']),
    svpUpColor: color,
    svpDownColor: color,
    svpVaUpColor: color,
    svpVaDownColor: color,
    svpShowPoc: z.boolean(),
    svpPocColor: color,
    renkoBoxMethod: boxMethod,
    renkoAtrLength: atrLength,
    renkoBoxSize: positive,
    renkoSource: brickSource,
    renkoWicks: z.boolean(),
    lineBreakCount: z.number().int().min(1).max(100),
    kagiMethod: z.enum(['atr', 'traditional', 'percentage']),
    kagiAtrLength: atrLength,
    kagiReversal: positive,
    kagiPercent: z.number().positive().max(100),
    kagiYangColor: color,
    kagiYinColor: color,
    pnfBoxMethod: boxMethod,
    pnfAtrLength: atrLength,
    pnfBoxSize: positive,
    pnfReversal: z.number().int().min(1).max(100),
    pnfSource: brickSource,
    rangeMethod: boxMethod,
    rangeAtrLength: atrLength,
    rangeValue: positive,
    pricePrecision: z.number().int().min(-1).max(10),
    showStatusSymbol: z.boolean(),
    showStatusOHLC: z.boolean(),
    showStatusChange: z.boolean(),
    showStatusVolume: z.boolean(),
    autoScale: z.boolean(),
    scaleMode: z.enum(['linear', 'log', 'percent']),
    invertScale: z.boolean(),
    lockScale: z.boolean(),
    scalePriceChartOnly: z.boolean(),
    showLastPriceLine: z.boolean(),
    showLastPriceLabel: z.boolean(),
    showPrevCloseLine: z.boolean(),
    backgroundType: z.enum(['solid', 'gradient']),
    gridVertical: z.boolean(),
    gridHorizontal: z.boolean(),
    crosshairMode: z.enum(['full', 'dot', 'arrow']),
    crosshairLineStyle: z.enum(LINE_STYLES),
    watermarkVisible: z.boolean(),
    watermarkText: z.string().max(80),
    fontSize: z.number().min(8).max(20),
    volumeVisible: z.boolean(),
    volumePaneRatio: z.number().min(volume.minRatio).max(volume.maxRatio),
    rightMargin: z.number().min(0).max(200),
    marginTop: z.number().min(0).max(40),
    marginBottom: z.number().min(0).max(40),
    hiDpi: z.boolean(),
  })
  .partial();

export function parseChartOptions(data: unknown): ChartOptions | null {
  const r = chartOptionsSchema.safeParse(data);
  if (!r.success) return null;
  const clean = Object.fromEntries(Object.entries(r.data).filter(([, v]) => v !== undefined));
  return { ...DEFAULT_CHART_OPTIONS, ...clean };
}
