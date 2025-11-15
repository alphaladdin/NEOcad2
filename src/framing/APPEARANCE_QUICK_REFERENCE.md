# AppearanceManager Quick Reference

## Import

```typescript
import {
  getAppearanceManager,
  AppearanceStyle,
  DisplayMode,
  applyStyleToObjects,
  createStylePreview
} from '@framing';
```

## Get Manager

```typescript
const manager = getAppearanceManager();
```

## Standard Styles

| ID | Name | Description |
|---|---|---|
| `default` | Default | Standard 3D view |
| `construction` | Construction | Thick lines, flat shading, no shadows |
| `presentation` | Presentation | Realistic materials with shadows |
| `schematic` | Schematic | Simple colors, thin lines |
| `hidden-line` | Hidden Line | White faces, black edges |
| `wireframe` | Wireframe | Edge-only display |
| `xray` | X-Ray | Semi-transparent view |

## Quick Operations

### Get Style
```typescript
const style = manager.getStyle('construction');
```

### Apply to Mesh
```typescript
manager.applyStyleToMesh(mesh, 'construction');
```

### Apply to Scene
```typescript
manager.applyStyleToScene(scene, 'presentation');
```

### Create Custom Style
```typescript
manager.addStyle({
  id: 'custom',
  name: 'Custom',
  materialSettings: {
    color: new THREE.Color(0xff0000),
    opacity: 1.0,
    metalness: 0.3,
    roughness: 0.7,
  },
  lineWeight: 2.0,
  lineColor: new THREE.Color(0x000000),
  displayMode: DisplayMode.SOLID,
  showDimensions: true,
  showLabels: true,
});
```

### Clone Style
```typescript
manager.cloneStyle('default', 'my-variant', {
  name: 'My Variant',
  materialSettings: {
    color: new THREE.Color(0x0000ff),
  },
});
```

### Export/Import
```typescript
// Export
const data = manager.exportLibrary();
localStorage.setItem('styles', JSON.stringify(data));

// Import
const data = JSON.parse(localStorage.getItem('styles'));
manager.importLibrary(data);
```

## Display Modes

```typescript
DisplayMode.SOLID       // Standard rendering
DisplayMode.WIREFRAME   // Edges only
DisplayMode.HIDDEN_LINE // Architectural
DisplayMode.REALISTIC   // Enhanced PBR
```

## ParametricWall Integration

```typescript
// Create with style
const wall = new ParametricWall(paramEngine, geoEngine, {
  appearanceStyleId: 'construction',
});

// Apply style
const style = manager.getStyle('presentation');
wall.applyAppearanceStyle(style);

// Get current style
const styleId = wall.getAppearanceStyleId();
```

## Helper Functions

```typescript
// Batch apply
applyStyleToObjects([mesh1, mesh2], 'construction');

// Apply by name pattern
applyStyleByName(scene, /^wall_/, 'construction');

// Create preview
const preview = createStylePreview(style, 1.0, position);

// Reset scene
resetSceneMaterials(scene);
```

## Events

```typescript
import { eventBus, Events } from '@core/EventBus';

eventBus.on(Events.APPEARANCE_STYLE_ADDED, ({ style }) => {
  console.log('Style added:', style.name);
});

eventBus.on(Events.APPEARANCE_STYLE_APPLIED, ({ style, count }) => {
  console.log(`Applied to ${count} meshes`);
});
```

## Common Patterns

### Switch Scene Style
```typescript
const styles = ['default', 'construction', 'presentation'];
let current = 0;

function nextStyle() {
  current = (current + 1) % styles.length;
  manager.applyStyleToScene(scene, styles[current]);
}
```

### Highlight Selected Objects
```typescript
const selected = getSelectedObjects();
applyStyleToObjects(selected, 'xray');
```

### Preview Materials
```typescript
const styles = manager.getAllStyles();
styles.forEach((style, i) => {
  const preview = createStylePreview(
    style,
    0.5,
    new THREE.Vector3(i * 1.5, 0, 0)
  );
  scene.add(preview);
});
```
