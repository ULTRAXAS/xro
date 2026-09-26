// @jsxImportSource @opentui/react
import type { ChoiceContext } from "@opentui-ui/dialog";
import { useDialogKeyboard } from "@opentui-ui/dialog/react";
import { useState, useEffect } from "react";
import { useDialogPalette } from "../../hooks/use-theme";
import {
	loadXroAccount,
	fetchLiveXroAccount,
	type XroAccountConfig,
} from "../../xro-account-manager";

export function XroAccountOverviewContent(props: ChoiceContext<"login" | "upgrade" | "close">) {
	const { resolve, dismiss, dialogId } = props;
	const palette = useDialogPalette();
	const [account, setAccount] = useState<XroAccountConfig | null>(loadXroAccount());

	useEffect(() => {
		const cached = loadXroAccount();
		if (cached?.apiKey) {
			fetchLiveXroAccount(cached.apiKey).then((updated) => {
				if (updated) setAccount(updated);
			});
		}
	}, []);

	useDialogKeyboard((key) => {
		if (key.name === "escape" || key.name === "q") {
			dismiss();
			return;
		}
		if (key.name === "l") {
			resolve("login");
			return;
		}
		if (key.name === "u") {
			resolve("upgrade");
			return;
		}
	}, dialogId);

	return (
		<box flexDirection="column" paddingX={1} gap={1}>
			<text fg={palette.act}>Xro Account & Credits</text>
			{account ? (
				<box flexDirection="column" border borderColor="gray" paddingX={1} gap={0}>
					<box flexDirection="row">
						<text fg="gray" width={16}>Email:</text>
						<text selectable>{account.email}</text>
					</box>
					<box flexDirection="row">
						<text fg="gray" width={16}>Credits Balance:</text>
						<text fg={account.credits > 20 ? palette.success : "red"}>
							{account.credits.toFixed(1)} Credits
						</text>
					</box>
					<box flexDirection="row">
						<text fg="gray" width={16}>Tokens Used:</text>
						<text>{account.totalTokensUsed.toLocaleString()} tokens</text>
					</box>
				</box>
			) : (
				<box flexDirection="column" border borderColor="gray" paddingX={1}>
					<text fg="yellow">No account logged in.</text>
					<text fg="gray">You are currently using shared access. Log in to get 200 free credits!</text>
				</box>
			)}

			<box flexDirection="column" marginTop={1}>
				<text fg="white">[L] Log in / Switch Account</text>
				<text fg="white">[U] Top Up / Upgrade Credits</text>
				<text fg="gray">[Esc] Close</text>
			</box>
		</box>
	);
}

export function XroUpgradeDialogContent(props: ChoiceContext<void>) {
	const { dismiss, dialogId } = props;
	const palette = useDialogPalette();

	useDialogKeyboard((key) => {
		if (key.name === "escape" || key.name === "return" || key.name === "enter") {
			dismiss();
		}
	}, dialogId);

	return (
		<box flexDirection="column" paddingX={1} gap={1}>
			<text fg={palette.act}>Top Up / Upgrade Credits</text>
			<box flexDirection="column" border borderColor="gray" paddingX={1} gap={1}>
				<text fg="white">To top up or upgrade your Xro CLI credits:</text>
				<text fg="cyan">Please contact ULTRAXAS support via noreply@ultraxas.com</text>
				<text fg="gray">New accounts automatically receive 200 free credits upon registration!</text>
			</box>
			<text fg="gray">Press Esc or Enter to close</text>
		</box>
	);
}
