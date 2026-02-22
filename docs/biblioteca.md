# NietzscheDB — Bibliotecas de Visualizacao

## Diagnostico: Cosmograph cobre ~21% das funcionalidades

| Coberto pelo Cosmograph | Invisivel hoje |
|---|---|
| Layout force-directed (Euclidiano) | Geometria hiperbolica real (Poincare ball) |
| Cores por NodeType | Klein disk, Riemann sphere, Minkowski |
| Size por energy | L-System growth, Sleep cycles, Zaratustra |
| Timeline por created_at | Diffusion heatmaps, Causal chains |
| Histogramas (energy/depth/hausdorff) | Valence/Arousal emocional |
| Edge type bars | Daemons, Dreams, Narratives, Agency |

---

## Passo 1: O Desbloqueio do Backend (Pre-requisito Tecnico)

Antes de desenhar qualquer coisa no React, precisamos das coordenadas. Como os embeddings (PoincareVectors) geralmente tem alta dimensionalidade (ex: 256d, 512d, 1536d), enviar isso via JSON puro no `GET /api/graph` pode derrubar o browser.

### A solucao no Rust (nietzsche-server / nietzsche-api):

Duas opcoes para expor isso no REST:

1. **Endpoint dedicado em lote:** `GET /api/graph/embeddings?collection=nome`. Retorna um binario (`Float32Array` codificado em base64) mapeando `node_id -> [coords]`. E o mais rapido para o browser parsear.

2. **Projecao 2D/3D no Backend (Recomendado para UI):** Visualizar um espaco hiperbolico de 256 dimensoes em uma tela 2D exige reducao de dimensionalidade (como um t-SNE ou UMAP, mas na versao hiperbolica). Se voce enviar os 256 floats pro frontend, o JS vai sofrer para reduzir isso a 60fps. O ideal e que o Rust (que ja tem acesso a GPU/TPU) faca uma projecao rapida para 2D/3D preservando a curvatura hiperbolica, e mande apenas `[x, y, z]` para o Dashboard.

---

## Passo 2: Comecar pela P0 — `@nietzsche/viz-poincare`

E a "assinatura visual" do banco de dados. Se fizermos o Disco de Poincare funcionar, ja teremos a demonstracao visual mais inovadora de um banco de vetores no mercado.

### Tech Spec Rapido do `@nietzsche/viz-poincare`

#### 1. Biblioteca Base (Rendering Engine)

Nao tente fazer SVG para grafos grandes. D3.js e maravilhoso, mas para milhares de nos hiperbolicos, ele vai engasgar.

**Escolha ideal: Three.js ou deck.gl** (com WebGL customizado). O deck.gl e excelente para plotar milhares de pontos e permite injetar shaders (GLSL) customizados para curvar as arestas (edges) usando a matematica de Mobius.

#### 2. A Matematica no Frontend

O maior desafio sera renderizar as arestas (edges). No espaco Euclidiano, uma aresta e uma reta. No Disco de Poincare, uma aresta entre dois nos e um **arco de circulo que cruza a fronteira do disco em um angulo de 90 graus** (ortogonalmente).

Precisaremos criar uma funcao TS/GLSL que calcula o centro e o raio desse arco com base nas coordenadas de dois nos.

#### 3. Navegacao (Focus + Context)

Quando o usuario arrastar a visualizacao (pan), nao e um "pan" normal. E uma **translacao de Mobius**. O no que ele puxar para o centro do disco vai parecer "aumentar" (zoom), e os nos empurrados para as bordas vao se espremer contra o limite hiperbolico.

---

## 7 Bibliotecas de Visualizacao Necessarias

### 1. `@nietzsche/viz-poincare` — Renderizador Hiperbolico Nativo

**Problema:** Cosmograph posiciona nos em espaco Euclidiano. O NietzscheDB armazena tudo no Poincare ball onde `depth in [0,1)` e o raio e a distancia e `acosh(...)`. Nenhuma biblioteca existente faz isso.

**Funcionalidades:**
- Renderizacao no disco de Poincare (WebGL/WebGPU)
- Geodesicas hiperbolicas como arcos (nao linhas retas)
- Zoom hiperbolico (Mobius transformation, nao zoom linear)
- Projecao Klein disk para pathfinding (geodesicas viram linhas retas)
- Projecao Riemann sphere para synthesis (esfera 3D interativa)
- Navegacao focus+context (centro = detalhe, borda = contexto)

**Dados necessarios:** Coordenadas de embedding (hoje so via gRPC, nao REST)

**Complexidade:** Alta — e o coracao do projeto

---

### 2. `@nietzsche/viz-minkowski` — Diagramas Causais Espaco-Tempo

**Problema:** NietzscheDB tem edges com `CausalType` (Timelike/Spacelike/Lightlike) e intervalos Minkowski `ds^2`. Nenhuma lib de grafos visualiza cones de luz.

**Funcionalidades:**
- Diagrama de cones de luz 2D (eixo vertical = tempo, horizontal = espaco)
- Filtro visual por tipo causal (timelike em azul, spacelike em vermelho, lightlike em amarelo)
- Cadeia causal interativa (`CausalChain` RPC)
- Animacao de propagacao causal ao longo do tempo
- Projecao Penrose diagram para grafos grandes

**Dados necessarios:** `causal_type`, `minkowski_interval`, `created_at` por edge

**Complexidade:** Media

---

### 3. `@nietzsche/viz-diffusion` — Heatmaps de Difusao Multi-Escala

**Problema:** O Heat Kernel com Chebyshev polynomials opera em 3 escalas (t=0.1, 1.0, 10.0) com Laplaciano modulado por valence. Totalmente invisivel hoje.

**Funcionalidades:**
- Heatmap overlay no grafo (cores = ativacao por difusao)
- Slider temporal multi-escala (t=0.1 -> t=10.0) com animacao
- Campo vetorial de fluxo de energia (gradiente da difusao)
- Visualizacao do Laplaciano (peso das arestas modulado por valence)
- Split-view comparando escalas lado a lado
- Animacao "wave" mostrando propagacao a partir de um no seed

**Dados necessarios:** Resultado do `DIFFUSE FROM $seed` com diferentes escalas

**Complexidade:** Media-Alta

---

### 4. `@nietzsche/viz-lifecycle` — Ciclos Biologicos & Evolucao Temporal

**Problema:** Zaratustra (Will-to-Power + Eternal Recurrence + Ubermensch), Sleep cycles, L-System growth, e Daemons sao processos autonomos que evoluem no tempo. Zero visibilidade.

**Funcionalidades:**

**L-System Tree:**
- Arvore de geracoes (parent->child spawns via Mobius addition)

**Sleep Timeline:**
- Grafico Hausdorff before/after por ciclo, commit/rollback markers

**Zaratustra Dashboard:**
- Energy propagation wave animation (Will-to-Power alpha=0.10)
- Echo ring-buffer timeline (Eternal Recurrence)
- Elite tier gauge (Ubermensch top 10%)

**Daemon Monitor:**
- Daemon grid com energy bars, fire count, cooldown timers
- Patrol pattern overlay no grafo
- Will-to-Power priority queue visualization

**Narrative Arc:**
- Story arc timeline (emergence -> conflict -> decay -> recurrence)

**Dados necessarios:** `SleepReport`, `WillToPowerReport`, `EternalRecurrenceReport`, `UbermenschReport`, Daemon states, `NarrativeReport`

**Complexidade:** Alta (muitos sub-componentes)

---

### 5. `@nietzsche/viz-emotion` — Espaco Emocional Valence x Arousal

**Problema:** Cada no tem `valence in [-1,1]` e `arousal in [0,1]` — o modelo circumplex de Russell. Totalmente nao-visualizado.

**Funcionalidades:**
- **Circumplex Plot:** Scatter 2D (x=valence, y=arousal) com quadrantes nomeados
  - Alta arousal + valence positivo = Excitacao/Alegria
  - Alta arousal + valence negativo = Raiva/Medo
  - Baixa arousal + valence positivo = Calma/Serenidade
  - Baixa arousal + valence negativo = Tristeza/Depressao
- Cores por NodeType, size por energy
- Selecao bidirecional (selecionar no circumplex -> highlight no grafo Cosmograph)
- Evolucao temporal (animacao do drift emocional)
- Heatmap de densidade emocional por comunidade (Louvain)

**Dados necessarios:** `valence`, `arousal` por no (ja no REST)

**Complexidade:** Baixa-Media

---

### 6. `@nietzsche/viz-algorithms` — Resultados de Algoritmos de Grafo

**Problema:** 11 algoritmos built-in (PageRank, Louvain, Betweenness, etc.) retornam scores/labels mas nao tem visualizacao dedicada.

**Funcionalidades:**
- **Community View:** Coloracao por comunidade (Louvain/Label Propagation) com hulls convexos
- **Centrality Heatmap:** Gradient de cores por score (PageRank, Betweenness, Closeness, Degree)
- **Component Inspector:** WCC/SCC com isolamento visual e contagem
- **Path Visualizer:** A* path highlighting com custo acumulado
- **Distribution Charts:** Histogramas e violin plots dos scores
- **Comparison Mode:** Side-by-side de 2 metricas (ex: PageRank vs Betweenness)

**Dados necessarios:** Resultados dos endpoints `/api/algo/*`

**Complexidade:** Media

---

### 7. `@nietzsche/viz-dreams` — Exploracao Especulativa & Counterfactual

**Problema:** Dream queries, Counterfactual engine, e Schrodinger edges sao features unicas do NietzscheDB sem equivalente em nenhuma lib.

**Funcionalidades:**
- **Dream Trail:** BFS visualization com noise perturbation markers
  - Energy spikes (explosoes), curvature anomalies (distorcoes), cluster collisions (colisoes)
- **Dream Gallery:** Cards com sessions Pending/Applied/Rejected
- **Counterfactual Diff:** ShadowGraph overlay (grafo original vs. what-if)
  - Nos removidos em vermelho translucido, novos em verde
- **Schrodinger View:** Edges com opacidade = probabilidade, animacao de collapse on click
- **Psychoanalyze Timeline:** Lineage evolutiva de um no (PSYCHOANALYZE output)

**Dados necessarios:** `DreamSession`, `CounterfactualResult`, `SchrodingerEdge` states

**Complexidade:** Media-Alta

---

## Arquitetura Final: `@nietzsche/lens` — Motor Unificado

Em vez de 7 pacotes separados, um unico motor de renderizacao (Engine) baseado em WebGL, que possui "Lentes" (Modos de Visualizacao) alternaveis.

### 1. Stack Tecnologico

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Core de Renderizacao** | Three.js via `@react-three/fiber` (R3F) | Dashboard ja e React. R3F permite escrever codigo 3D/WebGL declarativo como componentes React, rodando na GPU a 60 FPS |
| **Shaders (GLSL)** | Vertex + Fragment Shaders customizados | Renderizar milhares de Schrodinger Edges probabilisticos e linhas curvas no disco de Poincare no JS vai travar a UI. GPU faz o calculo matematico instantaneamente |
| **Gestao de Estado** | Zustand ou TanStack Query (ja em uso) | Injetar mutacoes do L-System e Zaratustra em tempo real |

### 2. Os 4 Modos Principais ("The Manifold Switcher")

A **Killer Feature**: um controle na UI onde o usuario clica e o grafo inteiro se transforma suavemente (morphing) entre as geometrias.

#### Modo Poincare (O Padrao)

- O canvas e um disco 2D
- Nos profundos/abstratos no centro. Nos recentes nas bordas
- **O Segredo:** As arestas (edges) nao sao linhas retas. A biblioteca usa matematica hiperbolica para desenhar arcos de circulo que cruzam a borda a 90 graus

#### Modo Riemann (Sintese e Opostos)

- O canvas vira uma **Esfera 3D giratoria**
- Conceitos diametralmente opostos ficam nos polos (ex: Luz e Sombra). A sintese fica no equador
- Excelente para ver o motor Dialetico Hegeliano

#### Modo Minkowski (Causalidade)

- O grafo "deita" em um eixo 3D onde o Y e o Tempo
- Aparecem os **Cones de Luz** translucidos ao redor dos nos
- Nos vermelhos (Spacelike) ficam fora do cone, azuis (Timelike) dentro

#### Modo Emocao (Russell Circumplex)

- Ignora a geometria hiperbolica e plota o grafo num plano Cartesiano simples
- Eixo X = Valencia (-1 a 1), Eixo Y = Excitacao (0 a 1)
- Revela instantaneamente o "humor" da memoria da IA

### 3. A Camada de "Organismo Vivo" (Overlays)

Sobre qualquer um dos 4 modos, aplica-se os "Filtros Visuais" (Overlays):

- **Heatmap de Difusao:** Quando roda um `DIFFUSE FROM $seed`, a biblioteca colore os nos de vermelho a amarelo como uma camera termica
- **Pulsacao de Energia:** O tamanho do no "respira" baseado na propriedade `energy`. Daemons patrulhando brilham

---

## Resumo & Prioridade

| # | Biblioteca | Prioridade | Justificativa |
|---|---|---|---|
| 1 | `viz-poincare` | **P0 - Critica** | Sem isso, a geometria hiperbolica (razao de existir do NietzscheDB) e invisivel |
| 2 | `viz-lifecycle` | **P0 - Critica** | Zaratustra/Sleep/L-System sao o "cerebro" autonomo - precisa de monitoramento |
| 3 | `viz-diffusion` | **P1 - Alta** | Heat kernel e a operacao central de query - precisa ser observavel |
| 4 | `viz-minkowski` | **P1 - Alta** | Causalidade e diferencial competitivo unico |
| 5 | `viz-emotion` | **P2 - Media** | Valence/arousal ja estao no REST, implementacao rapida |
| 6 | `viz-algorithms` | **P2 - Media** | 11 algoritmos prontos no backend, falta so frontend |
| 7 | `viz-dreams` | **P3 - Futura** | Features experimentais, podem esperar |

### Pre-requisito tecnico
Antes de tudo: **expor coordenadas de embedding via REST API** (hoje so disponivel via gRPC). Sem isso, `viz-poincare` nao funciona pelo dashboard.
