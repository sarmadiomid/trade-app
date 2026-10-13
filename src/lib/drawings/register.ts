import { drawingRegistry } from './framework/registry';
import { crossLineTool } from './tools/cross-line';
import { curveTool } from './tools/curve';
import { extendedLineTool } from './tools/extended-line';
import { fibRetracementTool } from './tools/fib-retracement';
import { highlighterTool } from './tools/highlighter';
import { horizontalLineTool } from './tools/horizontal-line';
import { horizontalRayTool } from './tools/horizontal-ray';
import { longPositionTool } from './tools/long-position';
import { parallelChannelTool } from './tools/parallel-channel';
import { pathTool } from './tools/path';
import { rayTool } from './tools/ray';
import { rectangleTool } from './tools/rectangle';
import { shortPositionTool } from './tools/short-position';
import { textTool } from './tools/text';
import { trendLineTool } from './tools/trend-line';
import { verticalLineTool } from './tools/vertical-line';
import { fixedRangeVolumeProfileTool } from './tools/volume-profile';

/**
 * The single place where drawing tools are registered. Order = toolbar order.
 * To add a tool: create tools/<name>/ (see tools/_template) and add one line here.
 */
drawingRegistry
  .register(trendLineTool)
  .register(rayTool)
  .register(extendedLineTool)
  .register(horizontalLineTool)
  .register(horizontalRayTool)
  .register(verticalLineTool)
  .register(crossLineTool)
  .register(parallelChannelTool)
  .register(fibRetracementTool)
  .register(rectangleTool)
  .register(pathTool)
  .register(curveTool)
  .register(textTool)
  .register(highlighterTool)
  .register(longPositionTool)
  .register(shortPositionTool)
  .register(fixedRangeVolumeProfileTool);
