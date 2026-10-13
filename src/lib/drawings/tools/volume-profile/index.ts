import type { DrawingToolDefinition } from '../../framework';
import { lineFields } from '../../framework';
import { VOLUME_PROFILE_DEFAULTS, volumeProfileStyleSchema, type VolumeProfileStyle } from './style';
import { FixedRangeVolumeProfile } from './volume-profile';

export { computeVolumeProfile, type VolumeProfile } from './profile-math';

const whenValueArea = { key: 'showValueArea', truthy: true } as const;
const whenPoc = { key: 'showPoc', truthy: true } as const;

export const fixedRangeVolumeProfileTool: DrawingToolDefinition<VolumeProfileStyle> = {
  id: 'fixed-range-volume-profile',
  label: 'Fixed Range Volume Profile',
  icon: 'M4 3v18M20 3v18M4 6h9M4 9h12M4 12h14M4 15h8M4 18h5',
  group: 'forecasting',
  placement: { kind: 'points', count: 2 },
  defaults: VOLUME_PROFILE_DEFAULTS,
  styleSchema: volumeProfileStyleSchema,
  toolbar: ['upColor', 'downColor', 'pocColor'],
  pointLabels: ['Start', 'End'],
  coordinateFields: [['time'], ['time']],
  settings: {
    tabs: [
      {
        id: 'inputs',
        label: 'Inputs',
        groups: [
          {
            id: 'inputs',
            fields: [
              { kind: 'number', key: 'rows', label: 'Number of rows', min: 1, max: 500, step: 1 },
              {
                kind: 'select',
                key: 'volumeMode',
                label: 'Volume',
                options: [
                  { value: 'updown', label: 'Up/Down' },
                  { value: 'total', label: 'Total' },
                  { value: 'delta', label: 'Delta' },
                ],
              },
              {
                kind: 'number',
                key: 'valueAreaPercent',
                label: 'Value area volume',
                min: 1,
                max: 100,
                step: 1,
                unit: '%',
              },
            ],
          },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        groups: [
          {
            id: 'histogram',
            label: 'Volume profile',
            fields: [
              {
                kind: 'number',
                key: 'widthPercent',
                label: 'Width (% of the box)',
                min: 1,
                max: 100,
                step: 1,
              },
              {
                kind: 'select',
                key: 'placement',
                label: 'Placement',
                options: [
                  { value: 'left', label: 'Left' },
                  { value: 'right', label: 'Right' },
                ],
              },
              { kind: 'color', key: 'upColor', label: 'Up volume', opacityKey: 'upOpacity' },
              { kind: 'color', key: 'downColor', label: 'Down volume', opacityKey: 'downOpacity' },
              {
                kind: 'color',
                key: 'vaUpColor',
                label: 'Value area up',
                opacityKey: 'vaUpOpacity',
              },
              {
                kind: 'color',
                key: 'vaDownColor',
                label: 'Value area down',
                opacityKey: 'vaDownOpacity',
              },
            ],
          },
          {
            id: 'poc',
            label: 'POC',
            fields: [
              { kind: 'boolean', key: 'showPoc', label: 'POC' },
              ...lineFields({
                color: 'pocColor',
                opacity: 'pocOpacity',
                width: 'pocWidth',
                style: 'pocStyle',
              }).map((f) => ({ ...f, visibleWhen: whenPoc })),
              { kind: 'boolean', key: 'extendPoc', label: 'Extend POC right', visibleWhen: whenPoc },
            ],
          },
          {
            id: 'value-area',
            label: 'Value area',
            fields: [
              { kind: 'boolean', key: 'showValueArea', label: 'Value area lines' },
              ...lineFields({
                color: 'vahColor',
                opacity: 'vahOpacity',
                width: 'vahWidth',
                style: 'vahStyle',
                label: 'VAH',
              }).map((f) => ({ ...f, visibleWhen: whenValueArea })),
              ...lineFields({
                color: 'valColor',
                opacity: 'valOpacity',
                width: 'valWidth',
                style: 'valStyle',
                label: 'VAL',
              }).map((f) => ({ ...f, visibleWhen: whenValueArea })),
            ],
          },
          {
            id: 'background',
            label: 'Background',
            fields: [
              { kind: 'boolean', key: 'showBackground', label: 'Background' },
              {
                kind: 'color',
                key: 'backgroundColor',
                label: 'Fill',
                opacityKey: 'backgroundOpacity',
                inline: true,
              },
            ],
          },
        ],
      },
    ],
  },
  create: (init) => new FixedRangeVolumeProfile('fixed-range-volume-profile', init),
};
