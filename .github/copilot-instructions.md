# Continuum Browser - AI Agent Instructions

## Project Overview
Continuum is a task-first, privacy-native Electron browser with **Workspace-based context preservation**. Unlike traditional tab-based browsers, it organizes browsing into persistent "Flows" (workspaces) that remember scroll position, notes, and state across sessions.

**Key Differentiator**: Each Flow has its own isolated BrowserView with a dedicated WebContents, enabling multi-context browsing and sophisticated AI agent automation.

## Architecture

### Core Pattern: Dual Process + BrowserView Isolation
- **Main Process** (`electron/main.ts`): Manages BrowserViews, IPC handlers, AI agent system, security features
- **Renderer Process** (`src/App.tsx`): React UI for sidebar, address bar, notes panel, switcher
- **BrowserViews** (`electron/ViewManager.ts`): Each Flow/Page runs in an isolated BrowserView (not iframes!)

**Critical**: Views are NOT destroyed on switch — they're hidden/shown for instant resume. State is tracked in `Map<flowId, Map<pageId, ViewState>>`.

### State Management
- **Frontend State**: Zustand stores in `src/store/` (`useFlowStore`, `usePreferencesStore`, `useAIStore`)
- **Persistent Storage**: JSON files via IPC (`flows.json` in userData directory)
- **View State**: Managed by ViewManager, includes scroll position, zoom, form data, and DOM anchors for resume

### IPC Communication Pattern
```typescript
// Renderer → Main
window.ipcRenderer.invoke('view:create', flowId, pageId, url, state)
// Main → Renderer
mainWindow.webContents.send('view:url-updated', { flowId, pageId, url })
```
All IPC is exposed via `electron/preload.ts` using `contextBridge.exposeInMainWorld`.

## AI Agent System

### 5-Layer Security Architecture
1. **AgentGateway** (`electron/agent/AgentGateway.ts`): Central orchestrator, enforces permissions
2. **ReasoningEngine** (`electron/agent/ReasoningEngine.ts`): Chain-of-Thought reasoning, self-critique
3. **IntentValidator** (`electron/agent/IntentValidator.ts`): JSON schema validation, blocks dangerous patterns
4. **PermissionManager** (`electron/agent/PermissionManager.ts`): Per-site, time-limited, Power Level (1-3) gating
5. **ActionExecutor** (`electron/agent/ActionExecutor.ts`): Sandboxed DOM interaction via CDP

**Security Principle**: LLM never gets direct API access. It outputs JSON intents (e.g., `{"type": "click", "selector": "#btn"}`) which are validated → permission-checked → executed by ActionExecutor.

### Adding New Agent Capabilities
1. Define intent type in `electron/agent/types.ts` (`AgentIntent`)
2. Add validation in `IntentValidator.validate()`
3. Implement execution in `ActionExecutor.executeIntent()`
4. Update `PermissionManager.INTENT_POWER_LEVELS` if risky

### Workflow Execution
```typescript
// Enqueue job
workflowEngine.addJob({ type: 'execution', goal: 'Book a flight', urls: [...] })
// Triggers: AgentGateway → ReasoningEngine → ActionExecutor loop
```
See `docs/AI_AGENT_ARCHITECTURE.md` for flow diagrams.

## Critical Developer Workflows

### Build & Dev
```bash
npm run dev              # Start Vite dev server + Electron (auto-reload)
npm run build:mac        # Production build with Widevine-enabled Electron
npm test                 # Jest tests (mostly agent system)
```

**Important**: Uses **castlabs/electron-releases** (Widevine-enabled fork) for DRM. Standard Electron builds won't work for Netflix/Spotify.

### Testing Agent Changes
```bash
npm test -- electron/agent/CDPBridge.test.ts  # Run specific test
```
Manual testing: Use "Agent Mode" in UI (Cmd+Shift+A), check console for `[AgentGateway]` logs.

### State Debugging
- **Frontend State**: React DevTools + Zustand DevTools
- **Flow Data**: `~/Library/Application Support/Continuum/flows.json` (human-readable JSON)
- **View State**: Enable `DEV_MODE = true` in `ViewManager.ts` for verbose logging

## Project-Specific Conventions

### Workspace Resume Strategy (Cascading Fallbacks)
```typescript
// 1. DOM Anchor - Find text you were reading (resilient to layout changes)
// 2. Scroll Ratio - scrollY / docHeight (handles dynamic content)
// 3. Pixel Position - Exact Y coordinate (last resort)
```
Implementation: `electron/ViewManager.ts` (search `DOM Anchor Resume`). Never skip the anchor step — it's the magic sauce.

### BrowserView Lifecycle
```typescript
// NEVER do this:
view.destroy()  // ❌ Breaks instant resume

// ALWAYS do this:
view.setBounds({ x: 0, y: 0, width: 0, height: 0 })  // ✅ Hide without destroy
```

### IPC Handler Naming
- `view:*` - BrowserView operations (create, select, resize)
- `privacy:*` - Privacy/permission management
- `agent:*` - AI agent actions
- `workflow:*` - Background job queue

### CSS Architecture
- **Tailwind** for UI components (src/components/)
- **Injected CSS** for content scripts (AD_BLOCKING_CSS, YOUTUBE_BLOCKER_SCRIPT)
- **Theme System**: Dynamic CSS variables from `useThemeColorStore` + radial gradients

## Integration Points

### WebAuthn (Passkeys)
Native macOS Touch ID integration via `native-modules/electron-webauthn-mac` (custom Node addon). Falls back to virtual authenticator on other platforms.

### Spatial Audio (YouTube)
Injected script (`YouTubeSpatialAudio.ts`) hooks into Web Audio API to apply HRTF transforms. Configuration in `SPATIAL_AUDIO_TUNING.md`.

### Content Blocking
- **Blocklists**: Loaded from `BlockerEngine.ts` (filters.txt format)
- **Cosmetic Filters**: CSS injection for element hiding
- **YouTube Ad Blocker**: DOM mutation observer script

### P2P Sync (Beta)
- **Yjs** CRDT for conflict-free sync
- **WebRTC** for peer discovery (y-webrtc provider)
- **IndexedDB** for local persistence (y-indexeddb)

## Common Gotchas

1. **BrowserView bounds must be updated manually** when window resizes (see `view:resize` IPC)
2. **DOM Anchor text can fail on SPAs** (e.g., React apps) — fall back to scroll ratio
3. **Agent permissions are time-limited** — always check `PermissionManager.hasPermission()` before execution
4. **Vite base path must be `./`** for Electron `file://` protocol (see `vite.config.ts`)
5. **Google Auth pages are blocklisted** from URL updates (prevents restoring sign-in flows)

## Key Files to Reference

- Architecture decisions: `docs/AI_AGENT_ARCHITECTURE.md`
- Security model: `AI_SECURITY.md`, `PRIVACY_AND_SECURITY.md`
- State persistence: `src/store/useFlowStore.ts` (Flow CRUD)
- View management: `electron/ViewManager.ts` (BrowserView lifecycle)
- Agent entry point: `electron/agent/index.ts` (exports all agent services)

## TypeScript & Bundling

- **No `noEmit`**: TypeScript compiles for Electron main process
- **Vite bundler mode**: `moduleResolution: "bundler"` (see `tsconfig.json`)
- **External deps**: `electron-chrome-extensions` must stay external in Rollup config

## When Adding Features

1. **Frontend**: Add Zustand store action → Update component → Add IPC invoke
2. **Backend**: Add IPC handler in `main.ts` → Implement in service class (e.g., ViewManager)
3. **State Sync**: Save to flows.json via `ipcRenderer.fs.saveFile()` → Reload on startup
4. **Privacy Check**: Does this touch user data? Document in `PRIVACY_AND_SECURITY.md`
