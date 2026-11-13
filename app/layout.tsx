import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "School Flow Africa — Plateforme de Gestion Scolaire",
  description: "Plateforme de gestion d'école tout-en-un : élèves, scolarités, reçus FCFA, notes et présence.",
  // Application installable sur l'écran d'accueil (Android, iPhone, ordinateur).
  manifest: "/manifest.webmanifest",
  applicationName: "School Flow Africa",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "School Flow Africa" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" data-scroll-behavior="smooth" className={`${outfit.variable} ${inter.variable} h-full`}>
      <body className="h-full bg-[#f8fafc] text-slate-900 antialiased font-sans flex flex-col">
        {children}
      </body>
    </html>
  );
}
