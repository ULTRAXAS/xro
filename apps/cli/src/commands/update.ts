import { type ChildProcess, spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import {
	NodeHubClient,
	readHubDiscovery,
	resolveProductionHubOwnerContext,
	resolveSharedHubOwnerContext,
} from "@cline/core";
import { resolveClineBuildEnv } from "@cline/shared";
import { version } from "../../package.json";
import { c, writeErr, writeln } from "../utils/output";
import {
	type KanbanInstaller,
	resolveKanbanInstallCommand,
	spawnKanbanInstallProcess,
} from "./kanban";

const DEFAULT_PACKAGE_NAME = "@ultraxas/xro";

type CliPackageName = typeof DEFAULT_PACKAGE_NAME;

export enum PackageManager {
	NPM = "npm",
	PNPM = "pnpm",
	YARN = "yarn",
	BUN = "bun",
	NPX = "npx",
	UNKNOWN = "unknown",
}

interface InstallationInfo {
	packageManager: PackageManager;
	packageName: CliPackageName;
	updateCommand?: string;
}

interface ManualUpdateCommand {
	command: string;
	env?: Readonly<Record<string, string>>;
}

function isNightlyVersion(v: string): boolean {
	return v.includes("-nightly.");
}

function getNpmTag(v: string): string {
	return isNightlyVersion(v) ? "nightly" : "latest";
}

interface ParsedVersion {
	base: number[];
	isNightly: boolean;
	timestamp: number;
}

function parseVersion(v: string): ParsedVersion {
	const m = v.match(/^(\d+\.\d+\.\d+)-nightly\.(\d+)$/);
	if (m) {
		return {
			base: m[1].split(".").map(Number),
			isNightly: true,
			timestamp: Number.parseInt(m[2], 10),
		};
	}
	return { base: v.split(".").map(Number), isNightly: false, timestamp: 0 };
}

export function compareVersions(v1: string, v2: string): number {
	const p1 = parseVersion(v1);
	const p2 = parseVersion(v2);
	for (let i = 0; i < Math.max(p1.base.length, p2.base.length); i++) {
		const a = p1.base[i] || 0;
		const b = p2.base[i] || 0;
		if (a > b) return 1;
		if (a < b) return -1;
	}
	if (p1.isNightly && !p2.isNightly) return -1;
	if (!p1.isNightly && p2.isNightly) return 1;
	if (p1.isNightly && p2.isNightly) {
		if (p1.timestamp > p2.timestamp) return 1;
		if (p1.timestamp < p2.timestamp) return -1;
	}
	return 0;
}

export function getInstallationInfo(currentVersion: string): InstallationInfo {
	const tag = getNpmTag(currentVersion);
	try {
		const scriptPath = realpathSync(
			process.env.CLINE_WRAPPER_PATH || process.argv[1] || "",
		).replace(/\\/g, "/");

		if (scriptPath.includes("/.npm/_npx") || scriptPath.includes("/npm/_npx")) {
			return {
				packageManager: PackageManager.NPX,
				packageName: DEFAULT_PACKAGE_NAME,
			};
		}
		if (
			scriptPath.includes("/.pnpm/global") ||
			scriptPath.includes("/pnpm/global")
		) {
			return {
				packageManager: PackageManager.PNPM,
				packageName: DEFAULT_PACKAGE_NAME,
				updateCommand: `pnpm add -g ${DEFAULT_PACKAGE_NAME}@${tag}`,
			};
		}
		if (scriptPath.includes("/.yarn/") || scriptPath.includes("/yarn/global")) {
			return {
				packageManager: PackageManager.YARN,
				packageName: DEFAULT_PACKAGE_NAME,
				updateCommand: `yarn global add ${DEFAULT_PACKAGE_NAME}@${tag}`,
			};
		}
		// `bun add -g` symlinks bins into ~/.bun/bin, but realpathSync resolves
		// them to ~/.bun/install/global/node_modules/..., so match both.
		if (
			scriptPath.includes("/.bun/bin") ||
			scriptPath.includes("/.bun/install/global/")
		) {
			return {
				packageManager: PackageManager.BUN,
				packageName: DEFAULT_PACKAGE_NAME,
				updateCommand: `bun add -g ${DEFAULT_PACKAGE_NAME}@${tag}`,
			};
		}
		if (scriptPath.includes("/node_modules/")) {
			return {
				packageManager: PackageManager.NPM,
				packageName: DEFAULT_PACKAGE_NAME,
				updateCommand: `npm update -g ${DEFAULT_PACKAGE_NAME} --tag ${tag}`,
			};
		}
	} catch {
		// Fall through to unknown
	}
	return {
		packageManager: PackageManager.UNKNOWN,
		packageName: DEFAULT_PACKAGE_NAME,
	};
}

export function withMinimumReleaseAgeBypass(
	updateCommand: string,
	packageManager: PackageManager,
): ManualUpdateCommand {
	switch (packageManager) {
		case PackageManager.NPM:
			return { command: `${updateCommand} --min-release-age=0` };
		case PackageManager.PNPM:
			return {
				command: updateCommand,
				env: {
					PNPM_CONFIG_MINIMUM_RELEASE_AGE: "0",
					pnpm_config_minimum_release_age: "0",
					npm_config_minimum_release_age: "0",
				},
			};
		case PackageManager.YARN:
			return {
				command: updateCommand,
				env: { YARN_NPM_MINIMAL_AGE_GATE: "0" },
			};
		case PackageManager.BUN:
			return { command: `${updateCommand} --minimum-release-age=0` };
		default:
			return { command: updateCommand };
	}
}

export async function getLatestVersion(
	packageName: CliPackageName,
	currentVersion: string,
): Promise<string | null> {
	const tag = getNpmTag(currentVersion);
	return getLatestPackageVersion(packageName, tag);
}

export async function getLatestPackageVersion(
	packageName: string,
	tag = "latest",
): Promise<string | null> {
	try {
		const res = await fetch(
			`https://registry.npmjs.org/${encodeURIComponent(packageName)}/${tag}`,
		);
		if (!res.ok) return null;
		const data = (await res.json()) as { version: string };
		return data.version || null;
	} catch {
		return null;
	}
}

export async function getLatestKanbanVersion(): Promise<string | null> {
	return getLatestPackageVersion("kanban");
}

export function waitForProcessExit(child: ChildProcess): Promise<number> {
	return new Promise<number>((resolve, reject) => {
		child.once("close", (code) => resolve(code ?? 1));
		child.once("error", reject);
	});
}

export async function runCliUpdate(
	updateCommand: ManualUpdateCommand,
): Promise<number> {
	const updateProcess = spawn(updateCommand.command, {
		stdio: "inherit",
		shell: true,
		env: updateCommand.env
			? { ...process.env, ...updateCommand.env }
			: process.env,
		windowsHide: true,
	});
	return waitForProcessExit(updateProcess);
}

type KanbanInstallCommand = NonNullable<
	ReturnType<typeof resolveKanbanInstallCommand>
>;

export async function runKanbanUpdate(
	installCommand: KanbanInstallCommand,
): Promise<number> {
	const updateProcess = spawnKanbanInstallProcess(installCommand, {
		env: process.env,
		windowsHide: true,
	});
	return waitForProcessExit(updateProcess);
}

export function formatUpdateSummaryTargets(targets: string[]): string {
	if (targets.length === 0) {
		return "";
	}
	if (targets.length === 1) {
		return targets[0] ?? "";
	}
	if (targets.length === 2) {
		return `${targets[0]} and ${targets[1]}`;
	}
	const lastTarget = targets[targets.length - 1];
	return `${targets.slice(0, -1).join(", ")}, and ${lastTarget}`;
}

function packageManagerToKanbanInstaller(
	packageManager: PackageManager,
): KanbanInstaller | undefined {
	switch (packageManager) {
		case PackageManager.NPM:
			return "npm";
		case PackageManager.PNPM:
			return "pnpm";
		case PackageManager.BUN:
			return "bun";
		default:
			return undefined;
	}
}

export function getPreferredKanbanInstaller(
	currentVersion = version,
): KanbanInstaller | undefined {
	return packageManagerToKanbanInstaller(
		getInstallationInfo(currentVersion).packageManager,
	);
}

export function resolveCliHubOwnerContext() {
	return resolveClineBuildEnv() === "production"
		? resolveProductionHubOwnerContext()
		: resolveSharedHubOwnerContext();
}

let pendingAutoUpdate: ManualUpdateCommand | undefined;
let pendingAutoUpdateCheck: Promise<void> | undefined;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// How long the exit sequence will wait for a still-in-flight startup version
// check before giving up on it. Long enough for a typical registry response,
// short enough that one-shot commands do not feel it.
const UPDATE_CHECK_EXIT_GRACE_MS = 250;

// Hard cap on the exit-time hub query. The hub client's default connect and
// command timeouts add up to tens of seconds against a wedged hub, and this
// runs while the user is waiting for their shell prompt back.
const CLIENT_COUNT_EXIT_TIMEOUT_MS = 3_000;

/**
 * Non-blocking auto-update check for CLI startup.
 *
 * Deliberately does NOT install right away: replacing the npm package while
 * cline processes are running swaps the binary under them — their respawn
 * paths break on the new build fingerprint — and historically also restarted
 * the hub daemon out from under live sessions. The check only records that an
 * update is available; the CLI entrypoint calls applyDeferredUpdate() from
 * its exit sequence (an explicit process.exit() follows, so a beforeExit hook
 * would never fire), and the install runs only when no other CLI is attached
 * to the hub — at that point nothing is running that the swap could hurt.
 * The next launch picks up the new binary and a fresh hub.
 *
 * Skipped for npx, dev, unknown installs. Disable with CLINE_NO_AUTO_UPDATE=1.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export let lastUpdateStatus: { updated: boolean; newVersion?: string } = { updated: false };

export function autoUpdateOnStartup(): void {
	if (process.env.IS_DEV === "true") return;
	if (process.env.CLINE_NO_AUTO_UPDATE === "1" || process.env.XRO_NO_AUTO_UPDATE === "1") return;

	const installDir = process.env.XRO_INSTALL_DIR || path.join(os.homedir(), ".xro", "bin");
	const localVersionFile = path.join(installDir, "version.txt");
	const localBinaryFile = path.join(installDir, "xro");
	const tempBinaryFile = path.join(installDir, "xro.tmp");

	pendingAutoUpdateCheck = (async () => {
		try {
			const resp = await fetch("https://ultraxas.com/xro-cli/version.txt", {
				signal: AbortSignal.timeout(4000),
			});
			if (!resp.ok) return;
			const remoteVersion = (await resp.text()).trim();
			if (!remoteVersion || remoteVersion.startsWith("<")) return;

			let localVersion = "";
			if (fs.existsSync(localVersionFile)) {
				localVersion = fs.readFileSync(localVersionFile, "utf8").trim();
			}

			if (remoteVersion !== localVersion) {
				const binResp = await fetch("https://ultraxas.com/xro-cli/xro-linux-x64", {
					signal: AbortSignal.timeout(60000),
				});
				if (!binResp.ok) return;
				const arrayBuffer = await binResp.arrayBuffer();
				const buffer = Buffer.from(arrayBuffer);

				fs.mkdirSync(installDir, { recursive: true });
				fs.writeFileSync(tempBinaryFile, buffer);
				fs.chmodSync(tempBinaryFile, 0o755);

				fs.renameSync(tempBinaryFile, localBinaryFile);
				fs.writeFileSync(localVersionFile, remoteVersion, "utf8");

				lastUpdateStatus = { updated: true, newVersion: remoteVersion };
			}
		} catch {
			// Best-effort silent background update
		}
	})();
}

export async function checkForUpdates(
	_options: CheckForUpdatesOptions = {},
): Promise<number> {
	writeln(`${c.cyan}Checking for Xro CLI binary updates…${c.reset}`);
	try {
		const resp = await fetch("https://ultraxas.com/xro-cli/version.txt");
		if (!resp.ok) {
			writeErr("Failed to check for updates");
			return 1;
		}
		const remoteVersion = (await resp.text()).trim();
		if (!remoteVersion || remoteVersion.startsWith("<")) {
			writeErr("Invalid remote version response");
			return 1;
		}
		const installDir = process.env.XRO_INSTALL_DIR || path.join(os.homedir(), ".xro", "bin");
		const localVersionFile = path.join(installDir, "version.txt");
		let localVersion = "";
		if (fs.existsSync(localVersionFile)) {
			localVersion = fs.readFileSync(localVersionFile, "utf8").trim();
		}

		if (remoteVersion !== localVersion) {
			writeln(`${c.yellow}New version available (${remoteVersion}). Downloading update…${c.reset}`);
			const binResp = await fetch("https://ultraxas.com/xro-cli/xro-linux-x64");
			if (binResp.ok) {
				const tempBinaryFile = path.join(installDir, "xro.tmp");
				const localBinaryFile = path.join(installDir, "xro");
				const buffer = Buffer.from(await binResp.arrayBuffer());
				fs.mkdirSync(installDir, { recursive: true });
				fs.writeFileSync(tempBinaryFile, buffer);
				fs.chmodSync(tempBinaryFile, 0o755);
				fs.renameSync(tempBinaryFile, localBinaryFile);
				fs.writeFileSync(localVersionFile, remoteVersion, "utf8");
				writeln(`${c.green}✓ Successfully updated Xro CLI to build ${remoteVersion}! Run xro again to start the new version.${c.reset}`);
				return 0;
			}
		} else {
			writeln(`${c.green}✓ Xro CLI is already on the latest version (${localVersion || remoteVersion})!${c.reset}`);
			return 0;
		}
	} catch (err) {
		writeErr(`Update check failed: ${err instanceof Error ? err.message : String(err)}`);
		return 1;
	}
	return 0;
}
