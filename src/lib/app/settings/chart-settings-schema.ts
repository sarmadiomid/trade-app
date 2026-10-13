import type { FieldCondition, SettingsField, SettingsGroup, SettingsSchema } from '@/lib/core';
import { seriesRegistry } from '@/lib/series';

const chartType = (...ids: string[]): FieldCondition => ({ key: 'opt.chartType', oneOf: ids });
const when = (key: string, equals: string): FieldCondition => ({ key: `opt.${key}`, equals });

const CANDLE_LIKE = chartType(
  'candles',
  'hollow-candles',
  'volume-candles',
  'session-volume-profile',
  'heikin-ashi',
  'renko',
  'line-break',
  'range',
  'bars',
  'point-figure',
);

const PRICE_SOURCES = [
  { value: 'open', label: 'Open' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'close', label: 'Close' },
  { value: 'hl2', label: '(H + L)/2' },
  { value: 'hlc3', label: '(H + L + C)/3' },
  { value: 'ohlc4', label: '(O + H + L + C)/4' },
];

const BOX_METHODS = [
  { value: 'atr', label: 'ATR' },
  { value: 'traditional', label: 'Traditional' },
];

const BRICK_SOURCES = [
  { value: 'close', label: 'Close' },
  { value: 'hl', label: 'High/Low' },
];

const color = (key: string, label: string, inline = false): SettingsField => ({
  kind: 'color',
  key: `opt.${key}`,
  label,
  inline,
});

const number = (
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  extra: Partial<{ unit: string; visibleWhen: FieldCondition }> = {},
): SettingsField => ({ kind: 'number', key: `opt.${key}`, label, min, max, step, ...extra });

const boxSizeFields = (prefix: string, methodKey: string, sizeKey: string, sizeLabel: string) => [
  {
    kind: 'select',
    key: `opt.${methodKey}`,
    label: 'Box size assignment method',
    options: BOX_METHODS,
  } as SettingsField,
  number(`${prefix}AtrLength`, 'ATR length', 1, 500, 1, { visibleWhen: when(methodKey, 'atr') }),
  number(sizeKey, sizeLabel, 0.00000001, 1e9, 1, {
    visibleWhen: when(methodKey, 'traditional'),
  }),
];

/** Per chart type settings, shown in the Symbol tab for the active type only. */
const CHART_TYPE_GROUPS: SettingsGroup[] = [
  {
    id: 'bars',
    label: 'Bars',
    visibleWhen: chartType('bars'),
    fields: [
      { kind: 'boolean', key: 'opt.barsColorOnPrevClose', label: 'Color bars based on previous close' },
      { kind: 'boolean', key: 'opt.barsHlc', label: 'HLC bars' },
      { kind: 'boolean', key: 'opt.barsThin', label: 'Thin bars' },
    ],
  },
  {
    id: 'line',
    label: 'Line',
    visibleWhen: chartType('line', 'step-line', 'area', 'baseline'),
    fields: [
      { kind: 'select', key: 'opt.lineSource', label: 'Price source', options: PRICE_SOURCES },
      {
        ...color('lineColor', 'Line'),
        visibleWhen: chartType('line', 'step-line', 'area'),
      },
      {
        kind: 'select',
        key: 'opt.lineWidth',
        label: 'Line width',
        options: [1, 2, 3, 4].map((w) => ({ value: w, label: `${w}px` })),
      },
    ],
  },
  {
    id: 'area',
    label: 'Fill',
    visibleWhen: chartType('area'),
    fields: [color('areaTopColor', 'Fill'), color('areaBottomColor', 'To', true)],
  },
  {
    id: 'hlc-area',
    label: 'HLC area',
    visibleWhen: chartType('hlc-area'),
    fields: [
      color('hlcHighColor', 'High line'),
      color('hlcCloseColor', 'Close line'),
      color('hlcLowColor', 'Low line'),
      color('hlcHighFill', 'Fill high'),
      color('hlcLowFill', 'Fill low'),
    ],
  },
  {
    id: 'baseline',
    label: 'Baseline',
    visibleWhen: chartType('baseline'),
    fields: [
      number('baselineLevel', 'Base level', 0, 100, 1, { unit: '%' }),
      color('baselineTopLine', 'Top line'),
      color('baselineTopFill1', 'Top area'),
      color('baselineTopFill2', 'To', true),
      color('baselineBottomLine', 'Bottom line'),
      color('baselineBottomFill1', 'Bottom area'),
      color('baselineBottomFill2', 'To', true),
    ],
  },
  {
    id: 'columns',
    label: 'Columns',
    visibleWhen: chartType('columns'),
    fields: [
      {
        kind: 'boolean',
        key: 'opt.columnsColorOnPrevClose',
        label: 'Color bars based on previous close',
      },
      color('columnsUpColor', 'Up'),
      color('columnsDownColor', 'Down', true),
    ],
  },
  {
    id: 'high-low',
    label: 'High-low',
    visibleWhen: chartType('high-low'),
    fields: [
      { kind: 'boolean', key: 'opt.hlShowBody', label: 'Body' },
      color('hlBodyColor', 'Color', true),
      { kind: 'boolean', key: 'opt.hlShowBorders', label: 'Borders' },
      color('hlBorderColor', 'Color', true),
      { kind: 'boolean', key: 'opt.hlShowLabels', label: 'Labels' },
      color('hlLabelsColor', 'Color', true),
    ],
  },
  {
    id: 'footprint',
    label: 'Volume footprint',
    visibleWhen: chartType('volume-footprint'),
    fields: [
      {
        kind: 'select',
        key: 'opt.footprintType',
        label: 'Type',
        options: [
          { value: 'buySell', label: 'Buy and sell' },
          { value: 'volume', label: 'Total volume' },
          { value: 'delta', label: 'Delta' },
        ],
      },
      number('footprintTicksPerRow', 'Ticks per row (0 = auto)', 0, 100000, 1),
      number('footprintValueArea', 'Value area', 1, 100, 1, { unit: '%' }),
      { kind: 'boolean', key: 'opt.footprintImbalance', label: 'Highlight imbalance' },
    ],
  },
  {
    id: 'tpo',
    label: 'Time price opportunity',
    visibleWhen: chartType('tpo'),
    fields: [
      {
        kind: 'select',
        key: 'opt.tpoMode',
        label: 'Display',
        options: [
          { value: 'letters', label: 'Letters' },
          { value: 'blocks', label: 'Blocks' },
        ],
      },
      {
        kind: 'select',
        key: 'opt.tpoPeriod',
        label: 'Period',
        options: [5, 10, 15, 30, 60, 120, 240].map((m) => ({
          value: m,
          label: m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`,
        })),
      },
      number('tpoTicksPerRow', 'Ticks per row (0 = auto)', 0, 100000, 1),
      number('tpoValueArea', 'Value area', 1, 100, 1, { unit: '%' }),
      { kind: 'boolean', key: 'opt.tpoShowPoc', label: 'Point of control' },
      { kind: 'boolean', key: 'opt.tpoShowValueArea', label: 'Value area' },
      { kind: 'boolean', key: 'opt.tpoShowInitialBalance', label: 'Initial balance' },
    ],
  },
  {
    id: 'svp',
    label: 'Session volume profile',
    visibleWhen: chartType('session-volume-profile'),
    fields: [
      number('svpRows', 'Row size', 1, 500, 1),
      number('svpValueArea', 'Value area volume', 1, 100, 1, { unit: '%' }),
      number('svpWidth', 'Width', 1, 100, 1, { unit: '%' }),
      {
        kind: 'select',
        key: 'opt.svpPlacement',
        label: 'Placement',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ],
      },
      color('svpUpColor', 'Up volume'),
      color('svpDownColor', 'Down volume', true),
      color('svpVaUpColor', 'Value area up'),
      color('svpVaDownColor', 'Value area down', true),
      { kind: 'boolean', key: 'opt.svpShowPoc', label: 'POC' },
      color('svpPocColor', 'Color', true),
    ],
  },
  {
    id: 'renko',
    label: 'Renko',
    visibleWhen: chartType('renko'),
    fields: [
      ...boxSizeFields('renko', 'renkoBoxMethod', 'renkoBoxSize', 'Box size'),
      { kind: 'select', key: 'opt.renkoSource', label: 'Source', options: BRICK_SOURCES },
      { kind: 'boolean', key: 'opt.renkoWicks', label: 'Wicks' },
    ],
  },
  {
    id: 'line-break',
    label: 'Line break',
    visibleWhen: chartType('line-break'),
    fields: [number('lineBreakCount', 'Number of lines', 1, 100, 1)],
  },
  {
    id: 'kagi',
    label: 'Kagi',
    visibleWhen: chartType('kagi'),
    fields: [
      {
        kind: 'select',
        key: 'opt.kagiMethod',
        label: 'Reversal amount method',
        options: [...BOX_METHODS, { value: 'percentage', label: 'Percentage' }],
      },
      number('kagiAtrLength', 'ATR length', 1, 500, 1, { visibleWhen: when('kagiMethod', 'atr') }),
      number('kagiReversal', 'Reversal amount', 0.00000001, 1e9, 1, {
        visibleWhen: when('kagiMethod', 'traditional'),
      }),
      number('kagiPercent', 'Percentage', 0.01, 100, 0.1, {
        unit: '%',
        visibleWhen: when('kagiMethod', 'percentage'),
      }),
      color('kagiYangColor', 'Up (yang) line'),
      color('kagiYinColor', 'Down (yin) line'),
    ],
  },
  {
    id: 'point-figure',
    label: 'Point & figure',
    visibleWhen: chartType('point-figure'),
    fields: [
      ...boxSizeFields('pnf', 'pnfBoxMethod', 'pnfBoxSize', 'Box size'),
      number('pnfReversal', 'Reversal amount', 1, 100, 1, { unit: 'boxes' }),
      { kind: 'select', key: 'opt.pnfSource', label: 'Source', options: BRICK_SOURCES },
    ],
  },
  {
    id: 'range',
    label: 'Range',
    visibleWhen: chartType('range'),
    fields: boxSizeFields('range', 'rangeMethod', 'rangeValue', 'Range'),
  },
];

/**
 * The chart settings dialog, declared as data. Keys prefixed `opt.` bind to ChartOptions,
 * `theme.` to colours of the active theme. The UI renders this with the generic SchemaForm.
 */
export const CHART_SETTINGS_SCHEMA: SettingsSchema = {
  tabs: [
    {
      id: 'symbol',
      label: 'Symbol',
      groups: [
        {
          id: 'chart-type',
          label: 'Chart type',
          fields: [
            {
              kind: 'select',
              key: 'opt.chartType',
              label: 'Type',
              options: seriesRegistry.list().map((s) => ({ value: s.id, label: s.label })),
            },
          ],
        },
        {
          id: 'candles',
          label: 'Candles',
          visibleWhen: CANDLE_LIKE,
          fields: [
            { kind: 'boolean', key: 'opt.showBody', label: 'Body' },
            { kind: 'color', key: 'theme.upBody', label: 'Up', inline: true },
            { kind: 'color', key: 'theme.downBody', label: 'Down', inline: true },
            { kind: 'boolean', key: 'opt.showBorders', label: 'Borders' },
            { kind: 'color', key: 'theme.upBorder', label: 'Up', inline: true },
            { kind: 'color', key: 'theme.downBorder', label: 'Down', inline: true },
            { kind: 'boolean', key: 'opt.showWicks', label: 'Wick' },
            { kind: 'color', key: 'theme.upWick', label: 'Up', inline: true },
            { kind: 'color', key: 'theme.downWick', label: 'Down', inline: true },
          ],
        },
        ...CHART_TYPE_GROUPS,
        {
          id: 'data',
          label: 'Data modification',
          fields: [
            {
              kind: 'select',
              key: 'opt.pricePrecision',
              label: 'Precision',
              options: [
                { value: -1, label: 'Default' },
                ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
                  value: n,
                  label: n === 0 ? '1' : `1/${10 ** n}`,
                })),
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'status',
      label: 'Status line',
      groups: [
        {
          id: 'status',
          fields: [
            { kind: 'boolean', key: 'opt.showStatusSymbol', label: 'Title' },
            { kind: 'boolean', key: 'opt.showStatusOHLC', label: 'OHLC values' },
            { kind: 'boolean', key: 'opt.showStatusChange', label: 'Bar change values' },
            { kind: 'boolean', key: 'opt.showStatusVolume', label: 'Volume' },
          ],
        },
      ],
    },
    {
      id: 'scales',
      label: 'Scales',
      groups: [
        {
          id: 'price-scale',
          label: 'Price scale',
          fields: [
            { kind: 'boolean', key: 'opt.autoScale', label: 'Auto (fits data to screen)' },
            {
              kind: 'select',
              key: 'opt.scaleMode',
              label: 'Scale type',
              options: [
                { value: 'linear', label: 'Regular' },
                { value: 'percent', label: 'Percent' },
                { value: 'log', label: 'Logarithmic' },
              ],
            },
            { kind: 'boolean', key: 'opt.invertScale', label: 'Invert scale' },
            { kind: 'boolean', key: 'opt.lockScale', label: 'Lock price to bar ratio' },
            { kind: 'boolean', key: 'opt.scalePriceChartOnly', label: 'Scale price chart only' },
          ],
        },
        {
          id: 'labels',
          label: 'Labels & lines',
          fields: [
            { kind: 'boolean', key: 'opt.showLastPriceLabel', label: 'Last price label' },
            { kind: 'boolean', key: 'opt.showLastPriceLine', label: 'Last price line' },
            { kind: 'boolean', key: 'opt.showPrevCloseLine', label: 'Previous day close line' },
            { kind: 'color', key: 'theme.prevCloseLine', label: 'Color', inline: true },
          ],
        },
      ],
    },
    {
      id: 'appearance',
      label: 'Appearance',
      groups: [
        {
          id: 'background',
          label: 'Chart basic styles',
          fields: [
            {
              kind: 'select',
              key: 'opt.backgroundType',
              label: 'Background',
              options: [
                { value: 'solid', label: 'Solid' },
                { value: 'gradient', label: 'Gradient' },
              ],
            },
            { kind: 'color', key: 'theme.background', label: 'Color', inline: true },
            {
              kind: 'color',
              key: 'theme.backgroundGradientEnd',
              label: 'To',
              inline: true,
              visibleWhen: { key: 'opt.backgroundType', equals: 'gradient' },
            },
            { kind: 'boolean', key: 'opt.gridVertical', label: 'Vert grid lines' },
            { kind: 'boolean', key: 'opt.gridHorizontal', label: 'Horz grid lines' },
            { kind: 'color', key: 'theme.grid', label: 'Grid color' },
            { kind: 'color', key: 'theme.scaleBorder', label: 'Scale lines' },
            { kind: 'color', key: 'theme.text', label: 'Scale text' },
            { kind: 'fontSize', key: 'opt.fontSize', label: 'Font size', inline: true },
          ],
        },
        {
          id: 'crosshair',
          label: 'Crosshair',
          fields: [
            {
              kind: 'select',
              key: 'opt.crosshairMode',
              label: 'Mode',
              options: [
                { value: 'full', label: 'Cross' },
                { value: 'dot', label: 'Dot' },
                { value: 'arrow', label: 'Arrow' },
              ],
            },
            { kind: 'color', key: 'theme.crosshair', label: 'Color', inline: true },
            {
              kind: 'lineStyle',
              key: 'opt.crosshairLineStyle',
              label: 'Line style',
              visibleWhen: { key: 'opt.crosshairMode', equals: 'full' },
            },
          ],
        },
        {
          id: 'watermark',
          label: 'Watermark',
          fields: [
            { kind: 'boolean', key: 'opt.watermarkVisible', label: 'Show watermark' },
            { kind: 'color', key: 'theme.watermark', label: 'Color', inline: true },
            {
              kind: 'text',
              key: 'opt.watermarkText',
              label: 'Text',
              placeholder: 'Symbol, interval',
              visibleWhen: { key: 'opt.watermarkVisible', truthy: true },
            },
          ],
        },
      ],
    },
    {
      id: 'canvas',
      label: 'Canvas',
      groups: [
        {
          id: 'volume',
          label: 'Volume',
          fields: [
            { kind: 'boolean', key: 'opt.volumeVisible', label: 'Show volume pane' },
            { kind: 'color', key: 'theme.volumeUp', label: 'Up', inline: true },
            { kind: 'color', key: 'theme.volumeDown', label: 'Down', inline: true },
            {
              kind: 'number',
              key: 'opt.volumePaneRatio',
              label: 'Pane height',
              min: 0.08,
              max: 0.5,
              step: 0.01,
              visibleWhen: { key: 'opt.volumeVisible', truthy: true },
            },
          ],
        },
        {
          id: 'margins',
          label: 'Margins',
          fields: [
            {
              kind: 'number',
              key: 'opt.marginTop',
              label: 'Top',
              min: 0,
              max: 40,
              step: 1,
              unit: '%',
            },
            {
              kind: 'number',
              key: 'opt.marginBottom',
              label: 'Bottom',
              min: 0,
              max: 40,
              step: 1,
              unit: '%',
            },
            {
              kind: 'number',
              key: 'opt.rightMargin',
              label: 'Right',
              min: 0,
              max: 200,
              step: 1,
              unit: 'bars',
            },
          ],
        },
        {
          id: 'rendering',
          label: 'Rendering',
          fields: [{ kind: 'boolean', key: 'opt.hiDpi', label: 'High-DPI (retina) rendering' }],
        },
      ],
    },
  ],
};
