# Spatial Audio Tuning & Regression Prevention

## Issue Diagnosis
**Symptom:** Strong echo/reverb artifacts in Cinema, 8D, Back, Left, and Right modes.
**Root Cause:**
1.  **Impulse Response Duration:** The convolution reverb was using a 2.0-second generated impulse response. This effectively simulated a massive cavern/cathedral, causing distinct slap-back echoes on voice frequencies.
2.  **Excessive Wet Gain:** The reverb mix (wet signal) was set too high relative to the direct signal (dry), particularly in 'back' mode (60% wet).

## Parameter Changes

| Parameter | Old Value | New Value | Reason |
|-----------|-----------|-----------|--------|
| **IR Duration** | 2.0s | 0.1s | Tightens the "room" sound to a small studio/cinema feel rather than a cathedral. Eliminates long decay tails. |
| **Back Gain** | 0.6 | 0.15 | Reduces mud and echo while keeping the "behind you" cue. |
| **Cinema Gain** | 0.3 | 0.1 | Provides subtle ambience without washing out dialogue. |
| **8D Gain** | 0.4 | 0.1 | Maintains clarity during orbital movement. |
| **Left/Right Gain** | 0.3 | 0.05 | Pure panning focus with barely perceptible air. |

## Verification Strategy
- **Static Analysis Test:** `tests/spatial-audio-regression.test.js` ensures these values do not drift back to high levels in future updates.
- **Audio Mode Test:**
    - **Cinema:** Dialogue should be crisp, center-locked, with slight width.
    - **Back:** Sound should feel "behind" but intelligible.
    - **8D:** smooth rotation without volume pumping or tails.
