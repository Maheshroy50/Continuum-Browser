/**
 * Permission Manager
 * 
 * Manages per-site, time-limited, revocable permissions for AI agent actions.
 * Key principles:
 * - Per site: linkedin.com permissions don't apply to indeed.com
 * - Time-limited: Default 30 min, max 24 hours
 * - Revocable: Instant revocation via UI
 * - Never "always allow forever"
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
    Permission,
    PermissionStatus,
    IntentType,
} from './types';

/** Default permission duration: 30 minutes */
const DEFAULT_DURATION_MS = 30 * 60 * 1000;

/** Maximum permission duration: 24 hours */
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

export class PermissionManager {
    private permissions: Map<string, Permission> = new Map();
    private permissionsFile: string;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.permissionsFile = path.join(app.getPath('userData'), 'agent-permissions.json');
        this.loadPermissions();
        this.startCleanupInterval();
    }

    /**
     * Check if permission exists for an origin and intent type
     */
    checkPermission(origin: string, intentType: IntentType): PermissionStatus {
        const now = Date.now();

        // Find matching permission
        for (const permission of this.permissions.values()) {
            if (
                permission.origin === origin &&
                permission.actionTypes.includes(intentType) &&
                !permission.revokedAt &&
                permission.expiresAt > now
            ) {
                return { status: 'granted', permission };
            }
        }

        // Check if this intent type needs approval
        const autoApprovedIntents: IntentType[] = ['read_page', 'summarize', 'highlight_element'];
        if (autoApprovedIntents.includes(intentType)) {
            // Create implicit permission for read-only actions
            const implicitPermission: Permission = {
                id: `implicit-${origin}-${intentType}`,
                origin,
                actionTypes: [intentType],
                grantedAt: now,
                expiresAt: now + DEFAULT_DURATION_MS,
            };
            return { status: 'granted', permission: implicitPermission };
        }

        return { status: 'requires_approval' };
    }

    /**
     * Grant permission for specific actions on a site
     */
    grantPermission(
        origin: string,
        actionTypes: IntentType[],
        durationMs: number = DEFAULT_DURATION_MS
    ): Permission {
        const now = Date.now();
        const duration = Math.min(durationMs, MAX_DURATION_MS);

        const permission: Permission = {
            id: crypto.randomUUID(),
            origin: this.normalizeOrigin(origin),
            actionTypes,
            grantedAt: now,
            expiresAt: now + duration,
        };

        this.permissions.set(permission.id, permission);
        this.savePermissions();

        return permission;
    }

    /**
     * Revoke a specific permission
     */
    revokePermission(permissionId: string): boolean {
        const permission = this.permissions.get(permissionId);
        if (permission) {
            permission.revokedAt = Date.now();
            this.savePermissions();
            return true;
        }
        return false;
    }

    /**
     * Revoke all permissions for a site
     */
    revokeAllForSite(origin: string): number {
        const normalizedOrigin = this.normalizeOrigin(origin);
        let count = 0;

        for (const permission of this.permissions.values()) {
            if (permission.origin === normalizedOrigin && !permission.revokedAt) {
                permission.revokedAt = Date.now();
                count++;
            }
        }

        if (count > 0) {
            this.savePermissions();
        }

        return count;
    }

    /**
     * Emergency: Revoke ALL permissions
     */
    revokeAll(): number {
        const now = Date.now();
        let count = 0;

        for (const permission of this.permissions.values()) {
            if (!permission.revokedAt) {
                permission.revokedAt = now;
                count++;
            }
        }

        if (count > 0) {
            this.savePermissions();
        }

        return count;
    }

    /**
     * Get all active (non-expired, non-revoked) permissions
     */
    getActivePermissions(): Permission[] {
        const now = Date.now();
        return Array.from(this.permissions.values()).filter(
            p => !p.revokedAt && p.expiresAt > now
        );
    }

    /**
     * Get permissions for a specific site
     */
    getPermissionsForSite(origin: string): Permission[] {
        const normalizedOrigin = this.normalizeOrigin(origin);
        const now = Date.now();

        return Array.from(this.permissions.values()).filter(
            p => p.origin === normalizedOrigin && !p.revokedAt && p.expiresAt > now
        );
    }

    /**
     * Extend an existing permission's duration
     */
    extendPermission(permissionId: string, additionalMs: number): boolean {
        const permission = this.permissions.get(permissionId);
        if (!permission || permission.revokedAt) {
            return false;
        }

        const newExpiry = Math.min(
            permission.expiresAt + additionalMs,
            permission.grantedAt + MAX_DURATION_MS
        );

        permission.expiresAt = newExpiry;
        this.savePermissions();
        return true;
    }

    /**
     * Normalize origin to consistent format
     */
    private normalizeOrigin(origin: string): string {
        try {
            const url = new URL(origin);
            return `${url.protocol}//${url.host}`;
        } catch {
            return origin;
        }
    }

    /**
     * Load permissions from disk
     */
    private loadPermissions(): void {
        try {
            if (fs.existsSync(this.permissionsFile)) {
                const data = fs.readFileSync(this.permissionsFile, 'utf-8');
                const parsed = JSON.parse(data) as Permission[];

                // Filter out expired permissions on load
                const now = Date.now();
                for (const permission of parsed) {
                    if (!permission.revokedAt && permission.expiresAt > now) {
                        this.permissions.set(permission.id, permission);
                    }
                }
            }
        } catch (error) {
            console.error('[PermissionManager] Failed to load permissions:', error);
        }
    }

    /**
     * Save permissions to disk
     */
    private savePermissions(): void {
        try {
            const data = Array.from(this.permissions.values());
            fs.writeFileSync(this.permissionsFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('[PermissionManager] Failed to save permissions:', error);
        }
    }

    /**
     * Periodically clean up expired permissions
     */
    private startCleanupInterval(): void {
        // Clean up every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpired();
        }, 5 * 60 * 1000);
    }

    /**
     * Remove expired permissions from memory and disk
     */
    private cleanupExpired(): void {
        const now = Date.now();
        let removed = 0;

        for (const [id, permission] of this.permissions.entries()) {
            if (permission.expiresAt < now || permission.revokedAt) {
                this.permissions.delete(id);
                removed++;
            }
        }

        if (removed > 0) {
            this.savePermissions();
        }
    }

    /**
     * Cleanup on shutdown
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

export const permissionManager = new PermissionManager();
