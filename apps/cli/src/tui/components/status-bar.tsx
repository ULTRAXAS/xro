import type { AgentMode } from "@cline/core";
import { useTerminalDimensions } from "@opentui/react";
import {
	shouldShowCliUsageCost,
	shouldShowCliUsageCoveredBySubscription,
} from "../../utils/usage-cost-display";
import { useTheme } from "../hooks/use-theme";
import { HOME_VIEW_MAX_WIDTH } from "../types";
import {
	resolveModelDisplayName,
	resolveModelMaxInputTokens,
} from "./model-display";
import { useCallback, useEffect, useState } from "react";
import { fetchLiveXroAccount, loadXroAccount } from "../xro-account-manager";

export { resolveModelDisplayName, resolveModelMaxInputTokens };

export function createContextBar(
	used: number,
	total?: number,
	width = 6,
): { filled: string; empty: string } {
	const normalizedWidth = Math.max(0, Math.floor(width));
	const ratio = total && total > 0 ? Math.min(used / total, 1) : 0;
	const filledCount =
		total && total > 0 && used > 0
			? used >= total
				? normalizedWidth
				: Math.min(
						Math.max(1, Math.ceil(ratio * normalizedWidth)),
						Math.max(0, normalizedWidth - 1),
					)
			: 0;
	const emptyCount = Math.max(0, normalizedWidth - filledCount);
	return {
		filled: "\u2588".repeat(filledCount),
		empty: "\u2588".repeat(emptyCount),
	};
}

export function resolveContextBarFilledForeground(
	defaultForeground: string | undefined,
): string {
	return defaultForeground ?? "#ffffff";
}

function formatCost(cost: number): string {
	return `$${cost.toFixed(2)}`;
}

function formatCostText(providerId: string, totalCost: number, liveCredits?: number | null): string {
	if (typeof liveCredits === "number") {
		return `${liveCredits.toLocaleString(undefined, { maximumFractionDigits: 1 })} credits`;
	}

	const xroAccount = loadXroAccount();
	if (xroAccount && typeof xroAccount.credits === "number") {
		return `${xroAccount.credits.toLocaleString(undefined, { maximumFractionDigits: 1 })} credits`;
	}

	// Subscription providers (ClinePass) have no per-use cost worth surfacing.
	if (shouldShowCliUsageCoveredBySubscription(providerId)) {
		return "";
	}

	if (!shouldShowCliUsageCost(providerId)) {
		return "";
	}

	return formatCost(totalCost);
}

export function formatStatusBarUsageText(input: {
	totalTokens: number;
	totalCost: number;
	providerId: string;
	liveCredits?: number | null;
}): string {
	const tokens = `(${input.totalTokens.toLocaleString()})`;
	const costText = formatCostText(input.providerId, input.totalCost, input.liveCredits);

	if (!costText) {
		return tokens;
	}

	return `${tokens} ${costText}`;
}

export interface StatusBarProps {
	providerId: string;
	modelId: string;
	totalTokens: number;
	totalCost: number;
	maxInputTokens?: number;
	uiMode: AgentMode;
	autoApproveAll: boolean;
	workspaceName: string;
	gitBranch: string | null;
	gitDiffStats: {
		files: number;
		additions: number;
		deletions: number;
	} | null;
	onToggleMode?: () => void;
	variant?: "home" | "chat";
}

export function StatusBar(props: StatusBarProps) {
	const {
		modelId,
		totalTokens,
		totalCost,
		maxInputTokens,
		uiMode,
		autoApproveAll,
		workspaceName,
		gitBranch,
		gitDiffStats,
		onToggleMode,
	} = props;

	const [activeAccount, setActiveAccount] = useState<ReturnType<typeof loadXroAccount>>(() => loadXroAccount());
	const [liveCredits, setLiveCredits] = useState<number | null>(() => {
		const account = loadXroAccount();
		return account ? account.credits : null;
	});

	useEffect(() => {
		const account = loadXroAccount();
		setActiveAccount(account);
		if (!account?.apiKey) return;

		const checkCredits = () => {
			fetchLiveXroAccount(account.apiKey).then((updated) => {
				if (updated) {
					setActiveAccount(updated);
					if (typeof updated.credits === "number") {
						setLiveCredits(updated.credits);
					}
				}
			}).catch(() => {});
		};

		checkCredits();
		const interval = setInterval(checkCredits, 5_000);
		return () => clearInterval(interval);
	}, []);

	const { width } = useTerminalDimensions();
	const theme = useTheme();
	const defaultFg = theme.defaultForeground;
	const contextBarFilledFg = resolveContextBarFilledForeground(defaultFg);
	const actAccent = theme.accents.act;
	const planAccent = theme.accents.plan;
	const successColor = theme.accents.success;
	const hasMaxInputTokens =
		typeof maxInputTokens === "number" &&
		Number.isFinite(maxInputTokens) &&
		maxInputTokens > 0;
	const bar = hasMaxInputTokens
		? createContextBar(totalTokens, maxInputTokens)
		: undefined;

	// Available content width after accounting for padding.
	// Home view: parent box is capped at 60 wide, status bar adds paddingX=1 (-2).
	// Chat view: status bar adds paddingX=1 (-2).
	const avail =
		props.variant === "home"
			? Math.min(width, HOME_VIEW_MAX_WIDTH) - 2
			: width - 2;

	// Row 1 layout: [model + context info] .... [Plan/Act toggle]
	// When the full row doesn't fit, context info drops to its own row 2.
	// Model ID truncates with "..." before wrapping; toggle stays right-aligned.
	const toggleWidth = 20;
	const usageText = formatStatusBarUsageText({
		totalTokens,
		totalCost,
		providerId: props.providerId,
		liveCredits,
	});
	const contextText = bar
		? ` ${bar.filled}${bar.empty} ${usageText}`
		: ` ${usageText}`;
	const firstRowFits =
		modelId.length + contextText.length + toggleWidth + 1 <= avail;
	const renderContextText = (withLeadingSpace: boolean) => (
		<>
			{withLeadingSpace && " "}
			{bar && (
				<>
					<span fg={contextBarFilledFg}>{bar.filled}</span>
					<span fg="gray">{bar.empty}</span>{" "}
				</>
			)}
			{usageText}
		</>
	);

	const modelMaxLen = Math.max(
		10,
		avail - toggleWidth - (firstRowFits ? contextText.length : 0) - 1,
	);
	const truncatedModel =
		modelId.length > modelMaxLen
			? `${modelId.slice(0, modelMaxLen - 3)}...`
			: modelId;

	// Repo row: [workspace (branch) | N files +X -Y]
	// Git stats stay visible; path/branch truncates with "..." when narrow.
	const hasGitDiff = gitDiffStats && gitDiffStats.files > 0;
	const gitSuffix = hasGitDiff
		? ` | ${gitDiffStats.files} file${gitDiffStats.files !== 1 ? "s" : ""} +${gitDiffStats.additions} -${gitDiffStats.deletions}`
		: "";
	const pathPart = workspaceName + (gitBranch ? ` (${gitBranch})` : "");
	const pathMax = Math.max(5, avail - gitSuffix.length);
	const truncatedPath =
		pathPart.length > pathMax
			? `${pathPart.slice(0, pathMax - 3)}...`
			: pathPart;
	return (
		<box flexDirection="column" paddingX={1}>
			<box flexDirection="row" justifyContent="space-between">
				<text fg="gray">
					{truncatedModel}
					{firstRowFits && renderContextText(true)}
				</text>
				<box
					flexDirection="row"
					gap={1}
					flexShrink={0}
					onMouseDown={onToggleMode}
				>
					<text fg={uiMode === "plan" ? planAccent : "gray"}>
						{uiMode === "plan" ? "●" : "○"} Plan
					</text>
					<text fg={uiMode === "act" ? actAccent : "gray"}>
						{uiMode === "act" ? "●" : "○"} Act
					</text>
					<text fg="gray">(Tab)</text>
				</box>
			</box>

			{!firstRowFits && <text fg="gray">{renderContextText(false)}</text>}

			<text fg={defaultFg}>
				{truncatedPath}
				{hasGitDiff && (
					<span fg="gray">
						{" | "}
						{gitDiffStats.files} file
						{gitDiffStats.files !== 1 ? "s" : ""}{" "}
						<span fg={successColor}>+{gitDiffStats.additions}</span>{" "}
						<span fg="red">-{gitDiffStats.deletions}</span>
					</span>
				)}
			</text>

			<box flexDirection="row" justifyContent="space-between">
				{autoApproveAll ? (
					<text fg={defaultFg}>
						<span fg={successColor}>
							{"\u23f5\u23f5"} Auto-approve all enabled
						</span>
						<span fg="gray"> (Shift+Tab)</span>
					</text>
				) : (
					<text fg="gray">Auto-approve all disabled (Shift+Tab)</text>
				)}

				<text fg="gray">
					{activeAccount ? (
						<span>Logged in: <span fg="cyan">{activeAccount.email}</span></span>
					) : (
						<span><span fg="yellow">●</span> Not logged in</span>
					)}
				</text>
			</box>
		</box>
	);
}
