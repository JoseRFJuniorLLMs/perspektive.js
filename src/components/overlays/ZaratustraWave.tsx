/**
 * ZaratustraWave.tsx — Will-to-Power energy propagation visualization
 *
 * Animates energy propagation during Zaratustra cycles:
 * - Will-to-Power: expanding heat wave from center
 * - Eternal Recurrence: flash on echo-ring nodes
 * - Übermensch: golden crown on elite nodes
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface ZaratustraResult {
  nodes_updated: number;
  energy_delta: number;
  echoes_created: number;
  elite_count: number;
  elite_ids: string[];
  echo_ids: string[];
  energy_threshold: number;
}

export interface ZaratustraWaveProps {
  /** Result from InvokeZaratustra */
  result: ZaratustraResult | null;
  /** Whether animation is active */
  active: boolean;
  /** Node positions for rendering overlays */
  nodePositions: Map<string, { x: number; y: number; z: number }>;
  /** Timestamp when zaratustra was invoked (for animation timing) */
  invokedAt: number;
}

/** Expanding ring animation for Will-to-Power energy propagation */
const WillToPowerWave = ({ active, invokedAt }: { active: boolean; invokedAt: number }) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!ringRef.current || !active) return;
    const elapsed = (Date.now() - invokedAt) / 1000;
    if (elapsed > 5) {
      ringRef.current.visible = false;
      return;
    }
    ringRef.current.visible = true;
    const progress = elapsed / 5;
    const radius = progress * 2;
    const opacity = (1 - progress) * 0.3;
    ringRef.current.scale.set(radius, radius, 1);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;
  });

  return (
    <mesh ref={ringRef} position={[0, 0, 0.005]}>
      <ringGeometry args={[0.95, 1.0, 64]} />
      <meshBasicMaterial
        color="#ff00ff"
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

/** Golden crown markers on Übermensch (elite) nodes */
const UbermenschCrowns = ({
  eliteIds,
  nodePositions,
}: {
  eliteIds: string[];
  nodePositions: Map<string, { x: number; y: number; z: number }>;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const positions = useMemo(() => {
    return eliteIds
      .map(id => nodePositions.get(id))
      .filter((p): p is { x: number; y: number; z: number } => p !== undefined);
  }, [eliteIds, nodePositions]);

  useFrame(({ clock }) => {
    if (!meshRef.current || positions.length === 0) return;
    const time = clock.getElapsedTime();

    positions.forEach((pos, i) => {
      dummy.position.set(pos.x, pos.y + 0.04, pos.z);
      const scale = 0.025 + Math.sin(time * 2 + i) * 0.005;
      dummy.scale.set(scale, scale, 1);
      dummy.rotation.z = time * 0.5 + i;
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (positions.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]}>
      <ringGeometry args={[0.6, 1, 6]} />
      <meshBasicMaterial
        color="#ffd700"
        transparent
        opacity={0.8}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
};

/** Flash effect on Eternal Recurrence echo nodes */
const RecurrenceFlash = ({
  echoIds,
  nodePositions,
  invokedAt,
}: {
  echoIds: string[];
  nodePositions: Map<string, { x: number; y: number; z: number }>;
  invokedAt: number;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const positions = useMemo(() => {
    return echoIds
      .map(id => nodePositions.get(id))
      .filter((p): p is { x: number; y: number; z: number } => p !== undefined);
  }, [echoIds, nodePositions]);

  useFrame(() => {
    if (!meshRef.current || positions.length === 0) return;
    const elapsed = (Date.now() - invokedAt) / 1000;
    if (elapsed > 4) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;

    const flashPhase = Math.max(0, 1 - elapsed / 4);

    positions.forEach((pos, i) => {
      dummy.position.set(pos.x, pos.y, pos.z + 0.01);
      const scale = 0.03 * (1 + flashPhase * 0.5);
      dummy.scale.set(scale, scale, 1);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      color.setHSL(0.75, 1, 0.5 + flashPhase * 0.5);
      color.multiplyScalar(1 + flashPhase * 3);
      meshRef.current!.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  if (positions.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]}>
      <circleGeometry args={[1, 16]} />
      <meshBasicMaterial
        toneMapped={false}
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
};

export const ZaratustraWave = ({
  result,
  active,
  nodePositions,
  invokedAt,
}: ZaratustraWaveProps) => {
  if (!active || !result) return null;

  return (
    <group>
      <WillToPowerWave active={active} invokedAt={invokedAt} />
      <UbermenschCrowns eliteIds={result.elite_ids} nodePositions={nodePositions} />
      <RecurrenceFlash
        echoIds={result.echo_ids}
        nodePositions={nodePositions}
        invokedAt={invokedAt}
      />
    </group>
  );
};
