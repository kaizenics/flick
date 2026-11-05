import { cache } from "fabric";

export const SYSTEM_FONTS = [
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Impact",
];

// Family -> weights Google serves for it. Asking css2 for a missing weight fails the whole request.
const GOOGLE_FONTS: Record<string, string> = {
  Inter: "400;700",
  Roboto: "400;700",
  "Open Sans": "400;700",
  Montserrat: "400;700",
  Poppins: "400;700",
  Lato: "400;700",
  Oswald: "400;700",
  Raleway: "400;700",
  Nunito: "400;700",
  Rubik: "400;700",
  "Work Sans": "400;700",
  "DM Sans": "400;700",
  "Space Grotesk": "400;700",
  "Josefin Sans": "400;700",
  Fredoka: "400;700",
  "Playfair Display": "400;700",
  Merriweather: "400;700",
  "Libre Baskerville": "400;700",
  "Cormorant Garamond": "400;700",
  Bitter: "400;700",
  "Bebas Neue": "400",
  Anton: "400",
  "Archivo Black": "400",
  "Abril Fatface": "400",
  Righteous: "400",
  Lobster: "400",
  Pacifico: "400",
  "Dancing Script": "400;700",
  Caveat: "400;700",
  "Permanent Marker": "400",
};

export const WEB_FONTS = Object.keys(GOOGLE_FONTS);

const cssLoads = new Map<string, Promise<void>>();

// One <link> per family so a single bad family cannot break the rest.
function loadCss(family: string): Promise<void> {
  let p = cssLoads.get(family);
  if (!p) {
    p = new Promise<void>((resolve) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${GOOGLE_FONTS[family]}&display=swap`;
      link.onload = () => resolve();
      // Offline: fall back to the browser's default font rather than hanging.
      link.onerror = () => resolve();
      document.head.appendChild(link);
    });
    cssLoads.set(family, p);
  }
  return p;
}

// Registers every family's @font-face so the font menu can preview them; files download on first use.
export function preloadFontCss(): void {
  for (const family of WEB_FONTS) void loadCss(family);
}

// Resolves once the faces are ready to measure, so Fabric never caches fallback glyph widths.
export async function ensureFonts(families: Iterable<string>): Promise<void> {
  const wanted = [...new Set(families)].filter((f) => f in GOOGLE_FONTS);
  await Promise.all(
    wanted.map(async (family) => {
      await loadCss(family);
      await Promise.all(
        GOOGLE_FONTS[family].split(";").map((w) => document.fonts.load(`${w} 32px "${family}"`).catch(() => [])),
      );
      cache.clearFontCache(family);
    }),
  );
}

export function fontsInJson(json: string): string[] {
  return [...json.matchAll(/"fontFamily":"([^"]+)"/g)].map((m) => m[1]);
}
