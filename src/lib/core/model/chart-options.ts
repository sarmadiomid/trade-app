import type { LineStyle } from '../contracts/settings-schema';
import type { PriceScaleMode } from '../scales/price-scale';
import { ENGINE_CONFIG } from '../config';

export type CrosshairMode = 'full' | 'dot' | 'arrow';
export type BackgroundType = 'solid' | 'gradient';
export type PriceSource = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
export type BoxSizeMethod = 'atr' | 'traditional';
export type KagiMethod = 'atr' | 'traditional' | 'percentage';
export type BrickSource = 'close' | 'hl';
export type FootprintType = 'buySell' | 'volume' | 'delta';
export type TpoMode = 'letters' | 'blocks';
export type ProfilePlacement = 'left' | 'right';

/**
 * Behavioural chart options (candle colours live in the Theme). Flat primitives on purpose: the
 * settings dialog binds schema fields to these keys directly.
 */
export interface ChartOptions {
  /** Id of the registered series definition (chart type). */
  chartType: string;
  // Symbol
  showBody: boolean;
  showBorders: boolean;
  showWicks: boolean;
  // Bars
  barsColorOnPrevClose: boolean;
  barsHlc: boolean;
  barsThin: boolean;
  // Line, step line, area
  lineSource: PriceSource;
  lineColor: string;
  lineWidth: number;
  areaTopColor: string;
  areaBottomColor: string;
  // HLC area
  hlcHighColor: string;
  hlcLowColor: string;
  hlcCloseColor: string;
  hlcHighFill: string;
  hlcLowFill: string;
  // Baseline
  baselineLevel: number;
  baselineTopLine: string;
  baselineTopFill1: string;
  baselineTopFill2: string;
  baselineBottomLine: string;
  baselineBottomFill1: string;
  baselineBottomFill2: string;
  // Columns
  columnsColorOnPrevClose: boolean;
  columnsUpColor: string;
  columnsDownColor: string;
  // High-low
  hlShowBody: boolean;
  hlBodyColor: string;
  hlShowBorders: boolean;
  hlBorderColor: string;
  hlShowLabels: boolean;
  hlLabelsColor: string;
  // Volume footprint
  footprintType: FootprintType;
  /** 0 = auto. */
  footprintTicksPerRow: number;
  footprintImbalance: boolean;
  footprintValueArea: number;
  // Time price opportunity
  tpoMode: TpoMode;
  /** Period of one TPO letter, in minutes. */
  tpoPeriod: number;
  /** 0 = auto. */
  tpoTicksPerRow: number;
  tpoValueArea: number;
  tpoShowPoc: boolean;
  tpoShowValueArea: boolean;
  tpoShowInitialBalance: boolean;
  // Session volume profile
  svpRows: number;
  svpValueArea: number;
  svpWidth: number;
  svpPlacement: ProfilePlacement;
  svpUpColor: string;
  svpDownColor: string;
  svpVaUpColor: string;
  svpVaDownColor: string;
  svpShowPoc: boolean;
  svpPocColor: string;
  // Renko
  renkoBoxMethod: BoxSizeMethod;
  renkoAtrLength: number;
  renkoBoxSize: number;
  renkoSource: BrickSource;
  renkoWicks: boolean;
  // Line break
  lineBreakCount: number;
  // Kagi
  kagiMethod: KagiMethod;
  kagiAtrLength: number;
  kagiReversal: number;
  kagiPercent: number;
  kagiYangColor: string;
  kagiYinColor: string;
  // Point & figure
  pnfBoxMethod: BoxSizeMethod;
  pnfAtrLength: number;
  pnfBoxSize: number;
  pnfReversal: number;
  pnfSource: BrickSource;
  // Range
  rangeMethod: BoxSizeMethod;
  rangeAtrLength: number;
  rangeValue: number;
  /** -1 = auto (from symbol tick size). */
  pricePrecision: number;
  // Status line
  showStatusSymbol: boolean;
  showStatusOHLC: boolean;
  showStatusChange: boolean;
  showStatusVolume: boolean;
  // Scales
  autoScale: boolean;
  scaleMode: PriceScaleMode;
  invertScale: boolean;
  lockScale: boolean;
  scalePriceChartOnly: boolean;
  showLastPriceLine: boolean;
  showLastPriceLabel: boolean;
  showPrevCloseLine: boolean;
  // Appearance
  backgroundType: BackgroundType;
  gridVertical: boolean;
  gridHorizontal: boolean;
  crosshairMode: CrosshairMode;
  crosshairLineStyle: LineStyle;
  watermarkVisible: boolean;
  watermarkText: string;
  fontSize: number;
  // Canvas
  volumeVisible: boolean;
  /** Histogram is hidden; the pane and its legend stay so it can be shown again. */
  volumeHidden: boolean;
  volumePaneRatio: number;
  rightMargin: number;
  marginTop: number;
  marginBottom: number;
  hiDpi: boolean;
}

export const DEFAULT_CHART_OPTIONS: Readonly<ChartOptions> = {
  chartType: 'candles',
  showBody: true,
  showBorders: true,
  showWicks: true,
  barsColorOnPrevClose: false,
  barsHlc: false,
  barsThin: true,
  lineSource: 'close',
  lineColor: '#3b78ff',
  lineWidth: 2,
  areaTopColor: '#3b78ff47',
  areaBottomColor: '#3b78ff0d',
  hlcHighColor: '#3dcea0',
  hlcLowColor: '#ff6b81',
  hlcCloseColor: '#8e98ab',
  hlcHighFill: '#3dcea033',
  hlcLowFill: '#ff6b8133',
  baselineLevel: 50,
  baselineTopLine: '#3dcea0',
  baselineTopFill1: '#3dcea047',
  baselineTopFill2: '#3dcea00d',
  baselineBottomLine: '#ff6b81',
  baselineBottomFill1: '#ff6b810d',
  baselineBottomFill2: '#ff6b8147',
  columnsColorOnPrevClose: true,
  columnsUpColor: '#3dcea080',
  columnsDownColor: '#ff6b8180',
  hlShowBody: true,
  hlBodyColor: '#3b78ff',
  hlShowBorders: true,
  hlBorderColor: '#3b78ff',
  hlShowLabels: true,
  hlLabelsColor: '#3b78ff',
  footprintType: 'buySell',
  footprintTicksPerRow: 0,
  footprintImbalance: true,
  footprintValueArea: 70,
  tpoMode: 'letters',
  tpoPeriod: 30,
  tpoTicksPerRow: 0,
  tpoValueArea: 70,
  tpoShowPoc: true,
  tpoShowValueArea: true,
  tpoShowInitialBalance: true,
  svpRows: 24,
  svpValueArea: 70,
  svpWidth: 70,
  svpPlacement: 'left',
  svpUpColor: '#2196f34d',
  svpDownColor: '#fbc02d4d',
  svpVaUpColor: '#2196f3b3',
  svpVaDownColor: '#fbc02db3',
  svpShowPoc: true,
  svpPocColor: '#ff0000',
  renkoBoxMethod: 'atr',
  renkoAtrLength: 14,
  renkoBoxSize: 10,
  renkoSource: 'close',
  renkoWicks: true,
  lineBreakCount: 3,
  kagiMethod: 'atr',
  kagiAtrLength: 14,
  kagiReversal: 10,
  kagiPercent: 1,
  kagiYangColor: '#3dcea0',
  kagiYinColor: '#ff6b81',
  pnfBoxMethod: 'atr',
  pnfAtrLength: 14,
  pnfBoxSize: 10,
  pnfReversal: 3,
  pnfSource: 'hl',
  rangeMethod: 'atr',
  rangeAtrLength: 14,
  rangeValue: 10,
  pricePrecision: -1,
  showStatusSymbol: true,
  showStatusOHLC: true,
  showStatusChange: true,
  showStatusVolume: true,
  autoScale: true,
  scaleMode: 'linear',
  invertScale: false,
  lockScale: false,
  scalePriceChartOnly: false,
  showLastPriceLine: true,
  showLastPriceLabel: true,
  showPrevCloseLine: false,
  backgroundType: 'solid',
  gridVertical: true,
  gridHorizontal: true,
  crosshairMode: 'full',
  crosshairLineStyle: 'dashed',
  watermarkVisible: false,
  watermarkText: '',
  fontSize: ENGINE_CONFIG.font.size,
  volumeVisible: true,
  volumeHidden: false,
  volumePaneRatio: ENGINE_CONFIG.volume.defaultRatio,
  rightMargin: ENGINE_CONFIG.rightMarginBars,
  marginTop: ENGINE_CONFIG.priceMargins.top * 100,
  marginBottom: ENGINE_CONFIG.priceMargins.bottom * 100,
  hiDpi: true,
};
