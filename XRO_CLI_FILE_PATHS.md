# Xro CLI File & Repository Structure (`@ultraxas/xro`)

Below is the complete file path directory structure for the **Xro CLI** repository and installed binaries.

---

## 1. Local Codebase Repository Paths

- **Repository Root**: `/home/ultraxas/Projects/xrocli`
- **CLI Application Workspace**: `/home/ultraxas/Projects/xrocli/apps/cli`
- **Documentation Markdown File**: `/home/ultraxas/Projects/xrocli/XRO_CLI_DOCUMENTATION.md`
- **Repository README**: `/home/ultraxas/Projects/xrocli/README.md`

### Source Files & Architecture Map

| File Path | Description |
| :--- | :--- |
| `apps/cli/package.json` | Package metadata (`@ultraxas/xro` v1.0.6), binary script registration (`"xro"`), dependencies |
| `apps/cli/src/index.ts` | CLI entry point launcher |
| `apps/cli/src/tui/root.tsx` | Main TUI Root container & Onboarding/Chat View Router |
| `apps/cli/src/tui/views/onboarding-xro-login-screen.tsx` | Full-screen interactive login onboarding screen |
| `apps/cli/src/tui/status-bar.tsx` | Reactive status bar component (renders `Logged in: <email>` & credit balance) |
| `apps/cli/src/tui/hooks/useAccountDialog.tsx` | Account authentication hook (`logoutAccount()`, session state) |
| `apps/cli/src/tui/slash-command-registry.ts` | Registry for slash commands (includes `/logout`, hides `/login`) |
| `apps/cli/src/tui/utils/provider-configured.ts` | Logic to check if user has active login session credentials |
| `apps/cli/script/build.ts` | Multi-platform build script (cross-compiles Linux, macOS, Windows binaries) |
| `apps/cli/script/publish-npm.ts` | npm release & publishing automation script |

---

## 2. User Configuration & Credential File Paths

When a user runs Xro CLI locally, credentials, workspace state, and settings are saved under:

- **Config Directory**: `~/.xrocli/shared-config/`
- **Account Session File**: `~/.xrocli/shared-config/settings/xro-account.json`
- **Global Settings File**: `~/.xrocli/shared-config/settings/cline_custom_modes.json`

---

## 3. Global Binary & npm Installation Paths

- **npm Global Binary Link**: `/home/ultraxas/.nvm/versions/node/v22.22.0/bin/xro`
- **npm Global Package Directory**: `/home/ultraxas/.nvm/versions/node/v22.22.0/lib/node_modules/@ultraxas/xro`
- **Official npm Registry Target**: `https://www.npmjs.com/package/@ultraxas/xro`

---

## 4. Backend API & VPS File Paths

- **VPS Host**: `automation@87.106.69.120`
- **Accounts & Credit Proxy Service**: `/home/automation/xro-accounts/server.py`
- **SQLite Database Path**: `~/.xro_accounts.db` on VPS
- **Credit Meter Proxy Endpoint**: `https://ultraxas.com/v1/chat/completions` (Port `3024`)

---

## 5. Website Documentation Page Files

- **Website Repository Root**: `/home/ultraxas/Documents/Xro Source 2`
- **CLI Article Component**: `/home/ultraxas/Documents/Xro Source 2/src/pages/IntroducingXroCli.tsx`
- **CLI Article Content**: `/home/ultraxas/Documents/Xro Source 2/src/data/xroCliArticle.ts`
- **Live URL**: `https://ultraxas.com/introducing-xro-cli`
