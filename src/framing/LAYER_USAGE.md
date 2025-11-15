# LayerManager Usage Guide

This guide demonstrates how to use the LayerManager system in NEOcad for organizing building elements.

## Overview

The LayerManager system provides a hierarchical organization structure similar to AutoCAD/Revit layers:
- **Layer**: Represents a drawing layer with properties like visibility, color, and lock state
- **LayerManager**: Singleton manager for creating, organizing, and controlling layers
- **LayerType**: Predefined layer types following AIA CAD Layer Guidelines

## Standard Layers

The LayerManager initializes with these standard architectural layers:

| Layer ID | Name | Color | Description |
|----------|------|-------|-------------|
| A-WALL-EXTR | Exterior Walls | 0x8B7355 (Brown) | Exterior building walls |
| A-WALL-INTR | Interior Walls | 0xCCCCCC (Light gray) | Interior partition walls |
| A-WALL-STRC | Structural Walls | 0xAAAAAA (Medium gray) | Load-bearing structural walls |
| A-WALL-PART | Partitions | 0xDDDDDD (Very light gray) | Non-structural partition walls |
| A-DOOR | Doors | 0x8B4513 (Saddle brown) | Door elements |
| A-WIND | Windows | 0x87CEEB (Sky blue) | Window elements |
| A-COLS | Columns | 0x696969 (Dim gray) | Structural columns |
| A-FLOR | Floors | 0xD2B48C (Tan) | Floor elements |
| A-CLNG | Ceilings | 0xF5F5DC (Beige) | Ceiling elements |
| A-ROOF | Roof | 0x8B0000 (Dark red) | Roof elements |
| A-STRS | Stairs | 0x556B2F (Dark olive green) | Stair elements |
| A-FURN | Furniture | 0xDDA0DD (Plum) | Furniture elements |
| A-EQUP | Equipment | 0xFF6347 (Tomato) | Equipment and fixtures |
| A-ANNO | Annotations | 0x000000 (Black) | Text annotations and labels |
| A-DIMS | Dimensions | 0xFF0000 (Red) | Dimension lines and text |
| A-GRID | Grid | 0x00FF00 (Green) | Reference grid lines |

## Basic Usage

### Getting the LayerManager Instance

```typescript
import { getLayerManager } from '@framing/LayerManager';

const layerManager = getLayerManager();
```

### Working with Layers

#### Get a Layer

```typescript
const exteriorLayer = layerManager.getLayer('A-WALL-EXTR');
if (exteriorLayer) {
  console.log(`Layer: ${exteriorLayer.name}`);
  console.log(`Color: ${exteriorLayer.getColorHex()}`);
  console.log(`Visible: ${exteriorLayer.visible}`);
  console.log(`Locked: ${exteriorLayer.locked}`);
}
```

#### Show/Hide Layers

```typescript
// Hide a specific layer
layerManager.hideLayer('A-WALL-INTR');

// Show a layer
layerManager.showLayer('A-WALL-INTR');

// Toggle visibility
layerManager.toggleLayerVisibility('A-WALL-INTR');

// Hide all layers
layerManager.hideAllLayers();

// Show all layers
layerManager.showAllLayers();
```

#### Lock/Unlock Layers

```typescript
// Lock a layer (prevent modifications)
layerManager.lockLayer('A-WALL-STRC');

// Unlock a layer
layerManager.unlockLayer('A-WALL-STRC');

// Toggle lock state
layerManager.toggleLayerLock('A-WALL-STRC');

// Unlock all layers
layerManager.unlockAllLayers();
```

### Creating Custom Layers

```typescript
import { LayerType } from '@framing/Layer';

const customLayer = layerManager.addLayer({
  id: 'A-WALL-CUSTOM',
  name: 'Custom Walls',
  type: LayerType.CUSTOM,
  color: 0xFF00FF, // Magenta
  description: 'Custom wall type for special construction',
  lineWeight: 1.2,
  visible: true,
  locked: false,
});
```

### Assigning Elements to Layers

```typescript
// Create a wall with layer assignment
import { ParametricWall } from '@parametric/ParametricWall';
import * as THREE from 'three';

const wall = new ParametricWall(parameterEngine, geometryEngine, {
  startPoint: new THREE.Vector3(0, 0, 0),
  endPoint: new THREE.Vector3(5000, 0, 0),
  layerId: 'A-WALL-EXTR', // Assign to exterior walls layer
});

// Or set the layer after creation
wall.setLayer('A-WALL-INTR');

// Get the wall's layer
const layerId = wall.getLayer();

// Register the element with the layer manager
layerManager.assignElementToLayer(wall.id, 'A-WALL-EXTR');
```

### Querying Layers

#### Get All Layers

```typescript
const allLayers = layerManager.getAllLayers();
allLayers.forEach(layer => {
  console.log(`${layer.name}: ${layer.getElementCount()} elements`);
});
```

#### Filter Layers

```typescript
// Get all visible layers
const visibleLayers = layerManager.getLayersByFilter({ visible: true });

// Get all unlocked layers
const unlockedLayers = layerManager.getLayersByFilter({ locked: false });

// Get all layers with elements
const layersWithElements = layerManager.getLayersByFilter({ hasElements: true });

// Get all exterior wall layers
import { LayerType } from '@framing/Layer';
const exteriorLayers = layerManager.getLayersByFilter({
  type: LayerType.EXTERIOR_WALLS
});
```

#### Search Layers

```typescript
// Search by name or description
const searchResults = layerManager.searchLayers('wall');
```

#### Get Layers by Type

```typescript
const layersByType = layerManager.getLayersByType();
layersByType.forEach((layers, type) => {
  console.log(`${type}: ${layers.length} layers`);
});
```

### Managing Layer Elements

```typescript
// Get all elements on a layer
const elementIds = layerManager.getElementsOnLayer('A-WALL-EXTR');

// Get which layer an element is on
const elementLayerId = layerManager.getElementLayer('wall-123');

// Remove element from all layers
layerManager.removeElement('wall-123');
```

### Current Layer

```typescript
// Get the current active layer
const currentLayer = layerManager.getCurrentLayer();

// Set the current layer
layerManager.setCurrentLayer('A-WALL-EXTR');
```

### Layer Statistics

```typescript
const stats = layerManager.getStatistics();
console.log(`Total layers: ${stats.totalLayers}`);
console.log(`Visible layers: ${stats.visibleLayers}`);
console.log(`Locked layers: ${stats.lockedLayers}`);
console.log(`Layers with elements: ${stats.layersWithElements}`);
console.log(`Total elements: ${stats.totalElements}`);

stats.byType.forEach((count, type) => {
  console.log(`${type}: ${count} layers`);
});
```

## Import/Export

### Export Layer Configuration

```typescript
const config = layerManager.exportConfiguration();

// Save to file
const json = JSON.stringify(config, null, 2);
// ... save json to file
```

### Import Layer Configuration

```typescript
// Load from file
const config = JSON.parse(jsonString);

// Import (merge with existing)
layerManager.importConfiguration(config, false);

// Import (replace all existing layers)
layerManager.importConfiguration(config, true);
```

## Event Handling

The LayerManager emits events that you can listen to:

```typescript
import { eventBus, Events } from '@core/EventBus';

// Layer added
eventBus.on(Events.LAYER_ADDED, ({ layer }) => {
  console.log(`Layer added: ${layer.name}`);
});

// Layer removed
eventBus.on(Events.LAYER_REMOVED, ({ layer }) => {
  console.log(`Layer removed: ${layer.name}`);
});

// Layer visibility changed
eventBus.on(Events.LAYER_VISIBILITY_CHANGED, ({ layerId, visible }) => {
  console.log(`Layer ${layerId} visibility: ${visible}`);
});

// Layer locked state changed
eventBus.on(Events.LAYER_LOCKED_CHANGED, ({ layerId, locked }) => {
  console.log(`Layer ${layerId} locked: ${locked}`);
});
```

## Integration with ParametricWall

```typescript
import { ParametricWall } from '@parametric/ParametricWall';
import { getLayerManager } from '@framing/LayerManager';
import { getWallTypeManager } from '@framing/WallTypeManager';
import * as THREE from 'three';

// Get managers
const layerManager = getLayerManager();
const wallTypeManager = getWallTypeManager();

// Get wall type
const exteriorWallType = wallTypeManager.getWallType('2x4-exterior-standard');

// Create wall with layer assignment
const wall = new ParametricWall(parameterEngine, geometryEngine, {
  startPoint: new THREE.Vector3(0, 0, 0),
  endPoint: new THREE.Vector3(5000, 0, 0),
  wallType: exteriorWallType,
  layerId: 'A-WALL-EXTR', // Assign to exterior walls layer
});

// Register with layer manager
layerManager.assignElementToLayer(wall.id, wall.getLayer()!);

// The wall will be serialized with layer information
const wallData = wall.toJSON();
console.log(`Wall layer: ${wallData.layerId}`);

// When deserializing, the layer is restored
const restoredWall = ParametricWall.fromJSON(
  wallData,
  parameterEngine,
  geometryEngine,
  wallTypeManager
);
console.log(`Restored wall layer: ${restoredWall.getLayer()}`);
```

## Best Practices

1. **Use Standard Layers**: Stick to the predefined layer types when possible for consistency
2. **Layer Naming**: Follow AIA CAD Layer Guidelines (Discipline-Type-Subtype)
3. **Lock Layers**: Lock layers that shouldn't be modified to prevent accidental changes
4. **Hide Layers**: Hide layers that aren't needed for the current view to improve performance
5. **Element Assignment**: Always assign elements to appropriate layers for better organization
6. **Event Listeners**: Use event listeners to keep UI in sync with layer state changes

## Advanced Usage

### Clone a Layer

```typescript
const clonedLayer = layerManager.cloneLayer(
  'A-WALL-EXTR',
  'A-WALL-EXTR-CUSTOM',
  {
    name: 'Custom Exterior Walls',
    color: 0xFF8C00, // Dark orange
  }
);
```

### Remove a Layer

```typescript
// Can only remove layers with no elements and not the current layer
const removed = layerManager.removeLayer('A-WALL-CUSTOM');
if (!removed) {
  console.log('Could not remove layer (has elements or is current layer)');
}
```

### Reset to Defaults

```typescript
// Reset to default layers only (clears all custom layers)
layerManager.reset();
```

## See Also

- [WallTypeManager Usage](./WALLTYPE_USAGE.md)
- [AppearanceManager Usage](./APPEARANCE_USAGE.md)
- [ParametricWall Documentation](../parametric/ParametricWall.ts)
