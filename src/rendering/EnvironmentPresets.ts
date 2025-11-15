/**
 * EnvironmentPresets - Manages different 3D environment settings
 * Includes realistic outdoor, indoor studio, night, and other presets
 */

import * as THREE from 'three';

export interface EnvironmentConfig {
  name: string;
  description: string;

  // Sky/Background
  skyType: 'color' | 'gradient' | 'skybox' | 'procedural';
  skyColor?: THREE.Color;
  skyGradientTop?: THREE.Color;
  skyGradientBottom?: THREE.Color;

  // Ground
  groundType: 'grid' | 'plane' | 'grass' | 'none';
  groundColor?: THREE.Color;
  groundSize?: number;

  // Lighting
  ambientLight: {
    color: THREE.Color;
    intensity: number;
  };
  directionalLight: {
    color: THREE.Color;
    intensity: number;
    position: THREE.Vector3;
    castShadow: boolean;
  };

  // Shadows
  enableShadows: boolean;

  // Fog
  enableFog: boolean;
  fogColor?: THREE.Color;
  fogNear?: number;
  fogFar?: number;
}

/**
 * Create a realistic grass ground plane with texture
 */
function createGrassGround(size: number = 100): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(size, size, 50, 50);

  // Create procedural grass texture using canvas
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base grass color
  const grassBase = '#4a7c2e';
  const grassDark = '#3a6323';
  const grassLight = '#5a8c3e';

  // Fill with base color
  ctx.fillStyle = grassBase;
  ctx.fillRect(0, 0, 512, 512);

  // Add random grass blade variations
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const color = Math.random() > 0.5 ? grassDark : grassLight;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 20);

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.9,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;

  return mesh;
}

/**
 * Create procedural sky with clouds
 */
function createProceduralSky(scene: THREE.Scene): void {
  // Create sky gradient
  const skyGeo = new THREE.SphereGeometry(500, 32, 15);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x0077ff) },
      bottomColor: { value: new THREE.Color(0xffffff) },
      offset: { value: 33 },
      exponent: { value: 0.6 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    side: THREE.BackSide
  });

  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Add simple cloud planes
  const cloudGeometry = new THREE.PlaneGeometry(30, 10);
  const cloudMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  });

  // Create several cloud instances
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial.clone());
    const angle = (i / 12) * Math.PI * 2;
    const radius = 100 + Math.random() * 50;
    cloud.position.set(
      Math.cos(angle) * radius,
      40 + Math.random() * 30,
      Math.sin(angle) * radius
    );
    cloud.rotation.y = angle + Math.PI / 2;
    cloud.scale.set(1 + Math.random(), 0.3 + Math.random() * 0.3, 1);
    scene.add(cloud);
  }
}

/**
 * Create simple grid helper
 */
function createGridGround(size: number = 20): THREE.GridHelper {
  return new THREE.GridHelper(size, size, 0x444444, 0x222222);
}

/**
 * Create simple ground plane
 */
function createPlaneGround(size: number = 100, color: THREE.Color = new THREE.Color(0x333333)): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.8,
    metalness: 0.2,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;

  return mesh;
}

/**
 * Environment preset configurations
 */
export const ENVIRONMENT_PRESETS: Record<string, EnvironmentConfig> = {
  'realistic-outdoor': {
    name: 'Realistic Outdoor',
    description: 'Sunny day with grass, clouds, and realistic shadows',
    skyType: 'procedural',
    groundType: 'grass',
    groundSize: 100,
    ambientLight: {
      color: new THREE.Color(0xffffff), // Neutral white for accurate material colors
      intensity: 0.5,
    },
    directionalLight: {
      color: new THREE.Color(0xfff8dc), // Warm sunlight
      intensity: 1.2,
      position: new THREE.Vector3(50, 100, 50),
      castShadow: true,
    },
    enableShadows: true,
    enableFog: true,
    fogColor: new THREE.Color(0xccddff),
    fogNear: 50,
    fogFar: 300,
  },

  'studio': {
    name: 'Studio',
    description: 'Clean studio lighting with neutral background',
    skyType: 'gradient',
    skyGradientTop: new THREE.Color(0x444444),
    skyGradientBottom: new THREE.Color(0x222222),
    groundType: 'plane',
    groundColor: new THREE.Color(0x2a2a2a),
    groundSize: 100,
    ambientLight: {
      color: new THREE.Color(0xffffff),
      intensity: 0.5,
    },
    directionalLight: {
      color: new THREE.Color(0xffffff),
      intensity: 0.8,
      position: new THREE.Vector3(10, 20, 10),
      castShadow: true,
    },
    enableShadows: true,
    enableFog: false,
  },

  'night': {
    name: 'Night',
    description: 'Moonlit scene with cool lighting',
    skyType: 'color',
    skyColor: new THREE.Color(0x0a0a1a),
    groundType: 'grass',
    groundSize: 100,
    ambientLight: {
      color: new THREE.Color(0x4466aa),
      intensity: 0.2,
    },
    directionalLight: {
      color: new THREE.Color(0x9999cc),
      intensity: 0.4,
      position: new THREE.Vector3(-50, 80, -50),
      castShadow: true,
    },
    enableShadows: true,
    enableFog: true,
    fogColor: new THREE.Color(0x0a0a1a),
    fogNear: 30,
    fogFar: 150,
  },

  'default': {
    name: 'Default',
    description: 'Simple grid with neutral lighting',
    skyType: 'color',
    skyColor: new THREE.Color(0x1a1a1a),
    groundType: 'grid',
    groundSize: 20,
    ambientLight: {
      color: new THREE.Color(0xffffff),
      intensity: 0.3,
    },
    directionalLight: {
      color: new THREE.Color(0xffffff),
      intensity: 0.4,
      position: new THREE.Vector3(5, 10, 5),
      castShadow: false,
    },
    enableShadows: false,
    enableFog: false,
  },
};

/**
 * EnvironmentManager - Manages 3D scene environment
 */
export class EnvironmentManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private currentPreset: string = 'default';

  private ambientLight: THREE.AmbientLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;
  private ground: THREE.Object3D | null = null;
  private skyObjects: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
  }

  /**
   * Apply an environment preset
   */
  applyPreset(presetName: string): void {
    const preset = ENVIRONMENT_PRESETS[presetName];
    if (!preset) {
      console.warn(`Environment preset '${presetName}' not found`);
      return;
    }

    // Clear existing environment
    this.clear();

    // Set sky/background
    this.setupSky(preset);

    // Set ground
    this.setupGround(preset);

    // Set lighting
    this.setupLighting(preset);

    // Set shadows
    this.renderer.shadowMap.enabled = preset.enableShadows;
    if (preset.enableShadows) {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // Set fog
    if (preset.enableFog && preset.fogColor) {
      this.scene.fog = new THREE.Fog(preset.fogColor, preset.fogNear || 50, preset.fogFar || 200);
    } else {
      this.scene.fog = null;
    }

    this.currentPreset = presetName;
    console.log(`Applied environment preset: ${preset.name}`);
  }

  /**
   * Setup sky/background
   */
  private setupSky(preset: EnvironmentConfig): void {
    switch (preset.skyType) {
      case 'color':
        this.scene.background = preset.skyColor || new THREE.Color(0x1a1a1a);
        break;

      case 'gradient':
        // Use shader material for gradient background
        const gradientGeo = new THREE.SphereGeometry(500, 32, 15);
        const gradientMat = new THREE.ShaderMaterial({
          uniforms: {
            topColor: { value: preset.skyGradientTop || new THREE.Color(0x444444) },
            bottomColor: { value: preset.skyGradientBottom || new THREE.Color(0x222222) },
          },
          vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              vWorldPosition = worldPosition.xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            varying vec3 vWorldPosition;
            void main() {
              float h = normalize(vWorldPosition).y;
              gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
            }
          `,
          side: THREE.BackSide
        });
        const gradientSky = new THREE.Mesh(gradientGeo, gradientMat);
        this.scene.add(gradientSky);
        this.skyObjects.push(gradientSky);
        this.scene.background = new THREE.Color(0x000000);
        break;

      case 'procedural':
        createProceduralSky(this.scene);
        this.scene.background = new THREE.Color(0x87ceeb);
        break;
    }
  }

  /**
   * Setup ground
   */
  private setupGround(preset: EnvironmentConfig): void {
    switch (preset.groundType) {
      case 'grid':
        this.ground = createGridGround(preset.groundSize || 20);
        this.scene.add(this.ground);
        break;

      case 'plane':
        this.ground = createPlaneGround(preset.groundSize || 100, preset.groundColor);
        this.scene.add(this.ground);
        break;

      case 'grass':
        this.ground = createGrassGround(preset.groundSize || 100);
        this.scene.add(this.ground);
        break;

      case 'none':
        // No ground
        break;
    }
  }

  /**
   * Setup lighting
   */
  private setupLighting(preset: EnvironmentConfig): void {
    // Ambient light
    this.ambientLight = new THREE.AmbientLight(
      preset.ambientLight.color,
      preset.ambientLight.intensity
    );
    this.scene.add(this.ambientLight);

    // Directional light (sun/main light)
    this.directionalLight = new THREE.DirectionalLight(
      preset.directionalLight.color,
      preset.directionalLight.intensity
    );
    this.directionalLight.position.copy(preset.directionalLight.position);
    this.directionalLight.castShadow = preset.directionalLight.castShadow;

    if (preset.directionalLight.castShadow) {
      // Configure shadow properties
      this.directionalLight.shadow.mapSize.width = 2048;
      this.directionalLight.shadow.mapSize.height = 2048;
      this.directionalLight.shadow.camera.near = 0.5;
      this.directionalLight.shadow.camera.far = 500;

      // Shadow camera frustum
      const d = 50;
      this.directionalLight.shadow.camera.left = -d;
      this.directionalLight.shadow.camera.right = d;
      this.directionalLight.shadow.camera.top = d;
      this.directionalLight.shadow.camera.bottom = -d;

      this.directionalLight.shadow.bias = -0.0001;
    }

    this.scene.add(this.directionalLight);
  }

  /**
   * Clear current environment
   */
  private clear(): void {
    // Remove lights
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight = null;
    }
    if (this.directionalLight) {
      this.scene.remove(this.directionalLight);
      this.directionalLight = null;
    }

    // Remove ground
    if (this.ground) {
      this.scene.remove(this.ground);
      if (this.ground instanceof THREE.Mesh) {
        this.ground.geometry.dispose();
        if (Array.isArray(this.ground.material)) {
          this.ground.material.forEach(m => m.dispose());
        } else {
          this.ground.material.dispose();
        }
      }
      this.ground = null;
    }

    // Remove sky objects
    this.skyObjects.forEach(obj => {
      this.scene.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.skyObjects = [];
  }

  /**
   * Get current preset name
   */
  getCurrentPreset(): string {
    return this.currentPreset;
  }

  /**
   * Get list of available presets
   */
  getAvailablePresets(): string[] {
    return Object.keys(ENVIRONMENT_PRESETS);
  }

  /**
   * Get preset configuration
   */
  getPresetConfig(presetName: string): EnvironmentConfig | undefined {
    return ENVIRONMENT_PRESETS[presetName];
  }
}
