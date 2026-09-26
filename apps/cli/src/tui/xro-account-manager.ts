import fs from "fs";
import path from "path";
import os from "os";

export interface XroAccountConfig {
	email: string;
	apiKey: string;
	userId: string;
	credits: number;
	totalTokensUsed: number;
}

const XRO_CONFIG_DIR = path.join(os.homedir(), ".xrocli", "shared-config", "settings");
const XRO_ACCOUNT_FILE = path.join(XRO_CONFIG_DIR, "xro-account.json");
export const XRO_ACCOUNTS_AUTH_API_BASE = "https://ultraxas.com/api/xro-accounts";
export const XRO_AI_COMPLETIONS_BASE = "https://ai.ultraxas.com/v1";

const POSSIBLE_PROVIDER_FILES = [
	path.join(os.homedir(), ".xrocli", "shared-config", "settings", "providers.json"),
	path.join(os.homedir(), ".xrocli", "data", "settings", "providers.json"),
	path.join(os.homedir(), ".cline", "data", "settings", "providers.json"),
	path.join(os.homedir(), ".cline", "shared-config", "settings", "providers.json"),
];

export function loadXroAccount(): XroAccountConfig | null {
	try {
		if (fs.existsSync(XRO_ACCOUNT_FILE)) {
			const data = fs.readFileSync(XRO_ACCOUNT_FILE, "utf8");
			return JSON.parse(data);
		}
	} catch {
		// Ignore read errors
	}
	return null;
}

export function saveXroAccount(config: XroAccountConfig): void {
	try {
		fs.mkdirSync(XRO_CONFIG_DIR, { recursive: true });
		fs.writeFileSync(XRO_ACCOUNT_FILE, JSON.stringify(config, null, 2), "utf8");

		// Sync with all providers.json locations so OpenAI-compatible provider uses the user's key
		for (const providerFile of POSSIBLE_PROVIDER_FILES) {
			try {
				if (fs.existsSync(providerFile)) {
					const raw = fs.readFileSync(providerFile, "utf8");
					const providersObj = JSON.parse(raw);
					if (!providersObj.providers) {
						providersObj.providers = {};
					}
					const existingSettings = providersObj.providers["openai-compatible"]?.settings || {};
					providersObj.providers["openai-compatible"] = {
						...providersObj.providers["openai-compatible"],
						settings: {
							...existingSettings,
							provider: "openai-compatible",
							model: "xro-8.5-pro",
							apiKey: config.apiKey,
							baseUrl: XRO_AI_COMPLETIONS_BASE,
						},
						updatedAt: new Date().toISOString(),
						tokenSource: "manual",
					};
					fs.writeFileSync(providerFile, JSON.stringify(providersObj, null, 2), "utf8");
				}
			} catch {
				// Ignore individual file sync errors
			}
		}
	} catch (err) {
		console.error("Failed to save Xro account config:", err);
	}
}

export function syncXroAccountToProviders(): void {
	const account = loadXroAccount();
	if (account) {
		saveXroAccount(account);
	}
}

export async function fetchLiveXroAccount(apiKey: string): Promise<XroAccountConfig | null> {
	try {
		const resp = await fetch(`${XRO_ACCOUNTS_AUTH_API_BASE}/api/user/me`, {
			headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!resp.ok) return null;
		const data = (await resp.json()) as any;
		const account: XroAccountConfig = {
			email: data.email,
			apiKey: data.api_key,
			userId: data.user_id,
			credits: data.credits,
			totalTokensUsed: data.total_tokens_used,
		};
		saveXroAccount(account);
		return account;
	} catch {
		return null;
	}
}

export async function registerOrLoginXroUser(email: string, password: string): Promise<XroAccountConfig> {
	const resp = await fetch(`${XRO_ACCOUNTS_AUTH_API_BASE}/api/auth/register-or-login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});

	if (!resp.ok) {
		const errData = (await resp.json().catch(() => ({}))) as any;
		throw new Error(errData.detail || "Authentication failed");
	}

	const data = (await resp.json()) as any;
	const account: XroAccountConfig = {
		email: data.email,
		apiKey: data.api_key,
		userId: data.user_id,
		credits: data.credits,
		totalTokensUsed: data.total_tokens_used || 0,
	};

	saveXroAccount(account);
	return account;
}

export function clearXroAccount(): void {
	try {
		if (fs.existsSync(XRO_ACCOUNT_FILE)) {
			fs.unlinkSync(XRO_ACCOUNT_FILE);
		}
		for (const providerFile of POSSIBLE_PROVIDER_FILES) {
			try {
				if (fs.existsSync(providerFile)) {
					const raw = fs.readFileSync(providerFile, "utf8");
					const providersObj = JSON.parse(raw);
					if (providersObj.providers?.["openai-compatible"]) {
						delete providersObj.providers["openai-compatible"];
						fs.writeFileSync(providerFile, JSON.stringify(providersObj, null, 2), "utf8");
					}
				}
			} catch {
				// Ignore file errors
			}
		}
	} catch (err) {
		console.error("Failed to clear Xro account config:", err);
	}
}

