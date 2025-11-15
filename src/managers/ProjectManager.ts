/**
 * ProjectManager - Manages project save/load functionality
 *
 * Handles:
 * - Creating new projects
 * - Saving/loading project files (.neocad)
 * - Tracking unsaved changes
 * - Auto-save to localStorage
 * - Recent files list
 * - Project state capture/restore
 */

import * as OBC from '@thatopen/components';
import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { FileSystemAccess } from '@utils/FileSystemAccess';
import {
  NEOcadProject,
  ModelReference,
  CameraState,
  MeasurementData,
  AnnotationData,
  ClippingPlaneData,
  ViewStateData,
  ProjectSettings,
  RecentFile,
  ValidationResult,
  DEFAULT_PROJECT_SETTINGS,
  PROJECT_FILE_VERSIONS,
} from '@data/ProjectFile';
import type { ViewportManager } from './ViewportManager';
import type { IFCLoader } from '@loaders/IFCLoader';

export class ProjectManager {
  private components: OBC.Components;
  private viewportManager: ViewportManager | null = null;
  private ifcLoader: IFCLoader | null = null;

  private currentProject: NEOcadProject | null = null;
  private isDirty: boolean = false;
  private autoSaveInterval: number | null = null;
  private recentFiles: RecentFile[] = [];

  // Constants
  private readonly MAX_RECENT_FILES = 10;
  private readonly AUTO_SAVE_KEY = 'neocad_autosave';
  private readonly AUTO_SAVE_TIME_KEY = 'neocad_autosave_time';
  private readonly RECENT_FILES_KEY = 'neocad_recent_files';

  constructor(components: OBC.Components) {
    this.components = components;
    this.loadRecentFiles();
    this.setupEventListeners();
    logger.info('ProjectManager', 'ProjectManager initialized');
  }

  /**
   * Set the viewport manager reference
   */
  setViewportManager(viewportManager: ViewportManager): void {
    this.viewportManager = viewportManager;
    logger.debug('ProjectManager', 'ViewportManager reference set');
  }

  /**
   * Set the IFC loader reference
   */
  setIFCLoader(ifcLoader: IFCLoader): void {
    this.ifcLoader = ifcLoader;
    logger.debug('ProjectManager', 'IFCLoader reference set');
  }

  /**
   * Setup event listeners for change tracking
   */
  private setupEventListeners(): void {
    // Track changes to mark project as dirty
    eventBus.on(Events.MODEL_LOADED, () => this.markDirty());
    eventBus.on(Events.MODEL_UNLOADED, () => this.markDirty());
    eventBus.on(Events.MEASUREMENT_CREATED, () => this.markDirty());
    eventBus.on(Events.MEASUREMENT_REMOVED, () => this.markDirty());
    eventBus.on(Events.ANNOTATION_CREATED, () => this.markDirty());
    eventBus.on(Events.ANNOTATION_UPDATED, () => this.markDirty());
    eventBus.on(Events.ANNOTATION_REMOVED, () => this.markDirty());
    eventBus.on(Events.CLIPPING_PLANE_CREATED, () => this.markDirty());
    eventBus.on(Events.CLIPPING_PLANE_REMOVED, () => this.markDirty());
    eventBus.on(Events.CAMERA_PRESET_CREATED, () => this.markDirty());
    eventBus.on(Events.CAMERA_PRESET_UPDATED, () => this.markDirty());
    eventBus.on(Events.CAMERA_PRESET_REMOVED, () => this.markDirty());

    logger.debug('ProjectManager', 'Event listeners configured');
  }

  /**
   * Create a new project
   */
  public createNewProject(name: string = 'Untitled Project'): NEOcadProject {
    // Check for unsaved changes
    if (this.isDirty && this.currentProject) {
      const shouldContinue = confirm(
        'You have unsaved changes. Do you want to continue without saving?'
      );
      if (!shouldContinue) {
        throw new Error('New project creation cancelled');
      }
    }

    // Clear current state
    this.clearAllState();

    // Create new project
    this.currentProject = {
      version: PROJECT_FILE_VERSIONS.CURRENT,
      name,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      models: [],
      camera: this.getCurrentCameraState(),
      measurements: [],
      annotations: [],
      clippingPlanes: [],
      viewStates: [],
      settings: { ...DEFAULT_PROJECT_SETTINGS },
      metadata: {},
    };

    this.isDirty = false;
    this.updateWindowTitle();

    logger.info('ProjectManager', `Created new project: ${name}`);
    eventBus.emit(Events.PROJECT_NEW, this.currentProject);

    return this.currentProject;
  }

  /**
   * Save the current project
   */
  public async saveProject(): Promise<void> {
    if (!this.currentProject) {
      throw new Error('No project to save');
    }

    // Capture current state
    this.captureCurrentState();

    // Convert to JSON
    const json = JSON.stringify(this.currentProject, null, 2);

    // Determine filename
    const filename = FileSystemAccess.ensureExtension(
      this.currentProject.name,
      '.neocad'
    );

    // Save file
    await FileSystemAccess.saveProjectFile(json, filename);

    this.isDirty = false;
    this.updateWindowTitle();
    this.addToRecentFiles(this.currentProject.name);

    logger.info('ProjectManager', `Project saved: ${filename}`);
    eventBus.emit(Events.PROJECT_SAVE, this.currentProject);
  }

  /**
   * Save project with a new name (Save As)
   */
  public async saveProjectAs(newName?: string): Promise<void> {
    if (!this.currentProject) {
      throw new Error('No project to save');
    }

    // Prompt for new name if not provided
    if (!newName) {
      newName = prompt('Enter project name:', this.currentProject.name) || undefined;
    }

    if (!newName) {
      throw new Error('Save As cancelled');
    }

    // Update project name
    this.currentProject.name = newName;
    this.currentProject.modified = new Date().toISOString();

    // Save with new name
    await this.saveProject();
  }

  /**
   * Load a project from file
   */
  public async loadProject(file?: File): Promise<void> {
    // Check for unsaved changes
    if (this.isDirty && this.currentProject) {
      const shouldContinue = confirm(
        'You have unsaved changes. Do you want to continue without saving?'
      );
      if (!shouldContinue) {
        throw new Error('Project load cancelled');
      }
    }

    // Open file picker if no file provided
    if (!file) {
      file = await FileSystemAccess.openProjectFile();
    }

    // Read file content
    const text = await FileSystemAccess.readFileAsText(file);
    const project: NEOcadProject = JSON.parse(text);

    // Validate project
    const validation = this.validateProject(project);
    if (!validation.valid) {
      const errorMsg = `Invalid project file:\n${validation.errors.join('\n')}`;
      logger.error('ProjectManager', errorMsg);
      throw new Error(errorMsg);
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      logger.warn('ProjectManager', 'Project validation warnings:', validation.warnings);
    }

    // Clear current state
    await this.clearAllState();

    // Restore project state
    await this.restoreProjectState(project);

    this.currentProject = project;
    this.isDirty = false;
    this.updateWindowTitle();
    this.addToRecentFiles(project.name);

    logger.info('ProjectManager', `Project loaded: ${project.name}`);
    eventBus.emit(Events.PROJECT_OPEN, project);
  }

  /**
   * Load a recent project
   */
  public async loadRecentProject(index: number): Promise<void> {
    const recent = this.recentFiles[index];
    if (!recent) {
      throw new Error('Recent file not found');
    }

    // For now, we can't directly load from path, so just show file picker
    // In the future, we could use File System Access API to reopen the file
    logger.info('ProjectManager', `Opening recent project: ${recent.name}`);
    await this.loadProject();
  }

  /**
   * Capture current application state into the project
   */
  private captureCurrentState(): void {
    if (!this.currentProject) return;

    logger.debug('ProjectManager', 'Capturing current state...');

    this.currentProject.modified = new Date().toISOString();
    this.currentProject.camera = this.getCurrentCameraState();
    this.currentProject.models = this.getLoadedModels();
    this.currentProject.measurements = this.getMeasurements();
    this.currentProject.annotations = this.getAnnotations();
    this.currentProject.clippingPlanes = this.getClippingPlanes();
    this.currentProject.viewStates = this.getViewStates();

    logger.debug('ProjectManager', 'State captured successfully');
  }

  /**
   * Restore application state from project
   */
  private async restoreProjectState(project: NEOcadProject): Promise<void> {
    logger.info('ProjectManager', 'Restoring project state...');

    try {
      // Restore camera
      this.restoreCameraState(project.camera);
      logger.debug('ProjectManager', 'Camera state restored');

      // Restore settings
      this.restoreSettings(project.settings);
      logger.debug('ProjectManager', 'Settings restored');

      // Prompt user to load models
      if (project.models.length > 0) {
        await this.restoreModels(project.models);
      }

      // Restore measurements
      if (project.measurements.length > 0) {
        this.restoreMeasurements(project.measurements);
        logger.debug('ProjectManager', `Restored ${project.measurements.length} measurements`);
      }

      // Restore annotations
      if (project.annotations.length > 0) {
        this.restoreAnnotations(project.annotations);
        logger.debug('ProjectManager', `Restored ${project.annotations.length} annotations`);
      }

      // Restore clipping planes
      if (project.clippingPlanes.length > 0) {
        this.restoreClippingPlanes(project.clippingPlanes);
        logger.debug('ProjectManager', `Restored ${project.clippingPlanes.length} clipping planes`);
      }

      // Restore view states
      if (project.viewStates.length > 0) {
        this.restoreViewStates(project.viewStates);
        logger.debug('ProjectManager', `Restored ${project.viewStates.length} view states`);
      }

      logger.info('ProjectManager', 'Project state restored successfully');
    } catch (error) {
      logger.error('ProjectManager', 'Failed to restore project state:', error);
      throw error;
    }
  }

  /**
   * Get current camera state
   */
  private getCurrentCameraState(): CameraState {
    const viewport = this.viewportManager?.getActiveViewport();
    if (!viewport) {
      // Return default camera state
      return {
        position: [10, 10, 10],
        target: [0, 0, 0],
        zoom: 1,
        projection: 'perspective',
      };
    }

    const camera = viewport.world.camera.three;
    const controls = viewport.world.camera.controls;

    const position = camera.position.toArray() as [number, number, number];
    const target = controls.getTarget
      ? controls.getTarget(new THREE.Vector3()).toArray() as [number, number, number]
      : [0, 0, 0] as [number, number, number];

    return {
      position,
      target,
      zoom: camera.zoom || 1,
      projection: camera.type === 'PerspectiveCamera' ? 'perspective' : 'orthographic',
      fov: (camera as THREE.PerspectiveCamera).fov,
      near: camera.near,
      far: camera.far,
    };
  }

  /**
   * Restore camera state
   */
  private restoreCameraState(cameraState: CameraState): void {
    const viewport = this.viewportManager?.getActiveViewport();
    if (!viewport) {
      logger.warn('ProjectManager', 'No active viewport for camera restoration');
      return;
    }

    const camera = viewport.world.camera.three;
    const controls = viewport.world.camera.controls;

    camera.position.fromArray(cameraState.position);

    if (controls.target) {
      controls.target.fromArray(cameraState.target);
    }

    if (camera.type === 'PerspectiveCamera' && cameraState.fov) {
      (camera as THREE.PerspectiveCamera).fov = cameraState.fov;
    }

    camera.zoom = cameraState.zoom || 1;
    camera.near = cameraState.near || 0.1;
    camera.far = cameraState.far || 1000;

    camera.updateProjectionMatrix();
    controls.update();
  }

  /**
   * Get loaded models
   */
  private getLoadedModels(): ModelReference[] {
    // TODO: Get actual loaded models from IFCLoader
    // For now, return empty array
    return [];
  }

  /**
   * Restore models (prompt user to reopen files)
   */
  private async restoreModels(modelRefs: ModelReference[]): Promise<void> {
    if (modelRefs.length === 0) return;

    const message = `This project requires ${modelRefs.length} model(s):\n${modelRefs.map(m => `- ${m.name}`).join('\n')}\n\nPlease locate and open each model file.`;

    alert(message);

    // For each model, prompt user to locate the file
    for (const ref of modelRefs) {
      try {
        const shouldLoad = confirm(`Locate model: ${ref.name}?`);
        if (!shouldLoad) continue;

        // TODO: Open file picker and load model
        logger.info('ProjectManager', `User should locate: ${ref.name}`);
      } catch (error) {
        logger.error('ProjectManager', `Failed to restore model ${ref.name}:`, error);
      }
    }
  }

  /**
   * Get measurements
   */
  private getMeasurements(): MeasurementData[] {
    const viewport = this.viewportManager?.getActiveViewport();
    if (!viewport || !viewport.measurementManager) {
      return [];
    }

    const measurements = viewport.measurementManager.getAllMeasurements();
    const unitSettings = viewport.measurementManager.getUnitConverter().getSettings();

    return measurements.map(m => ({
      id: m.id,
      type: m.type,
      value: m.value,
      unit: this.getUnitForMeasurementType(m.type, unitSettings),
      label: m.label,
      points: m.points.map(p => ({
        position: p.position.toArray() as [number, number, number],
      })),
      visible: m.visible,
      created: new Date().toISOString(),
    }));
  }

  /**
   * Get the appropriate unit for a measurement type
   */
  private getUnitForMeasurementType(type: string, unitSettings: any): string {
    switch (type) {
      case 'distance':
        return unitSettings.length || 'm';
      case 'area':
        return unitSettings.area || 'm2';
      case 'volume':
        return unitSettings.volume || 'm3';
      case 'angle':
        return unitSettings.angle || 'deg';
      default:
        return 'm';
    }
  }

  /**
   * Restore measurements
   */
  private restoreMeasurements(measurements: MeasurementData[]): void {
    const viewport = this.viewportManager?.getActiveViewport();
    if (!viewport || !viewport.measurementManager) {
      logger.warn('ProjectManager', 'Cannot restore measurements: no measurement manager');
      return;
    }

    // Build measurement data for import
    const measurementJson = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      measurements: measurements.map(m => ({
        id: m.id,
        type: m.type,
        value: m.value,
        label: m.label,
        visible: m.visible,
        points: m.points.map(p => ({
          x: p.position[0],
          y: p.position[1],
          z: p.position[2],
        })),
      })),
    };

    try {
      viewport.measurementManager.importMeasurements(JSON.stringify(measurementJson));
      logger.info('ProjectManager', `Restored ${measurements.length} measurements`);
    } catch (error) {
      logger.error('ProjectManager', 'Failed to restore measurements', error);
    }
  }

  /**
   * Get annotations
   */
  private getAnnotations(): AnnotationData[] {
    const viewport = this.viewportManager?.getActiveViewport();
    if (!viewport || !viewport.annotationManager) {
      return [];
    }

    const annotations = viewport.annotationManager.getAnnotations();
    return annotations.map(a => ({
      id: a.id,
      type: 'text',
      position: a.position.toArray() as [number, number, number],
      text: a.text,
      author: a.author,
      created: a.created || new Date().toISOString(),
      modified: a.modified,
      visible: a.visible !== false,
      color: a.color,
      fontSize: a.fontSize,
    }));
  }

  /**
   * Restore annotations
   */
  private restoreAnnotations(annotations: AnnotationData[]): void {
    const viewport = this.viewportManager?.getActiveViewport();
    if (!viewport || !viewport.annotationManager) {
      logger.warn('ProjectManager', 'Cannot restore annotations: no annotation manager');
      return;
    }

    // TODO: Implement annotation restoration
    logger.warn('ProjectManager', 'Annotation restoration not yet implemented');
  }

  /**
   * Get clipping planes
   */
  private getClippingPlanes(): ClippingPlaneData[] {
    const viewport = this.viewportManager?.getActiveViewport();
    if (!viewport || !viewport.clippingManager) {
      return [];
    }

    const planes = viewport.clippingManager.getPlanes();
    return planes.map(p => ({
      id: p.id,
      name: p.name,
      enabled: p.enabled !== false,
      position: [p.position.x, p.position.y, p.position.z] as [number, number, number],
      normal: [p.normal.x, p.normal.y, p.normal.z] as [number, number, number],
      created: new Date().toISOString(),
    }));
  }

  /**
   * Restore clipping planes
   */
  private restoreClippingPlanes(planes: ClippingPlaneData[]): void {
    const viewport = this.viewportManager?.getActiveViewport();
    if (!viewport || !viewport.clippingManager) {
      logger.warn('ProjectManager', 'Cannot restore clipping planes: no clipping manager');
      return;
    }

    // TODO: Implement clipping plane restoration
    logger.warn('ProjectManager', 'Clipping plane restoration not yet implemented');
  }

  /**
   * Get view states (camera presets)
   */
  private getViewStates(): ViewStateData[] {
    const viewport = this.viewportManager?.getActiveViewport();
    if (!viewport || !viewport.cameraPresetManager) {
      return [];
    }

    const presets = viewport.cameraPresetManager.getPresets();
    return presets.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      camera: {
        position: p.position.toArray() as [number, number, number],
        target: p.target.toArray() as [number, number, number],
        zoom: p.zoom || 1,
        projection: 'perspective',
      },
      created: p.created || new Date().toISOString(),
    }));
  }

  /**
   * Restore view states
   */
  private restoreViewStates(viewStates: ViewStateData[]): void {
    const viewport = this.viewportManager?.getActiveViewport();
    if (!viewport || !viewport.cameraPresetManager) {
      logger.warn('ProjectManager', 'Cannot restore view states: no camera preset manager');
      return;
    }

    // TODO: Implement view state restoration
    logger.warn('ProjectManager', 'View state restoration not yet implemented');
  }

  /**
   * Restore settings
   */
  private restoreSettings(settings: ProjectSettings): void {
    // TODO: Apply settings to the application
    logger.debug('ProjectManager', 'Settings restoration not yet implemented');
  }

  /**
   * Clear all application state
   */
  private async clearAllState(): Promise<void> {
    logger.debug('ProjectManager', 'Clearing application state...');

    const viewport = this.viewportManager?.getActiveViewport();
    if (viewport) {
      // Clear measurements
      if (viewport.measurementManager) {
        viewport.measurementManager.clearAll();
      }

      // Clear annotations
      if (viewport.annotationManager) {
        viewport.annotationManager.clearAll();
      }

      // Clear clipping planes
      if (viewport.clippingManager) {
        viewport.clippingManager.clearAll();
      }
    }

    // TODO: Unload all models

    logger.debug('ProjectManager', 'Application state cleared');
  }

  /**
   * Validate project file structure
   */
  private validateProject(project: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!project.version) {
      errors.push('Missing version field');
    }

    if (!project.name) {
      errors.push('Missing name field');
    }

    if (!project.created) {
      errors.push('Missing created timestamp');
    }

    // Check version compatibility
    if (project.version && project.version !== PROJECT_FILE_VERSIONS.CURRENT) {
      warnings.push(`Project version ${project.version} may not be fully compatible with current version ${PROJECT_FILE_VERSIONS.CURRENT}`);
    }

    // Check required arrays
    if (!Array.isArray(project.models)) {
      errors.push('Invalid or missing models array');
    }

    if (!Array.isArray(project.measurements)) {
      errors.push('Invalid or missing measurements array');
    }

    if (!Array.isArray(project.annotations)) {
      errors.push('Invalid or missing annotations array');
    }

    if (!Array.isArray(project.clippingPlanes)) {
      errors.push('Invalid or missing clippingPlanes array');
    }

    if (!Array.isArray(project.viewStates)) {
      errors.push('Invalid or missing viewStates array');
    }

    // Check camera state
    if (!project.camera || !project.camera.position || !project.camera.target) {
      errors.push('Invalid or missing camera state');
    }

    // Check settings
    if (!project.settings) {
      warnings.push('Missing settings, will use defaults');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Mark project as dirty (unsaved changes)
   */
  private markDirty(): void {
    if (!this.currentProject) return;

    this.isDirty = true;
    this.updateWindowTitle();
  }

  /**
   * Update window title to reflect project state
   */
  private updateWindowTitle(): void {
    const dirty = this.isDirty ? '*' : '';
    const name = this.currentProject?.name || 'Untitled';
    document.title = `${dirty}${name} - NEOcad`;
  }

  /**
   * Enable auto-save to localStorage
   */
  public enableAutoSave(intervalMinutes: number = 5): void {
    this.disableAutoSave();

    this.autoSaveInterval = window.setInterval(() => {
      if (this.isDirty && this.currentProject) {
        this.autoSave();
      }
    }, intervalMinutes * 60 * 1000);

    logger.info('ProjectManager', `Auto-save enabled (interval: ${intervalMinutes} minutes)`);
  }

  /**
   * Disable auto-save
   */
  public disableAutoSave(): void {
    if (this.autoSaveInterval !== null) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
      logger.info('ProjectManager', 'Auto-save disabled');
    }
  }

  /**
   * Auto-save to localStorage
   */
  private autoSave(): void {
    if (!this.currentProject) return;

    try {
      this.captureCurrentState();
      const json = JSON.stringify(this.currentProject);

      localStorage.setItem(this.AUTO_SAVE_KEY, json);
      localStorage.setItem(this.AUTO_SAVE_TIME_KEY, new Date().toISOString());

      logger.debug('ProjectManager', 'Auto-saved to localStorage');
    } catch (error) {
      logger.error('ProjectManager', 'Auto-save failed:', error);
    }
  }

  /**
   * Check if auto-save data exists
   */
  public hasAutoSave(): boolean {
    return localStorage.getItem(this.AUTO_SAVE_KEY) !== null;
  }

  /**
   * Load auto-saved project
   */
  public async loadAutoSave(): Promise<void> {
    const json = localStorage.getItem(this.AUTO_SAVE_KEY);
    const timestamp = localStorage.getItem(this.AUTO_SAVE_TIME_KEY);

    if (!json) {
      throw new Error('No auto-save data found');
    }

    const shouldLoad = confirm(
      `An auto-saved project was found (${timestamp}).\nDo you want to restore it?`
    );

    if (!shouldLoad) {
      this.clearAutoSave();
      return;
    }

    const project: NEOcadProject = JSON.parse(json);
    await this.restoreProjectState(project);

    this.currentProject = project;
    this.isDirty = true; // Mark as dirty since it's from auto-save
    this.updateWindowTitle();

    logger.info('ProjectManager', 'Auto-save restored');
  }

  /**
   * Clear auto-save data
   */
  public clearAutoSave(): void {
    localStorage.removeItem(this.AUTO_SAVE_KEY);
    localStorage.removeItem(this.AUTO_SAVE_TIME_KEY);
    logger.info('ProjectManager', 'Auto-save data cleared');
  }

  /**
   * Add project to recent files list
   */
  private addToRecentFiles(name: string, path?: string): void {
    const recent: RecentFile = {
      name,
      path,
      lastOpened: new Date().toISOString(),
    };

    // Remove duplicates
    this.recentFiles = this.recentFiles.filter(f => f.name !== name);

    // Add to front
    this.recentFiles.unshift(recent);

    // Limit to max recent files
    this.recentFiles = this.recentFiles.slice(0, this.MAX_RECENT_FILES);

    // Save to localStorage
    this.saveRecentFiles();

    logger.debug('ProjectManager', `Added to recent files: ${name}`);
  }

  /**
   * Load recent files from localStorage
   */
  private loadRecentFiles(): void {
    try {
      const json = localStorage.getItem(this.RECENT_FILES_KEY);
      if (json) {
        this.recentFiles = JSON.parse(json);
        logger.debug('ProjectManager', `Loaded ${this.recentFiles.length} recent files`);
      }
    } catch (error) {
      logger.error('ProjectManager', 'Failed to load recent files:', error);
      this.recentFiles = [];
    }
  }

  /**
   * Save recent files to localStorage
   */
  private saveRecentFiles(): void {
    try {
      const json = JSON.stringify(this.recentFiles);
      localStorage.setItem(this.RECENT_FILES_KEY, json);
    } catch (error) {
      logger.error('ProjectManager', 'Failed to save recent files:', error);
    }
  }

  /**
   * Get recent files
   */
  public getRecentFiles(): RecentFile[] {
    return [...this.recentFiles];
  }

  /**
   * Clear recent files
   */
  public clearRecentFiles(): void {
    this.recentFiles = [];
    localStorage.removeItem(this.RECENT_FILES_KEY);
    logger.info('ProjectManager', 'Recent files cleared');
  }

  /**
   * Get current project
   */
  public getCurrentProject(): NEOcadProject | null {
    return this.currentProject;
  }

  /**
   * Check if project has unsaved changes
   */
  public isDirtyProject(): boolean {
    return this.isDirty;
  }

  /**
   * Export measurements as CSV
   */
  public async exportMeasurementsCSV(): Promise<void> {
    const measurements = this.getMeasurements();

    if (measurements.length === 0) {
      throw new Error('No measurements to export');
    }

    let csv = 'Type,Value,Unit,Label,Points\n';

    for (const m of measurements) {
      const pointsStr = m.points.map(p => `(${p.position.join(',')})`).join(';');
      csv += `${m.type},${m.value},${m.unit},"${m.label || ''}","${pointsStr}"\n`;
    }

    await FileSystemAccess.exportCSV(csv, 'measurements.csv');
    logger.info('ProjectManager', 'Measurements exported to CSV');
  }

  /**
   * Dispose the manager
   */
  public dispose(): void {
    this.disableAutoSave();
    logger.info('ProjectManager', 'ProjectManager disposed');
  }
}
