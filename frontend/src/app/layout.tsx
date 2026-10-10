import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { SessionRecovery } from "@/components/providers/session-recovery";
import { accessCookieExpired } from "@/lib/session";

import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "block",
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "block",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "block",
});

export const metadata: Metadata = {
  title: {
    default: "MU CSE Financial Transparency Platform",
    template: "%s | MU CSE Financial Transparency Platform",
  },
  description:
    "A trust-first financial transparency platform for MU CSE Society with public-safe reporting, audit-ready controls, and role-protected internal workflows.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const access = cookieStore.get(process.env.ACCESS_TOKEN_COOKIE_NAME || "mu_access_token")?.value;
  const refresh = cookieStore.has(process.env.REFRESH_TOKEN_COOKIE_NAME || "mu_refresh_token");
  const expired = accessCookieExpired(access);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body {
                background: hsl(210, 38%, 98%);
                color: hsl(221, 39%, 16%);
                font-family: 'Public Sans', 'Segoe UI', system-ui, sans-serif;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }
            `,
          }}
        />
      </head>
      <body className={`${publicSans.variable} ${fraunces.variable} ${plexMono.variable}`} suppressHydrationWarning>
        <SessionRecovery needed={refresh && expired}>{children}</SessionRecovery>
      </body>
    </html>
  );
}
