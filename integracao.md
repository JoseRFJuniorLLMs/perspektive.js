# 🌊 integracao.md — Transplante de Áudio Multimodal

A `perspektive.js` agora suporta audição multimodal, onde o som é tratado como uma deformação geométrica da variedade (manifold).

## 🧠 Arquitetura de Áudio

O sistema de áudio está dividido em duas partes:

1.  **AudioDecoder (`src/audio/AudioDecoder.ts`):** Extrai picos de amplitude e fornece um analisador em tempo real sem dependências externas pesadas.
2.  **Shader Integration:** A variável `uAudioAmplitude` é injetada em todos os shaders WebGL, permitindo que a geometria reaja ao som de forma específica para cada espaço matemático.

## 🌌 Comportamentos Geométricos

| Manifold | Efeito Visual | Descrição Matemática |
| :--- | :--- | :--- |
| **Poincaré** | **Respiração Hiperbólica** | Os nós pulsam e emitem ondas de choque que sofrem compressão infinita na borda do disco. |
| **Klein** | **Fibra Óptica** | O som viaja em pulsos de luz lineares através das arestas geodésicas (retas em Klein). |
| **Bloch** | **Ressonância Quântica** | A nuvem de probabilidade torna-se turbulenta e a fidelidade quântica vibra com o áudio. |
| **Minkowski** | **Fósseis Acústicos** | O áudio é registrado como partículas persistentes no cone de luz (eixo temporal). |

## 🚀 Como Usar

Para ativar a sinestesia, basta passar um arquivo de áudio para o motor (ou usar o hook `useAudio` futuramente):

```typescript
import { AudioPulse } from 'perspektive';

const audio = new AudioPulse();
audio.play('https://exemplo.com/voz_da_eva.mp3');

// O PerspektiveEngine cuidará da propagação dos uniformes automaticamente via useFrame.
```

## 🛠️ Detalhes do Shader

O uniforme `uAudioAmplitude` [0, 1] pode ser usado para modular:
- `vPosition` (Escalamento/Deformação)
- `gl_FragColor` (Brilho/Emissão/Alpha)
- Frequências de ruído (Turbulência)
