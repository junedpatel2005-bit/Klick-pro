import fs from "fs";
import path from "path";

let cachedLogoBase64: string | null = null;

/**
 * Returns the base64 data URI of the official website logo (public/logo-icon.png)
 * for @react-pdf/renderer documents.
 */
export function getBrandLogoBase64(): string {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const filePath = path.join(process.cwd(), "public", "logo-icon.png");
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      cachedLogoBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
      return cachedLogoBase64;
    }
  } catch (err) {
    console.error("Failed to load PDF brand logo:", err);
  }
  return "";
}
