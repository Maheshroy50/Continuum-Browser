const fs = require('fs');
const path = require('path');

// Test Configuration
const THRESHOLDS = {
    IR_DURATION_MAX: 0.2, // Seconds
    GAIN_BACK_MAX: 0.2,
    GAIN_CINEMA_MAX: 0.15,
    GAIN_8D_MAX: 0.15,
    GAIN_SIDE_MAX: 0.1 // Left/Right
};

const FILE_PATH = path.join(__dirname, '../electron/YouTubeSpatialAudio.ts');

function runTest() {
    console.log('Running Spatial Audio Regression Test...');
    
    if (!fs.existsSync(FILE_PATH)) {
        console.error('❌ File not found:', FILE_PATH);
        process.exit(1);
    }

    const content = fs.readFileSync(FILE_PATH, 'utf8');

    // 1. Check Impulse Response Duration
    // Look for: this.createImpulseResponse(0.1, ...
    const irMatch = content.match(/this\.createImpulseResponse\s*\(\s*([\d\.]+)/);
    if (irMatch) {
        const duration = parseFloat(irMatch[1]);
        if (duration > THRESHOLDS.IR_DURATION_MAX) {
            console.error(`❌ Reverb IR Duration too high: ${duration}s (Max: ${THRESHOLDS.IR_DURATION_MAX}s)`);
            process.exit(1);
        } else {
            console.log(`✅ Reverb IR Duration safe: ${duration}s`);
        }
    } else {
        console.error('❌ Could not find createImpulseResponse call');
        process.exit(1);
    }

    // 2. Check Back Gain
    const backMatch = content.match(/if\s*\(this\.currentMode\s*===\s*'back'\)\s*\{\s*reverbGain\.gain\.value\s*=\s*([\d\.]+)/);
    if (backMatch) {
        const val = parseFloat(backMatch[1]);
        if (val > THRESHOLDS.GAIN_BACK_MAX) {
            console.error(`❌ Back Mode Reverb too high: ${val} (Max: ${THRESHOLDS.GAIN_BACK_MAX})`);
            process.exit(1);
        } else {
            console.log(`✅ Back Mode Reverb safe: ${val}`);
        }
    }

    // 3. Check Cinema Gain
    const cinemaMatch = content.match(/else\s*if\s*\(this\.currentMode\s*===\s*'cinema'\)\s*\{\s*reverbGain\.gain\.value\s*=\s*([\d\.]+)/);
    if (cinemaMatch) {
        const val = parseFloat(cinemaMatch[1]);
        if (val > THRESHOLDS.GAIN_CINEMA_MAX) {
            console.error(`❌ Cinema Mode Reverb too high: ${val} (Max: ${THRESHOLDS.GAIN_CINEMA_MAX})`);
            process.exit(1);
        } else {
            console.log(`✅ Cinema Mode Reverb safe: ${val}`);
        }
    }
    
    // 4. Check 8D Gain
    const d8Match = content.match(/else\s*if\s*\(this\.currentMode\s*===\s*'8d'\)\s*\{\s*reverbGain\.gain\.value\s*=\s*([\d\.]+)/);
    if (d8Match) {
        const val = parseFloat(d8Match[1]);
        if (val > THRESHOLDS.GAIN_8D_MAX) {
            console.error(`❌ 8D Mode Reverb too high: ${val} (Max: ${THRESHOLDS.GAIN_8D_MAX})`);
            process.exit(1);
        } else {
            console.log(`✅ 8D Mode Reverb safe: ${val}`);
        }
    }

    console.log('🎉 All spatial audio regression tests passed!');
}

runTest();
