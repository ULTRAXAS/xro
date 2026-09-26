import type { ChoiceContext } from "@opentui-ui/dialog";
import type { DialogActions } from "@opentui-ui/dialog/react";
import { useCallback } from "react";
import {
	XroAccountOverviewContent,
	XroUpgradeDialogContent,
} from "../components/dialogs/xro-account-dialog";
import { XroLoginDialogContent } from "../components/dialogs/xro-login-dialog";
import { clearXroAccount, type XroAccountConfig } from "../xro-account-manager";

export function useAccountDialog(opts: {
	dialog: DialogActions;
	termHeight: number;
	refocusTextarea: () => void;
	showToast?: (message: string, variant?: "info" | "success" | "error") => void;
	setAppView?: (view: "home" | "chat" | "onboarding") => void;
}) {
	const { dialog, termHeight, refocusTextarea, showToast, setAppView } = opts;

	const openLoginDialog = useCallback(async () => {
		const account = await dialog.choice<XroAccountConfig | null>({
			size: "large",
			style: { maxHeight: termHeight - 2 },
			closeOnEscape: true,
			content: (ctx: ChoiceContext<XroAccountConfig | null>) => (
				<XroLoginDialogContent {...ctx} />
			),
		});
		refocusTextarea();
		return account;
	}, [dialog, refocusTextarea, termHeight]);

	const logoutAccount = useCallback(async () => {
		clearXroAccount();
		if (showToast) {
			showToast("Logged out of Xro account", "info");
		}
		if (setAppView) {
			setAppView("onboarding");
		}
	}, [setAppView, showToast]);

	const openUpgradeDialog = useCallback(async () => {
		await dialog.choice<void>({
			size: "large",
			style: { maxHeight: termHeight - 2 },
			closeOnEscape: true,
			content: (ctx: ChoiceContext<void>) => <XroUpgradeDialogContent {...ctx} />,
		});
		refocusTextarea();
	}, [dialog, refocusTextarea, termHeight]);

	const openAccountDialog = useCallback(async () => {
		const choice = await dialog.choice<"login" | "upgrade" | "close">({
			size: "large",
			style: { maxHeight: termHeight - 2 },
			closeOnEscape: true,
			content: (ctx: ChoiceContext<"login" | "upgrade" | "close">) => (
				<XroAccountOverviewContent {...ctx} />
			),
		});

		if (choice === "login") {
			await openLoginDialog();
		} else if (choice === "upgrade") {
			await openUpgradeDialog();
		} else {
			refocusTextarea();
		}
	}, [dialog, openLoginDialog, openUpgradeDialog, refocusTextarea, termHeight]);

	return { openAccountDialog, openLoginDialog, logoutAccount, openUpgradeDialog };
}
