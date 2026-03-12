import { ipcMain } from 'electron';

const DEV_MODE = process.env.NODE_ENV !== 'production';
const log = (...args: any[]) => DEV_MODE && console.log('[WebAuthnManager]', ...args);

/**
 * WebAuthnManager provides native WebAuthn support for macOS using electron-webauthn-mac
 * This is necessary because the standard WebAuthn API is broken in Electron on macOS
 */
export class WebAuthnManager {
    private webauthn: any = null;
    private isAvailable: boolean = false;

    constructor() {
        this.initializeWebAuthn();
        this.setupIPC();
        log('WebAuthnManager initialized');
    }

    private async initializeWebAuthn() {
        try {
            // Only use native WebAuthn on macOS
            if (process.platform === 'darwin') {
                log('Loading electron-webauthn-mac for native Touch ID support...');
                this.webauthn = require('electron-webauthn-mac');
                this.isAvailable = true;
                log('Native WebAuthn library loaded successfully');
                
                // Test if the library is actually working by checking if it has the expected methods
                if (this.webauthn && this.webauthn.createCredential && this.webauthn.getCredential) {
                    log('WebAuthn library has required methods');
                } else {
                    console.error('[WebAuthnManager] WebAuthn library missing required methods');
                    this.isAvailable = false;
                }
            } else {
                log('Native WebAuthn not available on this platform');
                this.isAvailable = false;
            }
        } catch (error) {
            console.error('[WebAuthnManager] Failed to load native WebAuthn library:', error);
            this.isAvailable = false;
        }
    }

    // Helper to convert ArrayBuffer/Uint8Array to Buffer for native library
    private ensureBuffer(obj: any): any {
        if (!obj) return obj;
        if (Buffer.isBuffer(obj)) return obj;
        if (obj instanceof ArrayBuffer) return Buffer.from(obj);
        if (obj instanceof Uint8Array) return Buffer.from(obj);
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.ensureBuffer(item));
        }
        
        if (typeof obj === 'object') {
            const newObj: any = {};
            for (const key in obj) {
                newObj[key] = this.ensureBuffer(obj[key]);
            }
            return newObj;
        }
        
        return obj;
    }

    // Helper to convert value to Buffer (handles Base64URL strings, ArrayBuffers, etc.)
    private toBuffer(val: any): Buffer {
        if (!val) return Buffer.alloc(0);
        if (Buffer.isBuffer(val)) return val;
        if (val instanceof ArrayBuffer) return Buffer.from(val);
        if (val instanceof Uint8Array) return Buffer.from(val);
        if (Array.isArray(val)) return Buffer.from(val);
        
        if (typeof val === 'string') {
            // WebAuthn usually uses Base64URL for strings (no padding, - instead of +, _ instead of /)
            // Node's 'base64url' encoding handles this correctly
            return Buffer.from(val, 'base64url');
        }
        
        return Buffer.alloc(0);
    }

    // Helper to convert any ID/Buffer to Standard Base64 String (for native library)
    private toBase64Standard(val: any): string {
        const buf = this.toBuffer(val);
        return buf.toString('base64');
    }

    // Map standard WebAuthn options to native library format
    private mapCreateOptions(options: any): any {
        const pk = options.publicKey || options; // Handle both wrapped and unwrapped

        // Map authenticators
        let authenticators: string[] = ['platform', 'securityKey'];
        if (pk.authenticatorSelection?.authenticatorAttachment === 'platform') {
            authenticators = ['platform'];
        } else if (pk.authenticatorSelection?.authenticatorAttachment === 'cross-platform') {
            authenticators = ['securityKey'];
        }

        // Map excludeCredentials (ID must be Base64 string for this library)
        const excludeCredentials = pk.excludeCredentials?.map((cred: any) => ({
            id: this.toBase64Standard(cred.id),
            transports: cred.transports
        }));

        return {
            rpId: pk.rp?.id || pk.rpId,
            userId: this.toBuffer(pk.user?.id || pk.userId),
            name: pk.user?.name || pk.name,
            displayName: pk.user?.displayName || pk.displayName,
            challenge: this.toBuffer(pk.challenge),
            authenticators,
            excludeCredentials,
            userVerification: pk.authenticatorSelection?.userVerification || 'preferred',
            attestation: pk.attestation || 'none'
        };
    }

    private mapGetOptions(options: any): any {
        const pk = options.publicKey || options;

        // Map allowCredentials (ID must be Base64 string for this library)
        const allowCredentials = pk.allowCredentials?.map((cred: any) => ({
            id: this.toBase64Standard(cred.id),
            transports: cred.transports
        }));

        return {
            rpId: pk.rpId,
            challenge: this.toBuffer(pk.challenge),
            allowCredentials,
            userVerification: pk.userVerification || 'preferred'
        };
    }

    private setupIPC() {
        // Check if WebAuthn is available
        ipcMain.handle('webauthn:is-available', () => {
            return this.isAvailable;
        });

        // Check if Touch ID is available
        ipcMain.handle('webauthn:is-touchid-available', async () => {
            if (!this.isAvailable) return false;
            
            try {
                // Since electron-webauthn-mac doesn't provide a direct Touch ID availability check,
                // we'll try to create a test credential to see if Touch ID is available
                // For now, we'll assume it's available if the library is loaded
                log('Checking Touch ID availability...');
                
                // Try a simple test to see if we can access the native WebAuthn APIs
                if (this.webauthn && this.webauthn.createCredential) {
                    log('Touch ID should be available (library has createCredential method)');
                    return true;
                }
                
                return false;
            } catch (error) {
                console.error('[WebAuthnManager] Error checking Touch ID availability:', error);
                return false;
            }
        });

        // Create a new credential (registration)
        ipcMain.handle('webauthn:create-credential', async (_, options: any) => {
            if (!this.isAvailable || !this.webauthn) {
                throw new Error('Native WebAuthn is not available');
            }

            try {
                const mappedOptions = this.mapCreateOptions(options);
                log('Creating credential for RP:', mappedOptions.rpId);
                
                if (DEV_MODE) {
                    console.log('[WebAuthnManager] Mapped Create Options:', JSON.stringify({
                        ...mappedOptions,
                        userId: '<Buffer>',
                        challenge: '<Buffer>'
                    }, null, 2));
                }

                const credential = await this.webauthn.createCredential(mappedOptions);
                log('Credential created successfully');
                return credential;
            } catch (error) {
                console.error('[WebAuthnManager] Failed to create credential:', error);
                throw error;
            }
        });

        // Get credential (authentication)
        ipcMain.handle('webauthn:get-credential', async (_, options: any) => {
            if (!this.isAvailable || !this.webauthn) {
                throw new Error('Native WebAuthn is not available');
            }

            try {
                const mappedOptions = this.mapGetOptions(options);
                log('Getting credential for RP:', mappedOptions.rpId);
                
                if (DEV_MODE) {
                    console.log('[WebAuthnManager] Mapped Get Options:', JSON.stringify({
                        ...mappedOptions,
                        challenge: '<Buffer>'
                    }, null, 2));
                }

                const assertion = await this.webauthn.getCredential(mappedOptions);
                log('Credential retrieved successfully');
                return assertion;
            } catch (error) {
                console.error('[WebAuthnManager] Failed to get credential:', error);
                throw error;
            }
        });

        // Get available authenticators
        ipcMain.handle('webauthn:get-authenticators', async () => {
            if (!this.isAvailable || !this.webauthn) {
                return [];
            }

            try {
                // Since electron-webauthn-mac doesn't provide a direct method to list authenticators,
                // we'll return the supported authenticator types based on the library capabilities
                log('Getting available authenticators...');
                
                return [
                    { type: 'platform', name: 'Touch ID', available: true },
                    { type: 'cross-platform', name: 'Security Key', available: true }
                ];
            } catch (error) {
                console.error('[WebAuthnManager] Error getting authenticators:', error);
                return [];
            }
        });

        // Open macOS Passwords settings
        ipcMain.handle('webauthn:manage-passwords', () => {
            if (!this.isAvailable || !this.webauthn) {
                throw new Error('Native WebAuthn is not available');
            }

            try {
                log('Opening macOS Passwords settings...');
                this.webauthn.managePasswords();
                log('Passwords settings opened');
                return true;
            } catch (error) {
                console.error('[WebAuthnManager] Failed to open Passwords settings:', error);
                throw error;
            }
        });
    }

    public isNativeAvailable(): boolean {
        return this.isAvailable;
    }
}