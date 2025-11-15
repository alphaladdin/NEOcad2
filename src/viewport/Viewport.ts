/**
 * Viewport class - Represents a single 3D viewport
 */

import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { MouseTracker } from '@utils/MouseUtils';
import { Raycaster } from './Raycaster';
import { Highlighter } from './Highlighter';
import { throttle } from '@utils/MouseUtils';
import { MeasurementManager } from '@managers/MeasurementManager';
import { ClippingManager } from '@managers/ClippingManager';
import { CameraPresetManager } from '@managers/CameraPresetManager';
import { ModelComparisonManager } from '@managers/ModelComparisonManager';
import { AnnotationManager } from '@managers/AnnotationManager';
import { FilterManager } from '@managers/FilterManager';
import { ClashDetectionManager } from '@managers/ClashDetectionManager';
import { SelectionManager } from '@managers/SelectionManager';
import type { WallCreationTool } from '@tools/WallCreationTool';
import type { DoorPlacementTool } from '@tools/DoorPlacementTool';
import type { WindowPlacementTool } from '@tools/WindowPlacementTool';
import { ViewCubeWidget } from '@ui/ViewCubeWidget';

export interface ViewportConfig {
  container: HTMLElement;
  enableGrid?: boolean;
  enableShadows?: boolean;
  backgroundColor?: THREE.Color;
  enableInteraction?: boolean;
}

export class Viewport {
  public readonly id: string;
  public readonly container: HTMLElement;
  public world: OBC.SimpleWorld;

  private components: OBC.Components;
  private resizeObserver: ResizeObserver | null = null;

  // Interaction systems
  public mouseTracker: MouseTracker | null = null;
  public raycaster: Raycaster | null = null;
  public highlighter: Highlighter | null = null;
  public measurementManager: MeasurementManager | null = null;
  public clippingManager: ClippingManager | null = null;
  public cameraPresetManager: CameraPresetManager | null = null;
  public modelComparisonManager: ModelComparisonManager | null = null;
  public annotationManager: AnnotationManager | null = null;
  public filterManager: FilterManager | null = null;
  public clashDetectionManager: ClashDetectionManager | null = null;
  public selectionManager: SelectionManager | null = null;
  public wallCreationTool: WallCreationTool | null = null;
  public doorPlacementTool: DoorPlacementTool | null = null;
  public windowPlacementTool: WindowPlacementTool | null = null;
  public viewCubeWidget: ViewCubeWidget | null = null;

  // Mouse event handlers
  private mouseMoveHandler: ((event: MouseEvent) => void) | null = null;
  private clickHandler: ((event: MouseEvent) => void) | null = null;
  private dblClickHandler: ((event: MouseEvent) => void) | null = null;
  private mouseDownHandler: ((event: MouseEvent) => void) | null = null;
  private mouseUpHandler: ((event: MouseEvent) => void) | null = null;

  // Keyboard event handlers
  private keyDownHandler: ((event: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((event: KeyboardEvent) => void) | null = null;

  // Reusable objects for ground plane raycasting (avoid allocating on every mouse event)
  private groundPlaneRaycaster: THREE.Raycaster = new THREE.Raycaster();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private groundPlaneIntersect: THREE.Vector3 = new THREE.Vector3();

  // Box selection state
  private boxSelectionDiv: HTMLDivElement | null = null;

  constructor(components: OBC.Components, config: ViewportConfig) {
    this.id = THREE.MathUtils.generateUUID();
    this.components = components;
    this.container = config.container;

    // Create the world - type assertion needed due to Fragments generic constraints
    this.world = this.components.get(OBC.Worlds).create<
      OBC.SimpleScene,
      OBC.OrthoPerspectiveCamera,
      OBC.SimpleRenderer
    >() as any;

    logger.info('Viewport', `Created viewport ${this.id}`);

    this.setupScene(config);
    this.setupRenderer(config); // Renderer must be set up before camera
    this.setupCamera();
    this.setupGrid(config);

    this.setupResize();

    // Setup interaction systems
    if (config.enableInteraction !== false) {
      this.setupInteraction();
      // this.setupViewCube(); // TODO: Add when available in Fragments
    }

    // Setup event listeners
    this.setupEventListeners();
  }

  private setupScene(config: ViewportConfig): void {
    this.world.scene = new OBC.SimpleScene(this.components);
    (this.world.scene as OBC.SimpleScene).setup();

    // Set background color
    const bgColor = config.backgroundColor || new THREE.Color(0x202020);
    (this.world.scene.three as THREE.Scene).background = bgColor;

    logger.debug('Viewport', 'Scene configured');
  }

  private setupCamera(): void {
    this.world.camera = new OBC.OrthoPerspectiveCamera(this.components);
    const camera = this.world.camera as OBC.OrthoPerspectiveCamera;

    // Set initial camera position for isometric view showing ~20x20 meter area
    // Position camera closer to origin for better initial view of walls
    camera.controls.setLookAt(
      -15, 15, 15,  // Camera position - isometric view
      0, 0, 0       // Look at origin
    );

    // Set zoom level to show approximately 20x20 meter area on screen
    // For orthographic camera, this controls the visible area
    const distance = Math.sqrt(15 * 15 + 15 * 15 + 15 * 15); // Distance from camera to origin
    camera.controls.dollyTo(distance * 0.7, false); // Zoom in to show ~20m area

    logger.debug('Viewport', 'Camera configured with 20x20m default view');
  }

  private setupRenderer(config: ViewportConfig): void {
    this.world.renderer = new OBC.SimpleRenderer(this.components, this.container);

    // Configure renderer
    this.world.renderer.three.setClearColor(config.backgroundColor || new THREE.Color(0x202020));

    logger.debug('Viewport', 'Renderer configured');
  }

  private setupGrid(config: ViewportConfig): void {
    if (config.enableGrid !== false) {
      const grids = this.components.get(OBC.Grids);
      const grid = grids.create(this.world as any);

      // Configure grid for 60ft x 60ft viewport (imperial units)
      // 1 foot = 0.3048 meters
      // uSize1 = small grid (1 foot increments)
      // uSize2 = large grid (10 foot increments)
      if (grid.material?.uniforms) {
        grid.material.uniforms.uColor.value = new THREE.Color(0x444444);
        grid.material.uniforms.uSize1.value = 0.3048;  // 1 foot grid
        grid.material.uniforms.uSize2.value = 3.048;   // 10 foot grid
      }

      logger.debug('Viewport', 'Grid created with 1ft/10ft imperial spacing');
    }
  }

  private setupResize(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(this.container);

    // Initial resize
    this.resize();
  }

  public resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    if (width === 0 || height === 0) return;

    (this.world.renderer as OBC.SimpleRenderer)?.resize();
    (this.world.camera as OBC.OrthoPerspectiveCamera).updateAspect();

    logger.debug('Viewport', `Resized to ${width}x${height}`);
    eventBus.emit(Events.VIEWPORT_RESIZE, { viewportId: this.id, width, height });
  }

  public setNavigationMode(mode: 'Orbit' | 'Plan' | 'FirstPerson'): void {
    (this.world.camera as OBC.OrthoPerspectiveCamera).set(mode);
    logger.info('Viewport', `Navigation mode set to: ${mode}`);
    eventBus.emit(Events.VIEWPORT_NAVIGATION_MODE_CHANGED, { viewportId: this.id, mode });
  }

  public fitToView(meshes?: THREE.Mesh[]): void {
    const camera = this.world.camera as OBC.OrthoPerspectiveCamera;
    if (meshes && meshes.length > 0) {
      camera.fit(meshes);
    } else {
      // Fit to all meshes in the world
      const allMeshes = Array.from(this.world.meshes);
      if (allMeshes.length > 0) {
        camera.fit(allMeshes);
      }
    }
  }

  /**
   * Focus camera on selected objects
   */
  public focusSelected(): void {
    if (!this.highlighter) {
      logger.warn('Viewport', 'Cannot focus: highlighter not initialized');
      return;
    }

    const selectedObjects = this.highlighter.getSelected();

    if (selectedObjects.length === 0) {
      logger.info('Viewport', 'No objects selected to focus on');
      return;
    }

    // Filter for meshes only
    const meshes = selectedObjects.filter((obj) => obj instanceof THREE.Mesh) as THREE.Mesh[];

    if (meshes.length === 0) {
      logger.warn('Viewport', 'Selected objects contain no meshes');
      return;
    }

    logger.info('Viewport', `Focusing camera on ${meshes.length} selected object(s)`);
    this.fitToView(meshes);
  }

  /**
   * Set camera to a specific view
   */
  public setCameraView(position: THREE.Vector3, target: THREE.Vector3, animate: boolean = true): void {
    const camera = this.world.camera as OBC.OrthoPerspectiveCamera;

    if (animate) {
      // Use setLookAt for smooth animation
      camera.controls.setLookAt(
        position.x, position.y, position.z,
        target.x, target.y, target.z,
        true // Enable smooth transition
      );
    } else {
      // Instant camera move
      camera.controls.setLookAt(
        position.x, position.y, position.z,
        target.x, target.y, target.z,
        false
      );
    }

    logger.info('Viewport', `Camera view changed to position: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
  }

  /**
   * Update camera position (used for ViewCube dragging)
   */
  public updateCameraPosition(position: THREE.Vector3, target: THREE.Vector3, animate: boolean = false): void {
    const camera = this.world.camera as OBC.OrthoPerspectiveCamera;

    // Directly update camera position and target without animation for smooth dragging
    camera.controls.setLookAt(
      position.x, position.y, position.z,
      target.x, target.y, target.z,
      animate
    );
  }

  private setupInteraction(): void {
    // Get the canvas element
    const canvas = this.world.renderer?.three.domElement;
    if (!canvas) {
      logger.warn('Viewport', 'Cannot setup interaction: canvas not found');
      return;
    }

    // Create interaction systems
    this.mouseTracker = new MouseTracker(canvas);
    this.raycaster = new Raycaster();
    this.highlighter = new Highlighter(this.components, this.world);
    this.measurementManager = new MeasurementManager(
      this.world.scene.three as THREE.Scene,
      this.world.camera.three
    );
    this.clippingManager = new ClippingManager(
      this.components,
      this.world
    );
    // Debug camera controls
    const camera = this.world.camera as OBC.OrthoPerspectiveCamera;
    logger.debug('Viewport', 'Camera controls check:', camera.controls);

    this.cameraPresetManager = new CameraPresetManager(
      this.world.camera.three,
      camera.controls
    );
    this.modelComparisonManager = new ModelComparisonManager(
      this.world.scene.three as THREE.Scene,
      this.components
    );
    this.annotationManager = new AnnotationManager(
      this.world.scene.three as THREE.Scene,
      this.world.camera.three
    );
    this.filterManager = new FilterManager(
      this.world.scene.three as THREE.Scene,
      this.components
    );
    this.clashDetectionManager = new ClashDetectionManager(
      this.components,
      this.world
    );
    this.selectionManager = new SelectionManager();

    // Setup ViewCube widget (disabled for now)
    // this.viewCubeWidget = new ViewCubeWidget(this.container, {
    //   position: 'top-right',
    //   size: 120,
    // });

    // Set the main camera reference for the ViewCube
    // this.viewCubeWidget.setMainCamera(this.world.camera.three, new THREE.Vector3(0, 0, 0));

    // Setup mouse event handlers with throttling for performance
    this.mouseMoveHandler = throttle(this.onMouseMove.bind(this), 16); // ~60fps
    this.clickHandler = this.onClick.bind(this);
    this.dblClickHandler = this.onDoubleClick.bind(this);
    this.mouseDownHandler = this.onMouseDown.bind(this);
    this.mouseUpHandler = this.onMouseUp.bind(this);

    // Add event listeners to canvas
    canvas.addEventListener('mousemove', this.mouseMoveHandler);
    canvas.addEventListener('click', this.clickHandler);
    canvas.addEventListener('dblclick', this.dblClickHandler);
    canvas.addEventListener('mousedown', this.mouseDownHandler);
    canvas.addEventListener('mouseup', this.mouseUpHandler);

    // Setup keyboard event handlers
    this.keyDownHandler = this.onKeyDown.bind(this);
    this.keyUpHandler = this.onKeyUp.bind(this);

    // Add keyboard listeners to window (to catch global shortcuts)
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);

    logger.debug('Viewport', 'Interaction systems enabled');
  }

  /**
   * Setup event listeners for selection synchronization
   */
  private setupEventListeners(): void {
    // Listen for selection events from tree
    eventBus.on(Events.OBJECT_SELECTED, (data: any) => {
      // Don't respond to our own selection events (from viewport clicks)
      if (!data.source || data.source === 'viewport') return;

      // Select the object in the viewport
      if (this.highlighter && data.object && data.model && data.expressID !== undefined) {
        this.highlighter.select(data.object, data.model, data.expressID, 'tree');
        logger.debug('Viewport', `Selected object from event: expressID=${data.expressID}`);
      }
    });

    // Listen for multi-selection events from tree
    eventBus.on(Events.SELECTION_CHANGED, (data: any) => {
      // Don't respond to our own selection events
      if (!data.source || data.source === 'viewport') return;

      if (this.highlighter && data.selected && Array.isArray(data.selected)) {
        // Clear current selection first
        this.highlighter.clearSelection();

        // Select each object
        for (const item of data.selected) {
          if (item.object && item.model && item.expressID !== undefined) {
            this.highlighter.select(item.object, item.model, item.expressID, 'tree');
          }
        }

        logger.debug('Viewport', `Selected ${data.selected.length} objects from multi-selection event`);
      }
    });

    // Listen for selection cleared events
    eventBus.on(Events.SELECTION_CLEARED, (data: any) => {
      // Don't respond to our own events
      if (data && data.source === 'viewport') return;

      if (this.highlighter) {
        this.highlighter.clearSelection();
        logger.debug('Viewport', 'Cleared selection from event');
      }
    });

    // Listen for camera view change events from ViewCube
    eventBus.on('viewport:set-camera-view', (data: any) => {
      if (data.position && data.target) {
        this.setCameraView(data.position, data.target, data.animate);
      }
    });

    // Listen for camera position updates from ViewCube rotation
    eventBus.on('viewport:update-camera-position', (data: any) => {
      if (data.position && data.target) {
        this.updateCameraPosition(data.position, data.target, data.animate);
      }
    });

    logger.debug('Viewport', 'Event listeners configured');
  }

  // TODO: Re-enable when ViewCube is available in Fragments
  // private setupViewCube(): void {
  //   try {
  //     // Create ViewCube
  //     this.viewCube = this.components.get(OBC.ViewCube);
  //
  //     // Configure ViewCube for this world
  //     this.viewCube.world = this.world;
  //
  //     logger.debug('Viewport', 'ViewCube enabled');
  //   } catch (error) {
  //     logger.warn('Viewport', 'Failed to setup ViewCube', error);
  //   }
  // }

  private onMouseMove(): void {
    if (!this.mouseTracker || !this.raycaster || !this.highlighter || !this.selectionManager) return;

    const ndc = this.mouseTracker.ndc;
    const camera = this.world.camera.three;
    const objects = Array.from(this.world.scene.three.children);

    // Update box selection if active
    if (this.selectionManager.isBoxSelectionActive()) {
      this.selectionManager.updateBoxSelection(ndc.clone());
      this.updateBoxSelectionVisual();
      return;
    }

    // Perform raycast
    const hit = this.raycaster.castFirstFromCamera(ndc, camera, objects);

    // If wall creation tool is active, update preview
    if (this.wallCreationTool && this.wallCreationTool.isToolActive()) {
      if (hit) {
        this.wallCreationTool.onMouseMove(hit.point);
      } else {
        // If no hit, use ground plane intersection
        const groundIntersect = this.castToGroundPlane(ndc, camera);
        if (groundIntersect) {
          this.wallCreationTool.onMouseMove(groundIntersect);
        }
      }
      return;
    }

    // If door placement tool is active, update preview
    if (this.doorPlacementTool && this.doorPlacementTool.isToolActive()) {
      this.doorPlacementTool.onMouseMove(ndc);
      return;
    }

    // If window placement tool is active, update preview
    if (this.windowPlacementTool && this.windowPlacementTool.isToolActive()) {
      this.windowPlacementTool.onMouseMove(ndc);
      return;
    }

    if (hit && hit.object instanceof THREE.Mesh) {
      // Highlight hovered object
      this.highlighter.highlightHover(hit.object);
    } else {
      // Clear hover if nothing is hit
      this.highlighter.clearHover();
    }
  }

  private onMouseDown(event: MouseEvent): void {
    if (!this.mouseTracker || !this.selectionManager) return;

    // Start box selection on left mouse button with Alt key
    if (event.button === 0 && event.altKey && !event.ctrlKey && !event.shiftKey) {
      const ndc = this.mouseTracker.ndc.clone();
      this.selectionManager.startBoxSelection(ndc);
      this.createBoxSelectionVisual();
      logger.debug('Viewport', 'Box selection started');
    }
  }

  private onMouseUp(event: MouseEvent): void {
    if (!this.mouseTracker || !this.selectionManager || !this.raycaster) return;

    // End box selection
    if (this.selectionManager.isBoxSelectionActive()) {
      const box = this.selectionManager.endBoxSelection();

      if (box) {
        // Perform box selection
        this.performBoxSelection(box);
      }

      this.removeBoxSelectionVisual();
      logger.debug('Viewport', 'Box selection ended');
    }
  }

  private async onClick(event: MouseEvent): Promise<void> {
    if (!this.mouseTracker || !this.raycaster || !this.highlighter || !this.selectionManager) return;

    // Update modifier keys state
    if (event.ctrlKey || event.metaKey) {
      this.selectionManager.enableMultiSelectMode();
    } else {
      this.selectionManager.disableMultiSelectMode();
    }

    if (event.shiftKey) {
      this.selectionManager.enableRangeSelectMode();
    } else {
      this.selectionManager.disableRangeSelectMode();
    }

    const ndc = this.mouseTracker.ndc;
    const camera = this.world.camera.three;

    // If wall creation tool is active, handle wall creation clicks
    if (this.wallCreationTool && this.wallCreationTool.isToolActive()) {
      // Raycast to find ground plane intersection
      const objects = Array.from(this.world.scene.three.children);
      const hit = this.raycaster.castFirstFromCamera(ndc, camera, objects);

      if (hit) {
        this.wallCreationTool.onClick(hit.point);
      } else {
        // If no hit, create a point on the ground plane (y=0)
        const groundIntersect = this.castToGroundPlane(ndc, camera);
        if (groundIntersect) {
          this.wallCreationTool.onClick(groundIntersect);
        }
      }
      return;
    }

    // If door placement tool is active, handle door placement clicks
    if (this.doorPlacementTool && this.doorPlacementTool.isToolActive()) {
      this.doorPlacementTool.onClick(ndc);
      return;
    }

    // If window placement tool is active, handle window placement clicks
    if (this.windowPlacementTool && this.windowPlacementTool.isToolActive()) {
      this.windowPlacementTool.onClick(ndc);
      return;
    }

    // If measurement mode is active, handle measurement clicks
    if (this.measurementManager && this.measurementManager.isActivated()) {
      const canvas = this.world.renderer?.three.domElement;
      if (canvas) {
        const objects = Array.from(this.world.scene.three.children);
        this.measurementManager.handleClick(event, canvas, objects);
      }
      return;
    }

    // First, try using FragmentsModel raycast for IFC elements
    const fragmentsManager = this.components.get(OBC.FragmentsManager);
    let foundIFCElement = false;

    if (fragmentsManager.list && fragmentsManager.list.size > 0) {
      // Try each loaded FragmentsModel
      for (const [uuid, model] of fragmentsManager.list) {
        try {
          // Use FragmentsModel's built-in raycast
          const result = await model.raycast({
            camera: camera,
            mouse: new THREE.Vector2(ndc.x, ndc.y),
            dom: this.container,
          });

          if (result && result.itemId !== undefined) {
            // result.itemId IS the expressID
            const expressID = result.itemId;
            const hitObject = result.object;

            this.highlighter.toggleSelect(hitObject, model, expressID);
            logger.info('Viewport', `Clicked IFC element: expressID=${expressID}, model=${uuid}`);
            foundIFCElement = true;
            break;
          }
        } catch (error) {
          // Model doesn't support raycast or no hit, try next model
        }
      }
    }

    // Fallback to generic Three.js raycast for non-IFC objects
    if (!foundIFCElement) {
      const objects = Array.from(this.world.scene.three.children);
      const hit = this.raycaster.castFirstFromCamera(ndc, camera, objects);

      if (hit && hit.object instanceof THREE.Mesh) {
        // Try to extract IFC data using userData as fallback
        let model: FRAGS.FragmentsModel | undefined;
        let expressID: number | undefined;

        const mesh = hit.object;

        // Check userData for expressID
        if (mesh.userData && mesh.userData.expressID !== undefined) {
          expressID = mesh.userData.expressID;
        }

        // Try to find parent FragmentsModel
        let parent: THREE.Object3D | null = mesh.parent;
        while (parent) {
          if ((parent as any).uuid && fragmentsManager.list) {
            if (fragmentsManager.list.has((parent as any).uuid)) {
              model = fragmentsManager.list.get((parent as any).uuid);
              break;
            }
          }
          parent = parent.parent;
        }

        // Try fragment.getItemID if available
        if (!expressID && hit.faceIndex !== undefined) {
          try {
            const fragment = mesh as any;
            if (fragment.fragment && fragment.fragment.getItemID) {
              expressID = fragment.fragment.getItemID(hit.faceIndex);
            }
          } catch (e) {
            // Not a fragment mesh
          }
        }

        this.highlighter.toggleSelect(hit.object, model, expressID);
        logger.info('Viewport', `Clicked object: ${hit.object.uuid}${expressID !== undefined ? ` (expressID: ${expressID})` : ''}`);
      } else {
        // Clear selection if clicking on empty space
        this.highlighter.clearSelection();
      }
    }
  }

  private onDoubleClick(): void {
    if (!this.mouseTracker || !this.raycaster) return;

    const ndc = this.mouseTracker.ndc;
    const camera = this.world.camera.three;
    const objects = Array.from(this.world.scene.three.children);

    // Perform raycast
    const hit = this.raycaster.castFirstFromCamera(ndc, camera, objects);

    if (hit && hit.object instanceof THREE.Mesh) {
      // Fit camera to the clicked object
      (this.world.camera as OBC.OrthoPerspectiveCamera).fit([hit.object]);
      logger.info('Viewport', `Double-clicked: focusing on object ${hit.object.uuid}`);
    }
  }

  /**
   * Handle keyboard down events
   */
  private onKeyDown(event: KeyboardEvent): void {
    if (!this.selectionManager) return;

    // Ctrl/Cmd key for multi-select
    if (event.ctrlKey || event.metaKey) {
      this.selectionManager.enableMultiSelectMode();
    }

    // Shift key for range select
    if (event.shiftKey) {
      this.selectionManager.enableRangeSelectMode();
    }

    // Don't handle shortcuts if typing in an input field
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    // Escape - Handle tool escape or clear selection
    if (event.key === 'Escape') {
      // First, check if wall creation tool is active
      if (this.wallCreationTool && this.wallCreationTool.isToolActive()) {
        this.wallCreationTool.onEscape();
        event.preventDefault();
        return;
      }

      // Check if door placement tool is active
      if (this.doorPlacementTool && this.doorPlacementTool.isToolActive()) {
        this.doorPlacementTool.onEscape();
        event.preventDefault();
        return;
      }

      // Check if window placement tool is active
      if (this.windowPlacementTool && this.windowPlacementTool.isToolActive()) {
        this.windowPlacementTool.onEscape();
        event.preventDefault();
        return;
      }

      // Otherwise, clear selection
      if (this.highlighter) {
        this.highlighter.clearSelection();
      }
      if (this.selectionManager) {
        this.selectionManager.clearSelection();
      }
      logger.info('Viewport', 'Selection cleared via Escape key');
      event.preventDefault();
    }

    // F - Focus on selected
    if (event.key === 'f' || event.key === 'F') {
      this.focusSelected();
      event.preventDefault();
    }

    // H - Hide selected
    if (event.key === 'h' || event.key === 'H') {
      this.hideSelected();
      event.preventDefault();
    }

    // I - Isolate selected (Shift+I to show all)
    if (event.key === 'i' || event.key === 'I') {
      if (event.shiftKey) {
        this.showAll();
      } else {
        this.isolateSelected();
      }
      event.preventDefault();
    }

    // A - Select all (Ctrl/Cmd+A)
    if ((event.key === 'a' || event.key === 'A') && (event.ctrlKey || event.metaKey)) {
      this.selectAll();
      event.preventDefault();
    }
  }

  /**
   * Handle keyboard up events
   */
  private onKeyUp(event: KeyboardEvent): void {
    if (!this.selectionManager) return;

    // Release Ctrl/Cmd key
    if (!event.ctrlKey && !event.metaKey) {
      this.selectionManager.disableMultiSelectMode();
    }

    // Release Shift key
    if (!event.shiftKey) {
      this.selectionManager.disableRangeSelectMode();
    }
  }

  /**
   * Cast a ray to the ground plane and return the intersection point
   * Uses reusable objects to avoid allocations on every call
   */
  private castToGroundPlane(ndc: THREE.Vector2, camera: THREE.Camera): THREE.Vector3 | null {
    this.groundPlaneRaycaster.setFromCamera(ndc, camera);

    if (this.groundPlaneRaycaster.ray.intersectPlane(this.groundPlane, this.groundPlaneIntersect)) {
      // Return a clone so the caller can modify it without affecting our reusable vector
      return this.groundPlaneIntersect.clone();
    }

    return null;
  }

  /**
   * Create box selection visual overlay
   */
  private createBoxSelectionVisual(): void {
    if (this.boxSelectionDiv) return;

    this.boxSelectionDiv = document.createElement('div');
    this.boxSelectionDiv.style.cssText = `
      position: absolute;
      border: 2px dashed #6366f1;
      background: rgba(99, 102, 241, 0.1);
      pointer-events: none;
      z-index: 1000;
    `;

    this.container.style.position = 'relative';
    this.container.appendChild(this.boxSelectionDiv);
  }

  /**
   * Update box selection visual
   */
  private updateBoxSelectionVisual(): void {
    if (!this.boxSelectionDiv || !this.selectionManager) return;

    const box = this.selectionManager.getBoxSelectionBounds();
    if (!box) return;

    // Convert NDC to screen coordinates
    const canvas = this.world.renderer?.three.domElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const x1 = ((box.min.x + 1) / 2) * width;
    const y1 = ((-box.max.y + 1) / 2) * height;
    const x2 = ((box.max.x + 1) / 2) * width;
    const y2 = ((-box.min.y + 1) / 2) * height;

    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);

    this.boxSelectionDiv.style.left = `${left}px`;
    this.boxSelectionDiv.style.top = `${top}px`;
    this.boxSelectionDiv.style.width = `${w}px`;
    this.boxSelectionDiv.style.height = `${h}px`;
  }

  /**
   * Remove box selection visual
   */
  private removeBoxSelectionVisual(): void {
    if (this.boxSelectionDiv) {
      this.boxSelectionDiv.remove();
      this.boxSelectionDiv = null;
    }
  }

  /**
   * Perform box selection - select all objects within box
   */
  private performBoxSelection(box: THREE.Box2): void {
    if (!this.highlighter || !this.selectionManager || !this.raycaster) return;

    const camera = this.world.camera.three;
    const fragmentsManager = this.components.get(OBC.FragmentsManager);
    const selectedItems: any[] = [];

    // Check all loaded models
    if (fragmentsManager.list && fragmentsManager.list.size > 0) {
      for (const [uuid, model] of fragmentsManager.list) {
        // Get all elements with geometry in the model
        model.getItemsIdsWithGeometry().then((ids: number[]) => {
          ids.forEach((expressID) => {
            // Get object for this element
            // We need to raycast to get the object's screen position
            // This is a simplified approach - in production, you'd cache object positions
            // or use a more efficient spatial query

            // For now, we'll select elements that have their center within the box
            // This is an approximation
          });
        });
      }
    }

    // Fallback: select visible meshes within box
    const objects = Array.from(this.world.scene.three.children);
    objects.forEach((obj) => {
      if (obj instanceof THREE.Mesh && obj.visible) {
        // Project object center to screen space
        const center = new THREE.Vector3();
        obj.getWorldPosition(center);

        const projected = center.clone();
        projected.project(camera);

        // Check if projected point is within box
        if (
          projected.x >= box.min.x &&
          projected.x <= box.max.x &&
          projected.y >= box.min.y &&
          projected.y <= box.max.y
        ) {
          selectedItems.push({
            object: obj,
            model: undefined,
            expressID: undefined,
          });
        }
      }
    });

    // Apply selection
    if (selectedItems.length > 0) {
      this.selectionManager.selectMultiple(selectedItems, 'viewport', !this.selectionManager.isMultiSelectActive());

      // Update highlighter
      selectedItems.forEach((item) => {
        this.highlighter?.select(item.object, item.model, item.expressID, 'viewport');
      });

      logger.info('Viewport', `Box selected ${selectedItems.length} objects`);
    }
  }

  /**
   * Select all visible objects
   */
  private selectAll(): void {
    if (!this.highlighter || !this.selectionManager) return;

    const objects = Array.from(this.world.scene.three.children);
    const selectedItems: any[] = [];

    objects.forEach((obj) => {
      if (obj instanceof THREE.Mesh && obj.visible) {
        selectedItems.push({
          object: obj,
          model: undefined,
          expressID: undefined,
        });
      }
    });

    if (selectedItems.length > 0) {
      this.selectionManager.selectMultiple(selectedItems, 'viewport', true);

      // Update highlighter
      selectedItems.forEach((item) => {
        this.highlighter?.select(item.object, item.model, item.expressID, 'viewport');
      });

      logger.info('Viewport', `Selected all: ${selectedItems.length} objects`);
    }
  }

  /**
   * Isolate selected elements (hide all except selected)
   */
  public async isolateSelected(): Promise<void> {
    if (!this.highlighter || !this.highlighter.selection.selected.size) {
      logger.warn('Viewport', 'No objects selected to isolate');
      return;
    }

    const fragmentsManager = this.components.get(OBC.FragmentsManager);

    // Hide all fragments first
    if (fragmentsManager.list && fragmentsManager.list.size > 0) {
      for (const [uuid, model] of fragmentsManager.list) {
        await model.setVisible(undefined, false);
      }
    }

    // Show only selected fragments
    for (const [model, expressIDs] of this.highlighter.selection.selected) {
      if (model) {
        // Show the entire model first
        await model.setVisible(undefined, true);

        // If we have specific expressIDs, we could filter further
        // but for now we show the entire model containing selections
        logger.debug('Viewport', `Showing model ${model.uuid} with ${expressIDs.size} selected elements`);
      }
    }

    logger.info('Viewport', 'Isolated selected elements');
    eventBus.emit(Events.VIEWPORT_UPDATED, { viewportId: this.id });
  }

  /**
   * Hide selected elements
   */
  public async hideSelected(): Promise<void> {
    if (!this.highlighter || !this.highlighter.selection.selected.size) {
      logger.warn('Viewport', 'No objects selected to hide');
      return;
    }

    for (const [model, expressIDs] of this.highlighter.selection.selected) {
      if (model) {
        // Hide the model containing selected elements
        await model.setVisible(undefined, false);
        logger.debug('Viewport', `Hiding model ${model.uuid}`);
      }
    }

    // Clear selection after hiding
    this.highlighter.clearSelection();

    logger.info('Viewport', 'Hidden selected elements');
    eventBus.emit(Events.VIEWPORT_UPDATED, { viewportId: this.id });
  }

  /**
   * Show all elements (reset visibility)
   */
  public async showAll(): Promise<void> {
    const fragmentsManager = this.components.get(OBC.FragmentsManager);

    if (fragmentsManager.list && fragmentsManager.list.size > 0) {
      for (const [uuid, model] of fragmentsManager.list) {
        await model.setVisible(undefined, true);
      }
    }

    logger.info('Viewport', 'Showing all elements');
    eventBus.emit(Events.VIEWPORT_UPDATED, { viewportId: this.id });
  }

  public dispose(): void {
    logger.info('Viewport', `Disposing viewport ${this.id}`);

    // Clean up interaction systems
    const canvas = this.world.renderer?.three.domElement;
    if (canvas) {
      if (this.mouseMoveHandler) {
        canvas.removeEventListener('mousemove', this.mouseMoveHandler);
      }
      if (this.clickHandler) {
        canvas.removeEventListener('click', this.clickHandler);
      }
      if (this.dblClickHandler) {
        canvas.removeEventListener('dblclick', this.dblClickHandler);
      }
      if (this.mouseDownHandler) {
        canvas.removeEventListener('mousedown', this.mouseDownHandler);
      }
      if (this.mouseUpHandler) {
        canvas.removeEventListener('mouseup', this.mouseUpHandler);
      }
    }

    // Remove keyboard listeners
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler);
    }
    if (this.keyUpHandler) {
      window.removeEventListener('keyup', this.keyUpHandler);
    }

    // Clean up box selection visual
    this.removeBoxSelectionVisual();

    if (this.mouseTracker) {
      this.mouseTracker.dispose();
      this.mouseTracker = null;
    }

    if (this.highlighter) {
      this.highlighter.dispose();
      this.highlighter = null;
    }

    if (this.measurementManager) {
      this.measurementManager.dispose();
      this.measurementManager = null;
    }

    if (this.clippingManager) {
      this.clippingManager.dispose();
      this.clippingManager = null;
    }

    if (this.cameraPresetManager) {
      this.cameraPresetManager.dispose();
      this.cameraPresetManager = null;
    }

    if (this.modelComparisonManager) {
      this.modelComparisonManager.dispose();
      this.modelComparisonManager = null;
    }

    if (this.annotationManager) {
      this.annotationManager.dispose();
      this.annotationManager = null;
    }

    if (this.filterManager) {
      this.filterManager.dispose();
      this.filterManager = null;
    }

    if (this.clashDetectionManager) {
      this.clashDetectionManager.dispose();
      this.clashDetectionManager = null;
    }

    if (this.selectionManager) {
      this.selectionManager.dispose();
      this.selectionManager = null;
    }

    if (this.viewCubeWidget) {
      this.viewCubeWidget.destroy();
      this.viewCubeWidget = null;
    }

    this.raycaster = null;

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.world.dispose();
  }

  public get canvas(): HTMLCanvasElement | null {
    return this.world.renderer?.three.domElement || null;
  }

  public get enabled(): boolean {
    return this.world.enabled;
  }

  public set enabled(value: boolean) {
    this.world.enabled = value;
  }
}
