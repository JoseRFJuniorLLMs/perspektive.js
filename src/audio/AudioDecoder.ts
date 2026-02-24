/**
 * AudioDecoder.ts
 *
 * Core engine for Mathematical Synesthesia.
 * Extracts peaks for static waveforms and provides real-time amplitude analysis.
 */

export async function extractPeaks(audioUrl: string, samples = 100): Promise<number[]> {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
  const audioCtx = new AudioContextClass();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  
  const rawData = audioBuffer.getChannelData(0); // Use first channel
  const blockSize = Math.floor(rawData.length / samples);
  const peaks = [];

  for (let i = 0; i < samples; i++) {
    let max = 0;
    const offset = i * blockSize;
    for (let j = 0; j < blockSize; j++) {
      const val = Math.abs(rawData[offset + j]);
      if (val > max) max = val;
    }
    peaks.push(max);
  }

  return peaks;
}

export class AudioPulse {
  private audio: HTMLAudioElement | null = null;
  private analyzer: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private audioCtx: AudioContext | null = null;

  constructor() {}

  async play(url: string) {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }

    this.audio = new Audio(url);
    this.audio.crossOrigin = "anonymous";
    
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    this.audioCtx = new AudioContextClass();
    const source = this.audioCtx.createMediaElementSource(this.audio);
    this.analyzer = this.audioCtx.createAnalyser();
    this.analyzer.fftSize = 256;
    
    source.connect(this.analyzer);
    this.analyzer.connect(this.audioCtx.destination);
    
    this.dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
    
    await this.audio.play();
  }

  getAmplitude(): number {
    if (!this.analyzer || !this.dataArray) return 0;
    this.analyzer.getByteFrequencyData(this.dataArray);
    
    const sum = this.dataArray.reduce((acc, val) => acc + val, 0);
    return sum / (this.dataArray.length * 255);
  }

  stop() {
    if (this.audio) this.audio.pause();
    if (this.audioCtx) this.audioCtx.close();
  }
}
