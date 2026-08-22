import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LinguaProvider } from "./components/LinguaProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vybe — Trova chi si unisce",
  description:
    "Pubblica un'attività, trova persone vicine a te con le tue stesse passioni e unitevi. Moto, sport, cena, musica e tutto quello che vuoi fare, ora.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vybe",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "Vybe — Trova chi si unisce",
    description:
      "Pubblica un'attività, trova persone vicine a te con le tue stesse passioni e unitevi.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LinguaProvider>{children}</LinguaProvider>
      </body>
    </html>
  );
}
