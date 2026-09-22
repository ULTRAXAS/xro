import {
	diffPalettes,
	getDefaultForeground,
	getDialogSurfaceBackground,
	getTerminalTheme,
	hexToOklab,
	oklabToHex,
	type TerminalTheme,
	themePalette,
} from "./palette";

// User-selectable color themes for the TUI. Only three exist by design:
//   - "auto" adapts to the terminal: it detects light/dark from the terminal's
//     reported background and keeps that background untouched (the pre-theme
//     behavior, and still the default).
//   - "dark" / "light" force a fixed palette and paint a matching background,
//     for terminals whose reported colors are missing or wrong (see
//     cline/cline#12872).

export interface ThemeAccents {
	act: string;
	plan: string;
	success: string;
	error: string;
}

export interface ThemeDiffPalette {
	addedBg: string;
	removedBg: string;
	addedLineNumberBg: string;
	removedLineNumberBg: string;
	addedSignColor: string;
	removedSignColor: string;
	lineNumberFg: string;
}

export interface ThemeSyntaxColors {
	keyword: string;
	operator: string;
	type: string;
	functionName: string;
	variable: string;
	string: string;
	number: string;
	comment: string;
	punctuation: string;
	property: string;
	constant: string;
	tag: string;
	attribute: string;
	escape: string;
	markdownCode: string;
	markdownMuted: string;
	markdownItalic: string;
	markdownDefault?: string;
}

// Dark syntax colors are a pastel family harmonized with the brand accents
// (act #79b8ff, plan #ffea7f, success #99e89b): every hue sits near the same
// OKLCH lightness/chroma weight (~L 0.78, C 0.11) so code blocks feel like
// part of the same palette instead of a bolted-on editor theme.
export const baseSyntaxColors: Record<TerminalTheme, ThemeSyntaxColors> = {
	dark: {
		keyword: "#d7a0e3",
		operator: "#9bbbdd",
		type: "#dfca7d",
		functionName: themePalette.dark.act,
		variable: "#ee939b",
		string: "#99e89b",
		number: "#f0ad7f",
		comment: "#5c6370",
		punctuation: "#abb2bf",
		property: "#ee939b",
		constant: "#f0ad7f",
		tag: "#ee939b",
		attribute: "#f0ad7f",
		escape: "#9bbbdd",
		markdownCode: "#99e89b",
		markdownMuted: "#808080",
		markdownItalic: "#dfca7d",
	},
	light: {
		keyword: "#cf222e",
		operator: "#0550ae",
		type: "#953800",
		functionName: "#8250df",
		variable: "#953800",
		string: "#0a3069",
		number: "#0550ae",
		comment: "#6e7781",
		punctuation: "#57606a",
		property: "#0550ae",
		constant: "#0550ae",
		tag: "#116329",
		attribute: "#0550ae",
		escape: "#0550ae",
		markdownCode: "#116329",
		markdownMuted: "#6e7781",
		markdownItalic: "#8250df",
		markdownDefault: "#1a1a1a",
	},
};

const baseAccents: Record<TerminalTheme, ThemeAccents> = {
	dark: { ...themePalette.dark, error: "#ef4444" },
	light: { ...themePalette.light, error: "#b42318" },
};

export interface ThemeDefinition {
	id: string;
	label: string;
	description: string;
	/** "auto" resolves to the detected terminal variant at runtime. */
	variant: TerminalTheme | "auto";
	/** Painted over the whole terminal; null keeps the terminal's background. */
	background: string | null;
	/** Default text color; null keeps the variant default. */
	foreground: string | null;
	accents?: Partial<ThemeAccents>;
	syntax?: Partial<ThemeSyntaxColors>;
	diff?: Partial<ThemeDiffPalette>;
}

export interface ResolvedTheme {
	id: string;
	label: string;
	variant: TerminalTheme;
	/** Explicit background painted over the terminal, or null to keep it. */
	appBackground: string | null;
	/** Background all adaptive colors derive from (theme's, else detected). */
	background: string | null;
	/** Default text color; undefined keeps the renderer default (white). */
	defaultForeground: string | undefined;
	/** Background for selected rows/buttons on the main themed surface. */
	selection: string;
	/** Text color readable on top of `selection`. */
	textOnSelection: string;
	accents: ThemeAccents;
	diff: ThemeDiffPalette;
	syntax: ThemeSyntaxColors;
}

export const AUTO_THEME_ID = "auto";

export const THEMES: readonly ThemeDefinition[] = [
	{
		id: AUTO_THEME_ID,
		label: "Auto",
		description: "Adapts to your terminal's colors",
		variant: "auto",
		background: null,
		foreground: null,
	},
	{
		id: "dark",
		label: "Dark",
		description: "Pure black, high-contrast accents",
		variant: "dark",
		background: "#000000",
		foreground: "#e8eaed",
	},
	{
		id: "light",
		label: "Light",
		description: "Crisp white, high-contrast accents",
		variant: "light",
		background: "#ffffff",
		foreground: "#1a1a1a",
	},
] as const;

const THEMES_BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]));

export function getThemeDefinition(id: string): ThemeDefinition | undefined {
	return THEMES_BY_ID.get(id);
}

export function normalizeThemeId(id: string | undefined | null): string {
	const trimmed = id?.trim().toLowerCase();
	return trimmed && THEMES_BY_ID.has(trimmed) ? trimmed : AUTO_THEME_ID;
}

// Below this WCAG relative luminance, white text has the higher contrast
// ratio against the background; above it, black does. Derived from
// (L + 0.05)^2 = 1.05 * 0.05.
const WHITE_TEXT_LUMINANCE_CUTOFF = 0.179;

function relativeLuminance(hex: string): number {
	const channel = (offset: number) => {
		const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function mixHex(base: string, tint: string, amount: number): string {
	const a = hexToOklab(base);
	const b = hexToOklab(tint);
	return oklabToHex(
		a.L + (b.L - a.L) * amount,
		a.a + (b.a - a.a) * amount,
		a.b + (b.b - a.b) * amount,
	);
}

// Diff rows tint the theme background toward the theme's own green/red so
// diffs feel native to every theme instead of reusing one fixed palette.
function deriveDiffPalette(
	background: string,
	foreground: string,
	accents: ThemeAccents,
): ThemeDiffPalette {
	return {
		addedBg: mixHex(background, accents.success, 0.22),
		removedBg: mixHex(background, accents.error, 0.22),
		addedLineNumberBg: mixHex(background, accents.success, 0.3),
		removedLineNumberBg: mixHex(background, accents.error, 0.3),
		addedSignColor: accents.success,
		removedSignColor: accents.error,
		lineNumberFg: mixHex(foreground, background, 0.4),
	};
}

export interface DetectedTerminalColors {
	background: string | null;
	foreground: string | null;
}

export function resolveTheme(
	id: string,
	detected: DetectedTerminalColors,
): ResolvedTheme {
	const definition =
		getThemeDefinition(normalizeThemeId(id)) ?? (THEMES[0] as ThemeDefinition);
	const variant: TerminalTheme =
		definition.variant === "auto"
			? getTerminalTheme(detected.background, detected.foreground)
			: definition.variant;
	const appBackground = definition.background;
	const background = appBackground ?? detected.background;
	const accents: ThemeAccents = {
		...baseAccents[variant],
		...definition.accents,
	};
	const syntax: ThemeSyntaxColors = {
		...baseSyntaxColors[variant],
		...(definition.foreground
			? { markdownDefault: definition.foreground }
			: {}),
		...definition.syntax,
	};
	const diff: ThemeDiffPalette = {
		...(appBackground && definition.foreground
			? deriveDiffPalette(appBackground, definition.foreground, accents)
			: diffPalettes[variant]),
		...definition.diff,
	};
	// Selected rows highlight with the act accent; the text on top flips
	// between black and white, picking whichever has the higher WCAG
	// contrast ratio against the accent.
	const selection = accents.act;
	const textOnSelection =
		relativeLuminance(selection) > WHITE_TEXT_LUMINANCE_CUTOFF
			? "#000000"
			: "#ffffff";
	return {
		id: definition.id,
		label: definition.label,
		variant,
		appBackground,
		background,
		defaultForeground:
			definition.foreground ?? getDefaultForeground(background),
		selection,
		textOnSelection,
		accents,
		diff,
		syntax,
	};
}

export function getThemeModeAccent(theme: ResolvedTheme, mode: string): string {
	return mode === "plan" ? theme.accents.plan : theme.accents.act;
}

/**
 * Dialog surfaces are always dark, so light-variant themes (whose accents are
 * darkened for contrast on light backgrounds) fall back to the dark accent
 * set for readable dialog content.
 */
export function getDialogAccents(theme: ResolvedTheme): ThemeAccents {
	return theme.variant === "dark" ? theme.accents : baseAccents.dark;
}

/** Neutral dark panel used when no theme background is available to derive
 * a surface from (auto theme on an undetected terminal, light themes). */
export const DEFAULT_DIALOG_SURFACE = "#262626";

/**
 * Background for dialog panels. Dark themes get their own background lifted
 * one perceptual step (OKLAB), so the panel keeps the theme's hue and reads
 * as a raised surface of the same world. Light themes and undetectable
 * backgrounds keep the neutral dark panel that matches the dark accent
 * fallback in getDialogAccents.
 */
export function getDialogSurface(theme: ResolvedTheme): string {
	if (theme.variant !== "dark" || !theme.background) {
		return DEFAULT_DIALOG_SURFACE;
	}
	return getDialogSurfaceBackground(theme.background);
}

/**
 * Colors for content rendered on the always-dark dialog surface, following
 * the active theme's accents (see getDialogAccents). Mirrors the shape of
 * the static `palette` so dialog components can consume it as a drop-in
 * replacement that re-resolves on every theme change (including previews).
 */
export interface DialogPalette extends ThemeAccents {
	selection: string;
	textOnSelection: string;
	muted: string;
	/** Panel background the dialog content is rendered on. */
	surface: string;
}

export function getDialogPalette(theme: ResolvedTheme): DialogPalette {
	const accents = getDialogAccents(theme);
	const selection = accents.act;
	return {
		...accents,
		selection,
		textOnSelection:
			relativeLuminance(selection) > WHITE_TEXT_LUMINANCE_CUTOFF
				? "#000000"
				: "#ffffff",
		muted: "gray",
		surface: getDialogSurface(theme),
	};
}

/** Small color strip rendered next to each entry in the theme picker. */
export function getThemeSwatchColors(definition: ThemeDefinition): string[] {
	const variant = definition.variant === "auto" ? "dark" : definition.variant;
	const accents = { ...baseAccents[variant], ...definition.accents };
	return [accents.act, accents.plan, accents.success, accents.error];
}
