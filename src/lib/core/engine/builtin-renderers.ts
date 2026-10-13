import type { LayerManager } from '../render/layer-manager';
import { backgroundRenderer } from '../render/renderers/background';
import { crosshairRenderer } from '../render/renderers/crosshair';
import { gridRenderer } from '../render/renderers/grid';
import { priceAxisRenderer } from '../render/renderers/price-axis';
import { priceLinesRenderer } from '../render/renderers/price-lines';
import { timeAxisRenderer } from '../render/renderers/time-axis';
import { volumeRenderer } from '../render/renderers/volume';

/** Wires the core renderers into their layers. The engine adds the active series itself. */
export function registerBuiltInRenderers(layers: LayerManager): void {
  layers.add('background', backgroundRenderer);
  layers.add('background', gridRenderer);
  layers.add('series', volumeRenderer);
  layers.add('series', priceLinesRenderer);
  layers.add('axes', priceAxisRenderer);
  layers.add('axes', timeAxisRenderer);
  layers.add('overlay', crosshairRenderer);
}
