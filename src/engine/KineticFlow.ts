import * as THREE from 'three';
import { calculateGeodesic } from '../math/poincare';

export class KineticFlowEngine {
  private particles: THREE.InstancedMesh;
  private particleCount: number = 5000;
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.SphereGeometry(0.005, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ 
      color: '#ff00ff', 
      transparent: true, 
      opacity: 0.8,
      blending: THREE.AdditiveBlending 
    });
    this.particles = new THREE.InstancedMesh(geo, mat, this.particleCount);
    scene.add(this.particles);
  }

  update(activeEdges: any[], time: number) {
    let instanceIdx = 0;

    activeEdges.forEach(edge => {
      // Só desenha fluxo em arestas com "calor" (ativação) e se tivermos instâncias disponíveis
      if (edge.activation > 0.1 && instanceIdx < this.particleCount - 3) {
        const geodesic = calculateGeodesic(edge.source, edge.target);
        
        // Distribui 3 partículas por aresta ativa
        for (let i = 0; i < 3; i++) {
          const t = (time * 0.5 + (i / 3)) % 1.0;
          const pos = this.getPointOnGeodesic(geodesic, t);
          
          this.dummy.position.set(pos.x, pos.y, pos.z || 0);
          this.dummy.scale.setScalar(edge.activation * 0.5);
          this.dummy.updateMatrix();
          this.particles.setMatrixAt(instanceIdx++, this.dummy.matrix);
        }
      }
    });
    this.particles.instanceMatrix.needsUpdate = true;
    this.particles.count = instanceIdx;
  }

  private getPointOnGeodesic(geo: any, t: number) {
    if (geo.type === 'line') {
      return {
        x: geo.x1 + (geo.x2 - geo.x1) * t,
        y: geo.y1 + (geo.y2 - geo.y1) * t,
        z: 0
      };
    }
    const angle = geo.startAngle + (geo.endAngle - geo.startAngle) * t;
    return {
      x: geo.cx + Math.cos(angle) * geo.radius,
      y: geo.cy + Math.sin(angle) * geo.radius,
      z: 0
    };
  }
}
