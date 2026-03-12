export const YOUTUBE_SPATIAL_AUDIO_SCRIPT = `
(function() {
    // console.log('[Flow] YouTube Spatial Audio Script Loaded');

    window.ContinuumSpatialAudio = {
        context: null,
        source: null,
        panner: null,
        gain: null,
        convolver: null,
        filter: null,
        compressor: null, // Pro-Audio Compressor
        bassBoost: null, // Low-shelf EQ
        trebleBoost: null, // High-shelf EQ for Clarity
        midBoost: null, // Peaking EQ for Presence
        isEnabled: false,
        videoElement: null,
        currentMode: 'front', // front, left, right, back, orbit, cinema, 8d
        orbitAngle: 0,
        orbitInterval: null,
        hudCanvas: null, // Visual Radar
        analyser: null, // Audio Analysis

        init: function() {
            if (this.context) return;
            
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.context = new AudioContext();
                this.gain = this.context.createGain();
                this.panner = this.context.createPanner();
                
                // 1. Dynamics Compressor (Professional Polish)
                this.compressor = this.context.createDynamicsCompressor();
                this.compressor.threshold.value = -24;
                this.compressor.knee.value = 30;
                this.compressor.ratio.value = 12;
                this.compressor.attack.value = 0.003;
                this.compressor.release.value = 0.25;

                // 2. Bass Boost EQ
                this.bassBoost = this.context.createBiquadFilter();
                this.bassBoost.type = 'lowshelf';
                this.bassBoost.frequency.value = 200; // Boost below 200Hz
                this.bassBoost.gain.value = 0; // Default flat
                
                // 2.2 Mid-Range Boost (Presence) - NEW
                this.midBoost = this.context.createBiquadFilter();
                this.midBoost.type = 'peaking';
                this.midBoost.frequency.value = 3000; // 3kHz for vocal clarity
                this.midBoost.Q.value = 1.0; // Broad peak
                this.midBoost.gain.value = 0; // Default flat
                
                // 2.5 Treble Boost EQ (Crystalizer)
                this.trebleBoost = this.context.createBiquadFilter();
                this.trebleBoost.type = 'highshelf';
                this.trebleBoost.frequency.value = 5000; // Lowered from 8000 for more body in highs
                this.trebleBoost.gain.value = 0; // Default flat
                
                // 3. Low-pass filter for head shadowing
                this.filter = this.context.createBiquadFilter();
                this.filter.type = 'lowpass';
                this.filter.frequency.value = 20000;
                
                // 4. Reverb
                this.convolver = this.context.createConvolver();
                // FIXED: Reduced impulse response duration from 2.0s to 0.1s to eliminate echo
                // while preserving spatial room presence.
                this.convolver.buffer = this.createImpulseResponse(0.1, 4.0);
                
                // 5. Analyser for Visuals
                this.analyser = this.context.createAnalyser();
                this.analyser.fftSize = 256;
                
                // HRTF Configuration
                this.panner.panningModel = 'HRTF';
                this.panner.distanceModel = 'inverse';
                this.panner.refDistance = 1;
                this.panner.maxDistance = 10000;
                this.panner.rolloffFactor = 0.2; 
                this.panner.coneInnerAngle = 360;
                this.panner.coneOuterAngle = 0;
                this.panner.coneOuterGain = 0;
                
                this.createHUD();
                this.updatePosition();

                // Master Gain -> Destination
                this.gain.connect(this.context.destination);
            } catch (e) {
                console.error('[Flow] Spatial Audio Init Failed:', e);
            }
        },
        
        createHUD: function() {
             if (this.hudCanvas) return;
             
             const canvas = document.createElement('canvas');
             canvas.width = 150;
             canvas.height = 150;
             canvas.style.position = 'absolute';
             canvas.style.top = '20px';
             canvas.style.right = '20px';
             canvas.style.zIndex = '9999';
             canvas.style.pointerEvents = 'none'; // Click-through
             canvas.style.opacity = '0'; // Hidden by default
             canvas.style.transition = 'opacity 0.3s ease';
             
             // Inject into video container if possible, else body
             const container = document.querySelector('#movie_player') || document.body;
             container.appendChild(canvas);
             this.hudCanvas = canvas;
             
             this.drawHUD();
        },
        
        drawHUD: function() {
             if (!this.hudCanvas || !this.context) return;
             
             const ctx = this.hudCanvas.getContext('2d');
             const w = this.hudCanvas.width;
             const h = this.hudCanvas.height;
             const cx = w / 2;
             const cy = h / 2;
             
             const render = () => {
                 if (!this.isEnabled) {
                     this.hudCanvas.style.opacity = '0';
                     requestAnimationFrame(render);
                     return;
                 }
                 this.hudCanvas.style.opacity = '1';
                 
                 ctx.clearRect(0, 0, w, h);
                 
                 // Draw Radar Grid
                 ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)'; // Green-ish
                 ctx.lineWidth = 1;
                 ctx.beginPath();
                 ctx.arc(cx, cy, w/2 - 5, 0, Math.PI * 2);
                 ctx.stroke();
                 ctx.beginPath();
                 ctx.arc(cx, cy, w/4, 0, Math.PI * 2);
                 ctx.stroke();
                 
                 // Draw Head (Center)
                 ctx.fillStyle = '#fff';
                 ctx.beginPath();
                 ctx.arc(cx, cy, 5, 0, Math.PI * 2);
                 ctx.fill();
                 
                 // Get Audio Data for pulsing
                 const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
                 this.analyser.getByteFrequencyData(dataArray);
                 const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                 const pulse = average / 255; // 0 to 1
                 
                 // Draw Source Position
                 // We need to map 3D panner position to 2D radar
                 // Panner X: -20 (Left) to 20 (Right) -> Map to Canvas X
                 // Panner Z: -10 (Front) to 10 (Back) -> Map to Canvas Y (Inverted: -Z is Top)
                 
                 const pX = this.panner.positionX.value;
                 const pZ = this.panner.positionZ.value;
                 
                 // Normalize (-20 to 20 range usually)
                 const nX = Math.max(-1, Math.min(1, pX / 20)); 
                 const nZ = Math.max(-1, Math.min(1, pZ / 20));
                 
                 const dotX = cx + (nX * (w/2 - 10));
                 const dotY = cy + (nZ * (h/2 - 10)); // +Z is down (Back), -Z is up (Front)
                 
                 // Draw Source Dot
                 const alpha = 0.5 + pulse;
                 ctx.fillStyle = 'rgba(74, 222, 128, ' + alpha + ')';
                 ctx.shadowBlur = 15 * (1 + pulse);
                 ctx.shadowColor = '#4ade80';
                 ctx.beginPath();
                 ctx.arc(dotX, dotY, 8 + (pulse * 5), 0, Math.PI * 2);
                 ctx.fill();
                 ctx.shadowBlur = 0;
                 
                 // Draw Label
                 ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                 ctx.font = '10px monospace';
                 ctx.textAlign = 'center';
                 ctx.fillText(this.currentMode.toUpperCase(), cx, h - 5);
                 
                 requestAnimationFrame(render);
             };
             render();
        },

        createImpulseResponse: function(duration, decay) {
            const sampleRate = this.context.sampleRate;
            const length = sampleRate * duration;
            const impulse = this.context.createBuffer(2, length, sampleRate);
            const left = impulse.getChannelData(0);
            const right = impulse.getChannelData(1);

            for (let i = 0; i < length; i++) {
                const n = i;
                // Simple exponential decay noise
                left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
                right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
            }
            return impulse;
        },

        setMode: function(mode) {
            // mode: 'off' | 'front' | 'left' | 'right' | 'back' | 'orbit'
            
            // Clear any existing orbit interval
            if (this.orbitInterval) {
                clearInterval(this.orbitInterval);
                this.orbitInterval = null;
            }

            if (mode === 'off') {
                this.disable();
                return;
            }
            
            this.currentMode = mode;
            this.isEnabled = true;
            
            // Start orbit loop if needed
            if (mode === '8d') {
                this.startOrbit();
            } else if (this.context && this.panner) {
                this.updatePosition();
            }
            
            this.updateRouting();
        },
        
        startOrbit: function() {
             if (this.orbitInterval) return;
             this.orbitAngle = 0;
             const radius = 10;
             const speed = 0.02; // Radians per tick
             
             this.orbitInterval = setInterval(() => {
                 if (!this.panner || !this.context) return;
                 
                 this.orbitAngle += speed;
                 if (this.orbitAngle > Math.PI * 2) this.orbitAngle = 0;
                 
                 const t = this.context.currentTime;
                 const x = Math.sin(this.orbitAngle) * radius;
                 const z = Math.cos(this.orbitAngle) * radius; 
                 // Add varying elevation for "Object" feel
                 const y = Math.sin(this.orbitAngle * 2) * 3; // Up and down motion
                 
                 // When sound is behind (z > 0), apply filtering
                 // cos(0) = 1 (back), cos(PI) = -1 (front)
                 // Actually in WebAudio: -Z is front, +Z is back.
                 // So if Z > 0, we are behind.
                 
                 // Apply Head Shadowing dynamically
                 // Map Z from -10 (Front) to 10 (Back)
                 // If Z > 0, cutoff drops from 20kHz to 3kHz
                 if (this.filter) {
                    if (z > 2) { // Behind
                        // Smoothly ramp down frequency
                         this.filter.frequency.setTargetAtTime(3000, t, 0.1);
                    } else {
                         this.filter.frequency.setTargetAtTime(20000, t, 0.1);
                    }
                 }

                 this.panner.positionX.setValueAtTime(x, t);
                 this.panner.positionY.setValueAtTime(y, t);
                 this.panner.positionZ.setValueAtTime(z, t);
                 
             }, 50); // 20fps update is enough for smooth audio movement
        },

        updatePosition: function() {
            if (!this.panner || !this.context) return;
            
            const t = this.context.currentTime;
            
            // Reset filter
            if (this.filter) {
                this.filter.frequency.setValueAtTime(20000, t);
            }
            
            // Coordinates: X (Right+), Y (Up+), Z (Back+) 
            // Listener is at (0,0,0) facing -Z
            
            switch (this.currentMode) {
                case 'cinema':
                    // Wide stereo + Bass Boost + Overhead Ambience
                    this.panner.positionX.setValueAtTime(0, t);
                    this.panner.positionY.setValueAtTime(2, t); // Slight elevation for "Big Screen" feel
                    this.panner.positionZ.setValueAtTime(-5, t); 
                    
                    if (this.bassBoost) this.bassBoost.gain.setValueAtTime(6, t); 
                    if (this.midBoost) this.midBoost.gain.setValueAtTime(2, t); // Cut through bass
                    if (this.trebleBoost) this.trebleBoost.gain.setValueAtTime(2, t); // Slight clarity boost
                    if (this.filter) this.filter.frequency.setValueAtTime(20000, t);
                    break;
                case '8d':
                    // Orbit handles position
                    if (this.bassBoost) this.bassBoost.gain.setValueAtTime(3, t);
                    if (this.midBoost) this.midBoost.gain.setValueAtTime(2, t);
                    if (this.trebleBoost) this.trebleBoost.gain.setValueAtTime(4, t); // High clarity for 8D details
                    break;
                case 'front':
                    // In front of listener (-Z)
                    this.panner.positionX.setValueAtTime(0, t);
                    this.panner.positionY.setValueAtTime(0, t);
                    this.panner.positionZ.setValueAtTime(-1, t);
                    if (this.bassBoost) this.bassBoost.gain.setValueAtTime(0, t); // Flat bass
                    if (this.midBoost) this.midBoost.gain.setValueAtTime(4, t); // Strong vocal presence
                    if (this.trebleBoost) this.trebleBoost.gain.setValueAtTime(3, t); // Balanced crispness
                    break;
                case 'left':
                    // To the left (-X) - Extreme Pan
                    this.panner.positionX.setValueAtTime(-20, t); // Increased from -10
                    this.panner.positionY.setValueAtTime(0, t);
                    this.panner.positionZ.setValueAtTime(0, t);
                    break;
                case 'right':
                    // To the right (+X) - Extreme Pan
                    this.panner.positionX.setValueAtTime(20, t); // Increased from 10
                    this.panner.positionY.setValueAtTime(0, t);
                    this.panner.positionZ.setValueAtTime(0, t);
                    break;
                case 'back':
                    // Behind listener (+Z)
                    this.panner.positionX.setValueAtTime(0, t);
                    this.panner.positionY.setValueAtTime(0, t);
                    this.panner.positionZ.setValueAtTime(10, t); // Increased from 5
                    
                    // Apply Head Shadowing
                    if (this.filter) {
                        this.filter.frequency.setValueAtTime(3000, t); // Muffle sound from back
                    }
                    break;
                default:
                    // Default to front
                    this.panner.positionX.setValueAtTime(0, t);
                    this.panner.positionY.setValueAtTime(0, t);
                    this.panner.positionZ.setValueAtTime(-1, t);
            }
        },

        attach: function() {
            const video = document.querySelector('video');
            if (!video || video === this.videoElement) return;

            this.videoElement = video;
            
            if (!this.context) this.init();
            
            // Add Mouse Parallax
            document.addEventListener('mousemove', (e) => {
                if (this.currentMode !== 'front' && this.currentMode !== 'cinema') return;
                if (!this.panner || !this.context) return;
                
                // Map mouse X to small Panner X shift
                // Width 0 to window.innerWidth -> -1 to 1
                const x = (e.clientX / window.innerWidth) * 2 - 1;
                // Invert X for parallax (move head left, sound moves right relative to head)
                // Actually, if I look left, the source (center) is to my right.
                // So if mouse is on left, we assume user is looking left? 
                // Let's just make source follow mouse for "interactive" feel.
                
                // Target X: +/- 2 units max
                const targetX = x * 2;
                this.panner.positionX.setTargetAtTime(targetX, this.context.currentTime, 0.1);
            });

            try {
                // Check if we can create a source (only one allowed per element usually)
                // We wrap in try-catch because re-creating it might throw
                if (!this.source) {
                    this.source = this.context.createMediaElementSource(video);
                } else {
                     // If we already have a source but for a different video element (rare in SPA if recycled, but possible)
                     // Actually, if the video element changes, we need a new source.
                     // But usually YouTube reuses the player.
                     // If it's a new element, we need a new source.
                     this.source = this.context.createMediaElementSource(video);
                }
                
                this.updateRouting();
                
                // Ensure context is running
                if (this.context.state === 'suspended') {
                    this.context.resume();
                }
                
                // Listen for play to resume context
                video.addEventListener('play', () => {
                    if (this.context.state === 'suspended') this.context.resume();
                });
                
            } catch (e) {
                // console.error('[Flow] Source Attach Failed (might be already connected):', e);
            }
        },

        enable: function() {
            this.isEnabled = true;
            this.updateRouting();
        },

        disable: function() {
            this.isEnabled = false;
            this.updateRouting();
        },

        updateRouting: function() {
            if (!this.source || !this.context) return;

            // Visual Indicator - REMOVED as requested by user
            if (this.videoElement) {
                if (this.isEnabled) {
                    // this.videoElement.style.boxShadow = '0 0 10px 2px #4ade80'; // Green glow
                    // this.videoElement.style.border = '2px solid #4ade80';
                    this.videoElement.style.boxShadow = 'none';
                    this.videoElement.style.border = 'none';
                } else {
                    this.videoElement.style.boxShadow = 'none';
                    this.videoElement.style.border = 'none';
                }
            }

            // Disconnect everything first to reset
            try {
                this.source.disconnect();
                this.panner.disconnect();
                this.convolver.disconnect();
                this.gain.disconnect();
            } catch (e) {}
            
            // Reconnect gain to destination always
            this.gain.connect(this.context.destination);

            if (this.isEnabled) {
                // Reverb routing logic based on mode
                // Mix: Dry (Panner) + Wet (Reverb)
                
                // 1. Dry Path: Source -> Compressor -> BassBoost -> MidBoost -> TrebleBoost -> Panner -> Filter -> Gain
                this.source.connect(this.compressor);
                this.compressor.connect(this.bassBoost);
                this.bassBoost.connect(this.midBoost);
                this.midBoost.connect(this.trebleBoost);
                this.trebleBoost.connect(this.panner);
                
                if (this.filter) {
                    this.panner.connect(this.filter);
                    this.filter.connect(this.gain);
                } else {
                    this.panner.connect(this.gain);
                }
                
                // 2. Wet Path: Source -> Convolver -> Gain (Subtle)
                // We create a side-chain for reverb to add "room" feel
                // But only if mode is Back or distant
                
                const reverbGain = this.context.createGain();
                // Adjust reverb based on mode
                // FIXED: Drastically reduced wet gain levels to eliminate echo artifacts
                if (this.currentMode === 'back') {
                    reverbGain.gain.value = 0.15; // Reduced from 0.6
                } else if (this.currentMode === 'cinema') {
                    reverbGain.gain.value = 0.1; // Reduced from 0.3
                } else if (this.currentMode === '8d') {
                    reverbGain.gain.value = 0.1; // Reduced from 0.4
                } else if (this.currentMode === 'left' || this.currentMode === 'right') {
                    reverbGain.gain.value = 0.05; // Reduced from 0.3
                } else {
                    reverbGain.gain.value = 0.0; // ZERO reverb for Front Mode (Pure Clarity)
                }
                
                // Analyser connection (Side chain)
                this.source.connect(this.analyser);
                
                this.source.connect(this.convolver);
                this.convolver.connect(reverbGain);
                reverbGain.connect(this.gain);

                console.log('[Flow] Spatial Audio Routing: ENABLED (' + this.currentMode + ')');
            } else {
                // Path: Source -> Destination (Normal)
                this.source.connect(this.context.destination);
                console.log('[Flow] Spatial Audio Routing: DISABLED');
            }
        }
    };

    // Auto-attach loop
    setInterval(() => {
        window.ContinuumSpatialAudio.attach();
    }, 1000);

})();
`;
