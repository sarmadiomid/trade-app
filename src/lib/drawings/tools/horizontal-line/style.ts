import { z } from 'zod';
import {
  DEFAULT_FONT_FAMILY,
  zColor,
  zFontFamily,
  zFontSize,
  zHAlign,
  zLineStyle,
  zLineWidth,
  zOpacity,
  zVAlign,
} from '../../framework';

export const horizontalLineStyleSchema = z.object({
  color: zColor,
  opacity: zOpacity,
  lineWidth: zLineWidth,
  lineStyle: zLineStyle,
  showPrice: z.boolean(),
  text: z.string().max(2000),
  textColor: zColor,
  fontSize: zFontSize,
  fontFamily: zFontFamily,
  bold: z.boolean(),
  italic: z.boolean(),
  textAlign: zHAlign,
  textPosition: zVAlign,
});

export type HorizontalLineStyle = z.infer<typeof horizontalLineStyleSchema>;

export const HORIZONTAL_LINE_DEFAULTS: HorizontalLineStyle = {
  color: '#2962ff',
  opacity: 1,
  lineWidth: 1,
  lineStyle: 'solid',
  showPrice: true,
  text: '',
  textColor: '#2962ff',
  fontSize: 14,
  fontFamily: DEFAULT_FONT_FAMILY,
  bold: false,
  italic: false,
  textAlign: 'right',
  textPosition: 'top',
};
