import "./globals.css";
import { BRAND } from "../config/brand";
import { AppShell } from "../components/app-shell";
import { WorkspaceProvider } from "../components/workspace-provider";

export const metadata = { title: BRAND.name, description: BRAND.tagline };
export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><WorkspaceProvider><AppShell>{children}</AppShell></WorkspaceProvider></body></html>;
}
