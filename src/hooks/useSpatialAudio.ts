import { useEffect, useRef, useCallback } from 'react';
import { useFlowStore } from '../store/useFlowStore';

type SoundType = 'hover' | 'click' | 'transition' | 'success' | 'error' | 'open' | 'close';

interface AudioContextRef {
    ctx: AudioContext | null;
    gainNode: GainNode | null;
}

export function useSpatialAudio() {
    const isSpatialAudio = useFlowStore(state => state.isSpatialAudio);
    const audioRef = useRef<AudioContextRef>({ ctx: null, gainNode: null });

    // Initialize Audio Context
    useEffect(() => {
        if (!isSpatialAudio) {
            if (audioRef.current.ctx) {
                audioRef.current.ctx.close();
                audioRef.current.ctx = null;
            }
            return;
        }

        const initAudio = () => {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContext();
            const gainNode = ctx.createGain();
            gainNode.connect(ctx.destination);
            gainNode.gain.value = 0.4; // Master volume

            audioRef.current = { ctx, gainNode };
        };

        // Initialize on first user interaction if needed, but for now init immediately
        // Browser policy might block auto-play until interaction
        const handleInteraction = () => {
            if (!audioRef.current.ctx) {
                initAudio();
            } else if (audioRef.current.ctx.state === 'suspended') {
                audioRef.current.ctx.resume();
            }
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };

        window.addEventListener('click', handleInteraction);
        window.addEventListener('keydown', handleInteraction);

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
            if (audioRef.current.ctx) {
                audioRef.current.ctx.close();
            }
        };
    }, [isSpatialAudio]);

    const playSound = useCallback((type: SoundType, xPosition: number = 0) => {
        if (!isSpatialAudio || !audioRef.current.ctx || !audioRef.current.gainNode) return;

        const ctx = audioRef.current.ctx;
        const t = ctx.currentTime;

        // Create source and spatial nodes
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const panner = ctx.createPanner();

        // HRTF Panning for 3D spatial audio
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 10000;
        panner.rolloffFactor = 1;
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 0;
        panner.coneOuterGain = 0;

        // Position: x is left/right (-1 to 1)
        // We place the listener at (0, 0, 0) and the sound at (x*2, 0, -1)
        // -1 Z means slightly in front of the listener
        panner.positionX.setValueAtTime(xPosition * 2, t);
        panner.positionY.setValueAtTime(0, t);
        panner.positionZ.setValueAtTime(-1, t);

        // Sound Synthesis based on type
        switch (type) {
            case 'hover':
                // Subtle high tick
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, t);
                osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
                gain.gain.setValueAtTime(0.05, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
                osc.start(t);
                osc.stop(t + 0.05);
                break;

            case 'click':
                // Clean click
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(400, t);
                osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
                gain.gain.setValueAtTime(0.2, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                osc.start(t);
                osc.stop(t + 0.1);
                break;

            case 'transition':
                // Swoosh effect
                const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
                const output = noiseBuffer.getChannelData(0);
                for (let i = 0; i < noiseBuffer.length; i++) {
                    output[i] = Math.random() * 2 - 1;
                }
                const noise = ctx.createBufferSource();
                noise.buffer = noiseBuffer;
                
                // Filter for swoosh sound
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(200, t);
                filter.frequency.exponentialRampToValueAtTime(2000, t + 0.15);
                filter.frequency.exponentialRampToValueAtTime(200, t + 0.3);

                noise.connect(filter);
                filter.connect(panner);
                
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.linearRampToValueAtTime(0.2, t + 0.15);
                gain.gain.linearRampToValueAtTime(0.001, t + 0.3);
                
                noise.start(t);
                noise.stop(t + 0.3);
                return; // Special case, already connected

            case 'success':
                // Pleasant chord
                const freqs = [440, 554.37, 659.25]; // A major
                freqs.forEach((f, i) => {
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.type = 'sine';
                    o.frequency.setValueAtTime(f, t);
                    g.gain.setValueAtTime(0.1, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5 + (i * 0.1));
                    o.connect(g);
                    g.connect(panner);
                    o.start(t);
                    o.stop(t + 0.6);
                });
                return;

            case 'open':
                // Rising shimmer
                osc.type = 'sine';
                osc.frequency.setValueAtTime(200, t);
                osc.frequency.linearRampToValueAtTime(600, t + 0.2);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.2);
                osc.start(t);
                osc.stop(t + 0.2);
                break;
                
            case 'close':
                // Falling shimmer
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, t);
                osc.frequency.linearRampToValueAtTime(200, t + 0.2);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.2);
                osc.start(t);
                osc.stop(t + 0.2);
                break;
        }

        // Standard routing
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(audioRef.current.gainNode);

    }, [isSpatialAudio]);

    return { playSound };
}
