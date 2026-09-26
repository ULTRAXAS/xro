// @jsxImportSource @opentui/react
import type { ChoiceContext } from "@opentui-ui/dialog";
import { useDialogKeyboard } from "@opentui-ui/dialog/react";
import { useState } from "react";
import { useDialogPalette } from "../../hooks/use-theme";
import { registerOrLoginXroUser, type XroAccountConfig } from "../../xro-account-manager";

export function XroLoginDialogContent(props: ChoiceContext<XroAccountConfig | null>) {
	const { resolve, dismiss, dialogId } = props;
	const palette = useDialogPalette();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [activeField, setActiveField] = useState<"email" | "password">("email");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async () => {
		if (!email.trim() || !password.trim()) {
			setError("Please fill in both email and password.");
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const account = await registerOrLoginXroUser(email.trim(), password.trim());
			resolve(account);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setLoading(false);
		}
	};

	useDialogKeyboard((key) => {
		if (key.name === "escape") {
			dismiss();
			return;
		}
		if (key.name === "tab") {
			setActiveField((prev) => (prev === "email" ? "password" : "email"));
			return;
		}
		if (key.name === "return" || key.name === "enter") {
			void handleSubmit();
			return;
		}

		if (key.name === "backspace") {
			if (activeField === "email") {
				setEmail((prev) => prev.slice(0, -1));
			} else {
				setPassword((prev) => prev.slice(0, -1));
			}
			return;
		}

		if (key.sequence && key.sequence.length === 1 && key.sequence.charCodeAt(0) >= 32) {
			if (activeField === "email") {
				setEmail((prev) => prev + key.sequence);
			} else {
				setPassword((prev) => prev + key.sequence);
			}
		}
	}, dialogId);

	return (
		<box flexDirection="column" paddingX={1} gap={1}>
			<text fg={palette.act}>Sign In or Register Xro Account</text>
			<text fg="gray">New users get 200 free credits upon login!</text>

			{error && <text fg="red">{error}</text>}
			{loading && <text fg="yellow">Authenticating with Xro Cloud...</text>}

			<box flexDirection="column" gap={1} marginTop={1}>
				<box flexDirection="row">
					<text fg={activeField === "email" ? palette.act : "gray"} width={14}>
						{activeField === "email" ? "❯ Email:" : "  Email:"}
					</text>
					<text fg="white">{email || (activeField === "email" ? "▌" : "")}</text>
				</box>

				<box flexDirection="row">
					<text fg={activeField === "password" ? palette.act : "gray"} width={14}>
						{activeField === "password" ? "❯ Password:" : "  Password:"}
					</text>
					<text fg="white">
						{"*".repeat(password.length) || (activeField === "password" ? "▌" : "")}
					</text>
				</box>
			</box>

			<text fg="gray">Tab to switch fields, Enter to submit, Esc to cancel</text>
		</box>
	);
}
