# Perspektive.js

**Um telescopio hiperbolico para mentes artificiais.**

Motor unificado de visualizacao WebGL para [NietzscheDB](https://github.com/JoseRFJuniorLLMs/NietzscheDB) — o unico banco de vetores hiperbolico do mundo. Renderiza grafos de conhecimento em geometria nao-euclidiana real, com geodesicas matematicamente exatas, a 60 FPS na GPU.

> *"Perspektive"* e a grafia alema de "perspectiva". Friedrich Nietzsche — o filosofo que da nome ao banco de dados — cunhou o conceito de **Perspektivismus**: a ideia de que toda verdade depende do ponto de vista do observador. Esta biblioteca materializa isso literalmente: o mesmo grafo de conhecimento pode ser visto atraves de 4 "lentes" geometricas diferentes (Poincare, Riemann, Minkowski, Emocao), cada uma revelando uma verdade oculta sobre os dados.

---

## Por que existe?

O NietzscheDB armazena memorias de IA em um **Poincare ball** hiperbolico — nao em espaco Euclidiano plano. Nenhuma biblioteca de grafos existente (D3, Cytoscape, Cosmograph, Sigma.js) sabe desenhar:

- **Geodesicas hiperbolicas** (arcos de circulo ortogonais a borda, nao linhas retas)
- **Zoom de Mobius** (translacao hiperbolica, nao pan linear)
- **Cones de luz Minkowski** (causalidade espaco-temporal)
- **Sintese dialetica na esfera de Riemann** (opostos nos polos, sintese no equador)

O dashboard anterior usava Cosmograph e cobria **~21% das funcionalidades** do banco. Perspektive.js foi construida para cobrir os outros 79%.

---

## O que faz?

### O Manifold Switcher — 4 Lentes sobre os mesmos dados

| Lente | Geometria | O que revela |
|---|---|---|
| **Poincare** (padrao) | Disco hiperbolico 2D | Hierarquia: conceitos abstratos no centro, memorias especificas nas bordas |
| **Riemann** | Esfera 3D giratoria | Opostos dialeticos nos polos, sintese no equador (motor Hegeliano) |
| **Minkowski** | Espaco-tempo 3D | Causalidade: cones de luz, edges Timelike/Spacelike/Lightlike |
| **Emocao** | Cartesiano 2D | Russell Circumplex: Valence x Arousal = o "humor" da memoria da IA |

### Overlays (sobre qualquer lente)

- **Heatmap de Difusao** — resultado do `DIFFUSE FROM $seed` como camera termica
- **Pulsacao de Energia** — nos "respiram" baseado na propriedade `energy`

---

## Arquitetura

```
NietzscheDB REST API (/api/graph)
         |
         v
   LivePoincareMap          TanStack Query (polling 5s)
   projectTo2D()            256d → 2D preservando raio hiperbolico
         |
         v
   PoincareView             React Three Fiber (Three.js declarativo)
   HyperbolicNodes           InstancedMesh (1 draw call = 100k+ nos)
   HyperbolicEdges           Geodesicas via Regra de Cramer → EllipseCurve
         |
         v
   GPU (WebGL)              Bloom HDR + AdditiveBlending = Neon Cyberpunk
```

### Stack tecnologico

| Camada | Tecnologia |
|---|---|
| Renderizacao | Three.js via `@react-three/fiber` (R3F) |
| Post-processing | `@react-three/postprocessing` (Bloom HDR) |
| Data fetching | `@tanstack/react-query` (polling com cache) |
| Estado global | `zustand` (Manifold Switcher) |
| Shaders | GLSL customizado (Vertex + Fragment) |
| Build | Vite (lib mode, tree-shakeable) |

---

## Estrutura do projeto

```
perspektive.js/
├── package.json                 @nietzsche/perspektive v0.1.0
├── tsconfig.json                strict, ESNext, react-jsx
├── vite.config.ts               lib mode, externals React/Three
│
├── docs/
│   └── biblioteca.md            Spec arquitetural completa (7 bibliotecas → 1 engine)
│
└── src/
    ├── index.ts                 Exports publicos
    │
    ├── core/
    │   ├── Engine.tsx           Canvas WebGL principal (orquestra manifolds)
    │   └── ManifoldContext.tsx   Estado: qual lente esta ativa + transicoes
    │
    ├── math/                    Cerebro matematico (zero dependencias de UI)
    │   ├── poincare.ts          Geodesicas, distancia acosh, conformal factor
    │   ├── klein.ts             Conversao Poincare↔Klein, colinearidade O(1)
    │   └── riemann.ts           Projecao estereografica, midpoint esferico
    │
    ├── manifolds/               Renderizadores por geometria
    │   ├── PoincareView.tsx     Disco hiperbolico (Bloom + InstancedMesh)
    │   ├── MinkowskiView.tsx    Cones de luz espaco-temporais
    │   └── EmotionView.tsx      Russell Circumplex (Valence x Arousal)
    │
    └── components/              Conectores de dados reais
        └── LivePoincareMap.tsx   REST fetch + projectTo2D + HUD overlay
```

---

## Matematica implementada

### Geodesicas no disco de Poincare

No espaco hiperbolico, a menor distancia entre dois pontos **nao e uma reta**. E um arco de circulo que cruza a fronteira do disco em angulo de 90 graus (ortogonalmente).

```
calculateGeodesic(p1, p2) → ArcGeodesic | LineGeodesic
```

Usa a **Regra de Cramer** para encontrar o centro `(cx, cy)` do circulo ortogonal:

```
cx = ((1 + ||p1||²) · p2.y - (1 + ||p2||²) · p1.y) / (2 · (p1.x · p2.y - p2.x · p1.y))
raio = sqrt(cx² + cy² - 1)
```

Excecao: se os pontos sao colineares com a origem, a geodesica e uma reta euclidiana.

### Distancia hiperbolica

```
d(u,v) = acosh(1 + 2·||u-v||² / ((1-||u||²)(1-||v||²)))
```

Corresponde exatamente a `HYPERBOLIC_DIST()` do NQL (linguagem de query do NietzscheDB).

### Fator conformal (correcao visual)

Nos perto da borda do disco parecem menores no monitor, mas no espaco hiperbolico mantem seu tamanho. A funcao `getVisualRadius()` compensa usando:

```
conformalFactor = 2 / (1 - ||x||²)
visualRadius = baseEnergy / conformalFactor
```

### Projecao 256d → 2D (O hack do raio)

Vetores de alta dimensionalidade sao projetados para o disco 2D preservando a hierarquia:
- **Direcao**: primeiras 2 dimensoes do embedding (angulo no disco)
- **Raio**: norma do vetor completo (profundidade hiperbolica)

Isso garante que conceitos abstratos (centro) e memorias especificas (borda) mantêm suas posicoes hierarquicas mesmo apos o achatamento dimensional.

---

## Estetica visual

### Cyberpunk Neon HDR

A visualizacao usa **cores HDR** (High Dynamic Range) — valores acima de 1.0 que "sangram" luz para pixels vizinhos via Bloom:

| NodeType | Cor | Multiplicador HDR |
|---|---|---|
| Semantic | `#00ff66` Esmeralda Matrix | 2x |
| Episodic | `#00f0ff` Ciano Eletrico | 2x |
| Concept | `#f59e0b` Amber | 2x |
| DreamSnapshot | `#8b5cf6` Violeta | 2x |
| Pruned | `#1e293b` Cinza Apagado | 1x (sem brilho) |
| **Ubermensch** (energy > 0.8) | `#ff00ff` Magenta Puro | **4x** (halo explosivo) |

### AdditiveBlending nas edges

Quando geodesicas se cruzam, o WebGL **soma** as cores (`THREE.AdditiveBlending`). Zonas de alta densidade no grafo brilham como um cerebro biologico sem nenhum pos-processamento extra.

### Respiracao biologica

O universo de nos pulsa sutilmente no eixo Z a 2Hz (`Math.sin(t * 2) * 0.005`), dando a sensacao de organismo vivo.

---

## Status de desenvolvimento

| Componente | Status | Descricao |
|---|---|---|
| Matematica hiperbolica (`poincare.ts`) | ✅ Pronto | Geodesicas, distancia, conformal scaling, WebGL vertices |
| Matematica Klein (`klein.ts`) | ✅ Pronto | Conversoes Poincare↔Klein, colinearidade O(1) |
| Matematica Riemann (`riemann.ts`) | ✅ Pronto | Projecao estereografica, midpoint esferico |
| Motor WebGL (`PoincareView.tsx`) | ✅ Pronto | InstancedMesh + Bloom HDR + AdditiveBlending |
| Integracao React (`LivePoincareMap.tsx`) | ✅ Pronto | TanStack Query + projectTo2D + HUD cyberpunk |
| Backend REST (`nietzsche-server`) | 🟡 Pendente | Verificar se `GET /api/graph` retorna array `embedding` |
| Interatividade (Mouse/Hover) | ❌ Falta | Raycaster para tooltip com ID, Energy, Type, Content |
| Animacoes suaves (Lerp) | ❌ Falta | Transicao organica de cor/tamanho entre refreshes |
| Manifold Switcher (3 lentes) | ❌ Falta | Riemann, Minkowski, Emocao + morphing entre geometrias |
| Streaming real-time | ❌ Futuro | WebSocket/SSE com delta (nasceu/morreu) para 1M+ nos |

---

## Instalacao

```bash
npm install @nietzsche/perspektive
```

Ou clone e rode localmente:

```bash
git clone https://github.com/JoseRFJuniorLLMs/perspektive.js.git
cd perspektive.js
npm install
npm run typecheck
```

## Uso

```tsx
import { LivePoincareMap } from '@nietzsche/perspektive';

function App() {
  return <LivePoincareMap collection="eva_core" apiBase="http://localhost:8080" />;
}
```

Ou use o motor diretamente com dados proprios:

```tsx
import { PoincareView } from '@nietzsche/perspektive';

const nodes = [
  { id: '1', x: 0.0, y: 0.0, energy: 0.95, node_type: 'Concept' },
  { id: '2', x: 0.6, y: 0.3, energy: 0.40, node_type: 'Episodic' },
];
const edges = [{ source: '1', target: '2', weight: 0.8 }];

function App() {
  return <PoincareView nodes={nodes} edges={edges} />;
}
```

Use as funcoes matematicas standalone:

```typescript
import { poincare } from '@nietzsche/perspektive';

const dist = poincare.poincareDistance({ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.7 });
const geo = poincare.calculateGeodesic({ x: 0.3, y: -0.2 }, { x: -0.4, y: 0.6 });
```

---

## Contexto: NietzscheDB

[NietzscheDB](https://github.com/JoseRFJuniorLLMs/NietzscheDB) e um banco de dados de grafos hiperbolicos escrito em Rust, projetado para ser a memoria de longo prazo de IAs autonomas. Suas features incluem:

- **Poincare ball embeddings** — hierarquia natural (profundidade = raio)
- **4 geometrias** — Poincare, Klein, Riemann, Minkowski
- **L-System** — crescimento fractal autonomo de nos
- **Sleep cycle** — reconsolidacao de memoria (perturbacao + Hausdorff check)
- **Zaratustra** — evolucao autonoma (Will-to-Power, Eternal Recurrence, Ubermensch)
- **Daemons** — agentes autonomos patrulhando o grafo
- **Heat kernel diffusion** — propagacao de ativacao multi-escala
- **Dream queries** — exploracao especulativa com rollback
- **Schrodinger edges** — arestas probabilisticas com colapso contextual
- **NQL** — linguagem de query com 19+ tipos e funcoes geometricas built-in

Perspektive.js existe para tornar tudo isso **visivel**.

---

## Por que "Perspektive"?

Tres razoes:

1. **Nietzsche era alemao.** O banco se chama NietzscheDB. A biblioteca de visualizacao honra isso com grafia alema.

2. **Perspektivismus.** Nietzsche argumentou que nao existe "verdade objetiva" — toda verdade e uma perspectiva. Esta biblioteca materializa isso: o mesmo grafo visto pelo disco de Poincare revela hierarquia; visto pela esfera de Riemann revela opostos dialeticos; visto por Minkowski revela causalidade; visto pelo Circumplex revela emocao. Quatro verdades. Nenhuma completa sozinha.

3. **Perspektive e um projeto de otica.** Literalmente: transforma coordenadas de um espaco (hiperbolico 256d) para outro (tela 2D do monitor) preservando significado. E uma lente.

---

## Licenca

MIT

---

*Construido para o NietzscheDB por [Jose Ricardo Figueroa Junior](https://github.com/JoseRFJuniorLLMs) e Claude.*
