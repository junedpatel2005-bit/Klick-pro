import type { Metadata } from "next";
import "../src/styles.css";
import "react-loading-skeleton/dist/skeleton.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "Klick-Pro — Hire trusted professionals near you", template: "%s | Klick-Pro" },
  description: "Post jobs, hire experts, track work, and manage Projects in one platform.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
