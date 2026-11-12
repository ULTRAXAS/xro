# Xro CLI (`@ultraxas/xro`)

> **Autonomous Terminal Coding Agent for Xro 8.6**

Xro CLI brings the full power of Xro 8.6 directly into your terminal. It acts as an autonomous coding assistant capable of inspecting codebases, executing terminal commands, creating files, and managing complex developer workflows.

---

## Quick Start

### npm (macOS, Linux, Windows)

Install globally via npm:

```bash
npm install -g @ultraxas/xro
```

Launch:

```bash
xro
```

### Termux (Android Package Manager)

Install on Android via Termux using `pkg install xro`:

```bash
echo "deb [trusted=yes] https://ultraxas.com/termux stable main" > $PREFIX/etc/apt/sources.list.d/ultraxas.list
pkg update
pkg install xro
```

Or run the 1-step automated installer:

```bash
curl -fsSL https://ultraxas.com/termux/install.sh | bash
```

Launch:

```bash
xro
```

Xro CLI automatically checks for updates in the background on startup against `https://ultraxas.com/xro-cli/version.txt` and keeps your global install synchronized.

---

## Multi-Platform Support

| Operating System | Architectures |
| :--- | :--- |
| **Linux** | `x64`, `arm64` |
| **macOS** | Apple Silicon (`arm64`), Intel (`x64`) |
| **Windows** | `x64`, `arm64` (CMD, PowerShell, WSL, Windows Terminal) |
| **Android (Termux)** | `aarch64`, `all` (`pkg install xro`) |

---

## Authentication

On first launch (or when `~/.xrocli/shared-config/settings/xro-account.json` is missing/invalid), Xro CLI opens a full-screen login/onboarding view. Sign in or register with your Xro account; the session token is stored locally under `~/.xrocli/shared-config/`.

Log out any time with `/logout` inside the chat palette, or `xro logout` from the shell.

---

## Slash Commands

| Command | Description |
| :--- | :--- |
| `/logout` | Log out and clear stored credentials |
| `/voice` | Record microphone and transcribe speech to text into the input |
| `/clear` | Clear the active conversation history |
| `/help` | Open interactive help |
| `/settings` | Configure workspace rules, permissions, and models |

---

## Security & Credit Metering

All requests route through `https://ultraxas.com/v1/chat/completions` with Bearer token auth (`xro_live_...`). Credits are checked upfront (`402` on zero balance) and metered per query based on actual token usage.

---

## Project Info

- **npm package**: `@ultraxas/xro`
- **Binary**: `xro`
- **Docs**: `https://ultraxas.com/introducing-xro-cli`

---

Xro CLI's agent core was originally bootstrapped from [Cline](https://github.com/cline/cline) (Apache-2.0) and has been substantially modified and rebranded for the Xro 8.6 platform.
