import { describe, expect, it } from 'vitest';
import {
  stepsFromDrag,
  timeframeBySteps,
  timeframeWindow,
} from '@/components/chart/mobile/timeframe-step';

describe('timeframe drag', () => {
  it('ignores a drag shorter than one step', () => {
    expect(stepsFromDrag(0)).toBe(0);
    expect(stepsFromDrag(27)).toBe(0);
    expect(stepsFromDrag(-27)).toBe(0);
  });

  it('moves up the list when the finger moves up', () => {
    expect(stepsFromDrag(-28)).toBe(1);
    expect(stepsFromDrag(-56)).toBe(2);
    expect(stepsFromDrag(28)).toBe(-1);
  });

  it('clamps at the ends of the timeframe list', () => {
    expect(timeframeBySteps('1m', -3)).toBe('1m');
    expect(timeframeBySteps('1M', 4)).toBe('1M');
    expect(timeframeBySteps('15m', 1)).toBe('30m');
    expect(timeframeBySteps('15m', -1)).toBe('5m');
  });

  it('shows the previous and next interval around the active one', () => {
    expect(timeframeWindow('15m')).toEqual(['5m', '15m', '30m']);
    expect(timeframeWindow('1m')).toEqual([null, '1m', '3m']);
    expect(timeframeWindow('1M')).toEqual(['1W', '1M', null]);
  });
});
