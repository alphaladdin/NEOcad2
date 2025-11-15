# AppearanceManager Usage Guide

This guide demonstrates how to use the AppearanceManager system to manage visual styles and rendering settings for building elements in NEOcad.

## Table of Contents
1. [Basic Usage](#basic-usage)
2. [Creating Custom Styles](#creating-custom-styles)
3. [Applying Styles](#applying-styles)
4. [Using with ParametricWall](#using-with-parametricwall)
5. [Batch Operations](#batch-operations)
6. [Import/Export](#importexport)
7. [Helper Functions](#helper-functions)

## Basic Usage

### Getting the AppearanceManager Instance

```typescript
import { getAppearanceManager } from '@framing/AppearanceManager';

const appearanceManager = getAppearanceManager();
```

### Using Pre-configured Styles

The AppearanceManager comes with several standard styles:

```typescript
// Get all available styles
const allStyles = appearanceManager.getAllStyles();

// Get a specific style
const defaultStyle = appearanceManager.getStyle('default');
const constructionStyle = appearanceManager.getStyle('construction');
const presentationStyle = appearanceManager.getStyle('presentation');
const schematicStyle = appearanceManager.getStyle('schematic');
const hiddenLineStyle = appearanceManager.getStyle('hidden-line');
const wireframeStyle = appearanceManager.getStyle('wireframe');
const xrayStyle = appearanceManager.getStyle('xray');
```

## Creating Custom Styles

### Create a Basic Custom Style

```typescript
import { DisplayMode } from '@framing/AppearanceStyle';
import * as THREE from 'three';

const customStyle = appearanceManager.addStyle({
  id: 'custom-blue',
  name: 'Custom Blue Style',
  description: 'A custom blue appearance for structural elements',
  materialSettings: {
    color: new THREE.Color(0x0066cc),
    opacity: 1.0,
    metalness: 0.2,
    roughness: 0.6,
    transparent: false,
  },
  lineWeight: 1.5,
  lineColor: new THREE.Color(0x003366),
  displayMode: DisplayMode.SOLID,
  showDimensions: true,
  showLabels: true,
});
```

### Clone and Modify an Existing Style

```typescript
const redVariant = appearanceManager.cloneStyle(
  'default',
  'red-variant',
  {
    name: 'Red Variant',
    materialSettings: {
      color: new THREE.Color(0xff0000),
      opacity: 0.8,
      metalness: 0.1,
      roughness: 0.7,
      transparent: true,
    },
  }
);
```

## Applying Styles

### Apply to a Single Mesh

```typescript
import * as THREE from 'three';

const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial()
);

// Method 1: Using AppearanceManager
appearanceManager.applyStyleToMesh(mesh, 'construction');

// Method 2: Using the style directly
const style = appearanceManager.getStyle('presentation');
if (style) {
  style.applyToMesh(mesh);
}
```

### Apply to Multiple Meshes

```typescript
const meshes: THREE.Mesh[] = [mesh1, mesh2, mesh3];
const count = appearanceManager.applyStyleToMeshes(meshes, 'schematic');
console.log(`Applied style to ${count} meshes`);
```

### Apply to Entire Scene

```typescript
const scene = new THREE.Scene();
// ... add objects to scene ...

const count = appearanceManager.applyStyleToScene(scene, 'hidden-line');
console.log(`Applied style to ${count} meshes in scene`);
```

## Using with ParametricWall

### Create a Wall with Appearance Style

```typescript
import { ParametricWall } from '@parametric/ParametricWall';
import { ParameterEngine } from '@parametric/ParameterEngine';
import { GeometryEngineWrapper } from '@parametric/GeometryEngineWrapper';
import * as THREE from 'three';

const paramEngine = new ParameterEngine();
const geometryEngine = new GeometryEngineWrapper();

const wall = new ParametricWall(paramEngine, geometryEngine, {
  startPoint: new THREE.Vector3(0, 0, 0),
  endPoint: new THREE.Vector3(5000, 0, 0),
  appearanceStyleId: 'construction',
});
```

### Change Wall Appearance

```typescript
// Get the style
const style = appearanceManager.getStyle('presentation');

if (style && wall.mesh) {
  // Apply the style to the wall
  wall.applyAppearanceStyle(style);
}
```

### Get Current Style

```typescript
const currentStyleId = wall.getAppearanceStyleId();
console.log(`Wall is using style: ${currentStyleId}`);
```

## Batch Operations

### Apply Different Styles to Different Groups

```typescript
import { batchApplyStyles } from '@framing/AppearanceHelpers';

const styleMap = new Map<string, THREE.Object3D[]>();
styleMap.set('construction', [wall1, wall2, wall3]);
styleMap.set('presentation', [floor, ceiling]);
styleMap.set('xray', [columns]);

const results = batchApplyStyles(styleMap);
console.log('Applied styles:', results);
```

### Apply Style by Object Name Pattern

```typescript
import { applyStyleByName } from '@framing/AppearanceHelpers';

const count = applyStyleByName(
  scene,
  /^wall_/,  // Regex pattern matching object names
  'construction'
);
console.log(`Applied style to ${count} walls`);
```

### Apply Style by Material Type

```typescript
import { applyStyleByMaterialType } from '@framing/AppearanceHelpers';

const count = applyStyleByMaterialType(
  scene,
  'standard',  // Material type
  'presentation'
);
console.log(`Applied style to ${count} meshes with standard material`);
```

## Import/Export

### Export All Styles

```typescript
const libraryData = appearanceManager.exportLibrary();

// Save to file (example using localStorage or file system)
localStorage.setItem('appearance-library', JSON.stringify(libraryData));
```

### Import Styles

```typescript
const libraryData = JSON.parse(localStorage.getItem('appearance-library'));

// Replace existing styles
appearanceManager.importLibrary(libraryData, true);

// Or merge with existing styles
appearanceManager.importLibrary(libraryData, false);
```

### Export Single Style

```typescript
const styleData = appearanceManager.exportStyle('custom-blue');
```

### Import Single Style

```typescript
const style = appearanceManager.importStyle(styleData);
```

### Save/Load Appearance Presets

```typescript
import { saveAppearancePreset, loadAppearancePreset } from '@framing/AppearanceHelpers';

// Save a preset with selected styles
const preset = saveAppearancePreset(
  ['construction', 'presentation', 'schematic'],
  'My Favorite Styles'
);

// Save to file
localStorage.setItem('preset-favorites', JSON.stringify(preset));

// Load preset
const loadedPreset = JSON.parse(localStorage.getItem('preset-favorites'));
const styles = loadAppearancePreset(loadedPreset);
console.log(`Loaded ${styles.length} styles from preset`);
```

## Helper Functions

### Convert Material to Settings

```typescript
import { materialToSettings } from '@framing/AppearanceHelpers';

const material = new THREE.MeshStandardMaterial({
  color: 0xff0000,
  metalness: 0.5,
  roughness: 0.3,
});

const settings = materialToSettings(material);
console.log('Material settings:', settings);
```

### Convert Settings to Material

```typescript
import { settingsToMaterial } from '@framing/AppearanceHelpers';

const material = settingsToMaterial(settings, 'standard');
mesh.material = material;
```

### Create Style from Scene Materials

```typescript
import { createStylesFromScene } from '@framing/AppearanceHelpers';

// Automatically create styles from all unique materials in the scene
const styles = createStylesFromScene(scene, 'imported-style');
console.log(`Created ${styles.length} styles from scene`);
```

### Interpolate Between Styles

```typescript
import { interpolateStyles } from '@framing/AppearanceHelpers';

const styleA = appearanceManager.getStyle('construction');
const styleB = appearanceManager.getStyle('presentation');

// Create a style that's 50% between styleA and styleB
const interpolated = interpolateStyles(
  styleA,
  styleB,
  0.5,  // Interpolation factor (0-1)
  'interpolated-style',
  'Interpolated Style'
);

appearanceManager.addStyle(interpolated.toJSON());
```

### Create Material Preview

```typescript
import { createStylePreview } from '@framing/AppearanceHelpers';

const style = appearanceManager.getStyle('presentation');
const previewMesh = createStylePreview(
  style,
  1.0,  // Size
  new THREE.Vector3(0, 0, 0)  // Position
);

scene.add(previewMesh);
```

### Reset Scene Materials

```typescript
import { resetSceneMaterials } from '@framing/AppearanceHelpers';

// Reset all materials in scene to default style
const count = resetSceneMaterials(scene);
console.log(`Reset ${count} materials to default`);
```

## Event Handling

### Listen for Style Changes

```typescript
import { eventBus, Events } from '@core/EventBus';

// Listen for style additions
eventBus.on(Events.APPEARANCE_STYLE_ADDED, ({ style }) => {
  console.log(`Style added: ${style.name}`);
});

// Listen for style removals
eventBus.on(Events.APPEARANCE_STYLE_REMOVED, ({ style }) => {
  console.log(`Style removed: ${style.name}`);
});

// Listen for style applications
eventBus.on(Events.APPEARANCE_STYLE_APPLIED, ({ style, count }) => {
  console.log(`Style "${style.name}" applied to ${count} meshes`);
});
```

## Display Modes

The AppearanceManager supports several display modes:

- **SOLID**: Standard solid rendering with materials
- **WIREFRAME**: Show only edges/wireframe
- **HIDDEN_LINE**: Architectural hidden line rendering (white faces, black edges)
- **REALISTIC**: Enhanced realistic rendering with environmental reflections

```typescript
import { DisplayMode } from '@framing/AppearanceStyle';

const style = appearanceManager.getStyle('default');
console.log(`Current display mode: ${style.displayMode}`);

// Create a style with specific display mode
const wireframe = appearanceManager.addStyle({
  id: 'my-wireframe',
  name: 'My Wireframe',
  displayMode: DisplayMode.WIREFRAME,
  // ... other settings
});
```

## Best Practices

1. **Use Pre-configured Styles**: Start with the built-in styles before creating custom ones
2. **Name Styles Consistently**: Use descriptive IDs and names for easy identification
3. **Clone Instead of Create**: Clone existing styles and modify them to maintain consistency
4. **Batch Operations**: Use batch operations when applying styles to multiple objects
5. **Event Listeners**: Use events to keep UI in sync with style changes
6. **Export Regularly**: Export your custom styles to prevent loss
7. **Test Performance**: Some display modes (e.g., realistic) may impact performance on large scenes

## Common Use Cases

### Construction Documents

```typescript
const count = appearanceManager.applyStyleToScene(scene, 'construction');
// Thick lines, flat shading, no shadows - perfect for construction docs
```

### Client Presentations

```typescript
const count = appearanceManager.applyStyleToScene(scene, 'presentation');
// Realistic materials with shadows - great for presentations
```

### Technical Analysis

```typescript
const count = appearanceManager.applyStyleToScene(scene, 'xray');
// Semi-transparent view - useful for seeing internal structure
```

### Schematic Diagrams

```typescript
const count = appearanceManager.applyStyleToScene(scene, 'schematic');
// Simple colors and thin lines - ideal for diagrams
```
