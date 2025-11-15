# NEOcad Quick Reference

**Last Updated:** November 15, 2024

## 🎯 Core Vision

NEOcad = CAD/BIM platform for residential builders with **robotics integration**

**Unique Value:** Only CAD platform that exports directly to automated framing robots (NEO Robotics)

---

## 📊 Current Status (v0.9.0)

### ✅ COMPLETE (65%)
- 2D CAD engine (Vector2, entities, tools)
- Wall framing system (IRC 2021, California corners, 16" OC)
- Interactive UI (StructuralOptionsPanel, real-time 2D/3D sync)
- Multi-layer wall rendering
- 3D visualization (Three.js)

### 🚧 IN PROGRESS
- Room detection & space planning
- Room type assignment

### ❌ NOT STARTED
- Door/window openings
- File I/O (save/load)
- Data model architecture
- Robotics exporter
- MEP routing

---

## 🚀 Phase 1: Foundation (Next 3 Months)

**Goal:** Framing engine → NEO Robotics integration

### Priority Tasks
1. **Data model architecture** (2 weeks) 🔴
   - HomeProject, CompanyStandards, CommunityStandards classes

2. **Door & window openings** (4 weeks) 🔴
   - Headers, king/jack studs, cripples

3. **File I/O** (2 weeks) 🔴
   - Save/load projects as JSON

4. **Robotics exporter** (3 weeks) 🔴
   - Cut lists, assembly sequences

5. **Remove parametric system** (1 week) 🟡
   - Clean up `src/parametric/*`

**Budget:** $114K (2.75 developers × 3 months)

---

## 🔑 Critical Decisions

### 1. Parametric System
**Decision:** REMOVE for now
- Not integrated with working CAD system
- Adds massive complexity
- Delays robotics integration
- Revisit in 2026+

### 2. MEP Strategy
**Decision:** INTEGRATE existing tools
- Don't build from scratch ($2M+, 5 years)
- Use Trimble/Autodesk MEP APIs ($200K, 6 months)
- Build MEP AFTER door/window openings

### 3. Data Model Architecture
**Decision:** Build THIS WEEK
- Everything depends on this foundation
- Hierarchical: Company → Community → Home Instance
- Prevents massive refactoring later

---

## 📋 Data Model Schema

```typescript
CompanyStandards {
  wallTypes, framingRules, mepStandards,
  materialCatalog, vendorIntegrations
}
  ↓ inherits
CommunityStandards {
  allowedFloorPlans, allowedOptions,
  pricingRules, localBuildingCodes
}
  ↓ creates
HomeInstance {
  baseFloorPlan, selectedOptions,
  customizations, framingOutput,
  mepLayout, purchaseOrders
}
```

---

## 🤖 NEO Robotics Integration

### Data Export Needs
```typescript
RoboticsFramingData {
  walls: {
    studs: { quantity, length, material, cuts }
    plates: { top, bottom }
    assemblySequence, nailingPattern
  }
  corners: { type, walls, position }
  openings: { type, header, kingStuds, jackStuds, cripples }
}
```

### Critical Questions (Answer THIS WEEK)
1. What format does NEO Robotics expect? (JSON/STEP/IFC/DXF?)
2. What detail level? (cut lists vs toolpaths vs assembly)
3. How does data transfer? (file/API/streaming?)

---

## 🏗️ Monorepo Structure

```
neocad/
├── packages/
│   ├── core/          # CAD engine (existing)
│   ├── configurator/  # Public floor plan configurator
│   ├── robotics/      # NEO Robotics integration
│   └── shared/        # Shared types
```

**Tool:** pnpm workspaces or Nx

**Benefit:** Independent versioning, parallel teams, clear boundaries

---

## 💰 Budget Overview

| Phase | Timeline | Cost |
|-------|----------|------|
| Phase 1: Foundation | 3 months | $114K |
| Phase 2: MEP | 3 months | $90K |
| Phase 3: Configurator | 2 months | $60K |
| Phase 4: Procurement/AI | 3 months | $90K |
| **TOTAL** | **11 months** | **$354K** |

---

## ⚠️ Technical Debt

### High Priority
1. Remove `src/parametric/*` - unused code
2. Room detection with gaps (<0.1ft)
3. Selection performance (50+ entities)
4. Undo/redo system missing

### Medium Priority
5. Replace CustomEvents → EventEmitter
6. Fix `any` types in CADTo3DConverter
7. Add unit tests (current: 10%, target: 80%)
8. Move demos to `src/demos/`

---

## 📞 Immediate Actions (THIS WEEK)

1. ✅ Schedule NEO Robotics meeting (get data spec)
2. ✅ Design data model schema
3. ✅ Allocate 2-3 developers to Phase 1
4. ✅ Remove parametric system
5. ✅ Create Phase 1 backlog with estimates

---

## 🎯 Strategic Focus

> **NEOcad is the ONLY CAD platform with automated framing robotics integration.**

**Everything else is secondary.**

Perfect framing → robotics first, then expand.

---

## 📊 Success Metrics

### Phase 1 KPIs
- Framing accuracy: 100% IRC 2021 compliant
- Export success: >95% validated by robotics team
- Load/save reliability: 100%
- Rendering: <16ms (60fps) for 100 walls
- Code coverage: >60%

### Business Metrics (6 months)
- 10+ homes exported to robotics
- Configurator engagement: >5 min avg
- MEP clash detection: >90% accuracy

---

## 🔄 Full Platform Components

**Implemented:**
1. ✅ Framing Engine (core differentiator)
2. ⚠️ 2D CAD Tools (complete)
3. ⚠️ 3D Visualization (complete)

**Planned:**
4. ❌ NEO Robotics Integration (Phase 1)
5. ❌ Public Configurators (Phase 3)
6. ❌ MEP Modeling (Phase 2)
7. ❌ Procurement Module (Phase 4)
8. ❌ AI Rendering (Phase 4)
9. ❌ Unreal Export (Phase 4)

---

## 💡 Key Insights from Assessment

1. **Build vs Buy:** Integrate MEP/AI, build framing/configurator
2. **Risk:** Scope creep is #1 threat - stay focused on Phase 1
3. **Architecture:** Data model foundation is critical blocker
4. **Validation:** Early robotics integration testing is essential
5. **Timeline:** 11 months for full platform with 2-3 developers

---

**Full Assessment:** `NEOcad_Strategic_Assessment.md`
**Roadmap:** `ROADMAP.md`
**Project Structure:** `PROJECT_STRUCTURE.md`
