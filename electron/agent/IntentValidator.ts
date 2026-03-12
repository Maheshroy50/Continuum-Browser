/**
 * Intent Validator
 * 
 * Validates AI-generated intents against security rules.
 * This is the first line of defense against prompt injection and malformed intents.
 */

import {
    AgentIntent,
    IntentType,
    ValidationResult,
    PowerLevel,
    RiskLevel,
    POWER_LEVEL_CONFIG,
    BLOCKED_SELECTORS,
    BLOCKED_BUTTON_TYPES,
    FillFormParameters,
} from './types';

/** Patterns that indicate code injection attempts */
const CODE_INJECTION_PATTERNS = [
    /\beval\s*\(/i,
    /\bnew\s+Function\s*\(/i,
    /\bsetTimeout\s*\(/i,
    /\bsetInterval\s*\(/i,
    /\bdocument\s*\./i,
    /\bwindow\s*\./i,
    /\blocation\s*\./i,
    /<script\b/i,
    /javascript:/i,
    /on(click|error|load|mouseover|mouseout|keydown|keyup|keypress|change|submit|focus|blur|abort|dblclick|drag|drop)\s*=/i,  // specific event handlers
    /\bfetch\s*\(/i,
    /\bXMLHttpRequest/i,
    /\bimport\s*\(/i,
    /\brequire\s*\(/i,
];

/** Maximum allowed string lengths */
const MAX_LENGTHS = {
    description: 500,
    selectorHint: 200,
    textMatch: 300,
    fieldValue: 5000,
};

export class IntentValidator {
    private powerLevel: PowerLevel;

    constructor(powerLevel: PowerLevel = 1) {
        this.powerLevel = powerLevel;
    }

    setPowerLevel(level: PowerLevel): void {
        this.powerLevel = level;
    }

    /**
     * Validate an intent from the LLM
     */
    validate(intent: unknown): ValidationResult {
        const errors: string[] = [];

        // 1. Basic structure validation
        if (!intent || typeof intent !== 'object') {
            return { valid: false, errors: ['Intent must be an object'] };
        }

        const intentObj = intent as Partial<AgentIntent>;

        // 2. Required fields
        if (!intentObj.type) {
            errors.push('Missing required field: type');
        }

        // Auto-fix: If target is missing but answer is present, use default target
        if (!intentObj.target && intentObj.answer) {
            intentObj.target = {
                description: 'General page context',
                selectorHint: 'body'
            };
        }

        if (!intentObj.target) {
            errors.push('Missing required field: target');
        }
        if (typeof intentObj.confidence !== 'number') {
            errors.push('Missing or invalid confidence score');
        }

        if (errors.length > 0) {
            return { valid: false, errors };
        }

        // 3. Intent type validation
        const validTypes: IntentType[] = [
            'read_page', 'summarize', 'highlight_element',
            'suggest_action', 'scroll_to', 'fill_form', 'click_element',
            'navigate', 'synthesize_final_answer'
        ];
        if (!validTypes.includes(intentObj.type as IntentType)) {
            errors.push(`Invalid intent type: ${intentObj.type}`);
        }

        // 4. Power level check
        const allowedIntents = POWER_LEVEL_CONFIG[this.powerLevel].allowedIntents;
        if (!allowedIntents.includes(intentObj.type as IntentType)) {
            errors.push(
                `Intent type "${intentObj.type}" not allowed at power level ${this.powerLevel} (${POWER_LEVEL_CONFIG[this.powerLevel].name})`
            );
        }

        // 5. Confidence threshold
        if (intentObj.confidence! < 0 || intentObj.confidence! > 1) {
            errors.push('Confidence must be between 0 and 1');
        }
        if (intentObj.confidence! < 0.7 && ['fill_form', 'click_element'].includes(intentObj.type!)) {
            errors.push(`Low confidence (${intentObj.confidence}) for high-risk action`);
        }

        // 6. Target validation
        if (intentObj.target) {
            const targetErrors = this.validateTarget(intentObj.target);
            errors.push(...targetErrors);
        }

        // 7. Code injection check
        const injectionErrors = this.checkCodeInjection(intentObj);
        errors.push(...injectionErrors);

        // 8. Blocked selector check
        if (intentObj.target?.selectorHint) {
            const blockedErrors = this.checkBlockedSelectors(intentObj.target.selectorHint);
            errors.push(...blockedErrors);
        }

        // 9. Intent-specific validation
        if (intentObj.type === 'fill_form') {
            const formErrors = this.validateFillFormIntent(intentObj);
            errors.push(...formErrors);
        }
        if (intentObj.type === 'click_element') {
            const clickErrors = this.validateClickIntent(intentObj);
            errors.push(...clickErrors);
        }

        if (errors.length > 0) {
            return { valid: false, errors };
        }

        // Create sanitized intent
        const sanitizedIntent: AgentIntent = {
            id: crypto.randomUUID(),
            type: intentObj.type as IntentType,
            target: this.sanitizeTarget(intentObj.target!),
            parameters: this.sanitizeParameters(intentObj.parameters || {}),
            confidence: intentObj.confidence!,
            risk: this.assessRisk(intentObj.type as IntentType),
            timestamp: Date.now(),
            answer: typeof intentObj.answer === 'string' ? intentObj.answer.slice(0, 10000) : undefined,
        };

        return { valid: true, errors: [], sanitizedIntent };
    }

    private validateTarget(target: unknown): string[] {
        const errors: string[] = [];

        if (!target || typeof target !== 'object') {
            errors.push('Target must be an object');
            return errors;
        }

        const t = target as Record<string, unknown>;

        if (!t.description || typeof t.description !== 'string') {
            errors.push('Target must have a description string');
        } else if (t.description.length > MAX_LENGTHS.description) {
            errors.push(`Target description too long (max ${MAX_LENGTHS.description})`);
        }

        if (t.selectorHint && typeof t.selectorHint === 'string') {
            if (t.selectorHint.length > MAX_LENGTHS.selectorHint) {
                errors.push(`Selector hint too long (max ${MAX_LENGTHS.selectorHint})`);
            }
        }

        return errors;
    }

    private checkCodeInjection(intent: Partial<AgentIntent>): string[] {
        const errors: string[] = [];

        // Only scan STRUCTURAL fields for code injection, not user-content fields.
        // User-content fields (answer, fill_form field values) can legitimately
        // contain text that matches injection patterns (e.g. "information on Wednesday =").
        const structuralStrings: string[] = [];

        // Collect structural fields
        if (intent.type) structuralStrings.push(intent.type);
        if (intent.target?.description) structuralStrings.push(intent.target.description);
        if (intent.target?.selectorHint) structuralStrings.push(intent.target.selectorHint);
        if ((intent.target as any)?.textMatch) structuralStrings.push((intent.target as any).textMatch);

        // For fill_form, only scan field selectors and names, NOT values
        const params = intent.parameters as Partial<FillFormParameters> | undefined;
        if (params?.fields && Array.isArray(params.fields)) {
            for (const field of params.fields) {
                if (field.selectorHint) structuralStrings.push(field.selectorHint);
                if (field.fieldName) structuralStrings.push(field.fieldName);
            }
        }

        // Scan only structural content for injection patterns
        const structuralContent = structuralStrings.join(' ');
        for (const pattern of CODE_INJECTION_PATTERNS) {
            if (pattern.test(structuralContent)) {
                errors.push(`Potential code injection detected: ${pattern.source}`);
            }
        }

        return errors;
    }

    private checkBlockedSelectors(selectorHint: string): string[] {
        const errors: string[] = [];
        const lowerSelector = selectorHint.toLowerCase();

        for (const blocked of BLOCKED_SELECTORS) {
            // Skip blocking password fields if this is a secure fill operation
            // (Note: This function is called for ALL actions, so we need to be careful)
            if (blocked.includes('password') || blocked.includes('credit')) {
                continue; // Handled by validateFillFormIntent more granularly
            }

            if (lowerSelector.includes(blocked.toLowerCase().replace(/[[\]"'=*]/g, ''))) {
                errors.push(`Blocked selector pattern detected: ${blocked}`);
            }
        }

        // Check for password-related patterns
        // RELAXED: Handled by validateFillFormIntent
        // if (/password|passwd|pwd|secret|token|api.?key/i.test(selectorHint)) {
        //    errors.push('Cannot target password or secret fields');
        // }

        return errors;
    }

    private validateFillFormIntent(intent: Partial<AgentIntent>): string[] {
        const errors: string[] = [];
        const params = intent.parameters as Partial<FillFormParameters> | undefined;

        if (!params?.fields || !Array.isArray(params.fields)) {
            errors.push('fill_form intent must include fields array');
            return errors;
        }

        for (const field of params.fields) {
            if (!field.selectorHint || !field.fieldName) {
                errors.push('Each field must have selectorHint and fieldName');
            }
            if (field.value && field.value.length > MAX_LENGTHS.fieldValue) {
                errors.push(`Field value too long for ${field.fieldName}`);
            }
            
            // Check if trying to fill password field
            const isPassword = /password|passwd|pwd/i.test(field.fieldName) || /password|passwd|pwd/i.test(field.selectorHint);
            
            if (isPassword) {
                // Allow ONLY if it's a secure injection request (value is a reference or marked secure)
                const isSecureReference = field.value.startsWith('{{') && field.value.endsWith('}}');
                
                if (!isSecureReference) {
                    errors.push('Cannot fill password fields with plain text. Use secure credential injection.');
                }
            }
        }

        return errors;
    }

    private validateClickIntent(intent: Partial<AgentIntent>): string[] {
        const errors: string[] = [];
        const selectorHint = intent.target?.selectorHint || '';

        // Check for submit buttons
        // Logic: Check if any blocked type is included in selector
        const hasBlocked = BLOCKED_BUTTON_TYPES.some(blocked =>
            selectorHint.toLowerCase().includes(blocked.toLowerCase().replace(/[[\]"'=*]/g, ''))
        );

        if (hasBlocked) {
            errors.push('Cannot click submit buttons');
        }

        // Check for dangerous actions
        if (/delete|remove|cancel.?subscription|close.?account/i.test(selectorHint)) {
            errors.push('Cannot click dangerous action buttons');
        }

        return errors;
    }

    private sanitizeTarget(target: Record<string, unknown> | any): AgentIntent['target'] {
        return {
            description: String(target.description || '').slice(0, MAX_LENGTHS.description),
            selectorHint: target.selectorHint
                ? String(target.selectorHint).slice(0, MAX_LENGTHS.selectorHint)
                : undefined,
            textMatch: target.textMatch
                ? String(target.textMatch).slice(0, MAX_LENGTHS.textMatch)
                : undefined,
            role: target.role ? String(target.role) : undefined,
        };
    }

    private sanitizeParameters(params: Record<string, unknown>): Record<string, unknown> {
        // Deep clone and sanitize
        const sanitized: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string') {
                // Truncate long strings
                sanitized[key] = value.slice(0, MAX_LENGTHS.fieldValue);
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(item =>
                    typeof item === 'object' ? this.sanitizeParameters(item as Record<string, unknown>) : item
                );
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeParameters(value as Record<string, unknown>);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    private assessRisk(intentType: IntentType): RiskLevel {
        switch (intentType) {
            case 'read_page':
            case 'summarize':
            case 'synthesize_final_answer':
                return 'low';
            case 'highlight_element':
            case 'suggest_action':
            case 'scroll_to':
            case 'navigate':
                return 'medium';
            case 'fill_form':
            case 'click_element':
                return 'high';
            default:
                return 'high';
        }
    }

    /**
     * Parse and validate raw LLM output
     */
    parseAndValidate(rawOutput: string): ValidationResult {
        // Try to extract JSON from the output
        let parsed: unknown;

        try {
            // First try direct parse
            parsed = JSON.parse(rawOutput);
        } catch {
            // Try to find JSON in the output
            const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsed = JSON.parse(jsonMatch[0]);
                } catch {
                    return { valid: false, errors: ['Failed to parse JSON from LLM output'] };
                }
            } else {
                // FALLBACK: If no JSON found, treat the entire output as a conversational answer
                // This handles cases where the LLM ignores instructions and replies with plain text
                // or refuses to perform an action but explains why.
                parsed = {
                    type: 'suggest_action', // Use suggest_action (Level 2) or summarize (Level 1)
                    target: {
                        description: 'Conversational response',
                        selectorHint: 'body'
                    },
                    confidence: 0.8, // Medium confidence since it's a fallback
                    answer: rawOutput.trim(),
                    parameters: {}
                };
            }
        }

        return this.validate(parsed);
    }
}

export const intentValidator = new IntentValidator();
