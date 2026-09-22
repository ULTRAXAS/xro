import { describe, expect, it } from "vitest";
import { diffPalettes, themePalette } from "./palette";
import {
	AUTO_THEME_ID,
	DEFAULT_DIALOG_SURFACE,
	getDialogAccents,
	getDialogPalette,
	getDialogSurface,
	getThemeDefinition,
	getThemeModeAccent,
	getThemeSwatchColors,
	normalizeThemeId,
	resolveTheme,
	THEMES,
} from "./themes";

const noDetection = { background: null, foreground: null };

describe("theme registry", () => {
	it("has unique ids and auto first", () => {
		const ids = THEMES.map((theme) => theme.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids[0]).toBe(AUTO_THEME_ID);
	});

	it("gives every non-auto theme an explicit background and foreground", () => {
		for (const theme of THEMES) {
			if (theme.id === AUTO_THEME_ID) {
				expect(theme.background).toBeNull();
				expect(theme.foreground).toBeNull();
			} else {
				expect(theme.background).toMatch(/^#[0-9a-f]{6}$/i);
				expect(theme.foreground).toMatch(/^#[0-9a-f]{6}$/i);
			}
		}
	});

	it("provides four swatch colors per theme", () => {
		for (const theme of THEMES) {
			expect(getThemeSwatchColors(theme)).toHaveLength(4);
		}
	});
});

describe("normalizeThemeId", () => {
	it("accepts known ids case-insensitively", () => {
		expect(normalizeThemeId("dark")).toBe("dark");
		expect(normalizeThemeId(" Light ")).toBe("light");
	});

	it("falls back to auto for unknown or missing ids", () => {
		expect(normalizeThemeId("not-a-theme")).toBe(AUTO_THEME_ID);
		expect(normalizeThemeId(undefined)).toBe(AUTO_THEME_ID);
		expect(normalizeThemeId(null)).toBe(AUTO_THEME_ID);
		expect(normalizeThemeId("")).toBe(AUTO_THEME_ID);
	});
});

describe("resolveTheme", () => {
	it("auto adapts to the detected terminal and keeps its background", () => {
		const dark = resolveTheme(AUTO_THEME_ID, noDetection);
		expect(dark.variant).toBe("dark");
		expect(dark.appBackground).toBeNull();
		expect(dark.background).toBeNull();
		expect(dark.defaultForeground).toBeUndefined();
		expect(dark.accents.act).toBe(themePalette.dark.act);
		expect(dark.diff).toEqual(diffPalettes.dark);

		const light = resolveTheme(AUTO_THEME_ID, {
			background: "#ffffff",
			foreground: null,
		});
		expect(light.variant).toBe("light");
		expect(light.appBackground).toBeNull();
		expect(light.background).toBe("#ffffff");
		expect(light.defaultForeground).toBe("#1a1a1a");
		expect(light.accents.act).toBe(themePalette.light.act);
		expect(light.diff).toEqual(diffPalettes.light);
	});

	it("forced dark and light themes override detection", () => {
		const forcedDark = resolveTheme("dark", {
			background: "#ffffff",
			foreground: "#1a1a1a",
		});
		expect(forcedDark.variant).toBe("dark");
		expect(forcedDark.appBackground).toBe("#000000");
		expect(forcedDark.background).toBe("#000000");
		expect(forcedDark.accents.act).toBe(themePalette.dark.act);

		const forcedLight = resolveTheme("light", noDetection);
		expect(forcedLight.variant).toBe("light");
		expect(forcedLight.appBackground).toBe("#ffffff");
		expect(forcedLight.defaultForeground).toBe("#1a1a1a");
		expect(forcedLight.accents.act).toBe(themePalette.light.act);
	});

	it("forced dark theme carries the base accents and syntax palette", () => {
		const dark = resolveTheme("dark", noDetection);
		expect(dark.variant).toBe("dark");
		expect(dark.appBackground).toBe("#000000");
		expect(dark.accents.act).toBe(themePalette.dark.act);
		expect(dark.syntax.keyword).toBeTruthy();
		expect(dark.diff.addedSignColor).toBeTruthy();
		expect(dark.diff.addedBg).toMatch(/^#[0-9a-f]{6}$/i);
	});

	it("falls back to auto for unknown ids", () => {
		const resolved = resolveTheme("bogus", noDetection);
		expect(resolved.id).toBe(AUTO_THEME_ID);
	});

	it("resolves every registered theme without missing colors", () => {
		for (const definition of THEMES) {
			const resolved = resolveTheme(definition.id, noDetection);
			expect(resolved.accents.act).toBeTruthy();
			expect(resolved.accents.plan).toBeTruthy();
			expect(resolved.accents.success).toBeTruthy();
			expect(resolved.accents.error).toBeTruthy();
			for (const value of Object.values(resolved.diff)) {
				expect(value).toBeTruthy();
			}
			expect(resolved.syntax.keyword).toBeTruthy();
			expect(resolved.syntax.comment).toBeTruthy();
		}
	});

	it("derives a readable selection pair per theme", () => {
		// Dark-theme accents are light, so selected text flips to black.
		const dark = resolveTheme(AUTO_THEME_ID, noDetection);
		expect(dark.selection).toBe(dark.accents.act);
		expect(dark.textOnSelection).toBe("#000000");

		// Light-theme accents are darkened for contrast, so text flips to white.
		const light = resolveTheme("light", noDetection);
		expect(light.selection).toBe(light.accents.act);
		expect(light.textOnSelection).toBe("#ffffff");

		for (const definition of THEMES) {
			const resolved = resolveTheme(definition.id, noDetection);
			expect(["#000000", "#ffffff"]).toContain(resolved.textOnSelection);
		}
	});
});

describe("theme helpers", () => {
	it("getThemeModeAccent picks the accent by mode", () => {
		const theme = resolveTheme("dark", noDetection);
		expect(getThemeModeAccent(theme, "act")).toBe(themePalette.dark.act);
		expect(getThemeModeAccent(theme, "plan")).toBe(themePalette.dark.plan);
	});

	it("getDialogAccents falls back to dark accents for light themes", () => {
		const light = resolveTheme("light", noDetection);
		expect(getDialogAccents(light).act).toBe(themePalette.dark.act);

		const dark = resolveTheme("dark", noDetection);
		expect(getDialogAccents(dark).act).toBe(themePalette.dark.act);
	});

	it("getThemeDefinition finds registered themes", () => {
		expect(getThemeDefinition("dark")?.label).toBe("Dark");
		expect(getThemeDefinition("missing")).toBeUndefined();
	});

	it("getDialogPalette follows the theme's dialog accents", () => {
		const dark = getDialogPalette(resolveTheme("dark", noDetection));
		expect(dark.act).toBe(themePalette.dark.act);
		expect(dark.selection).toBe(themePalette.dark.act);
		expect(dark.success).toBe(themePalette.dark.success);

		// Light themes fall back to dark accents (dialog surfaces stay dark).
		const light = getDialogPalette(resolveTheme("light", noDetection));
		expect(light.act).toBe(themePalette.dark.act);

		for (const definition of THEMES) {
			const dialogPalette = getDialogPalette(
				resolveTheme(definition.id, noDetection),
			);
			expect(dialogPalette.selection).toBe(dialogPalette.act);
			expect(["#000000", "#ffffff"]).toContain(dialogPalette.textOnSelection);
		}
	});

	it("getDialogSurface lifts dark theme backgrounds and keeps hue", () => {
		// The dark theme derives the panel from its own background: a
		// different, lighter color than both the background and the neutral
		// default.
		const dark = resolveTheme("dark", noDetection);
		const darkSurface = getDialogSurface(dark);
		expect(darkSurface).toMatch(/^#[0-9a-f]{6}$/i);
		expect(darkSurface).not.toBe(dark.background);
		expect(darkSurface).not.toBe(DEFAULT_DIALOG_SURFACE);

		// Auto with no detected background has nothing to derive from.
		expect(getDialogSurface(resolveTheme(AUTO_THEME_ID, noDetection))).toBe(
			DEFAULT_DIALOG_SURFACE,
		);
		// Auto on a detected dark terminal lifts the detected background.
		expect(
			getDialogSurface(
				resolveTheme(AUTO_THEME_ID, {
					background: "#000000",
					foreground: null,
				}),
			),
		).not.toBe(DEFAULT_DIALOG_SURFACE);

		// Light themes keep the neutral dark panel (dialog content still uses
		// the dark accent fallback, and hardcoded light text must stay legible).
		expect(getDialogSurface(resolveTheme("light", noDetection))).toBe(
			DEFAULT_DIALOG_SURFACE,
		);

		// The palette exposes the same surface.
		expect(getDialogPalette(dark).surface).toBe(darkSurface);
	});
});
