# NEOcad

**Professional Web-Based CAD/BIM Platform for Residential Homebuilders**

[![Status](https://img.shields.io/badge/status-pre--release-orange)](https://github.com/yourusername/NEOcad2)
[![Version](https://img.shields.io/badge/version-0.9.0-blue)](https://github.com/yourusername/NEOcad2)
[![License](https://img.shields.io/badge/license-proprietary-red)](https://github.com/yourusername/NEOcad2)

---

## 🎯 Overview

NEOcad is a **vertical integration platform** connecting architectural design → automated manufacturing (NEO Robotics) → procurement (NEO ERP) → customer-facing configurators.

**Unique Value Proposition:** The **only CAD platform** with direct integration to automated framing robotics.

---

## ✨ Key Features

### ✅ Implemented (v0.9.0)
- **2D CAD Engine** - Vector2 math, entity system, snap/polar tracking
- **Wall Framing System** - IRC 2021 compliant with California corners, 16" OC stud spacing
- **Interactive UI** - Click-to-edit wall types, real-time 2D/3D synchronization
- **Multi-Layer Wall Rendering** - Studs, sheathing, drywall, siding visualization
- **3D Visualization** - Three.js rendering with environment presets
- **Room Detection** - Automatic boundary detection with area/perimeter calculation

### 🚧 In Development
- Door & window openings (headers, king/jack studs)
- File I/O (save/load projects)
- NEO Robotics exporter (cut lists, assembly sequences)
- Data model architecture (HomeProject, CompanyStandards)

### 📋 Planned
- MEP modeling (electrical/plumbing routing, clash detection)
- Public configurators (customer-facing floor plan customization)
- AI rendering (image-to-image photorealistic renders)
- Procurement module (NEO ERP integration)

---

## 🏗️ Architecture

### Current Structure
```
neocad/
├── src/
│   ├── cad/            # 2D CAD engine ⭐ ACTIVE
│   ├── framing/        # Structural framing system ⭐ ACTIVE
│   ├── rendering/      # 3D visualization ⭐ ACTIVE
│   ├── ui/             # UI components ⭐ ACTIVE
│   └── core/           # IFC viewer (Track A)
├── draw.html           # Primary entry point
└── index.html          # IFC viewer entry point
```

### Future Monorepo (Phase 2+)
```
neocad/
├── packages/
│   ├── core/           # CAD/BIM engine
│   ├── configurator/   # Public configurator
│   ├── robotics/       # NEO Robotics integration
│   └── shared/         # Shared types
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/NEOcad2.git
cd NEOcad2

# Install dependencies
npm install

# Run development server
npm run dev
```

### Usage
1. Open http://localhost:3000
2. Use the Rectangle tool to draw walls
3. Click walls to change wall types via StructuralOptionsPanel
4. View real-time 3D framing in right viewport

---

## 📊 Project Status

| Track | Completion | Status |
|-------|-----------|--------|
| **IFC Viewer** | ~40% | Medium Priority |
| **CAD Creation** | ~65% | **High Priority** ⭐ |
| **Combined Platform** | ~25% | Future Integration |

### Performance Benchmarks
- 2D Render: <16ms (60fps) for 100 entities
- 3D Render: <16ms (60fps) for 50 walls with framing
- Load Time: ~1.5 seconds
- Memory Usage: ~150MB for medium project

---

## 📈 Roadmap

### Phase 1: Foundation (Q4 2024 - Q1 2025) - **3 months**
**Goal:** Framing engine → NEO Robotics integration

1. ✅ Data model architecture (HomeProject, CompanyStandards)
2. ✅ Door & window openings (headers, king/jack studs)
3. ✅ File I/O (save/load projects)
4. ✅ Robotics exporter (cut lists for NEO Robotics)
5. ✅ Remove parametric system cleanup

**Budget:** $114K

### Phase 2: MEP & Validation (Q2 2025) - **3 months**
- Electrical routing engine
- Plumbing routing engine
- Clash detection
- IRC compliance validation

**Budget:** $90K

### Phase 3: Public Configurator (Q3 2025) - **2 months**
- Customer-facing floor plan viewer
- Pricing engine
- PDF brochure generator

**Budget:** $60K

### Phase 4: Procurement & AI (Q4 2025) - **3 months**
- NEO ERP integration
- AI rendering (ControlNet/Stable Diffusion)
- Unreal Engine exporter

**Budget:** $90K

**Total Investment:** $354K over 11 months

---

## 🛠️ Technology Stack

- **Frontend:** TypeScript, Three.js, HTML5 Canvas
- **Build Tool:** Vite
- **3D Rendering:** Three.js
- **IFC Support:** That Open Company (web-ifc)
- **Standards:** IRC 2021, AIA CAD Layer Guidelines

---

## 📚 Documentation

- [ROADMAP.md](ROADMAP.md) - Detailed development roadmap
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Mobile-friendly quick reference
- [NEOcad_Strategic_Assessment.md](NEOcad_Strategic_Assessment.md) - Full strategic analysis
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Codebase organization guide

---

## 🤝 Contributing

This is a proprietary project for NEO Construction Systems. For questions or collaboration inquiries, contact the development team.

---

## 📝 License

Proprietary - All rights reserved by NEO Construction Systems

---

## 🔗 Related Projects

- **NEO Robotics** - Automated framing manufacturing system
- **NEO ERP** - Enterprise resource planning and procurement
- **NEO Configurators** - Customer-facing design tools

---

## 📞 Support

For technical questions or issues:
- Internal Team: Contact development lead
- Documentation: See `docs/` directory

---

**Last Updated:** November 15, 2024
**Version:** 0.9.0
**Status:** Pre-Release (Dual-Track Development)
