# Continuum

> A task-first, privacy-native browser that preserves context and lets you resume exactly where you left off.

**Created by Mahesh Rao**

---

## ✨ Philosophy

**Resume your work, not your tabs.**

Continuum organizes browsing into **Workspaces** — persistent contexts that remember everything: your scroll position, open pages, notes, and focus. Unlike Chrome where tabs disappear and history is lost, Continuum treats your browsing as continuous work.

---

## 🚀 Features

### 🔄 Workspace Resume
When you return to any page, you're exactly where you left off.

- **Cascading Restore Strategy**:
  1. **DOM Anchor** — Find the text you were reading
  2. **Scroll Ratio** — Restore proportional position (handles layout shifts)
  3. **Pixel Position** — Fallback to exact Y coordinate
- **Redirect Detection** — Handles URL redirects gracefully
- **Toast Feedback** — "Restored exactly where you left off" with method shown
- **Per-Page State** — Scroll, zoom, and form data persisted

### 📝 Notes Panel
Keep notes per Workspace — markdown-friendly scratchpad.

- **Renameable Title** — Click to customize (e.g., "Research Notes", "To-Do")
- **Collapsible** — State persisted per Workspace (localStorage)
- **Auto-Save** — Debounced 800ms save
- **Word & Character Count** — Shown in footer
- **Empty State Hint** — "Use this space to capture thoughts..."
- **Markdown Support** — Plain text with markdown hint

### ✂️ Send to Notes
Clip content from any webpage directly into notes.

- **Right-Click Context Menu** — Select text → Right-click → "Send to Notes"
- **Markdown Quote Format**:
  ```markdown
  > Selected text here...
  
  — hostname.com
  ```
- **Instant Append** — No modal, no delay
- **Copy + Select All** — Standard context menu items included

### ⚡ Quick Switcher (Cmd+K)
Power-user fast switching between Workspaces.

- **Keyboard Shortcut** — `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
- **Instant Open** — BrowserView paused for <16ms response time
- **Debounced Search** — 150ms input debounce
- **Keyboard Navigation** — `↑` `↓` to navigate, `Enter` to switch, `Esc` to close
- **Smart Sorting** — Active Workspace first, then by most recently updated
- **Resume Indicator** — Shows which Workspaces have pages to resume

### 🔍 Multi-Engine Search
6 search engines with persisted preference.

| Engine | Prefix |
|--------|--------|
| Google | default |
| Bing | — |
| DuckDuckGo | — |
| Yahoo | — |
| Ecosia | — |
| Naver | — |

- **Dropdown Selector** — In address bar
- **Persisted Preference** — Saved to localStorage
- **URL Detection** — Auto-detects URLs vs search queries
- **Naver Integration** — Auto-default for Korean locale

### 📥 Download Manager
Minimal, workspace-aware download tracking.

- **Unobtrusive UI** — Icon only appears during active downloads
- **Workspace Aware** — Tracks downloads across all isolated sessions
- **System Integation** — Native notifications on completion
- **Quick Actions** — Pause, Resume, Reveal in Finder

<!-- 
### 🧩 Chrome Extensions (beta)
Chrome extension runtime and quick controls in the address bar.

- **Puzzle Menu** — Use the extensions button in the address bar to view installed extensions
- **Install from URL** — Paste a Chrome Web Store or `.crx` URL to install
- **Load Unpacked** — Point to a local extension folder for development builds
- **One-Click Remove** — Remove misbehaving extensions without restarting
-->

### 🤖 AI Agent (Second Brain)
Ask questions or **delegate tasks** to your AI agent.

- **Dual Modes**:
  - **Chat Mode** — Summarize, explain, and question (Read-only)
  - **Agent Mode** — Fill forms, navigate, and click buttons (Active)
- **Security First** — Granular permissions, Power Levels (1-3), and human approval for all actions
- **Multi-Provider** — Works with OpenAI, Gemini, or Claude
- **BYOK** — Bring Your Own Key for privacy

### 🔄 P2P Sync (beta)
Securely sync your data across devices without a central server.

- **End-to-End Encryption** — Data stays encrypted during transit
- **Peer-to-Peer** — Direct WebRTC connection between your devices
- **Generate or Join** — Create a sync key or join an existing session
- **Status Indicator** — Real-time connection and peer count display
- **No Cloud Required** — All sync happens locally between devices 

### 🔒 Privacy Focus
Native privacy controls and site management.

- **Per-Site Permissions** — Toggle Location, Camera, Mic per site
- **Privacy Overview** — See blocking stats in Settings
- **Lock Icon** — Quick access to site security settings
- **Default Browser** — Set Continuum as default (respectful, no nagging)
*   **Download Manager**: Native download handling with pause/resume support.
*   **Popup Blocker**: Blocks malicious popups and redirects based on aggressive blocklists.
###  Bookmarks & History
Quick access to saved pages.

- **Star Button** — One-click bookmark in address bar
- **History Panel** — Toggle with clock icon
- **Tabbed Interface** — Switch between History and Bookmarks
- **Click to Navigate** — Opens page in current Workspace

### 🪟 Native Window Experience
macOS-native feel with custom title bar.

- **Hidden Title Bar** — `hiddenInset` style with traffic lights
- **Draggable Regions** — Sidebar header and address bar
- **Full-Width Browsing** — Notes panel hides when viewing a page

### 🎉 Welcome Screen
First-launch experience.

- **Shows Once** — Stored in localStorage (`continuum-welcome-seen`)
- **Clean Design** — "Continuum" title, tagline, credit
- **Get Started Button** — Dismisses permanently

### 🌐 Global Language Support
Full internationalization with 19 supported languages.

- **Smart Language Dropdown**:
  - **Suggested** — Auto-detected from system language
  - **Popular** — Collapsible common languages list
  - **All Languages** — Searchable full list
- **Supported Languages**:
  - **Indian**: Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi
  - **Global**: English, Spanish, French, German, Portuguese, Russian, Chinese, Japanese, Korean, Arabic
- **Context-Aware** — Language preference persisted locally
- **Native Naming** — "日本語 (Japanese)", "हिन्दी (Hindi)" for better readability

### 🔒 Persistence & Isolation
Local-first, no cloud sync.

- **All Data Local** — Stored in `flows.json`
- **Per-Workspace Isolation** — Separate sessions (cookies, cache)
- **No Telemetry** — Nothing leaves your machine

---

## ⚡ Performance Optimizations

| Optimization | Description |
|--------------|-------------|
| **BrowserView Pause** | Hidden during overlays for <16ms response |
| **Spellcheck Disabled** | Reduces CPU during video playback |
| **DevTools Disabled** | Only enabled in development |
| **No Backdrop Blur** | Solid backgrounds instead of GPU-heavy blur |
| **Debounced Inputs** | Search and notes save are debounced |
| **Memoized Components** | FlowSwitcher and FlowRow use `memo()` |

---

## 🎯 Key Differentiators

| Chrome | Continuum |
|--------|-----------|
| Tabs disappear on close | Pages persist forever |
| Start fresh every time | Resume exactly where you stopped |
| One shared session | Isolated sessions per Workspace |
| Tab chaos | Organized Workspaces |
| Scroll position lost | Cascading scroll restore |
| Copy-paste to notes | Right-click "Send to Notes" |
| One search engine | 6 search engines to choose from |

---

## 🛠 Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
# Install dependencies
npm install

# Run in development 
npm run dev

# Build for production
npm run build
```
---

## 📦 Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Electron 35 |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Build | Vite + electron-builder |
| Icons | Lucide React |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

MIT © 2026 Mahesh Rao
