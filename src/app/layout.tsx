import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { Logo } from "@/components/Logo";
import { NavegacionInferior, NavegacionLateral } from "@/components/Navegacion";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "ÉVORA PADEL",
    template: "%s · ÉVORA PADEL",
  },
  description: "Observa. Mide. Haz crecer. Metodología y desarrollo de jugadores de pádel.",
};

export const viewport: Viewport = {
  themeColor: "#101B2C",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${barlow.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <div className="md:flex">
          <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:border-r md:border-noche-500 md:px-4 md:py-6">
            <Logo />
            <p className="mt-1 text-xs text-tenue">Observa. Mide. Haz crecer.</p>
            <NavegacionLateral />
          </aside>

          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-noche-500 bg-noche/95 px-4 py-3 backdrop-blur md:hidden">
              <Logo />
            </header>

            <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-10">
              <p className="mb-6 rounded-xl border border-naranja/40 bg-naranja/10 px-3 py-2 text-xs text-naranja">
                Versión de demostración: todos los jugadores y datos son ficticios.
              </p>
              {children}
            </main>
          </div>
        </div>
        <NavegacionInferior />
      </body>
    </html>
  );
}
