/**
 * Clash Detection Data Structures
 * Defines interfaces and types for clash detection functionality
 */

import * as THREE from 'three';

export enum ClashSeverity {
  HARD = 'hard',        // Physical interference
  SOFT = 'soft',        // Clearance violation
  WARNING = 'warning'   // Potential issue
}

export enum ClashStatus {
  NEW = 'new',
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  APPROVED = 'approved',
  IGNORED = 'ignored'
}

export interface ClashElement {
  model: any; // FRAGS.FragmentsGroup - using any due to library export issues
  expressID: number;
  type: string;
  name?: string;
}

export interface ClashIntersection {
  point: THREE.Vector3;
  volume?: number;       // Intersection volume (if calculable)
  distance?: number;     // Clearance violation distance
}

export interface Clash {
  id: string;
  severity: ClashSeverity;
  status: ClashStatus;

  elementA: ClashElement;
  elementB: ClashElement;

  intersection: ClashIntersection;

  created: Date;
  modified?: Date;
  assignedTo?: string;
  description?: string;
  images?: string[];      // Screenshot URLs
}

export interface ClashRuleFilter {
  types?: string[];     // IFC types (IfcWall, IfcBeam, etc.)
  properties?: Map<string, any>;
}

export interface ClashRule {
  id: string;
  name: string;
  enabled: boolean;

  // Element filters
  setA: ClashRuleFilter;
  setB: ClashRuleFilter;

  // Clash criteria
  tolerance: number;      // Clearance distance (mm)
  checkType: 'hard' | 'soft';
}

// Element reference for internal processing
export interface ElementRef {
  model: any; // FRAGS.FragmentsGroup - using any due to library export issues
  expressID: number;
  type: string;
  name?: string;
  geometry?: THREE.BufferGeometry;
  matrix?: THREE.Matrix4;
}

// BCF Export structure (BIM Collaboration Format)
export interface BCFExport {
  project: {
    name: string;
    date: string;
  };
  topics: BCFTopic[];
}

export interface BCFTopic {
  guid: string;
  title: string;
  priority: string;
  status: string;
  creation_date: string;
  viewpoint?: {
    camera_position: THREE.Vector3;
    elements: number[];
  };
}

// Clash detection statistics
export interface ClashStats {
  total: number;
  hard: number;
  soft: number;
  warning: number;
  new: number;
  active: number;
  resolved: number;
  approved: number;
  ignored: number;
}
