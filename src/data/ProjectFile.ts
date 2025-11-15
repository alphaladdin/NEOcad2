/**
 * ProjectFile - Type definitions for NEOcad project file format
 *
 * Project files (.neocad) are JSON-based and contain references to models,
 * view states, measurements, annotations, and settings.
 *
 * IMPORTANT: We do NOT save IFC geometry (too large), only references.
 */

/**
 * Main project file structure
 */
export interface NEOcadProject {
  version: string;           // Project file format version (e.g., "0.9.0")
  name: string;              // Project name
  created: string;           // ISO timestamp
  modified: string;          // ISO timestamp

  models: ModelReference[];  // Loaded IFC models (references only)
  camera: CameraState;       // Camera position and settings
  measurements: MeasurementData[];
  annotations: AnnotationData[];
  clippingPlanes: ClippingPlaneData[];
  viewStates: ViewStateData[];
  settings: ProjectSettings;

  metadata: ProjectMetadata;
}

/**
 * Reference to an IFC model (not the geometry itself)
 */
export interface ModelReference {
  id: string;                // Unique model ID
  name: string;              // Model filename
  path?: string;             // Local file path (if available)
  url?: string;              // Remote URL (if loaded from URL)
  hash?: string;             // File hash for verification (SHA-256)
  lastModified?: string;     // Model file timestamp (ISO string)
  size?: number;             // File size in bytes
  visible: boolean;          // Model visibility state
  transform?: TransformData; // Model transformation (position, rotation, scale)
  color?: ColorOverride;     // Color override settings
  opacity?: number;          // Opacity override (0-1)
}

/**
 * 3D transformation data
 */
export interface TransformData {
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles in radians
  scale: [number, number, number];
}

/**
 * Color override settings for a model
 */
export interface ColorOverride {
  enabled: boolean;
  color: string;             // Hex color string (e.g., "#ff0000")
  affectedElements?: string[]; // Optional: specific element IDs
}

/**
 * Camera state
 */
export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];  // Look-at target
  zoom: number;
  projection: 'perspective' | 'orthographic';
  fov?: number;              // Field of view (for perspective)
  near?: number;             // Near clipping plane
  far?: number;              // Far clipping plane
}

/**
 * Measurement data
 */
export interface MeasurementData {
  id: string;
  type: 'distance' | 'area' | 'angle' | 'volume';
  value: number;             // Measured value
  unit: string;              // Unit of measurement (m, ft, degrees, etc.)
  label?: string;            // Optional custom label
  points: PointData[];       // Measurement points in 3D space
  visible: boolean;
  color?: string;            // Optional color override
  created: string;           // ISO timestamp
}

/**
 * 3D point with optional metadata
 */
export interface PointData {
  position: [number, number, number];
  elementId?: string;        // Associated IFC element ID
  normal?: [number, number, number]; // Surface normal at point
}

/**
 * Annotation data (text labels, comments, etc.)
 */
export interface AnnotationData {
  id: string;
  type: 'text' | 'arrow' | 'cloud' | 'dimension';
  position: [number, number, number];
  text: string;
  author?: string;
  created: string;           // ISO timestamp
  modified?: string;         // ISO timestamp
  visible: boolean;
  color?: string;
  fontSize?: number;
  elementId?: string;        // Associated IFC element ID
  viewpoint?: CameraState;   // Optional saved viewpoint
  attachments?: AttachmentReference[];
}

/**
 * Reference to an attachment (image, document, etc.)
 */
export interface AttachmentReference {
  id: string;
  name: string;
  type: string;              // MIME type
  url?: string;              // URL or data URI
  size?: number;             // Size in bytes
}

/**
 * Clipping plane data
 */
export interface ClippingPlaneData {
  id: string;
  name?: string;
  enabled: boolean;
  position: [number, number, number];
  normal: [number, number, number]; // Plane normal vector
  size?: number;             // Visual plane size
  color?: string;
  created: string;           // ISO timestamp
}

/**
 * Saved view state (camera preset)
 */
export interface ViewStateData {
  id: string;
  name: string;
  description?: string;
  camera: CameraState;
  visibleModels?: string[];  // Model IDs that should be visible
  hiddenElements?: string[]; // Element IDs that should be hidden
  clippingPlanes?: string[]; // Active clipping plane IDs
  thumbnail?: string;        // Base64 encoded thumbnail image
  created: string;           // ISO timestamp
}

/**
 * Project settings
 */
export interface ProjectSettings {
  units: UnitSettings;
  display: DisplaySettings;
  navigation: NavigationSettings;
  performance: PerformanceSettings;
  collaboration?: CollaborationSettings;
}

/**
 * Unit settings
 */
export interface UnitSettings {
  length: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  area: 'mm2' | 'cm2' | 'm2' | 'in2' | 'ft2';
  volume: 'mm3' | 'cm3' | 'm3' | 'in3' | 'ft3';
  angle: 'degrees' | 'radians';
}

/**
 * Display settings
 */
export interface DisplaySettings {
  backgroundColor: string;   // Hex color
  gridVisible: boolean;
  gridSize: number;
  gridColor: string;
  axesVisible: boolean;
  shadowsEnabled: boolean;
  ambientOcclusionEnabled: boolean;
  antialiasing: boolean;
  theme: 'light' | 'dark' | 'auto';
}

/**
 * Navigation settings
 */
export interface NavigationSettings {
  mode: 'orbit' | 'plan' | 'firstPerson';
  invertY: boolean;
  mouseSensitivity: number;
  zoomSpeed: number;
  panSpeed: number;
  rotateSpeed: number;
}

/**
 * Performance settings
 */
export interface PerformanceSettings {
  maxFPS: number;
  lodEnabled: boolean;       // Level of detail
  frustumCulling: boolean;
  occlusionCulling: boolean;
  maxTriangles: number;      // Maximum triangles to render
}

/**
 * Collaboration settings (BCF integration)
 */
export interface CollaborationSettings {
  serverUrl?: string;
  projectId?: string;
  userId?: string;
  syncEnabled: boolean;
  autoSaveInterval?: number; // Auto-save interval in minutes
}

/**
 * Project metadata
 */
export interface ProjectMetadata {
  author?: string;
  company?: string;
  description?: string;
  tags?: string[];
  customProperties?: Record<string, any>;
}

/**
 * Project file validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Recent file entry
 */
export interface RecentFile {
  name: string;
  path?: string;
  lastOpened: string;        // ISO timestamp
  thumbnail?: string;        // Base64 encoded thumbnail
}

/**
 * Project statistics
 */
export interface ProjectStats {
  modelCount: number;
  measurementCount: number;
  annotationCount: number;
  clippingPlaneCount: number;
  viewStateCount: number;
  totalElements?: number;
  fileSize?: number;         // Project file size in bytes
}

/**
 * Default project settings
 */
export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  units: {
    length: 'm',
    area: 'm2',
    volume: 'm3',
    angle: 'degrees',
  },
  display: {
    backgroundColor: '#1a1a1a',
    gridVisible: true,
    gridSize: 10,
    gridColor: '#404040',
    axesVisible: true,
    shadowsEnabled: false,
    ambientOcclusionEnabled: false,
    antialiasing: true,
    theme: 'dark',
  },
  navigation: {
    mode: 'orbit',
    invertY: false,
    mouseSensitivity: 1.0,
    zoomSpeed: 1.0,
    panSpeed: 1.0,
    rotateSpeed: 1.0,
  },
  performance: {
    maxFPS: 60,
    lodEnabled: true,
    frustumCulling: true,
    occlusionCulling: false,
    maxTriangles: 1000000,
  },
  collaboration: {
    syncEnabled: false,
    autoSaveInterval: 5,
  },
};

/**
 * Project file format version history
 */
export const PROJECT_FILE_VERSIONS = {
  CURRENT: '0.9.0',
  MINIMUM_SUPPORTED: '0.9.0',
} as const;
