# Privacy and Security at Continuum

Continuum is designed with a "Local-First, Privacy-Centric" philosophy. We believe your browsing data belongs to you, and you alone. Below is a detailed breakdown of our privacy architecture and security measures.

## 1. Data Storage & Ownership

### Local-First Storage
*   **Location**: All user data (workspaces, history, bookmarks, notes) is stored locally on your device in the standard application data directory (`~/Library/Application Support/Continuum` on macOS).
*   **Format**: Data is stored in transparent, unencrypted JSON files (`flows.json`), giving you full control and portability. You can back up, inspect, or delete this data at any time.
*   **No Cloud Sync**: Continuum does not have a central server. Your data never leaves your machine unless you explicitly share it.

### Note Taking
*   **Local Persistence**: Notes are stored within the local `flows.json` file.
*   **Privacy**: Notes are never analyzed, indexed, or sent to third-party servers.

## 2. Browser Security

### Sandbox & Isolation
*   **Context Isolation**: Continuum uses Electron's `contextIsolation: true` for all browser views. This ensures that web pages cannot access the internal logic of the browser or your system files.
*   **Sandboxing**: Rendering processes are sandboxed (`sandbox: true`) to restrict their access to OS resources.
*   **Node Integration Disabled**: `nodeIntegration: false` prevents web pages from executing Node.js commands, neutralizing a common class of Electron security vulnerabilities.

### Permissions Management
*   **Site-Specific Permissions**: Continuum implements a granular permission system. You must explicitly grant access to sensitive capabilities like Camera, Microphone, and Geolocation on a per-site basis.
*   **Lock Icon**: Clicking the lock icon in the address bar reveals the current site's security status and permissions, allowing you to revoke access instantly.

## 3. Tracking & Telemetry

### No Telemetry
*   **Zero Tracking**: Continuum collects **zero** telemetry usage data. We do not track which sites you visit, how long you stay, or what features you use.
*   **No "Phone Home"**: The application does not communicate with any Continuum servers. Updates must be downloaded manually (or via a standard auto-updater if configured, which only checks for version numbers).

## 4. Content Handling

### Download Security
*   **User Confirmation**: Downloads require user initiation.
*   **Isolation**: Downloads are handled by a dedicated Manager process, separating file system write operations from the renderer process.

## 5. Cleaning Your Data

### One-Click Clear
*   **Privacy Settings**: You can clear your browsing history, cache, cookies, and local storage directly from the Sidebar ("Clear" button) or the Command Palette (`Cmd+K` -> Clear History).
*   **Scope**: This action wipes both the Continuum application state and the underlying Electron session data, ensuring a fresh start.

---

**Commitment**: We are open-source at heart. You are encouraged to audit our code to verify these claims. Your trust is our currency.
