/**
 * AI Agent Type Definitions
 * 
 * Core types for the intent-based AI agent architecture.
 * Security principle: LLM outputs Intent JSON, never executable code.
 */

// =============================================================================
// Intent Types (What the AI can request)
// =============================================================================

export type IntentType =
    | 'read_page'           // Level 1: Read page content
    | 'summarize'           // Level 1: Summarize content
    | 'highlight_element'   // Level 2: Visual highlight
    | 'suggest_action'      // Level 2: Suggest but don't act
    | 'scroll_to'           // Level 2: Scroll to element
    | 'fill_form'           // Level 3: Fill form fields
    | 'click_element'       // Level 3: Click (never submit)
    | 'press_key'           // Level 3: Press key (Enter, Escape)
    | 'navigate'            // Level 2: Navigate to URL
    | 'synthesize_final_answer'; // Level 3: Deep Research Final Answer

export type RiskLevel = 'low' | 'medium' | 'high';

export type PowerLevel = 1 | 2 | 3;

export interface TargetDescriptor {
    /** Human-readable description of target */
    description: string;
    /** CSS selector hint (validated, not executed directly) */
    selectorHint?: string;
    /** Text content to match */
    textMatch?: string;
    /** Element role for accessibility matching */
    role?: string;
}

export interface AgentIntent {
    /** Unique ID for this intent */
    id: string;
    /** Type of action requested */
    type: IntentType;
    /** Target element or area */
    target: TargetDescriptor;
    /** Additional parameters based on intent type */
    parameters: Record<string, unknown>;
    /** AI's confidence in this intent (0-1) */
    confidence: number;
    /** Risk assessment */
    risk: RiskLevel;
    /** Timestamp when intent was generated */
    timestamp: number;
    /** Textual answer or summary from the AI */
    answer?: string;
}

// Specific intent parameter types
export interface FillFormParameters {
    fields: Array<{
        selectorHint: string;
        fieldName: string;
        value: string;
        source: 'user_profile' | 'page_context' | 'ai_generated';
    }>;
}

export interface ClickElementParameters {
    /** Never 'submit' for forms */
    buttonType?: 'navigation' | 'toggle' | 'expand';
}

export interface PressKeyParameters {
    key: string; // 'Enter', 'Escape', 'ArrowDown', etc.
}

// =============================================================================
// Validation & Approval
// =============================================================================

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    sanitizedIntent?: AgentIntent;
}

export interface ApprovalRequest {
    id: string;
    intent: AgentIntent;
    origin: string;
    previewHtml?: string;
    affectedElements: string[];
    consequences: string;
    timestamp: number;
}

export interface ApprovalResult {
    approved: boolean;
    requestId: string;
    approvedBy: 'user' | 'cached_permission';
    timestamp: number;
}

// =============================================================================
// Permissions
// =============================================================================

export interface Permission {
    id: string;
    origin: string;
    actionTypes: IntentType[];
    grantedAt: number;
    expiresAt: number;
    revokedAt?: number;
}

export type PermissionStatus =
    | { status: 'granted'; permission: Permission }
    | { status: 'denied'; reason: string }
    | { status: 'requires_approval' };

// =============================================================================
// Execution
// =============================================================================

export interface ApprovedIntent extends AgentIntent {
    approvalId: string;
    approvedAt: number;
}

export type AgentTerminalStatus = 'success' | 'failed' | 'cancelled';

export interface AgentTerminalData {
    status: AgentTerminalStatus;
    summary: string;
    answer?: string;
    manualSteps?: string[];
    finalUrl?: string;
    attemptsUsed: number;
}

export interface ActionResult<T = unknown> {
    success: boolean;
    intentId: string;
    executedAt: number;
    durationMs: number;
    error?: string;
    /** Elements that were modified */
    affectedElements?: string[];
    /** Result data (e.g. summary text, answer) */
    data?: T;
    /** Strategy used to achieve learning (Upgrade 5) */
    strategy?: string;
}

export interface DOMSnapshot {
    url: string;
    title: string;
    /** Sanitized text content (no scripts, no sensitive data) */
    textContent: string;
    /** Form fields on page (no values for password fields) */
    formFields: Array<{
        selector: string;
        type: string;
        name: string;
        label?: string;
        required?: boolean;
        /** Never included for password/sensitive fields */
        value?: string;
    }>;
    /** Clickable elements (Buttons, Links) */
    buttons: Array<{
        selector: string;
        text: string;
        type: 'submit' | 'button' | 'link' | 'submit-action';
        rect?: { x: number; y: number; width: number; height: number };
        accessibility?: { role: string; label: string };
    }>;
    /** ALL Interactive elements (Inputs, Buttons, Links, Toggles) - Supercedes formFields/buttons eventually */
    interactive: Array<{
        selector: string;
        role: string; // button, link, input, combobox, etc.
        text: string;
        label?: string;
        rect: { x: number; y: number; width: number; height: number };
        attributes: Record<string, string>; // type, placeholder, aria-*, etc.
        isVisible: boolean;
        isCovered: boolean; // Z-index check result
    }>;
}

// =============================================================================
// Memory
// =============================================================================

export interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
    timestamp: number;
    intentIds?: string[];
}

export interface UserProfile {
    name?: string;
    email?: string;
    phone?: string;
    resumeText?: string;
    linkedInUrl?: string;
    portfolioUrl?: string;
    preferredLanguage?: string;
    /** Custom fields user can add */
    customFields?: Record<string, string>;
    lastUpdated?: number;
}

export interface SuccessPattern {
    goalDescription: string; // "apply button", "login link"
    selector: string; // The selector that worked
    strategy: string; // "selector", "id", "aria", "vision"
    timestamp: number;
    successCount: number;
}

export interface SiteMemory {
    origin: string;
    lastVisit: number;
    visitCount: number;
    /** Fields we've filled before on this site */
    formsFilledBefore: Array<{
        fieldName: string;
        lastValue: string;
        filledAt: number;
    }>;
    /** When user corrected AI's suggestion */
    userCorrections: Array<{
        fieldName: string;
        aiValue: string;
        userValue: string;
        correctedAt: number;
    }>;
    /** Learned strategies for finding elements */
    patterns: Array<SuccessPattern>;
}

export interface ActionLogEntry {
    id: string;
    intentType: IntentType;
    origin: string;
    targetDescription: string;
    approved: boolean;
    approvedBy?: 'user' | 'cached_permission';
    result: 'success' | 'failure' | 'cancelled';
    error?: string;
    timestamp: number;
    durationMs?: number;
}

// =============================================================================
// Long-Term Persistent Memory (Level 3 Agent)
// =============================================================================

export interface GlobalPreferences {
    darkMode: boolean;
    conciseAnswers: boolean;
    techLevel: 'beginner' | 'expert';
    autoApprove?: boolean;
}

export interface InteractionLog {
    id: string;
    goal: string;
    outcome: 'success' | 'failure';
    summary: string;
    timestamp: number;
}

export interface AgentLongTermMemory {
    userProfile: UserProfile;
    globalPreferences: GlobalPreferences;
    facts: string[]; // Facts about user or world learned over time
    interactions: InteractionLog[];
    lastUpdated: number;
}

// =============================================================================
// Research State (Deep Loop)
// =============================================================================

export interface Subtask {
    id: string;
    description: string;
    status: 'pending' | 'active' | 'completed' | 'failed';
    successCriteria: string;
    dependencies: string[];
}

export interface FailureAnalysis {
    decision: 'retry' | 'new_strategy' | 'skip_step' | 'abort';
    reason: string;
    correction?: string;
    newSubtasks?: Subtask[];
}

export interface ResearchState {
    isActive: boolean;
    goal: string;
    plan: Subtask[];
    completedTasks: string[];
    gatheredInfo: string[]; // Snippets of info found
    visitedUrls: string[];
    iteration: number;
    maxIterations: number;
}

// =============================================================================
// Activity States (for UI indicator)
// =============================================================================

// =============================================================================
// Activity States (for UI indicator)
// =============================================================================

export type AgentActivityState =
    | 'idle'
    | 'reading'
    | 'thinking' // Deep planning
    | 'proposing'
    | 'awaiting_approval'
    | 'executing'
    | 'verifying' // Autonomy V2
    | 'persisting' // Deep Memory
    | 'complete'
    | 'error';

export interface AgentActivity {
    state: AgentActivityState;
    message?: string;
    intentId?: string;
    progress?: number;
    attempt?: number;
    maxAttempts?: number;
    summary?: string;
    manualSteps?: string[];
    /** For Granular Status UI: Detailed technical log */
    details?: string;
    /** Icon hint for UI: 'eye' | 'brain' | 'mouse' | 'save' */
    icon?: string;
}

// =============================================================================
// Power Level Configuration
// =============================================================================

export const POWER_LEVEL_CONFIG: Record<PowerLevel, {
    name: string;
    description: string;
    allowedIntents: IntentType[];
}> = {
    1: {
        name: 'Reader',
        description: 'Can read and summarize page content',
        allowedIntents: ['read_page', 'summarize'],
    },
    2: {
        name: 'Assistant',
        description: 'Can highlight elements and suggest actions',
        allowedIntents: ['read_page', 'summarize', 'highlight_element', 'suggest_action', 'scroll_to', 'navigate'],
    },
    3: {
        name: 'Agent',
        description: 'Can fill forms and click elements (with approval)',
        allowedIntents: ['read_page', 'summarize', 'highlight_element', 'suggest_action', 'scroll_to', 'fill_form', 'click_element', 'press_key', 'navigate', 'synthesize_final_answer'],
    },
};

// =============================================================================
// Blocked Selectors (Security)
// =============================================================================

/** Selectors that AI can NEVER interact with */
export const BLOCKED_SELECTORS = [
    'input[type="password"]',
    'input[autocomplete*="password"]',
    'input[autocomplete*="cc-"]',
    'input[autocomplete*="credit"]',
    'input[name*="credit"]',
    'input[name*="card"]',
    'input[name*="cvv"]',
    'input[name*="cvc"]',
    'input[name*="ssn"]',
    'input[name*="social-security"]',
    '[data-sensitive="true"]',
];

/** Button types AI can never click */
export const BLOCKED_BUTTON_TYPES = [
    // 'button[type="submit"]', // ALLOWED: AI needs to submit forms
    // 'input[type="submit"]',  // ALLOWED: AI needs to submit forms
    // '[data-action="submit"]', // ALLOWED: AI needs to submit forms
    '[data-action="purchase"]',
    '[data-action="pay"]',
    '[data-action="delete"]',
    '[data-action="remove-account"]',
];
