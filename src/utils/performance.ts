
export const measurePerformance = (label: string, thresholdMs = 16) => {
    const start = performance.now();
    return () => {
        const duration = performance.now() - start;
        if (duration > thresholdMs) {
            console.warn(`[Performance] ${label} took ${duration.toFixed(2)}ms (Threshold: ${thresholdMs}ms)`);
        } else {
            // console.log(`[Performance] ${label} took ${duration.toFixed(2)}ms`);
        }
    };
};

export const checkMainThreadBlocking = (thresholdMs = 50) => {
    return new Promise<void>((resolve) => {
        const start = performance.now();
        setTimeout(() => {
            const duration = performance.now() - start;
            // setTimeout(..., 0) should take slightly more than 0ms. 
            // If it takes significantly longer, the main thread was blocked.
            if (duration > thresholdMs) {
                console.warn(`[Performance] Main thread was blocked for ${duration.toFixed(2)}ms`);
            }
            resolve();
        }, 0);
    });
};
