/**
 * Mouse Utils
 * 
 * Helper class for generating human-like mouse movements.
 * Uses Cubic Bezier curves to simulate natural arcs and variable speed.
 */

export interface Point {
    x: number;
    y: number;
}

export class MouseUtils {
    /**
     * Generate a human-like path between two points using Cubic Bezier curves
     * @param start Starting coordinates
     * @param end Ending coordinates
     * @param steps Number of steps (interpolated points)
     * @returns Array of points representing the path
     */
    static generateHumanPath(start: Point, end: Point, steps: number = 25): Point[] {
        // 1. Calculate Control Points
        // Human movement is rarely a straight line. It usually arcs.
        // We pick two control points (P1, P2) roughly between start and end, 
        // but offset by a random amount to create the arc.

        const direction = {
            x: end.x - start.x,
            y: end.y - start.y
        };
        const distance = Math.sqrt(direction.x ** 2 + direction.y ** 2);
        
        // If distance is tiny, just return line
        if (distance < 5) {
            return [start, end];
        }

        // Randomize the arc intensity based on distance
        const arcIntensity = Math.min(distance * 0.2, 150); // Cap max arc deviation
        
        // Random offsets
        const offset1 = (Math.random() - 0.5) * arcIntensity;
        const offset2 = (Math.random() - 0.5) * arcIntensity;

        // P1: Roughly 1/3 of the way
        const p1: Point = {
            x: start.x + (direction.x * 0.33) + offset1,
            y: start.y + (direction.y * 0.33) - offset1 // Invert Y offset for variety
        };

        // P2: Roughly 2/3 of the way
        const p2: Point = {
            x: start.x + (direction.x * 0.66) + offset2,
            y: start.y + (direction.y * 0.66) - offset2
        };

        // 2. Generate Curve Points
        const path: Point[] = [];
        path.push(start);

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            path.push(this.cubicBezier(t, start, p1, p2, end));
        }

        return path;
    }

    /**
     * Calculate point on a Cubic Bezier curve at time t (0-1)
     */
    private static cubicBezier(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;

        // B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
        const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
        const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;

        return { x, y };
    }

    /**
     * Get a random delay that varies based on the current progress
     * Simulates "Fitts's Law" - slowing down as we approach the target
     */
    static getDelay(stepIndex: number, totalSteps: number, baseDelayMs: number = 10): number {
        // Slow down at the end (last 20%)
        if (stepIndex > totalSteps * 0.8) {
            return baseDelayMs * (1 + Math.random() * 2); // 1x to 3x slower
        }
        // Slight randomness in middle
        return baseDelayMs * (0.8 + Math.random() * 0.4);
    }
}
