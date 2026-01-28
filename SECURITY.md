# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **DO NOT** open a public issue for security vulnerabilities
2. Email your findings to **maheshroy50@example.com**
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Resolution Timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next release

### Scope

The following are in scope:
- Continuum Browser application code
- Electron main/renderer process security
- Data storage and persistence
- Extension handling

### Out of Scope

- Third-party websites visited through the browser
- Chrome extension vulnerabilities (report to extension authors)
- Social engineering attacks

## Security Best Practices

Continuum is designed with privacy in mind:
- All data stored locally (no cloud sync)
- Per-workspace session isolation
- No telemetry or tracking
- Sandboxed web content

---

Thank you for helping keep Continuum secure! 🔒
