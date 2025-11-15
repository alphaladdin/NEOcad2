/**
 * ViewCubeWidget - 3D interactive view cube in viewport corner
 * Provides quick access to standard orthographic and isometric views
 * Bidirectional sync: rotate cube to rotate viewport, and vice versa
 */

import { logger } from '@utils/Logger';
import { eventBus } from '@core/EventBus';
import * as THREE from 'three';

export interface ViewCubeConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  size?: number;
}

export interface CameraView {
  id: string;
  name: string;
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/**
 * ViewCubeWidget class - renders an actual 3D cube with clickable faces
 * The cube orientation is bidirectionally synced with the main viewport camera
 */
export class ViewCubeWidget {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private viewportElement: HTMLElement;
  private config: Required<ViewCubeConfig>;

  // Three.js components for the cube
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private cube: THREE.Mesh;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private views: Map<string, CameraView>;

  // Main viewport camera reference
  private mainCamera: THREE.Camera | null = null;
  private mainCameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private cameraDistance: number = 20; // Distance from target

  // Interaction state
  private isDragging: boolean = false;
  private previousMousePosition: { x: number; y: number } = { x: 0, y: 0 };
  private mouseDownPosition: { x: number; y: number } = { x: 0, y: 0 };
  private hoveredFace: number | null = null;
  private userIsRotating: boolean = false; // Flag to prevent feedback loop
  private hasMoved: boolean = false; // Track if mouse moved during drag

  // Animation state
  private isAnimating: boolean = false;
  private animationStartTime: number = 0;
  private animationDuration: number = 500; // milliseconds
  private animationStartRotation: THREE.Euler = new THREE.Euler();
  private animationTargetRotation: THREE.Euler = new THREE.Euler();

  constructor(viewportElement: HTMLElement, config: ViewCubeConfig = {}) {
    this.viewportElement = viewportElement;
    this.config = {
      position: config.position || 'top-right',
      size: config.size || 120,
    };

    this.container = this.createContainer();
    this.canvas = this.createCanvas();
    this.container.appendChild(this.canvas);
    this.viewportElement.appendChild(this.container);

    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true
    });
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.initializeViews();
    this.setupScene();
    this.setupEventListeners();
    this.animate();

    logger.debug('ViewCubeWidget', 'ViewCube widget created');
  }

  /**
   * Set the main viewport camera to mirror
   */
  setMainCamera(camera: THREE.Camera, target?: THREE.Vector3): void {
    this.mainCamera = camera;
    if (target) {
      this.mainCameraTarget.copy(target);
    }
  }

  /**
   * Update the camera target (look-at point)
   */
  updateCameraTarget(target: THREE.Vector3): void {
    this.mainCameraTarget.copy(target);
  }

  /**
   * Create the container element
   */
  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `view-cube-container ${this.config.position}`;
    container.style.cssText = `
      position: absolute;
      width: ${this.config.size}px;
      height: ${this.config.size}px;
      pointer-events: auto;
      z-index: 500;
    `;

    // Position the container
    if (this.config.position.includes('top')) {
      container.style.top = '20px';
    } else {
      container.style.bottom = '20px';
    }

    if (this.config.position.includes('right')) {
      container.style.right = '20px';
    } else {
      container.style.left = '20px';
    }

    return container;
  }

  /**
   * Create the canvas element
   */
  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.config.size;
    canvas.height = this.config.size;
    canvas.style.cssText = `
      display: block;
      cursor: grab;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;
    return canvas;
  }

  /**
   * Initialize standard camera views
   */
  private initializeViews(): void {
    const distance = 20;

    this.views = new Map([
      ['front', {
        id: 'front',
        name: 'Front',
        position: new THREE.Vector3(0, 0, distance),
        target: new THREE.Vector3(0, 0, 0),
      }],
      ['back', {
        id: 'back',
        name: 'Back',
        position: new THREE.Vector3(0, 0, -distance),
        target: new THREE.Vector3(0, 0, 0),
      }],
      ['left', {
        id: 'left',
        name: 'Left',
        position: new THREE.Vector3(-distance, 0, 0),
        target: new THREE.Vector3(0, 0, 0),
      }],
      ['right', {
        id: 'right',
        name: 'Right',
        position: new THREE.Vector3(distance, 0, 0),
        target: new THREE.Vector3(0, 0, 0),
      }],
      ['top', {
        id: 'top',
        name: 'Top',
        position: new THREE.Vector3(0, distance, 0),
        target: new THREE.Vector3(0, 0, 0),
      }],
      ['bottom', {
        id: 'bottom',
        name: 'Bottom',
        position: new THREE.Vector3(0, -distance, 0),
        target: new THREE.Vector3(0, 0, 0),
      }],
    ]);
  }

  /**
   * Setup the 3D scene with cube
   */
  private setupScene(): void {
    // Setup renderer
    this.renderer.setSize(this.config.size, this.config.size);
    this.renderer.setClearColor(0x000000, 0);

    // Setup camera
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    // Create cube geometry
    const geometry = new THREE.BoxGeometry(2, 2, 2);

    // Create materials for each face with different colors
    const materials = [
      this.createFaceMaterial(0xe74c3c, 'RIGHT'),  // Right - Red
      this.createFaceMaterial(0x3498db, 'LEFT'),   // Left - Blue
      this.createFaceMaterial(0x2ecc71, 'TOP'),    // Top - Green
      this.createFaceMaterial(0x9b59b6, 'BOTTOM'), // Bottom - Purple
      this.createFaceMaterial(0xf39c12, 'FRONT'),  // Front - Orange
      this.createFaceMaterial(0x1abc9c, 'BACK'),   // Back - Turquoise
    ];

    this.cube = new THREE.Mesh(geometry, materials);
    this.scene.add(this.cube);

    // Add edges to make the cube more visible
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );
    this.cube.add(line);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);
  }

  /**
   * Create a material for a cube face with text
   */
  private createFaceMaterial(color: number, text: string): THREE.MeshLambertMaterial {
    // Create a canvas for the texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Fill background
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 256, 256);

    // Add text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 128);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);

    return new THREE.MeshLambertMaterial({
      map: texture,
      color: 0xffffff,
    });
  }

  /**
   * Setup event listeners for interaction
   */
  private setupEventListeners(): void {
    // Mouse down - start potential drag
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.hasMoved = false;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
      this.mouseDownPosition = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
    });

    // Mouse move - rotate cube or check hover
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const deltaX = e.clientX - this.previousMousePosition.x;
        const deltaY = e.clientY - this.previousMousePosition.y;

        // Check if mouse has moved significantly (more than 3 pixels)
        const totalDelta = Math.abs(e.clientX - this.mouseDownPosition.x) +
                          Math.abs(e.clientY - this.mouseDownPosition.y);

        if (totalDelta > 3) {
          this.hasMoved = true;

          // Rotate the cube to match Autodesk ViewCube behavior
          // Drag right = rotate right, drag up = rotate up
          this.cube.rotation.y += deltaX * 0.01;
          this.cube.rotation.x += deltaY * 0.01;

          // Mark that user is actively rotating
          this.userIsRotating = true;

          // Update the main camera to match cube rotation
          this.updateMainCameraFromCube();
        }

        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      } else {
        // Check for face hover
        this.checkFaceHover(e);
      }
    });

    // Mouse up - stop dragging
    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';

        // Small delay before allowing viewport to update cube again (only if we rotated)
        if (this.hasMoved) {
          setTimeout(() => {
            this.userIsRotating = false;
          }, 100);
        }
      }
    });

    // Click - select view (only if not dragging)
    this.canvas.addEventListener('click', (e) => {
      // Only handle click if we didn't move the mouse (was a true click, not a drag)
      if (!this.hasMoved) {
        this.handleClick(e);
      }
      // Reset the flag after handling click
      this.hasMoved = false;
    });
  }

  /**
   * Check which face is being hovered
   */
  private checkFaceHover(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.cube);

    if (intersects.length > 0) {
      const faceIndex = intersects[0].faceIndex;
      if (faceIndex !== undefined) {
        const materialIndex = Math.floor(faceIndex / 2);
        if (this.hoveredFace !== materialIndex) {
          this.hoveredFace = materialIndex;
          this.canvas.style.cursor = 'pointer';
        }
      }
    } else {
      this.hoveredFace = null;
      this.canvas.style.cursor = 'grab';
    }
  }

  /**
   * Handle click on cube face
   */
  private handleClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.cube);

    if (intersects.length > 0) {
      const faceIndex = intersects[0].faceIndex;
      if (faceIndex !== undefined) {
        const materialIndex = Math.floor(faceIndex / 2);
        const viewIds = ['right', 'left', 'top', 'bottom', 'front', 'back'];
        const viewId = viewIds[materialIndex];
        const view = this.views.get(viewId);

        if (view) {
          this.selectView(view);
        }
      }
    }
  }

  /**
   * Select a camera view
   */
  private selectView(view: CameraView): void {
    // Start cube animation to face the selected view
    this.animateCubeToView(view.id);

    // Emit event to animate camera to the view
    eventBus.emit('viewport:set-camera-view', {
      position: view.position,
      target: view.target,
      viewId: view.id,
      animate: true,
    });

    logger.info('ViewCubeWidget', `Camera view changed to: ${view.name}`);
  }

  /**
   * Animate cube to show a specific face front-facing
   */
  private animateCubeToView(viewId: string): void {
    // Define target rotations for each face to appear front-facing
    const faceRotations: { [key: string]: { x: number; y: number; z: number } } = {
      front: { x: 0, y: 0, z: 0 },
      back: { x: 0, y: Math.PI, z: 0 },
      right: { x: 0, y: -Math.PI / 2, z: 0 },
      left: { x: 0, y: Math.PI / 2, z: 0 },
      top: { x: -Math.PI / 2, y: 0, z: 0 },
      bottom: { x: Math.PI / 2, y: 0, z: 0 },
    };

    const targetRot = faceRotations[viewId];
    if (!targetRot) return;

    // Reset userIsRotating flag when starting new animation
    // This allows the new animation to proceed
    this.userIsRotating = false;

    // Store current rotation as start
    this.animationStartRotation.copy(this.cube.rotation);

    // Set target rotation
    this.animationTargetRotation.set(targetRot.x, targetRot.y, targetRot.z);

    // Start animation
    this.isAnimating = true;
    this.userIsRotating = true; // Prevent feedback during animation
    this.animationStartTime = Date.now();

    logger.debug('ViewCubeWidget', `Animating cube to ${viewId} view`);
  }

  /**
   * Update main camera position based on cube rotation
   */
  private updateMainCameraFromCube(): void {
    if (!this.mainCamera) return;

    // Calculate camera position from cube rotation
    // Start with a vector pointing in the default camera direction
    const direction = new THREE.Vector3(0, 0, 1);

    // Apply inverse of cube rotation to get camera direction
    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(new THREE.Euler(
      -this.cube.rotation.x,
      -this.cube.rotation.y + Math.PI,
      -this.cube.rotation.z
    ));

    direction.applyQuaternion(quaternion);
    direction.normalize();

    // Calculate new camera position
    const newPosition = this.mainCameraTarget.clone();
    newPosition.addScaledVector(direction, this.cameraDistance);

    // Emit event to update viewport camera
    eventBus.emit('viewport:update-camera-position', {
      position: newPosition,
      target: this.mainCameraTarget,
      animate: false, // No animation during drag for smooth experience
    });
  }

  /**
   * Update cube orientation to match main camera
   */
  private updateCubeOrientation(): void {
    if (!this.mainCamera || this.userIsRotating || this.isAnimating) return;

    // Calculate direction from camera to target
    const direction = new THREE.Vector3();
    direction.subVectors(this.mainCamera.position, this.mainCameraTarget).normalize();

    // Calculate rotation to align cube with camera view
    const matrix = new THREE.Matrix4();
    matrix.lookAt(direction, new THREE.Vector3(0, 0, 0), this.mainCamera.up);

    // Extract rotation from matrix and invert it
    const rotation = new THREE.Euler();
    rotation.setFromRotationMatrix(matrix);

    // Apply inverted rotation to cube
    this.cube.rotation.x = -rotation.x;
    this.cube.rotation.y = -rotation.y + Math.PI;
    this.cube.rotation.z = -rotation.z;
  }

  /**
   * Animation loop
   */
  private animate = (): void => {
    requestAnimationFrame(this.animate);

    // Handle cube animation if active
    if (this.isAnimating) {
      this.updateCubeAnimation();
    } else {
      // Update cube orientation to match main camera (unless user is dragging)
      this.updateCubeOrientation();
    }

    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Update cube animation frame
   */
  private updateCubeAnimation(): void {
    const elapsed = Date.now() - this.animationStartTime;
    const progress = Math.min(elapsed / this.animationDuration, 1);

    // Easing function (ease-in-out)
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    // Interpolate rotation
    this.cube.rotation.x = this.animationStartRotation.x +
      (this.animationTargetRotation.x - this.animationStartRotation.x) * eased;
    this.cube.rotation.y = this.animationStartRotation.y +
      (this.animationTargetRotation.y - this.animationStartRotation.y) * eased;
    this.cube.rotation.z = this.animationStartRotation.z +
      (this.animationTargetRotation.z - this.animationStartRotation.z) * eased;

    // Check if animation is complete
    if (progress >= 1) {
      this.isAnimating = false;
      // Don't reset userIsRotating - keep cube locked in this orientation
      // until user manually rotates it or clicks another face
      logger.debug('ViewCubeWidget', 'Cube animation completed - staying in face-forward view');
    }
  }

  /**
   * Show the widget
   */
  show(): void {
    this.container.style.display = 'block';
  }

  /**
   * Hide the widget
   */
  hide(): void {
    this.container.style.display = 'none';
  }

  /**
   * Update widget position
   */
  setPosition(position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'): void {
    this.container.classList.remove(this.config.position);
    this.config.position = position;
    this.container.classList.add(position);

    // Update inline styles
    this.container.style.top = '';
    this.container.style.bottom = '';
    this.container.style.left = '';
    this.container.style.right = '';

    if (position.includes('top')) {
      this.container.style.top = '20px';
    } else {
      this.container.style.bottom = '20px';
    }

    if (position.includes('right')) {
      this.container.style.right = '20px';
    } else {
      this.container.style.left = '20px';
    }
  }

  /**
   * Destroy the widget
   */
  destroy(): void {
    // Dispose Three.js resources
    this.cube.geometry.dispose();
    if (Array.isArray(this.cube.material)) {
      this.cube.material.forEach(mat => {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
    }
    this.renderer.dispose();
    this.container.remove();

    logger.info('ViewCubeWidget', 'ViewCube widget destroyed');
  }
}
