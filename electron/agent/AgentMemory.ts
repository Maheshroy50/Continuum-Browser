/**
 * Agent Memory
 * 
 * Encrypted persistent memory for:
 * - User profile (name, email, resume, etc.)
 * - Site memory (forms filled, user corrections)
 * - Action history (audit log)
 * 
 * Security:
 * - Profile encrypted with Electron safeStorage
 * - Site memory per-origin, never includes passwords
 * - Memory content NEVER sent raw to LLM
 */

import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
    UserProfile,
    SiteMemory,
    ActionLogEntry,
    ConversationMessage,
    AgentLongTermMemory,
    GlobalPreferences,
    SuccessPattern
} from './types';

/** Maximum action log entries to keep */
const MAX_ACTION_LOG_ENTRIES = 1000;

/** Maximum site memory entries per site */
const MAX_SITE_FORMS = 50;

export class AgentMemory {
    private userDataPath: string;
    private profilePath: string;
    private siteMemoryPath: string;
    private actionLogPath: string;
    private longTermMemoryPath: string;

    // Session memory (in-memory only)
    private sessionHistory: ConversationMessage[] = [];

    // Cached data
    private userProfile: UserProfile | null = null;
    private siteMemoryCache: Map<string, SiteMemory> = new Map();
    private longTermMemoryCache: AgentLongTermMemory | null = null;

    constructor() {
        this.userDataPath = app.getPath('userData');
        this.profilePath = path.join(this.userDataPath, 'agent-profile.enc');
        this.siteMemoryPath = path.join(this.userDataPath, 'agent-site-memory.json');
        this.actionLogPath = path.join(this.userDataPath, 'agent-action-log.json');
        this.longTermMemoryPath = path.join(this.userDataPath, 'agent-long-term.json');
    }

    // =========================================================================
    // Session Memory (In-memory, cleared on restart)
    // =========================================================================

    getSessionHistory(): ConversationMessage[] {
        return [...this.sessionHistory];
    }

    addToSession(message: ConversationMessage): void {
        this.sessionHistory.push(message);
        // Keep last 50 messages
        if (this.sessionHistory.length > 50) {
            this.sessionHistory = this.sessionHistory.slice(-50);
        }
    }

    clearSession(): void {
        this.sessionHistory = [];
    }

    // =========================================================================
    // Credential Management (Secure Injection)
    // =========================================================================

    /**
     * Retrieve a secure credential by key (e.g. {{PASSWORD}})
     * This mocks a secure vault integration. In production, this would integrate with
     * macOS Keychain / Windows Credential Manager.
     */
    async getSecureCredential(key: string): Promise<string | null> {
        // Strip braces if present
        const cleanKey = key.replace(/{{|}}/g, '').trim();
        
        // For this implementation, we'll check the encrypted User Profile 'customFields'
        // This allows users to store secrets in their profile which is encrypted on disk.
        const profile = await this.getUserProfile();
        
        if (profile.customFields && profile.customFields[cleanKey]) {
            return profile.customFields[cleanKey];
        }
        
        return null;
    }

    // =========================================================================
    // User Profile (Encrypted, Persistent)
    // =========================================================================

    async getUserProfile(): Promise<UserProfile> {
        if (this.userProfile) {
            return { ...this.userProfile };
        }

        try {
            if (!fs.existsSync(this.profilePath)) {
                return {};
            }

            const encrypted = fs.readFileSync(this.profilePath);

            if (!safeStorage.isEncryptionAvailable()) {
                console.warn('[AgentMemory] Encryption not available, profile not loaded');
                return {};
            }

            const decrypted = safeStorage.decryptString(encrypted);
            this.userProfile = JSON.parse(decrypted);
            return { ...this.userProfile! };
        } catch (error) {
            console.error('[AgentMemory] Failed to load profile:', error);
            return {};
        }
    }

    async updateUserProfile(updates: Partial<UserProfile>): Promise<void> {
        const current = await this.getUserProfile();

        this.userProfile = {
            ...current,
            ...updates,
            lastUpdated: Date.now(),
        };

        try {
            if (!safeStorage.isEncryptionAvailable()) {
                console.warn('[AgentMemory] Encryption not available, profile not saved');
                return;
            }

            const json = JSON.stringify(this.userProfile);
            const encrypted = safeStorage.encryptString(json);
            fs.writeFileSync(this.profilePath, encrypted);
        } catch (error) {
            console.error('[AgentMemory] Failed to save profile:', error);
        }
    }

    async clearUserProfile(): Promise<void> {
        this.userProfile = null;
        try {
            if (fs.existsSync(this.profilePath)) {
                fs.unlinkSync(this.profilePath);
            }
        } catch (error) {
            console.error('[AgentMemory] Failed to clear profile:', error);
        }
    }

    // =========================================================================
    // Pattern Learning (Upgrade 5)
    // =========================================================================

    /**
     * Get a learned pattern for a specific goal on a specific site
     */
    async getPattern(domain: string, goalDescription: string): Promise<SuccessPattern | null> {
        // Use getSiteMemory which handles cache management
        const siteData = await this.getSiteMemory(domain);
        if (!siteData.patterns) return null;

        // Simple exact match on goal description for now
        // In future, could use fuzzy match or embeddings
        const pattern = siteData.patterns.find(p => p.goalDescription === goalDescription);

        if (pattern && pattern.successCount > 0) {
            return pattern;
        }
        return null;
    }

    /**
     * Get all learned patterns for a domain
     */
    async getSitePatterns(domain: string): Promise<SuccessPattern[]> {
        const siteData = await this.getSiteMemory(domain);
        return siteData.patterns || [];
    }

    /**
     * Save a successful strategy
     */
    async savePattern(domain: string, pattern: Omit<SuccessPattern, 'timestamp' | 'successCount'>): Promise<void> {
        // Ensure data is loaded
        const siteData = await this.getSiteMemory(domain);

        if (!siteData.patterns) siteData.patterns = [];

        const existingIndex = siteData.patterns.findIndex(p => p.goalDescription === pattern.goalDescription);

        if (existingIndex >= 0) {
            // Update existing
            const existing = siteData.patterns[existingIndex];
            existing.selector = pattern.selector; // Update selector in case it changed (auto-corrected)
            existing.strategy = pattern.strategy;
            existing.successCount++;
            existing.timestamp = Date.now();
            siteData.patterns[existingIndex] = existing;
        } else {
            // Create new
            siteData.patterns.push({
                ...pattern,
                timestamp: Date.now(),
                successCount: 1
            });
        }

        await this.saveSiteMemory();
    }

    // Unified Load/Save logic handled by internal methods or direct usage
    // loadSiteMemory and saveSiteMemory duplicates removed below

    // =========================================================================
    // Site Memory (Per-domain, Persistent)
    // =========================================================================

    async getSiteMemory(origin: string): Promise<SiteMemory> {
        const normalizedOrigin = this.normalizeOrigin(origin);

        // Check cache first
        if (this.siteMemoryCache.has(normalizedOrigin)) {
            return { ...this.siteMemoryCache.get(normalizedOrigin)! };
        }

        // Load from disk
        const allSiteMemory = await this.readRawSiteMemory();
        const siteMemory = allSiteMemory[normalizedOrigin] || this.createEmptySiteMemory(normalizedOrigin);

        this.siteMemoryCache.set(normalizedOrigin, siteMemory);
        return { ...siteMemory };
    }

    async updateSiteMemory(origin: string, updates: Partial<SiteMemory>): Promise<void> {
        const normalizedOrigin = this.normalizeOrigin(origin);
        const current = await this.getSiteMemory(normalizedOrigin);

        const updated: SiteMemory = {
            ...current,
            ...updates,
            origin: normalizedOrigin,
            lastVisit: Date.now(),
            visitCount: (current.visitCount || 0) + 1,
        };

        // Trim old entries
        if (updated.formsFilledBefore && updated.formsFilledBefore.length > MAX_SITE_FORMS) {
            updated.formsFilledBefore = updated.formsFilledBefore.slice(-MAX_SITE_FORMS);
        }

        this.siteMemoryCache.set(normalizedOrigin, updated);
        await this.saveSiteMemory();
    }

    async recordFormFill(origin: string, fieldName: string, value: string): Promise<void> {
        const siteMemory = await this.getSiteMemory(origin);

        // Don't store password-like fields
        if (/password|passwd|pwd|secret|token/i.test(fieldName)) {
            return;
        }

        // Update or add field
        const existingIndex = siteMemory.formsFilledBefore.findIndex(f => f.fieldName === fieldName);
        const entry = { fieldName, lastValue: value, filledAt: Date.now() };

        if (existingIndex >= 0) {
            siteMemory.formsFilledBefore[existingIndex] = entry;
        } else {
            siteMemory.formsFilledBefore.push(entry);
        }

        await this.updateSiteMemory(origin, { formsFilledBefore: siteMemory.formsFilledBefore });
    }

    async recordUserCorrection(
        origin: string,
        fieldName: string,
        aiValue: string,
        userValue: string
    ): Promise<void> {
        const siteMemory = await this.getSiteMemory(origin);

        siteMemory.userCorrections.push({
            fieldName,
            aiValue,
            userValue,
            correctedAt: Date.now(),
        });

        // Keep last 20 corrections per site
        if (siteMemory.userCorrections.length > 20) {
            siteMemory.userCorrections = siteMemory.userCorrections.slice(-20);
        }

        await this.updateSiteMemory(origin, { userCorrections: siteMemory.userCorrections });
    }

    async clearSiteMemory(origin: string): Promise<void> {
        const normalizedOrigin = this.normalizeOrigin(origin);
        this.siteMemoryCache.delete(normalizedOrigin);

        const allSiteMemory = await this.readRawSiteMemory();
        delete allSiteMemory[normalizedOrigin];

        try {
            fs.writeFileSync(this.siteMemoryPath, JSON.stringify(allSiteMemory, null, 2));
        } catch (error) {
            console.error('[AgentMemory] Failed to clear site memory:', error);
        }
    }

    // =========================================================================
    // Action History (Audit Log)
    // =========================================================================

    async logAction(entry: ActionLogEntry): Promise<void> {
        const log = await this.getActionHistory();
        log.push(entry);

        // Rotate log
        const trimmed = log.slice(-MAX_ACTION_LOG_ENTRIES);

        try {
            fs.writeFileSync(this.actionLogPath, JSON.stringify(trimmed, null, 2));
        } catch (error) {
            console.error('[AgentMemory] Failed to save action log:', error);
        }
    }

    async getActionHistory(limit?: number): Promise<ActionLogEntry[]> {
        try {
            if (!fs.existsSync(this.actionLogPath)) {
                return [];
            }

            const data = fs.readFileSync(this.actionLogPath, 'utf-8');
            const log = JSON.parse(data) as ActionLogEntry[];

            if (limit) {
                return log.slice(-limit);
            }
            return log;
        } catch (error) {
            console.error('[AgentMemory] Failed to load action log:', error);
            return [];
        }
    }

    async clearActionHistory(): Promise<void> {
        try {
            if (fs.existsSync(this.actionLogPath)) {
                fs.unlinkSync(this.actionLogPath);
            }
        } catch (error) {
            console.error('[AgentMemory] Failed to clear action log:', error);
        }
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private normalizeOrigin(origin: string): string {
        try {
            const url = new URL(origin);
            return `${url.protocol}//${url.host}`;
        } catch {
            return origin;
        }
    }

    private createEmptySiteMemory(origin: string): SiteMemory {
        return {
            origin,
            lastVisit: Date.now(),
            visitCount: 0,
            formsFilledBefore: [],
            userCorrections: [],
            patterns: []
        };
    }

    private async readRawSiteMemory(): Promise<Record<string, SiteMemory>> {
        try {
            if (!fs.existsSync(this.siteMemoryPath)) {
                return {};
            }
            const data = fs.readFileSync(this.siteMemoryPath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('[AgentMemory] Failed to load site memory:', error);
            return {};
        }
    }

    private async saveSiteMemory(): Promise<void> {
        // If args provided, update specific entry in full object
        // Otherwise save entire cache

        const allMemory: Record<string, SiteMemory> = await this.readRawSiteMemory();

        // Update with cache
        this.siteMemoryCache.forEach((val, key) => {
            allMemory[key] = val;
        });

        try {
            fs.writeFileSync(this.siteMemoryPath, JSON.stringify(allMemory, null, 2));
        } catch (error) {
            console.error('[AgentMemory] Failed to save site memory:', error);
        }
    }

    /**
     * Get suggested value for a field based on memory
     */
    async getSuggestedValue(origin: string, fieldName: string): Promise<string | null> {
        // First check if user corrected AI for this field
        const siteMemory = await this.getSiteMemory(origin);
        const correction = siteMemory.userCorrections.find(c => c.fieldName === fieldName);
        if (correction) {
            return correction.userValue;
        }

        // Then check site-specific history
        const siteField = siteMemory.formsFilledBefore.find(f => f.fieldName === fieldName);
        if (siteField) {
            return siteField.lastValue;
        }

        // Finally check user profile
        const profile = await this.getUserProfile();
        const fieldLower = fieldName.toLowerCase();

        if (fieldLower.includes('name') && profile.name) return profile.name;
        if (fieldLower.includes('email') && profile.email) return profile.email;
        if (fieldLower.includes('phone') && profile.phone) return profile.phone;
        if (fieldLower.includes('linkedin') && profile.linkedInUrl) return profile.linkedInUrl;

        return null;
    }

    // =========================================================================
    // Long-Term Persistent Memory (Level 3 Agent)
    // =========================================================================

    async getLongTermMemory(): Promise<AgentLongTermMemory> {
        // Return cache if available
        if (this.longTermMemoryCache) {
            return { ...this.longTermMemoryCache };
        }

        try {
            // Initialize default memory structure
            const defaultMemory: AgentLongTermMemory = {
                userProfile: {},
                globalPreferences: {
                    darkMode: false,
                    conciseAnswers: false,
                    techLevel: 'beginner',
                },
                facts: [],
                interactions: [],
                lastUpdated: Date.now(),
            };

            if (!fs.existsSync(this.longTermMemoryPath)) {
                this.longTermMemoryCache = defaultMemory;
                return defaultMemory;
            }

            const data = fs.readFileSync(this.longTermMemoryPath, 'utf-8');
            const memory = JSON.parse(data);

            // Merge with default to handle schema migrations/missing fields
            this.longTermMemoryCache = { ...defaultMemory, ...memory };
            return { ...this.longTermMemoryCache! };
        } catch (error) {
            console.error('[AgentMemory] Failed to load long-term memory:', error);
            // Return safe default on error
            return {
                userProfile: {},
                globalPreferences: { darkMode: false, conciseAnswers: false, techLevel: 'beginner' },
                facts: [],
                interactions: [],
                lastUpdated: Date.now(),
            };
        }
    }

    async updateGlobalPreferences(prefs: Partial<GlobalPreferences>): Promise<void> {
        const memory = await this.getLongTermMemory();
        memory.globalPreferences = { ...memory.globalPreferences, ...prefs };
        memory.lastUpdated = Date.now();
        await this.saveLongTermMemory(memory);
    }

    async addFact(fact: string): Promise<void> {
        const memory = await this.getLongTermMemory();
        if (!memory.facts.includes(fact)) {
            memory.facts.push(fact);
            memory.lastUpdated = Date.now();
            await this.saveLongTermMemory(memory);
        }
    }

    private async saveLongTermMemory(memory: AgentLongTermMemory): Promise<void> {
        try {
            this.longTermMemoryCache = memory;
            fs.writeFileSync(this.longTermMemoryPath, JSON.stringify(memory, null, 2));

            // Also sync UserProfile if it changed, to keep compatibility with legacy method
            // (Optional: depending on if we want to deprecate the separate profile file)
        } catch (error) {
            console.error('[AgentMemory] Failed to save long-term memory:', error);
        }
    }
}

export const agentMemory = new AgentMemory();
