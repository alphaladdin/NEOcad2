/**
 * NEOcad - Main Application Entry Point
 */

import { createNEOcad } from '@core/NEOcad';
import { logger, LogLevel } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { addTestScene } from '@utils/TestGeometry';
import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';

// Set development log level
logger.setLogLevel(LogLevel.DEBUG);

/**
 * Initialize the application
 */
async function main() {
  try {
    logger.info('Main', 'Starting NEOcad...');

    // Get container element
    const container = document.getElementById('viewer-container');
    if (!container) {
      throw new Error('Viewer container not found');
    }

    // Register event listeners BEFORE creating app
    let app: any = null;

    logger.info('Main', 'Registering event listeners...');

    // Hide loading screen when ready
    eventBus.on(Events.APP_READY, async () => {
      logger.info('Main', 'APP_READY event received!');

      const loadingScreen = document.getElementById('loading');
      if (loadingScreen) {
        loadingScreen.classList.add('hidden');
      }
      logger.info('Main', 'Application ready!');

      // Start with blank canvas - set 2D plan view
      const { NEOcad } = await import('@core/NEOcad');
      const appInstance = NEOcad.getInstance();
      if (appInstance) {
        const viewport = appInstance.viewportManager.getActiveViewport();
        if (viewport && viewport.world.camera) {
          // Set camera to pure 2D plan view (looking straight down)
          // Position camera 60 feet (18.288m) above origin for 60x60ft viewport
          const camera = viewport.world.camera as any;
          const controls = camera.controls;

          if (controls && controls.setLookAt) {
            // Set to isometric-style plan view (30-degree angle from above)
            // This allows seeing wall heights while still being mostly top-down
            const distance = 18.288; // 60 feet
            const angle = Math.PI / 6; // 30 degrees
            const height = distance * Math.cos(angle);
            const offset = distance * Math.sin(angle);

            controls.setLookAt(
              offset, height, offset,  // Camera position (angled view)
              0, 0, 0,                  // Look at origin
              false                     // No animation
            );
            logger.info('Main', 'Starting in isometric plan view (30° angle)');
          }
        }
      }
    });

    // Handle errors
    eventBus.on(Events.APP_ERROR, (error) => {
      logger.error('Main', 'Application error', error);
      alert('An error occurred while loading NEOcad. Check the console for details.');
    });

    // Create NEOcad instance (event listeners are now registered)
    app = await createNEOcad({
      container,
      logLevel: LogLevel.DEBUG,
      autoInit: true,
    });

    // Make app globally available for debugging and testing
    if (import.meta.env.DEV) {
      (window as any).neocad = app;
      (window as any).logger = logger;
      (window as any).eventBus = eventBus;
      (window as any).Events = Events;
      (window as any).THREE = THREE;
      (window as any).TWEEN = TWEEN;
      logger.info('Main', 'Debug: window.neocad, window.logger, window.eventBus, window.Events, window.THREE, and window.TWEEN are available');
    }

    logger.info('Main', 'NEOcad started successfully');
  } catch (error) {
    logger.error('Main', 'Fatal error during initialization', error);
    alert('Failed to start NEOcad. Please refresh the page and try again.');
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// Handle window unload
window.addEventListener('beforeunload', async () => {
  const app = (await import('@core/NEOcad')).NEOcad.getInstance();
  if (app) {
    await app.dispose();
  }
});
