/**
 * Example usage of LayerManager for organizing building elements
 * This demonstrates the complete layer workflow
 */

import { getLayerManager } from '@framing/LayerManager';
import { LayerType } from '@framing/Layer';
import { eventBus, Events } from '@core/EventBus';
import { logger } from '@utils/Logger';

/**
 * Example 1: Basic layer operations
 */
export function exampleBasicLayerOperations(): void {
  logger.info('LayerExample', 'Running basic layer operations example');

  const layerManager = getLayerManager();

  // Get a standard layer
  const exteriorLayer = layerManager.getLayer('A-WALL-EXTR');
  if (exteriorLayer) {
    logger.info('LayerExample', `Found layer: ${exteriorLayer.name}`);
    logger.info('LayerExample', `Color: ${exteriorLayer.getColorHex()}`);
    logger.info('LayerExample', `Visible: ${exteriorLayer.visible}`);
    logger.info('LayerExample', `Locked: ${exteriorLayer.locked}`);
  }

  // Toggle visibility
  layerManager.hideLayer('A-WALL-INTR');
  logger.info('LayerExample', 'Hidden interior walls layer');

  layerManager.showLayer('A-WALL-INTR');
  logger.info('LayerExample', 'Shown interior walls layer');

  // Lock a layer
  layerManager.lockLayer('A-WALL-STRC');
  logger.info('LayerExample', 'Locked structural walls layer');
}

/**
 * Example 2: Creating custom layers
 */
export function exampleCustomLayers(): void {
  logger.info('LayerExample', 'Running custom layers example');

  const layerManager = getLayerManager();

  // Create a custom mechanical layer
  const mechanicalLayer = layerManager.addLayer({
    id: 'M-HVAC',
    name: 'HVAC Systems',
    type: LayerType.EQUIPMENT,
    color: 0x00FFFF, // Cyan
    description: 'HVAC equipment and ductwork',
    lineWeight: 0.75,
    visible: true,
    locked: false,
  });

  logger.info('LayerExample', `Created custom layer: ${mechanicalLayer.name}`);

  // Create a custom electrical layer
  const electricalLayer = layerManager.addLayer({
    id: 'E-LITE',
    name: 'Lighting',
    type: LayerType.EQUIPMENT,
    color: 0xFFFF00, // Yellow
    description: 'Lighting fixtures and switches',
    lineWeight: 0.5,
  });

  logger.info('LayerExample', `Created custom layer: ${electricalLayer.name}`);
}

/**
 * Example 3: Layer filtering and queries
 */
export function exampleLayerFiltering(): void {
  logger.info('LayerExample', 'Running layer filtering example');

  const layerManager = getLayerManager();

  // Get all visible layers
  const visibleLayers = layerManager.getLayersByFilter({ visible: true });
  logger.info('LayerExample', `Found ${visibleLayers.length} visible layers`);

  // Get all unlocked layers
  const unlockedLayers = layerManager.getLayersByFilter({ locked: false });
  logger.info('LayerExample', `Found ${unlockedLayers.length} unlocked layers`);

  // Search layers by name
  const wallLayers = layerManager.searchLayers('wall');
  logger.info('LayerExample', `Found ${wallLayers.length} wall-related layers`);
  wallLayers.forEach(layer => {
    logger.info('LayerExample', `  - ${layer.name} (${layer.id})`);
  });

  // Get layers by type
  const layersByType = layerManager.getLayersByType();
  logger.info('LayerExample', `Layers grouped by ${layersByType.size} types`);
  layersByType.forEach((layers, type) => {
    logger.info('LayerExample', `  ${type}: ${layers.length} layers`);
  });
}

/**
 * Example 4: Element assignment
 */
export function exampleElementAssignment(): void {
  logger.info('LayerExample', 'Running element assignment example');

  const layerManager = getLayerManager();

  // Simulate creating some elements
  const wall1Id = 'wall-001';
  const wall2Id = 'wall-002';
  const door1Id = 'door-001';
  const window1Id = 'window-001';

  // Assign elements to layers
  layerManager.assignElementToLayer(wall1Id, 'A-WALL-EXTR');
  layerManager.assignElementToLayer(wall2Id, 'A-WALL-INTR');
  layerManager.assignElementToLayer(door1Id, 'A-DOOR');
  layerManager.assignElementToLayer(window1Id, 'A-WIND');

  logger.info('LayerExample', 'Assigned elements to layers');

  // Get elements on a layer
  const exteriorElements = layerManager.getElementsOnLayer('A-WALL-EXTR');
  logger.info('LayerExample', `Exterior walls layer has ${exteriorElements.length} elements`);

  // Get layer for an element
  const wall1Layer = layerManager.getElementLayer(wall1Id);
  logger.info('LayerExample', `Element ${wall1Id} is on layer: ${wall1Layer}`);

  // Show layer statistics
  const stats = layerManager.getStatistics();
  logger.info('LayerExample', 'Layer Statistics:');
  logger.info('LayerExample', `  Total layers: ${stats.totalLayers}`);
  logger.info('LayerExample', `  Visible layers: ${stats.visibleLayers}`);
  logger.info('LayerExample', `  Locked layers: ${stats.lockedLayers}`);
  logger.info('LayerExample', `  Layers with elements: ${stats.layersWithElements}`);
  logger.info('LayerExample', `  Total elements: ${stats.totalElements}`);
}

/**
 * Example 5: Event handling
 */
export function exampleLayerEvents(): void {
  logger.info('LayerExample', 'Running layer events example');

  // Subscribe to layer events
  const unsubscribeAdded = eventBus.on(Events.LAYER_ADDED, ({ layer }) => {
    logger.info('LayerExample', `Event: Layer added - ${layer.name}`);
  });

  const unsubscribeVisibility = eventBus.on(Events.LAYER_VISIBILITY_CHANGED, ({ layerId, visible }) => {
    logger.info('LayerExample', `Event: Layer ${layerId} visibility changed to ${visible}`);
  });

  const unsubscribeLocked = eventBus.on(Events.LAYER_LOCKED_CHANGED, ({ layerId, locked }) => {
    logger.info('LayerExample', `Event: Layer ${layerId} locked state changed to ${locked}`);
  });

  const layerManager = getLayerManager();

  // Trigger some events
  layerManager.addLayer({
    id: 'TEST-LAYER',
    name: 'Test Layer',
    type: LayerType.CUSTOM,
    color: 0xFF00FF,
  });

  layerManager.hideLayer('TEST-LAYER');
  layerManager.lockLayer('TEST-LAYER');

  // Cleanup
  unsubscribeAdded();
  unsubscribeVisibility();
  unsubscribeLocked();

  logger.info('LayerExample', 'Event handlers unsubscribed');
}

/**
 * Example 6: Import/Export
 */
export function exampleImportExport(): void {
  logger.info('LayerExample', 'Running import/export example');

  const layerManager = getLayerManager();

  // Export current configuration
  const config = layerManager.exportConfiguration();
  logger.info('LayerExample', 'Exported layer configuration');
  logger.info('LayerExample', `  Version: ${config.version}`);
  logger.info('LayerExample', `  Timestamp: ${config.timestamp}`);
  logger.info('LayerExample', `  Current layer: ${config.currentLayerId}`);
  logger.info('LayerExample', `  Total layers: ${config.layers.length}`);

  // In a real application, you would save this to a file
  const configJSON = JSON.stringify(config, null, 2);
  logger.info('LayerExample', `Configuration JSON size: ${configJSON.length} bytes`);

  // Import would look like this:
  // const loadedConfig = JSON.parse(configJSON);
  // layerManager.importConfiguration(loadedConfig, false);
}

/**
 * Example 7: Layer cloning
 */
export function exampleLayerCloning(): void {
  logger.info('LayerExample', 'Running layer cloning example');

  const layerManager = getLayerManager();

  // Clone the exterior walls layer with modifications
  const customExterior = layerManager.cloneLayer(
    'A-WALL-EXTR',
    'A-WALL-EXTR-CUSTOM',
    {
      name: 'Custom Exterior Walls',
      color: 0xFF8C00, // Dark orange
      description: 'Custom exterior wall construction',
    }
  );

  if (customExterior) {
    logger.info('LayerExample', `Cloned layer: ${customExterior.name}`);
    logger.info('LayerExample', `  ID: ${customExterior.id}`);
    logger.info('LayerExample', `  Color: ${customExterior.getColorHex()}`);
    logger.info('LayerExample', `  Description: ${customExterior.description}`);
  }
}

/**
 * Example 8: Current layer workflow
 */
export function exampleCurrentLayer(): void {
  logger.info('LayerExample', 'Running current layer workflow example');

  const layerManager = getLayerManager();

  // Get current layer
  const currentLayer = layerManager.getCurrentLayer();
  logger.info('LayerExample', `Current layer: ${currentLayer.name} (${currentLayer.id})`);

  // Set a different current layer
  layerManager.setCurrentLayer('A-WALL-EXTR');
  const newCurrent = layerManager.getCurrentLayer();
  logger.info('LayerExample', `New current layer: ${newCurrent.name} (${newCurrent.id})`);

  // In a real application, new elements would be assigned to the current layer by default
  const newElementId = 'wall-new-001';
  layerManager.assignElementToLayer(newElementId, newCurrent.id);
  logger.info('LayerExample', `Assigned new element to current layer: ${newCurrent.name}`);
}

/**
 * Run all examples
 */
export function runAllLayerExamples(): void {
  logger.info('LayerExample', '=== Running all LayerManager examples ===');

  try {
    exampleBasicLayerOperations();
    exampleCustomLayers();
    exampleLayerFiltering();
    exampleElementAssignment();
    exampleLayerEvents();
    exampleImportExport();
    exampleLayerCloning();
    exampleCurrentLayer();

    logger.info('LayerExample', '=== All examples completed successfully ===');
  } catch (error) {
    logger.error('LayerExample', 'Error running examples', error);
  }
}

// Export for testing
export default {
  exampleBasicLayerOperations,
  exampleCustomLayers,
  exampleLayerFiltering,
  exampleElementAssignment,
  exampleLayerEvents,
  exampleImportExport,
  exampleLayerCloning,
  exampleCurrentLayer,
  runAllLayerExamples,
};
