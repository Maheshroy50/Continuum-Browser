# Welcome to the Continuum Browser Wiki!

Continuum is a **task-first, privacy-native browser** that preserves context and lets you resume exactly where you left off.

---

## 📚 Documentation

- [Getting Started](Getting-Started) - Installation and first run
- [Features](Features) - Complete feature guide
- [Keyboard Shortcuts](Keyboard-Shortcuts) - Power user shortcuts
- [FAQ](FAQ) - Frequently asked questions

---

## 🗺️ Roadmap

### Current Status: **Beta (v0.1.0)**

| Phase | Status | Description |
|-------|--------|-------------|
| Beta | completed| Multi-platform releases, extensions support |
| v1.0 | 📋 Planned | Cloud sync, mobile companion |

### Upcoming Features

- [ ] Cloud sync (opt-in)
- [ ] Workspace sharing
- [ ] Mobile companion app
- [ ] Custom themes
- [ ] Plugin system

---

## 🏗️ Architecture

```
continuum/
├── electron/          # Main process (Electron)
│   ├── main.ts        # App entry point
│   ├── ViewManager.ts # BrowserView management
│   └── BlockerEngine.ts # Ad blocking
├── src/               # Renderer process (React)
│   ├── components/    # UI components
│   ├── store/         # Zustand state
│   └── shared/        # Shared types
└── dist-electron/     # Built electron files
```

---

## 🤝 Contributing

See [CONTRIBUTING.md](https://github.com/Maheshroy50/Continuum-Browser/blob/main/CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT © 2026 Mahesh Rao
