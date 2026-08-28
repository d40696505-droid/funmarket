import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ChatWidget } from "@/components/ChatWidget";
import { Header } from "@/components/Header";
import { AuthProvider } from "@/lib/auth-context";
import { FavoritesProvider } from "@/lib/favorites-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "HobbyHub",
    template: "%s | HobbyHub",
  },
  description: "C2C-маркетплейс развлекательных услуг",
  openGraph: {
    siteName: "HobbyHub",
    type: "website",
    locale: "ru_RU",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <FavoritesProvider>
            <Header />
            {children}
            <ChatWidget />
          </FavoritesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
