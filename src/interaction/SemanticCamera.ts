/**
 * interaction/SemanticCamera.ts — AGI-Aware Camera Controller
 * 
 * Provides high-level semantic controls for cinematic navigation
 * through the knowledge graph.
 */

import * as THREE from 'three';
import { NodePayload } from '../streaming/types';

export interface CameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  zoom: number;
}

export class SemanticCameraAPI {
  private camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  private controls: any;

  constructor(camera: THREE.OrthographicCamera | THREE.PerspectiveCamera, controls: any) {
    this.camera = camera;
    this.controls = controls;
  }

  /**
   * Focuses the camera on a specific node gracefully.
   */
  focusOnNode(node: NodePayload, duration: number = 1000) {
    if (!node.x || !node.y) return;
    this.animateTo({
      position: new THREE.Vector3(node.x, node.y, this.camera.position.z),
      target: new THREE.Vector3(node.x, node.y, 0),
      zoom: (this.camera as THREE.OrthographicCamera).zoom || 1
    }, duration);
  }

  /**
   * Centers and zooms the camera to fit a set of nodes.
   */
  focusOnCluster(nodes: NodePayload[], padding: number = 1.2, duration: number = 1000) {
    if (nodes.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const n of nodes) {
      if (n.x === undefined || n.y === undefined) continue;
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Simple zoom approximation for Orthographic camera
    const width = (maxX - minX) * padding;
    const height = (maxY - minY) * padding;
    
    // targetZoom calc based on fixed 500 units logic
    const targetZoom = Math.min(500 / width, 500 / height);

    this.animateTo({
      position: new THREE.Vector3(centerX, centerY, this.camera.position.z),
      target: new THREE.Vector3(centerX, centerY, 0),
      zoom: targetZoom
    }, duration);
  }

  /**
   * Plays a "reasoning trace" animation by following a sequence of nodes.
   */
  async followTrace(nodes: NodePayload[], stepDuration: number = 1500) {
    for (const node of nodes) {
      this.focusOnNode(node, stepDuration);
      await new Promise(resolve => setTimeout(resolve, stepDuration + 200));
    }
  }

  private animateTo(target: CameraState, _duration: number) {
    // Note: Actual lerp logic should ideally be handled in useFrame or a tweening lib.
    // Here we update the controls target and camera position directly for the "API" feel.
    if (this.controls) {
      this.controls.target.copy(target.target);
      this.camera.position.set(target.position.x, target.position.y, target.position.z);
      if ('zoom' in this.camera) {
        (this.camera as THREE.OrthographicCamera).zoom = target.zoom;
        (this.camera as THREE.OrthographicCamera).updateProjectionMatrix();
      }
      this.controls.update();
    }
  }
}
