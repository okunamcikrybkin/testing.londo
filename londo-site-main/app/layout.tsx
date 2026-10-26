import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteTheme } from "@/components/site-theme";
import { GuestLanding } from "@/components/guest-landing";
import { getCurrentUser } from "@/lib/auth/session";
import { headers } from "next/headers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "LONDO",
  description: "LONDO — закрытое пространство сообщества с входом через Discord.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const currentPath = (await headers()).get("x-londo-current-path")?.split("?", 1)[0];
  const publicAbout = currentPath === "/about";

  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <SiteTheme guest={!user}>{user || publicAbout ? children : <GuestLanding />}</SiteTheme>
      </body>
    </html>
  );
}
