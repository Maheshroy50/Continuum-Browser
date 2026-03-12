
import { measurePerformance } from './performance';

describe('Performance Utils', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'warn').mockImplementation(() => { });
        jest.spyOn(console, 'log').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    test('measurePerformance logs warning if duration exceeds threshold', () => {
        const endMeasure = measurePerformance('Test Task', 10);

        // Advance time by 20ms
        jest.advanceTimersByTime(20);

        endMeasure();

        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[Performance] Test Task took'));
    });

    test('measurePerformance does not log warning if duration is within threshold', () => {
        const endMeasure = measurePerformance('Fast Task', 50);

        // Advance time by 10ms
        jest.advanceTimersByTime(10);

        endMeasure();

        expect(console.warn).not.toHaveBeenCalled();
    });
});
