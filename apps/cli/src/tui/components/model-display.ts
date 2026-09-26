// knownModels keys are bare IDs ("claude-sonnet-4-6") but config.modelId
// may include a provider prefix ("anthropic/claude-sonnet-4-6"), so we
// try the full ID first, then strip the prefix and retry.
function lookupModelInfo(
	modelId: string,
	knownModels?: Record<string, unknown>,
): { name?: string } | undefined {
	if (!knownModels) return undefined;
	const candidates = [modelId, modelId.split("/").pop()];
	for (const key of candidates) {
		if (!key) continue;
		const hit = knownModels[key] as { name?: string } | undefined;
		if (hit) return hit;
	}
	return undefined;
}

// Friendly display names for models that don't have a meaningful catalog
// entry under the openai-compatible provider (custom endpoints, shared
// distribution builds, etc). Keyed by the exact model id sent to the API.
const CUSTOM_MODEL_DISPLAY_NAMES: Record<string, string> = {
	"xro-8.5-pro": "Xro 8.5",
	"xro-8.5": "Xro 8.5",
};

export function resolveModelDisplayName(config: {
	providerId?: string;
	modelId: string;
	knownModels?: Record<string, unknown>;
	thinking?: boolean;
	reasoningEffort?: string;
}): string {
	const info = lookupModelInfo(config.modelId, config.knownModels);
	const modelIdTail = config.modelId.split("/").pop() ?? config.modelId;
	let displayName =
		CUSTOM_MODEL_DISPLAY_NAMES[config.modelId] ??
		CUSTOM_MODEL_DISPLAY_NAMES[modelIdTail] ??
		info?.name ??
		modelIdTail;
	if (config.thinking && config.reasoningEffort) {
		displayName = `${displayName} (${config.reasoningEffort})`;
	}
	if (config.providerId === "cline-pass") {
		displayName = `ClinePass: ${displayName}`;
	}
	return displayName;
}

export function resolveModelMaxInputTokens(config: {
	modelId: string;
	knownModels?: Record<string, unknown>;
}): number | undefined {
	const info = (lookupModelInfo(config.modelId, config.knownModels) ?? {}) as {
		maxInputTokens?: number;
		contextWindow?: number;
	};
	if (typeof info.maxInputTokens === "number" && info.maxInputTokens > 0) {
		return info.maxInputTokens;
	}
	if (typeof info.contextWindow === "number" && info.contextWindow > 0) {
		return info.contextWindow;
	}
	return undefined;
}
