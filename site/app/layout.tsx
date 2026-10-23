import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { DownloadButton } from "./DownloadButton";
import icon from "./icon.png";
import { GITHUB_URL, getDownloads } from "./links";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://passthehost.jvdev.cl"),
  title: {
    default: "Pass the host — Servidores de Minecraft entre amigos",
    template: "%s — Pass the host",
  },
  description:
    "App gratuita para compartir un servidor de Minecraft entre amigos sin pagar hosting: cualquiera del grupo lo inicia y el mundo se sincroniza en la nube.",
  applicationName: "Pass the host",
  authors: [{ name: "Johann Vásquez", url: "https://jvdev.cl" }],
  creator: "Johann Vásquez",
  // og:image and twitter:image come from app/opengraph-image.tsx
  openGraph: {
    type: "website",
    url: "/",
    locale: "es_CL",
    siteName: "Pass the host",
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const downloads = await getDownloads();

  return (
    <html lang="es" className={geistSans.variable}>
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 bg-[#0F1115]/90 backdrop-blur-sm border-b border-white/5">
          <nav
            className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between"
            aria-label="Navegación principal"
          >
            <Link
              href="/"
              className="flex items-center gap-2.5 font-semibold text-[#EAEAEA]"
            >
              <Image
                src={icon}
                alt=""
                width={32}
                height={32}
                className="rounded-full"
              />
              Pass the host
            </Link>
            <div className="flex items-center gap-4 sm:gap-6 text-sm text-[#A1A1AA]">
              <Link
                href="/#como-funciona"
                className="hidden sm:inline hover:text-[#EAEAEA] transition-colors"
              >
                Cómo funciona
              </Link>
              <Link
                href="/#preguntas-frecuentes"
                className="hidden md:inline hover:text-[#EAEAEA] transition-colors"
              >
                Preguntas
              </Link>
              <a
                href={GITHUB_URL}
                className="hover:text-[#EAEAEA] transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              <DownloadButton
                downloads={downloads}
                showOS={false}
                className="rounded-lg bg-[#8BCB6B] px-3.5 py-1.5 font-medium text-[#0F1115] hover:bg-[#A3D98A] transition-colors"
              />
            </div>
          </nav>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-white/5 py-8 text-sm text-[#A1A1AA]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row gap-4 justify-between">
            <p>
              Hecho por{" "}
              <a
                href="https://jvdev.cl"
                className="text-[#EAEAEA] hover:text-[#8BCB6B]"
              >
                Johann Vásquez
              </a>
              . Código abierto.
            </p>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-[#EAEAEA]">
                Política de privacidad
              </Link>
              <a href={GITHUB_URL} className="hover:text-[#EAEAEA]">
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
