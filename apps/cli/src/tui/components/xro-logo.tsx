import { XRO_WORDMARK_ROWS } from "./xro-logo-data";

export function XroLogo() {
	return (
		<box flexDirection="column" alignItems="center" width="100%">
			{XRO_WORDMARK_ROWS.map((row, rowIdx) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static wordmark with fixed row order
				<text key={`row-${rowIdx}`} fg={row.fg}>
					{row.text}
				</text>
			))}
		</box>
	);
}
