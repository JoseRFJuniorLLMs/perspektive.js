import { useEffect, useRef, useState } from 'react';

/**
 * useHyperbolicAudio — The machine's auditory cortex.
 * Extracts real-time amplitude to drive non-Euclidean visualizations.
 */
export function useHyperbolicAudio(audioElement: HTMLAudioElement | null) {
    const [amplitude, setAmplitude] = useState<number>(0);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        if (!audioElement) return;
        
        // Initialise AudioContext
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        const audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;

        const analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 256;
        
        const source = audioCtx.createMediaElementSource(audioElement);
        source.connect(analyzer);
        analyzer.connect(audioCtx.destination);
        
        analyzerRef.current = analyzer;
        dataArrayRef.current = new Uint8Array(analyzer.frequencyBinCount);

        let animationFrameId: number;

        const renderLoop = () => {
            if (analyzerRef.current && dataArrayRef.current) {
                analyzerRef.current.getByteFrequencyData(dataArrayRef.current);
                
                const sum = dataArrayRef.current.reduce((a, b) => a + b, 0);
                const avg = sum / dataArrayRef.current.length;
                
                // Normalise [0.0, 1.0]
                setAmplitude(avg / 255);
            }
            animationFrameId = requestAnimationFrame(renderLoop);
        };

        const handlePlay = () => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            renderLoop();
        };
        
        const handlePause = () => cancelAnimationFrame(animationFrameId);

        audioElement.addEventListener('play', handlePlay);
        audioElement.addEventListener('pause', handlePause);

        return () => {
            cancelAnimationFrame(animationFrameId);
            audioElement.removeEventListener('play', handlePlay);
            audioElement.removeEventListener('pause', handlePause);
            source.disconnect();
            audioCtx.close();
        };
    }, [audioElement]);

    return amplitude;
}
