import { AIService } from './AIService';

describe('AIService retryWithBackoff', () => {
    test('limits provider retries to three total attempts', async () => {
        const service = new AIService();
        const fn = jest.fn().mockRejectedValue(new Error('503 Service Unavailable'));

        await expect((service as any).retryWithBackoff(fn, 'github', 3, 0)).rejects.toThrow('503 Service Unavailable');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    test('fails fast on non-retryable errors', async () => {
        const service = new AIService();
        const fn = jest.fn().mockRejectedValue(new Error('401 Unauthorized'));

        await expect((service as any).retryWithBackoff(fn, 'openai', 3, 0)).rejects.toThrow('401 Unauthorized');
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
