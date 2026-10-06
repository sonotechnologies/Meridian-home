import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: "600", variable: "--font-fraunces", display: "swap" });
// Inter's Latin subset includes ₦ (U+20A6).
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: "500", variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: "Meridian: find a place in Lagos on the map", template: "%s · Meridian" },
  description:
    "Rent, buy or book a shortlet in Lekki, Ikoyi, Victoria Island, Ikeja and Yaba. Filter a live map, see the total cost to move in, and WhatsApp the agent.",
  openGraph: { siteName: "Meridian", type: "website", locale: "en_NG" },
};

export const viewport: Viewport = { themeColor: "#F6F3EC", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG" className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-[6px] focus:bg-surface focus:px-4 focus:py-2">
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
