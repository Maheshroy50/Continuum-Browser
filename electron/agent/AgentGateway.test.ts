const mockIpcHandle = jest.fn();

const mockActionExecutor = {
    setActiveContents: jest.fn(),
    readSnapshot: jest.fn(),
    captureScreenshot: jest.fn(),
    execute: jest.fn(),
    stop: jest.fn(),
};

const mockPermissionManager = {
    checkPermission: jest.fn(),
    grantPermission: jest.fn(),
    revokeAll: jest.fn(),
    getActivePermissions: jest.fn(),
    revokePermission: jest.fn(),
    revokeAllForSite: jest.fn(),
};

const mockMetricsManager = {
    startTask: jest.fn(),
    endTask: jest.fn(),
};

const mockAgentMemory = {
    getLongTermMemory: jest.fn(),
    getSitePatterns: jest.fn(),
    logAction: jest.fn(),
    savePattern: jest.fn(),
};

jest.mock('electron', () => ({
    ipcMain: { handle: mockIpcHandle },
    BrowserWindow: class {},
    WebContents: class {},
}));

jest.mock('./ActionExecutor', () => ({
    actionExecutor: mockActionExecutor,
}));

jest.mock('./PermissionManager', () => ({
    permissionManager: mockPermissionManager,
}));

jest.mock('./MetricsManager', () => ({
    metricsManager: mockMetricsManager,
}));

jest.mock('./AgentMemory', () => ({
    agentMemory: mockAgentMemory,
}));

import { AgentGateway } from './AgentGateway';

const makePlan = () => ([
    {
        id: '1',
        description: 'Open compose',
        status: 'pending',
        successCriteria: 'Compose dialog is visible',
        dependencies: [],
    }
]);

describe('AgentGateway terminal summaries', () => {
    let gateway: AgentGateway;

    beforeEach(() => {
        jest.clearAllMocks();
        gateway = new AgentGateway({} as any);

        mockActionExecutor.readSnapshot.mockResolvedValue(null);
        mockActionExecutor.captureScreenshot.mockResolvedValue(null);
        mockPermissionManager.checkPermission.mockReturnValue({ status: 'granted' });
        mockAgentMemory.getLongTermMemory.mockResolvedValue({
            userProfile: {},
            globalPreferences: { darkMode: true, conciseAnswers: false, techLevel: 'expert' },
            facts: [],
            interactions: [],
            lastUpdated: Date.now(),
        });
        mockAgentMemory.getSitePatterns.mockResolvedValue([]);

        (gateway as any).reasoningEngine = {
            planDetailedStrategy: jest.fn().mockResolvedValue(makePlan()),
            think: jest.fn().mockResolvedValue({
                thoughtTrace: 'done',
                critique: '',
                nextAction: '{}',
                confidence: 0.9,
            }),
            verifySubtaskCompletion: jest.fn().mockResolvedValue(false),
            analyzeFailureStrategy: jest.fn().mockResolvedValue({
                decision: 'retry',
                reason: 'Retry',
            }),
        };

        (gateway as any).validator = {
            parseAndValidate: jest.fn(),
        };
    });

    test('returns a structured success summary for final answers', async () => {
        (gateway as any).validator.parseAndValidate.mockReturnValue({
            valid: true,
            sanitizedIntent: {
                id: 'final-1',
                type: 'synthesize_final_answer',
                target: { description: 'final answer' },
                parameters: {},
                confidence: 0.9,
                risk: 'low',
                timestamp: Date.now(),
                answer: 'Drafted the email successfully.',
            },
        });

        const result = await gateway.processRequest('Draft an email', 'openai', 'test-key');

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
            status: 'success',
            summary: 'Completed the requested task.',
            answer: 'Drafted the email successfully.',
        });
        expect(gateway.getActivityState()).toMatchObject({
            state: 'complete',
            summary: 'Completed the requested task.',
        });
    });

    test('fails with a summary and manual steps after three task failures', async () => {
        (gateway as any).validator.parseAndValidate.mockReturnValue({
            valid: false,
            errors: ['invalid intent'],
        });

        const result = await gateway.processRequest('Draft an email', 'openai', 'test-key');

        expect(result.success).toBe(false);
        expect(result.data).toMatchObject({
            status: 'failed',
            attemptsUsed: 3,
        });
        expect(Array.isArray(result.data?.manualSteps)).toBe(true);
        expect(result.data?.manualSteps?.length).toBeGreaterThan(0);
        expect(gateway.getActivityState()).toMatchObject({
            state: 'error',
            summary: expect.stringContaining("couldn't complete"),
        });
    });

    test('returns a GitHub-specific failure summary when the model fails', async () => {
        (gateway as any).reasoningEngine.planDetailedStrategy.mockRejectedValue(
            new Error('GitHub Models Error (503): gateway unavailable')
        );

        const result = await gateway.processRequest('Draft an email', 'github', 'test-key');

        expect(result.success).toBe(false);
        expect(result.data).toMatchObject({
            status: 'failed',
            attemptsUsed: 3,
        });
        expect(result.data?.summary).toContain('GitHub model kept failing');
        expect(result.data?.manualSteps?.length).toBeGreaterThan(0);
    });
});
