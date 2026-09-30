import "./globals.css";
import { BRAND } from "../config/brand";

export const metadata = { title: BRAND.name, description: BRAND.tagline };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
