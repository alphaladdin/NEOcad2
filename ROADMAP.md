# NEOcad Development Roadmap

**Version:** 0.9.0
**Last Updated:** November 15, 2024
**Status:** Pre-Release (Dual-Track Development)

---

## 📊 Project Overview

NEOcad is a professional web-based CAD/BIM platform with **two integrated workflows**:

1. **IFC Viewer Track** - View and analyze existing BIM models
2. **CAD Creation Track** - Create new architectural designs with structural framing

Both tracks will eventually merge into a unified platform supporting both model viewing and creation.

---

## Track A: IFC Viewer (BIM Model Analysis)

## ✅ Phase 1: Core Foundation (COMPLETED)

### Application Architecture
- [x] Core application structure with NEOcad class
- [x] Component system using That Open Company components
- [x] Event-driven architecture with EventBus
- [x] State management system
- [x] Logger utility with multiple log levels
- [x] Configuration management

### Viewport & 3D Rendering
- [x] Viewport system with Three.js integration
- [x] Camera controls (Orbit, Plan, FirstPerson modes)
- [x] Grid system
- [x] Scene management
- [x] Raycasting for object interaction
- [x] Object highlighting (hover and selection)

### User Interface
- [x] Toolbar with configurable buttons
- [x] Status bar with mouse position and FPS display
- [x] Panel system (resizable, collapsible)
- [x] Panel manager for organizing UI panels
- [x] Loading indicator
- [x] File picker for IFC files

### UI Panels
- [x] Properties Panel - Display object properties
- [x] Object Tree Panel - Hierarchical view of IFC structure
- [x] IFC Project Panel - Display project metadata
- [x] TreeView component for hierarchical data

## ✅ Phase 2: IFC Support (COMPLETED)

### IFC Loading
- [x] IFC Loader integration with That Open Company
- [x] FragmentsManager setup with local worker file
- [x] Progress tracking during IFC loading
- [x] Error handling and user feedback
- [x] Multiple IFC file support

### IFC Property Display
- [x] IFC Property Parser for FragmentsModel API
- [x] Spatial structure parsing (Project → Buildings → Storeys)
- [x] Element property extraction
- [x] Project information display
- [x] Property formatting utilities

### FragmentsModel API Integration
- [x] Updated all components to use FragmentsModel instead of FragmentsGroup
- [x] Fixed getSpatialStructure() method calls
- [x] Updated property retrieval using getItemsData()
- [x] Worker file bundling in public directory

## 🚧 Phase 3: Advanced IFC Features (IN PROGRESS)

### Object Tree Enhancements
- [ ] Load individual elements (walls, doors, windows, etc.) in tree
- [ ] Implement getElementsByType() for FragmentsModel
- [ ] Element filtering and search
- [ ] Multi-select support in tree
- [ ] Expand/collapse all functionality

### Selection & Properties
- [ ] Click to select IFC elements with property display
- [ ] Selection box/marquee selection
- [ ] Property editing capabilities
- [ ] Custom property sets

### Spatial Structure
- [ ] Investigate empty spatial structure issue
- [ ] Alternative spatial structure extraction methods
- [ ] Building/Storey visibility controls
- [ ] Floor plan view mode

## 📋 Phase 4: Measurement & Analysis Tools

### Measurement Tools
- [ ] Distance measurement
- [ ] Area measurement
- [ ] Angle measurement
- [ ] Volume calculation
- [ ] Measurement persistence

### Analysis Tools
- [ ] Clash detection
- [ ] Quantity takeoff
- [ ] Element counting and statistics
- [ ] Model comparison/diff

## 🎨 Phase 5: Visualization Enhancements

### Display Options
- [ ] Wireframe mode
- [ ] X-ray/transparency mode
- [ ] Section planes/cutting planes
- [ ] Color by property/type
- [ ] Shadows and ambient occlusion

### Camera & Navigation
- [ ] Saved camera views/bookmarks
- [ ] Walk-through mode
- [ ] Camera animation
- [ ] Minimap/navigation cube
- [ ] View presets (Top, Front, Side, etc.)

## 💾 Phase 6: Data Management

### Project Management
- [ ] Save/load project files
- [ ] Recent files list
- [ ] Project settings
- [ ] Undo/Redo system
- [ ] Auto-save functionality

### Export Capabilities
- [ ] Export to various formats (OBJ, FBX, GLTF)
- [ ] Screenshot/image export
- [ ] Report generation
- [ ] Property data export (CSV, JSON)

## 🔧 Phase 7: Advanced Features

### Collaboration
- [ ] Multiple viewport support (split view)
- [ ] Annotations and markup
- [ ] Comments system
- [ ] Version control integration

### BIM Workflow
- [ ] BCF (BIM Collaboration Format) support
- [ ] IFC validation and checking
- [ ] Custom IFC property creation
- [ ] IFC schema visualization

### Performance Optimization
- [ ] Level of Detail (LOD) system
- [ ] Frustum culling optimization
- [ ] Large model streaming
- [ ] Memory management improvements

## 🔌 Phase 8: Extensibility

### Plugin System
- [ ] Plugin architecture
- [ ] Plugin marketplace/registry
- [ ] Custom tool development API
- [ ] Scripting support (JavaScript/TypeScript)

### Integration
- [ ] REST API for external integration
- [ ] Database connectivity
- [ ] Cloud storage integration
- [ ] Third-party BIM tool integration

## 🧪 Phase 9: Quality & Polish

### Testing
- [ ] Unit tests for core functionality
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Performance benchmarks

### Documentation
- [ ] User guide
- [ ] API documentation
- [ ] Developer guide
- [ ] Video tutorials

### Deployment
- [ ] Build optimization
- [ ] Progressive Web App (PWA) support
- [ ] Desktop app (Electron) packaging
- [ ] CI/CD pipeline

---

## Track B: CAD Creation (New Design & Framing)

## ✅ Phase 1: 2D CAD Foundation (COMPLETED)

### Core CAD Engine
- [x] Vector2 math library with comprehensive operations
- [x] Entity base class (transform, serialize, render, selection)
- [x] Camera2D (pan, zoom, zoom-to-cursor)
- [x] CanvasViewport (grid, axes, render loop, zoom-aware rendering)
- [x] Layer system with 16 AIA standard layers
- [x] Snap system (endpoint, midpoint, nearest, intersection)
- [x] Polar tracking (45° increments)
- [x] Dynamic input display with coordinate feedback
- [x] Auto-dimension generation for entities

### Drawing Tools
- [x] Line tool with snap support
- [x] Rectangle tool (creates 4 walls in counter-clockwise order)
- [x] Circle tool (center + radius)
- [x] Arc tool (3-point arc)
- [x] Polyline tool (continuous line drawing)
- [x] Select tool (click, shift-click, box select, move, delete)
- [x] Dimension tool
- [x] Wall split tool

### CAD Entities
- [x] Line entity
- [x] Wall entity with multi-layer rendering
- [x] Circle entity
- [x] Arc entity
- [x] Polyline entity
- [x] Dimension entity (linear dimensions with extension lines)
- [x] Room entity (area/perimeter calculation)

## ✅ Phase 2: Wall Framing System (COMPLETED)

### Wall Types & Assemblies
- [x] WallType class with material layers
- [x] WallTypeManager singleton (6 standard types)
  - 2x4 Exterior Basic
  - 2x4 Exterior Standard
  - 2x4 Interior
  - 2x6 Exterior
  - 2x4 Partition
  - 2x6 Partition
- [x] Multi-layer wall assembly (studs, sheathing, drywall, siding, air cavity)
- [x] Layer thickness and material specification

### Framing Engine
- [x] FramingEngine with accurate stud layout algorithm
- [x] California corner implementation (end stud + 3 backing blocks)
- [x] Corner detection between walls (L, T, X intersections)
- [x] Corner clearance calculations
- [x] 16" OC stud spacing with corner avoidance
- [x] Top plate (single/double based on wall type)
- [x] Bottom plate
- [x] Interior vs exterior wall handling

### 3D Visualization
- [x] CADTo3DConverter (2D entities → 3D geometry)
- [x] Wall framing mesh generation (studs, plates, backing blocks)
- [x] Real-time framing updates on wall changes
- [x] Material color coding (wood, OSB, gypsum, siding)
- [x] Environment presets (Default Grid, Realistic Outdoor, Studio, Night)
- [x] Shadow casting and lighting system
- [x] Ambient + directional light configuration

## ✅ Phase 3: Interactive UI & Editing (COMPLETED - Nov 2024)

### Interactive Features
- [x] StructuralOptionsPanel for wall property editing
- [x] Click-to-edit wall types
- [x] Real-time 2D/3D synchronization
- [x] Selection event system (selectionChanged events)
- [x] Wall type change callbacks with framing rebuild
- [x] Visual feedback (hover states, selection highlighting)

### Rendering Enhancements
- [x] Zoom-aware wall thickness rendering (fixed scaling issue)
- [x] Corner connection detection and visualization
- [x] Multi-layer wall visualization in 2D
- [x] Material-based color coding
- [x] Selection highlighting with blue overlay
- [x] End cap rendering for walls

### UI Components
- [x] StructuralOptionsPanel with modern styling
- [x] Wall type selector with live preview
- [x] Wall information display (type, length, thickness)
- [x] Gradient headers and smooth transitions
- [x] Responsive panel layout

## 🚧 Phase 4: Room & Space Planning (IN PROGRESS)

### Room Detection
- [x] RoomDetector for automatic room boundary detection
- [x] Room entity with area/perimeter calculation
- [x] Room type assignment (bedroom, bathroom, kitchen, etc.)
- [ ] Room labeling and annotation
- [ ] Room schedule generation
- [ ] Area calculations with unit conversion

### Space Planning Tools
- [ ] Furniture placement tools
- [ ] Door swing visualization
- [ ] Window placement
- [ ] Traffic flow analysis
- [ ] Accessibility checking

## 📋 Phase 5: Openings & Advanced Framing (PLANNED)

### Door & Window Openings
- [ ] Door placement tool
- [ ] Window placement tool
- [ ] Header sizing calculations (span tables)
- [ ] King/jack stud automatic placement
- [ ] Cripple stud layout above/below openings
- [ ] Rough opening dimension display
- [ ] Jamb detail visualization

### Advanced Framing
- [ ] Floor framing system
  - Joist layout with proper spacing
  - Beam placement and sizing
  - Span calculations
  - Cantilever support
- [ ] Roof framing system
  - Rafter layout
  - Hip and valley rafters
  - Ridge beam
  - Truss support
  - Roof pitch calculations

## 💾 Phase 6: File I/O & Export (PLANNED)

### Project Files
- [ ] Save project to JSON format
- [ ] Load project from JSON
- [ ] Auto-save functionality
- [ ] Project templates (residential, commercial)
- [ ] Recent files list
- [ ] Project settings/preferences

### Export Capabilities
- [ ] Export 2D to DXF (AutoCAD)
- [ ] Export 3D to OBJ/glTF
- [ ] Export floor plans to PDF
- [ ] Export material takeoff to CSV
- [ ] Screenshot/image export
- [ ] Lumber cut list generation

## 🔍 Phase 7: Code Compliance & Validation (PLANNED)

### IRC 2021 Compliance
- [ ] Framing rules validation engine
- [ ] Wall height limits checking
- [ ] Bearing wall identification
- [ ] Load path visualization
- [ ] Header span validation
- [ ] Stud spacing compliance
- [ ] Automated code violation reporting

### Material Takeoff
- [ ] Lumber quantity calculations
- [ ] Fastener schedules
- [ ] Cost estimation
- [ ] Waste calculation (10% factor)
- [ ] Material optimization suggestions

---

## 🎯 Current Priorities

### Track A (IFC Viewer) - Medium Priority
**Next**: Advanced IFC Features - Object Tree Enhancements
1. Implementing element loading in Object Tree
2. Making IFC elements clickable
3. Element filtering and search

### Track B (CAD Creation) - **High Priority** ⭐
**Next**: Door & Window Openings
1. Door placement tool with swing visualization
2. Window placement tool with sizing
3. Header calculations and framing
4. Opening validation and spacing

### Cross-Track Integration - Low Priority
**Future**: Merge IFC viewer with CAD creation
- Edit imported IFC models
- Export CAD designs to IFC
- Hybrid workflow support

---

## 📈 Progress Metrics

### Overall Project Status
- **IFC Viewer Track**: ~40% complete (Phases 1-2 done, Phase 3 in progress)
- **CAD Creation Track**: ~65% complete (Phases 1-3 done, Phase 4 in progress)
- **Combined Platform**: ~25% complete

### Code Statistics (Estimated)
- Total Lines of Code: ~15,000
- TypeScript Files: ~80
- Test Coverage: ~10% (needs improvement)
- Documentation: ~30%

### Performance Benchmarks
- 2D Render: <16ms (60fps) for 100 entities
- 3D Render: <16ms (60fps) for 50 walls with framing
- Load Time: ~1.5 seconds
- Memory Usage: ~150MB for medium project

---

## 🐛 Known Issues & Technical Debt

### Critical Issues
- None currently

### High Priority
1. ~~Wall thickness zoom scaling~~ ✅ FIXED
2. Room detection with small gaps (<0.1ft)
3. Selection performance with 50+ entities
4. Undo/redo system not implemented

### Technical Debt
1. **Refactor SketchMode** - Unused code, integrate or remove
2. **Event system** - Replace CustomEvents with EventEmitter
3. **Type safety** - Fix `any` types in CADTo3DConverter
4. **Test coverage** - Add unit tests (target: 80%)
5. **Memory management** - Dispose Three.js resources properly
6. **Code organization** - Move demos to `src/demos/`

### Low Priority Issues
7. Console warnings (Vite worker.plugins deprecation)
8. HTML proxy errors in some test files
9. Browser compatibility (Safari/Firefox untested)
10. Grid snap precision at extreme zoom

---

## 🚀 Future Vision (2025+)

### Unified Platform
- Single app supporting both IFC viewing and CAD creation
- Seamless workflow between viewing and editing
- Import IFC → Edit → Export IFC

### AI & Automation
- AI-powered room layout suggestions
- Automatic code compliance checking
- Smart dimensioning
- Optimal framing recommendations
- Cost optimization

### Advanced Visualization
- Photorealistic rendering
- VR walkthrough support
- AR model viewing on mobile
- Construction sequence animation
- 4D scheduling integration

### Platform Integration
- Procore/PlanGrid integration
- Estimating software links
- ERP integration
- Supplier catalog access
- Permitting automation

---

## 📚 Development Guidelines

### Code Standards
- TypeScript strict mode required
- ESLint with Airbnb style guide
- JSDoc for all public APIs
- One class per file
- Descriptive naming (avoid abbreviations)

### Testing Requirements
- Unit tests for utilities and core classes
- Integration tests for tool workflows
- Visual tests (Playwright) for UI
- Performance benchmarks for rendering

### Git Workflow
- `main` (stable), `develop` (integration), `feature/*`
- Conventional commits format
- PR review required for main/develop
- Semantic versioning (v1.0.0)

---

## 📞 Contact & Resources

### Documentation
- API Docs: `docs/api/README.md`
- User Guide: `docs/user-guide/README.md`
- Architecture: `docs/architecture/README.md`

### References
- [IRC 2021](https://codes.iccsafe.org/content/IRC2021P1)
- [AIA Layer Guidelines](https://www.nationalcadstandard.org/)
- [Three.js Docs](https://threejs.org/docs/)
- [That Open Company](https://thatopen.com/)

---

## 📝 Notes

- This roadmap is a living document - updated regularly
- Priorities may shift based on user feedback
- MVP features take precedence over nice-to-haves
- Both tracks can be developed in parallel by different teams

**Last Updated:** November 15, 2024
