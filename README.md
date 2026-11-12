# Xro CLI Documentation (`@ultraxas/xro`)

> **Autonomous Terminal Coding Agent for Xro 8.6**

Xro CLI brings the full power of Xro 8.6 directly into your terminal command line. Built for developers, Xro CLI acts as an autonomous coding assistant capable of inspecting codebases, executing terminal commands, creating files, and managing complex developer workflows.

---

## 1. Quick Start & Installation

### npm (macOS, Linux, Windows)

Install Xro CLI globally via npm:

```bash
npm install -g @ultraxas/xro
```

Launch the CLI:

```bash
xro
```

### Termux (Android Package Manager)

You can install Xro CLI directly on Android via Termux using `pkg install xro`.

#### Method A: Official Termux Repo (Recommended)
Add the ULTRAXAS Termux repository and install with `pkg`:

```bash
echo "deb [trusted=yes] https://ultraxas.com/termux stable main" > $PREFIX/etc/apt/sources.list.d/ultraxas.list
pkg update
pkg install xro
```

#### Method B: 1-Step Automatic Installer
Run this single command inside Termux:

```bash
curl -fsSL https://ultraxas.com/termux/install.sh | bash
```

Once installed, simply run:

```bash
xro
```

### Auto-Update Synchronization
Xro CLI automatically checks for updates in the background on startup against `https://ultraxas.com/xro-cli/version.txt` and keeps your global package synchronized automatically.

---

## 2. Multi-Platform Support

Xro CLI is cross-compiled for native execution across all major operating systems and architectures:

| Operating System | Architectures | Target Support |
| :--- | :--- | :--- |
| **Linux** | `x64`, `arm64` | Full terminal TUI & interactive execution |
| **macOS** | Apple Silicon (`arm64`), Intel (`x64`) | Full terminal TUI & interactive execution |
| **Windows** | `x64`, `arm64` | Command Prompt, PowerShell, WSL, Windows Terminal |
| **Android (Termux)** | `aarch64`, `all` | Termux terminal TUI (`pkg install xro`) |

---

## 3. Session & Authentication Flow

### Full-Screen Login Onboarding
When launched for the first time or while unauthenticated (`~/.xrocli/shared-config/settings/xro-account.json` is missing/invalid), Xro CLI opens a full-screen interactive login onboarding view (`OnboardingXroLoginScreen`).

- **Sign In / Sign Up**: Log in using your email and password or register a new Xro account directly inside the terminal.
- **Persistent Key Storage**: Securely stores your session token locally under `~/.xrocli/shared-config/`.

### Status Bar User & Credit Display
Once authenticated, the reactive bottom status bar displays:
- **Left Side**: Mode indicator and slash command shortcuts.
- **Right Side**: `Logged in: <email>` along with real-time active credit balance.

### Logout Flow
To switch accounts or log out:
- Run `/logout` inside the interactive chat palette.
- Or execute `xro logout` directly from your terminal shell.

Running logout immediately clears all local authentication tokens and returns the interface directly to the full-screen onboarding login view.

---

## 4. Features & Interactive Slash Commands

| Command | Usage | Description |
| :--- | :--- | :--- |
| `/logout` | `/logout` | Log out of your Xro account and clear stored credentials |
| `/voice` | `/voice` | Record microphone and transcribe speech to text into the input |
| `/clear` | `/clear` | Clear active conversation history buffer |
| `/help` | `/help` | Open interactive help and documentation menu |
| `/settings` | `/settings` | Configure workspace rules, permissions, and models |

*(Note: `/login` is hidden from slash suggestions as unauthenticated launches route automatically to the full-screen onboarding view).*

---

## 5. Security & Credit Metering System

All AI queries and code generation requests sent from Xro CLI route through the dedicated backend proxy (`https://ultraxas.com/v1/chat/completions`).

1. **Bearer Token Authentication**: Every request includes your active `Bearer xro_live_...` API key.
2. **Upfront Credit Checks**: The backend verifies `credits > 0`. Accounts with `0` balance receive HTTP `402 Insufficient Credits` and are blocked from execution.
3. **Real-Time Metering**: Deducts token consumption per query based on exact usage (`max(0.1, round(total_tokens / 1000.0, 4))`), ensuring **zero unmetered or unauthorized free access**.

---

## 6. Project Architecture & Workspace Locations

- **Source Code Repository**: `/home/ultraxas/Projects/xrocli/apps/cli`
- **npm Package Name**: `@ultraxas/xro`
- **Global Binary Command**: `xro`
- **Current Version**: `v1.0.6`
- **Documentation Web Page**: `https://ultraxas.com/introducing-xro-cli`
