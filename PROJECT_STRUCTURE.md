# NEOcad Project Structure

**Last Updated:** November 15, 2024

This document provides a comprehensive overview of the NEOcad codebase organization.

---

## Quick Navigation

- [Directory Overview](#directory-overview)
- [Source Code Organization](#source-code-organization)
- [Entry Points](#entry-points)
- [Key Systems](#key-systems)
- [Development Guide](#development-guide)

---

## Directory Overview

```
neocad/
├── src/                    # Source code (TypeScript)
│   ├── cad/                # CAD engine (Track B) ⭐ ACTIVE
│   ├── framing/            # Structural framing system ⭐ ACTIVE
│   ├── rendering/          # 3D visualization ⭐ ACTIVE
│   ├── ui/                 # UI components ⭐ ACTIVE
│   ├── core/               # IFC viewer (Track A)
│   ├── parametric/         # Parametric system (⚠️ incomplete)
│   ├── tools/              # Legacy tools (⚠️ needs cleanup)
│   └── demo/               # Demo applications
├── public/                 # Static assets
├── docs/                   # Documentation
├── tests/                  # Test files
└── deprecated-tests/       # Old tests (⚠️ remove)
```

---

## Source Code Organization

### `/src/cad/` - CAD Creation Engine ⭐

**Status:** ACTIVE - 90% complete
**Purpose:** 2D CAD drawing, entity management, tools

**Key Files:**
- `CanvasViewport.ts` - 2D rendering with zoom-aware display
- `Wall.ts` - Wall entity with multi-layer rendering
- `SelectTool.ts` - Selection system with events
- `ToolManager.ts` - Tool switching and management

**Subdirectories:**
- `entities/` - CAD entities (Line, Wall, Circle, Arc, etc.)
- `tools/` - Drawing tools (Line, Rectangle, Select, etc.)

### `/src/framing/` - Structural Framing ⭐

**Status:** ACTIVE - 80% complete
**Purpose:** Building code-compliant structural framing

**Key Files:**
- `FramingEngine.ts` - Stud layout, California corners
- `WallTypeManager.ts` - Manages 6 standard wall types
- `WallType.ts` - Wall assembly definition

**Wall Types:**
- 2x4 Exterior Basic/Standard
- 2x4 Interior
- 2x6 Exterior
- 2x4/2x6 Partition

### `/src/rendering/` - 3D Visualization ⭐

**Status:** ACTIVE - 85% complete
**Purpose:** Three.js rendering, environments

**Key Files:**
- `EnvironmentPresets.ts` - 4 environment configurations

### `/src/ui/` - User Interface ⭐

**Status:** ACTIVE - 70% complete
**Purpose:** Interactive panels and controls

**Key Files:**
- `StructuralOptionsPanel.ts` - Click-to-edit wall properties

### `/src/core/` - IFC Viewer

**Status:** MEDIUM PRIORITY - 40% complete
**Purpose:** View and analyze IFC BIM models

**Key Files:**
- `NEOcad.ts` - Main application class
- `EventBus.ts` - Event system
- `StateManager.ts` - State management

### `/src/parametric/` - Parametric System

**Status:** ⚠️ INCOMPLETE - Needs decision
**Purpose:** Parametric modeling

**Action Required:** Complete or remove

### `/src/tools/` - Legacy Tools

**Status:** ⚠️ CLEANUP NEEDED
**Purpose:** Old tool system

**Action Required:** Integrate or remove `SketchMode.ts`

---

## Entry Points

### HTML Files

| File | Purpose | Track | Status |
|------|---------|-------|--------|
| `draw.html` | CAD Creation | B | ⭐ PRIMARY |
| `index.html` | IFC Viewer | A | Secondary |
| `test-framing.html` | Framing Tests | B | Dev/Test |
| `room-demo.html` | Room Detection | B | Demo |

**Main Entry:** [draw.html](draw.html) → [sketch-to-3d-demo.js](src/demo/sketch-to-3d-demo.js)

---

## Key Systems

### 1. 2D CAD System

**Files:** `src/cad/*`

**Components:**
- Vector2 math library
- Entity system (Line, Wall, Circle, Arc, Polyline, Dimension, Room)
- Camera2D (pan, zoom-to-cursor)
- Canvas rendering
- Layer management (16 AIA layers)
- Snap system (endpoint, midpoint, nearest)
- Polar tracking (45°)
- Auto-dimensions

**Tools:**
- Line, Rectangle, Circle, Arc, Polyline
- Select (click, box select, move, delete)
- Dimension, Wall Split

### 2. Framing System

**Files:** `src/framing/*`

**Features:**
- 6 standard wall types
- Multi-layer assemblies (studs, sheathing, drywall, siding)
- California corner implementation
- 16" OC stud spacing
- Corner detection (L, T, X intersections)
- IRC 2021 compliance

### 3. 3D Visualization

**Files:** `src/rendering/*`, `src/cad/CADTo3DConverter.ts`

**Features:**
- Real-time 2D → 3D conversion
- Wall framing mesh generation
- Material color coding
- Environment presets
- Shadow casting
- Lighting (ambient + directional)

### 4. Interactive UI

**Files:** `src/ui/*`

**Features:**
- StructuralOptionsPanel
- Click-to-edit wall types
- Real-time 2D/3D updates
- Selection events
- Modern styling

---

## Development Guide

### Adding a New Tool

1. Create `src/cad/tools/MyTool.ts`
2. Extend `DrawingTool` base class
3. Register in `ToolManager`
4. Add toolbar button in `draw.html`
5. Add keyboard shortcut

**Example:**
```typescript
export class MyTool extends DrawingTool {
  getName(): string { return 'MyTool'; }
  getDescription(): string { return 'My custom tool'; }
  getPrompt(): string { return 'Click to do something'; }

  onMouseDown(event: MouseEventData): void {
    // Handle mouse down
  }
}
```

### Adding a New Entity

1. Create `src/cad/entities/MyEntity.ts`
2. Extend `Entity` base class
3. Implement required methods
4. Add to `CADTo3DConverter` if 3D needed
5. Create tool to draw it

**Required Methods:**
```typescript
export class MyEntity extends Entity {
  protected calculateBoundingBox(): BoundingBox { /* ... */ }
  getSnapPoints(types: SnapType[]): SnapPoint[] { /* ... */ }
  containsPoint(point: Vector2, tolerance: number): boolean { /* ... */ }
  render(ctx: CanvasRenderingContext2D, worldToScreen, layer): void { /* ... */ }
  clone(): MyEntity { /* ... */ }
}
```

### Adding a New Wall Type

1. Open `src/framing/WallTypeManager.ts`
2. Add new `WallType` definition
3. Specify layers (studs, sheathing, etc.)
4. Set dimensions and spacing
5. Add to manager's wall type list

**Example:**
```typescript
const myWallType = new WallType({
  id: '2x6-custom',
  name: '2x6 Custom Wall',
  nominalThickness: '2x6',
  actualThickness: 5.5,
  defaultHeight: 8,
  layers: [
    { material: 'Gypsum', thickness: 0.5, position: 'interior' },
    { material: 'Wood Framing', thickness: 5.5, position: 'structure' },
    { material: 'OSB', thickness: 0.5, position: 'exterior' },
  ],
  stud: { spacing: 16, actualWidth: 1.5, actualDepth: 5.5 },
  topPlate: { count: 2 },
});
```

---

## Common Patterns

### Singleton Pattern
```typescript
export class MyManager {
  private static instance: MyManager;
  static getInstance(): MyManager {
    if (!this.instance) this.instance = new MyManager();
    return this.instance;
  }
}
```

### Event Emission
```typescript
// Emit
const event = new CustomEvent('myEvent', { detail: data });
canvas.dispatchEvent(event);

// Listen
canvas.addEventListener('myEvent', (e) => {
  console.log(e.detail);
});
```

---

## Cleanup Tasks

### High Priority ⚠️
1. Remove/refactor `src/tools/SketchMode.ts`
2. Complete or remove `src/parametric/*`
3. Move demos to `src/demos/`
4. Remove `deprecated-tests/`
5. Consolidate duplicate files (LayerManager)

### Medium Priority
6. Add TypeDoc configuration
7. Create CONTRIBUTING.md
8. Set up CI/CD
9. Add more unit tests

---

## Quick Reference

### Commands
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm test             # Run tests
npm run lint         # Lint code
```

### Main Demo
- URL: `http://localhost:3000/draw.html`
- Code: `src/demo/sketch-to-3d-demo.js`

### Documentation
- [ROADMAP.md](ROADMAP.md) - Development roadmap
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - This file

---

**For detailed roadmap, see [ROADMAP.md](ROADMAP.md)**
