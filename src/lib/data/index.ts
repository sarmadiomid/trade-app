import './register';

export { SyntheticProvider, SYNTHETIC_EPOCH } from './synthetic/synthetic-provider';
export { BinanceProvider, type FetchFn } from './binance/binance-provider';
export {
  BINANCE_HOSTS,
  BINANCE_INTERVALS,
  BINANCE_MAX_LIMIT,
  klinesQuery,
  parseKlines,
} from './binance/klines';
export { FallbackProvider } from './fallback-provider';
export {
  dataProviderRegistry,
  type DataProviderDefinition,
  type DataProviderDeps,
} from './registry';
export { DEFAULT_PROVIDER_ID, FALLBACK_PROVIDER_ID } from './register';
export { SYMBOLS, symbolInfo, searchSymbols } from './symbols';
export {
  INSTRUMENTS,
  assetClassOf,
  instrumentSpec,
  setAssetClasses,
  type AssetClass,
} from './instruments';
export { MockMarketProvider } from './mock/mock-market-provider';
export { HybridMarketProvider } from './hybrid-market';
export {
  customInstruments,
  customRange,
  customSpec,
  ensureCustomCatalog,
  installCustomCatalog,
  subscribeCustomCatalog,
  customCatalogVersion,
  type CatalogInstrument,
} from './custom-catalog';
export {
  MAX_IMPORT_BARS,
  MAX_SYMBOL_BARS,
  barsBetween,
  fromTuples,
  normalizeBars,
  parseCandleCsv,
  projectBars,
  timeframeFromPath,
  rangeOfBars,
  sliceCandles,
  toTuples,
} from './catalog/bars';
export {
  ASSET_CLASSES,
  HOURS_BY_PRESET,
  HOUR_PRESETS,
  draftToSpec,
  hoursPresetOf,
  parseInstrumentDraft,
  type HourPreset,
  type InstrumentDraft,
} from './catalog/instrument-form';
export { GOLD_MODEL, MOCK_MODELS, type MockModel } from './mock/models';
