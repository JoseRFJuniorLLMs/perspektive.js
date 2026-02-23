import * as THREE from 'three';

export interface DaemonData {
  id: string;
  x: number;
  y: number;
  type: 'entropy' | 'evolution' | 'patrol';
  energy: number;
}

export class DaemonRenderer {
  private daemonMeshes: Map<string, THREE.Group> = new Map();
  private dummy = new THREE.Object3D();

  constructor(private scene: THREE.Scene) {}

  syncDaemons(daemonsFromBackend: DaemonData[]) {
    const activeIds = new Set(daemonsFromBackend.map(d => d.id));

    // Cleanup inactive daemons
    for (const [id, group] of this.daemonMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.daemonMeshes.delete(id);
      }
    }

    daemonsFromBackend.forEach(d => {
      if (!this.daemonMeshes.has(d.id)) {
        const group = new THREE.Group();
        
        // Geometria de "Will to Power": Um octaedro duplo ou cristalino
        const geo = new THREE.OctahedronGeometry(0.04, 0);
        const mat = new THREE.MeshPhongMaterial({ 
          color: d.type === 'entropy' ? '#ff3300' : '#ff9900', 
          emissive: d.type === 'entropy' ? '#660000' : '#ff3300',
          flatShading: true,
          shininess: 100
        });
        
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
        
        // Luz pontual para o daemon
        const light = new THREE.PointLight(mat.color, 0.5, 0.5);
        group.add(light);
        
        this.scene.add(group);
        this.daemonMeshes.set(d.id, group);
      }

      const group = this.daemonMeshes.get(d.id)!;
      // Interpolação suave para a posição do Daemon
      group.position.lerp(new THREE.Vector3(d.x, d.y, 0.05), 0.1);
      
      const mesh = group.children[0] as THREE.Mesh;
      mesh.rotation.x += 0.05;
      mesh.rotation.y += 0.05;
      
      const scale = 1.0 + Math.sin(performance.now() * 0.005) * 0.2;
      mesh.scale.setScalar(scale * d.energy);
    });
  }
}
