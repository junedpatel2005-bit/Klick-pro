import fs from "fs";
import path from "path";

let cachedLogoBase64: string | null = null;
let cachedFullLogoBase64: string | null = null;

/**
 * Returns the base64 data URI of the official website logo (public/logo.png or public/logo-icon.png)
 * for @react-pdf/renderer documents.
 */
export function getBrandLogoBase64(): string {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const fullPath = path.join(process.cwd(), "public", "logo.png");
    const iconPath = path.join(process.cwd(), "public", "logo-icon.png");
    const targetPath = fs.existsSync(fullPath) ? fullPath : iconPath;
    if (fs.existsSync(targetPath)) {
      const buffer = fs.readFileSync(targetPath);
      cachedLogoBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
      return cachedLogoBase64;
    }
  } catch (err) {
    console.error("Failed to load PDF brand logo:", err);
  }
  return "";
}

/**
 * Returns the base64 data URI of the horizontal/full website logo (public/logo.png)
 */
export function getFullLogoBase64(): string {
  if (cachedFullLogoBase64) return cachedFullLogoBase64;
  try {
    const fullPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(fullPath)) {
      const buffer = fs.readFileSync(fullPath);
      cachedFullLogoBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
      return cachedFullLogoBase64;
    }
    return getBrandLogoBase64();
  } catch (err) {
    console.error("Failed to load PDF full logo:", err);
  }
  return "";
}
