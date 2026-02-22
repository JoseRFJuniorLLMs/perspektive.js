/**
 * LivePoincareMap.tsx — Ponto de entrada real da visualizacao
 *
 * Conecta a REST API do nietzsche-server ao motor WebGL via TanStack Query.
 * Projeta vetores N-dimensionais para 2D preservando a profundidade hiperbolica.
 * Atualiza a cada 5s para ver L-System crescer e Zaratustra evoluir em tempo real.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PoincareView } from '../manifolds/PoincareView';
import type { NodeData, EdgeData } from '../manifolds/PoincareView';

// Tipagem baseada no retorno do GET /api/graph
interface ApiNode {
  id: string;
  node_type: string;
  energy: number;
  embedding: number[]; // Vetor completo (ex: 256d) vindo do Rust
}

interface ApiEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
}

interface GraphResponse {
  nodes: ApiNode[];
  edges: ApiEdge[];
}

/**
 * Projeta um vetor hiperbolico N-Dimensional para 2D
 * preservando estritamente a Profundidade (Raio de Poincare).
 *
 * O hack: pega as 2 primeiras dimensoes para a DIRECAO (angulo),
 * mas usa a norma do vetor COMPLETO como RAIO. Assim a hierarquia
 * hiperbolica sobrevive ao achatamento dimensional.
 */
function projectTo2D(embedding: number[]): { x: number; y: number } {
  if (!embedding || embedding.length < 2) return { x: 0, y: 0 };

  // 1. Raio real no espaco de N dimensoes (||x||)
  let sumSq = 0;
  for (let i = 0; i < embedding.length; i++) sumSq += embedding[i] * embedding[i];
  const realRadius = Math.sqrt(sumSq);

  // Poincare exige ||x|| < 1
  const safeRadius = Math.min(realRadius, 0.999);

  // 2. Direcao: primeiras 2 dimensoes
  const rawX = embedding[0];
  const rawY = embedding[1];
  const len2D = Math.sqrt(rawX * rawX + rawY * rawY) || 1;

  // 3. Normaliza a direcao 2D e multiplica pelo raio real
  return {
    x: (rawX / len2D) * safeRadius,
    y: (rawY / len2D) * safeRadius,
  };
}

export interface LivePoincareMapProps {
  collection?: string;
  apiBase?: string;
  limit?: number;
  refetchInterval?: number;
}

export const LivePoincareMap = ({
  collection = 'default',
  apiBase = '',
  limit = 2000,
  refetchInterval = 5000,
}: LivePoincareMapProps) => {
  const { data, isLoading, error } = useQuery<GraphResponse>({
    queryKey: ['nietzsche-graph', collection, limit],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/graph?collection=${collection}&limit=${limit}`);
      if (!res.ok) throw new Error('Falha ao buscar a mente da EVA');
      return res.json();
    },
    refetchInterval,
  });

  // Mapeia dados da API para o formato que o WebGL exige
  const mappedNodes = useMemo<NodeData[]>(() => {
    if (!data) return [];
    return data.nodes.map(n => {
      const { x, y } = projectTo2D(n.embedding);
      return { id: n.id, node_type: n.node_type, energy: n.energy, x, y };
    });
  }, [data]);

  const mappedEdges = useMemo<EdgeData[]>(() => {
    if (!data) return [];
    return data.edges.map(e => ({
      source: e.source,
      target: e.target,
      weight: e.weight || 0.5,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div style={{ color: '#00f0ff', padding: 20, background: '#000', fontFamily: 'monospace' }}>
        Injetando EVA no cortex visual...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: '#ff00ff', padding: 20, background: '#000', fontFamily: 'monospace' }}>
        Erro Critico: {(error as Error).message}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* Motor WebGL */}
      <PoincareView nodes={mappedNodes} edges={mappedEdges} />

      {/* HUD Cyberpunk Overlay */}
      <div style={{
        position: 'absolute', top: 20, left: 20,
        color: '#00f0ff', fontFamily: 'monospace',
        pointerEvents: 'none', textShadow: '0 0 5px #00f0ff',
      }}>
        <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          NietzscheDB // Perspektive.js
        </div>
        <div>COLECAO: {collection.toUpperCase()}</div>
        <div>NOS ATIVOS: {mappedNodes.length}</div>
        <div>SINAIS (EDGES): {mappedEdges.length}</div>
        <div>MANIFOLD: POINCARE K &lt; 0</div>
      </div>
    </div>
  );
};
