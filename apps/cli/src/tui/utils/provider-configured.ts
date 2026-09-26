import { isProviderSettingsUsable, ProviderSettingsManager } from "@cline/core";
import { loadXroAccount } from "../xro-account-manager";
import type { TuiProps } from "../types";

export function isProviderConfigured(config: TuiProps["config"]): boolean {
	if (!loadXroAccount()) {
		return false;
	}
	if (config.apiKey?.trim()) {
		return true;
	}
	const manager = new ProviderSettingsManager();
	const settings = manager.getProviderSettings(config.providerId);
	const providerConfig = manager.getProviderConfig(config.providerId, {
		includeKnownModels: false,
	});
	return isProviderSettingsUsable(config.providerId, settings, providerConfig);
}
