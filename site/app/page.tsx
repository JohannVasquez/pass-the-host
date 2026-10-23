import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  LuBlocks,
  LuChartColumn,
  LuCloudUpload,
  LuCoffee,
  LuDownload,
  LuLock,
  LuPlay,
  LuRefreshCw,
  LuTerminal,
} from "react-icons/lu";
import { TbBucket } from "react-icons/tb";
import { DownloadButton } from "./DownloadButton";
import icon from "./icon.png";
import { DOWNLOAD_URL, GITHUB_URL, getDownloads } from "./links";

export const metadata: Metadata = {
  title: { absolute: "Pass the host — Servidores de Minecraft entre amigos" },
  description:
    "App gratuita para compartir un servidor de Minecraft entre amigos sin pagar hosting: cualquiera del grupo lo inicia y el mundo se sincroniza en la nube.",
  alternates: { canonical: "/" },
};

const SITE_URL = "https://passthehost.jvdev.cl";

// Shown on the page and reused as FAQPage structured data, so both always match
const faqs = [
  {
    q: "¿Pass the host es gratis?",
    a: "Sí. La app es gratuita y su código está publicado en GitHub. Solo podrías pagar por el almacenamiento en la nube, pero Google Drive o el plan gratuito de Cloudflare R2 suelen alcanzar para un mundo de Minecraft.",
  },
  {
    q: "¿Necesito pagar un hosting o tener un servidor dedicado?",
    a: "No. El servidor corre en el computador de quien hostea esa partida. El mundo se guarda en tu propio almacenamiento en la nube, así que nadie del grupo tiene que dejar su PC encendido.",
  },
  {
    q: "¿Cómo se conectan mis amigos al servidor?",
    a: "Quien hostea comparte su IP pública (abriendo el puerto 25565 en su router) o todos se unen a una VPN como Tailscale o ZeroTier y se conectan a la IP de la VPN.",
  },
  {
    q: "¿Qué pasa si dos personas intentan abrir el servidor al mismo tiempo?",
    a: "No se puede. Al iniciar el servidor, la app crea un bloqueo en la nube que muestra quién está hosteando. Nadie más puede abrirlo ni sobrescribir el mundo hasta que esa persona lo cierre y suba los cambios.",
  },
  {
    q: "¿Qué versiones de Minecraft y mods soporta?",
    a: "Servidores de Minecraft Java Edition Vanilla, Forge y NeoForge. La app descarga automáticamente la versión de Java que necesita cada versión de Minecraft.",
  },
  {
    q: "¿En qué sistemas operativos funciona?",
    a: "Windows, macOS (Apple Silicon) y Linux (AppImage, deb y snap). La interfaz está en español e inglés.",
  },
  {
    q: "¿Dónde se guardan mis mundos?",
    a: "En el almacenamiento que tú elijas: Google Drive o cualquier bucket compatible con S3, como Cloudflare R2, AWS S3, Backblaze B2, DigitalOcean Spaces o MinIO. Pass the host no tiene servidores propios ni recibe tus archivos.",
  },
];

const steps = [
  {
    icon: LuRefreshCw,
    title: "Descarga el último mundo",
    text: "La app trae desde la nube solo los archivos que cambiaron desde la última partida.",
  },
  {
    icon: LuPlay,
    title: "Inicia el servidor",
    text: "Un lock avisa al resto que tú eres el host, así nadie lo abre dos veces ni pisa tu mundo.",
  },
  {
    icon: LuCloudUpload,
    title: "Juega y pasa el host",
    text: "Al cerrar, los cambios se suben solos. La próxima vez lo puede abrir cualquiera.",
  },
];

const features = [
  {
    icon: LuTerminal,
    title: "Consola integrada",
    text: "Logs en vivo y comandos rápidos sin abrir una terminal.",
  },
  {
    icon: LuLock,
    title: "Lock distribuido",
    text: "Evita que dos personas inicien o sobrescriban el mismo servidor.",
  },
  {
    icon: LuRefreshCw,
    title: "Sync diferencial",
    text: "Compara manifiestos y transfiere solo lo necesario.",
  },
  {
    icon: LuBlocks,
    title: "Vanilla, Forge y NeoForge",
    text: "Crea servidores con o sin mods en un par de clics.",
  },
  {
    icon: LuCoffee,
    title: "Java automático",
    text: "Descarga la versión de Java correcta para cada versión de Minecraft.",
  },
  {
    icon: LuChartColumn,
    title: "Estadísticas de sesión",
    text: "Quién hosteó, cuándo y cuántas horas lleva cada uno.",
  },
];

const providers = [
  "Cloudflare R2",
  "AWS S3",
  "MinIO",
  "Backblaze",
  "DigitalOcean",
];

// Official Google Drive mark (brand colors)
function GoogleDriveLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 87.3 78"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  );
}

export default async function PassTheHostPage() {
  const downloads = await getDownloads();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: "Pass the host",
        url: SITE_URL,
        description:
          "App de escritorio gratuita para compartir un servidor de Minecraft entre amigos: cualquiera del grupo puede iniciarlo y el mundo se sincroniza en la nube.",
        applicationCategory: "GameApplication",
        applicationSubCategory: "Minecraft server manager",
        operatingSystem: "Windows, macOS, Linux",
        ...(downloads.version && {
          softwareVersion: downloads.version.replace(/^v/, ""),
        }),
        downloadUrl: DOWNLOAD_URL,
        image: `${SITE_URL}/pass-the-host-home.png`,
        screenshot: [
          `${SITE_URL}/pass-the-host-home.png`,
          `${SITE_URL}/pass-the-host-create-server.png`,
        ],
        inLanguage: ["es", "en"],
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: features.map((f) => f.title),
        author: {
          "@type": "Person",
          name: "Johann Vásquez",
          url: "https://jvdev.cl",
        },
        sameAs: [GITHUB_URL],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        // Escape "<" so the JSON can't close the script tag
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#8BCB6B]/30 bg-[#8BCB6B]/10 px-3 py-1 text-sm text-[#A3D98A]">
            Gratis y de código abierto
          </p>
          <h1 className="mt-6 text-4xl sm:text-6xl font-bold tracking-tight text-[#EAEAEA] text-balance">
            El servidor de Minecraft ya no depende de una sola persona.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-[#A1A1AA] max-w-2xl text-pretty">
            Pass the host guarda el mundo en la nube para que cualquiera del
            grupo pueda descargarlo, iniciar el servidor y subir los cambios al
            terminar.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <DownloadButton
              downloads={downloads}
              className="inline-flex items-center gap-2 rounded-xl bg-[#8BCB6B] px-5 py-3 font-semibold text-[#0F1115] hover:bg-[#A3D98A] transition-colors"
            >
              <LuDownload aria-hidden className="h-5 w-5" />
            </DownloadButton>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 font-semibold text-[#EAEAEA] hover:border-white/25 transition-colors"
            >
              Ver en GitHub
            </a>
          </div>
          <p className="mt-4 text-sm text-[#A1A1AA]">
            {downloads.version && `${downloads.version} · `}Windows · macOS
            (Apple Silicon) · Linux ·{" "}
            <a
              href={DOWNLOAD_URL}
              className="underline underline-offset-4 hover:text-[#EAEAEA]"
            >
              Todas las descargas
            </a>
          </p>
        </div>

        <div className="relative mt-14 sm:mt-20">
          <div
            aria-hidden
            className="absolute -inset-x-8 -top-8 bottom-0 bg-[radial-gradient(ellipse_at_top,rgba(139,203,107,0.18),transparent_65%)] blur-2xl"
          />
          <figure className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#181B23] shadow-2xl shadow-black/50">
            <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
              <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
              <span className="h-3 w-3 rounded-full bg-[#28C840]" />
            </div>
            <Image
              src="/pass-the-host-home.png"
              alt="Pantalla principal de Pass the host con el control del servidor y la consola"
              width={3840}
              height={2036}
              sizes="(min-width: 1152px) 1104px, 100vw"
              className="w-full h-auto"
              priority
            />
          </figure>
        </div>
      </section>

      {/* Cómo funciona */}
      <section
        id="como-funciona"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-24 scroll-mt-16"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-[#EAEAEA]">
          Cómo funciona
        </h2>
        <p className="mt-3 text-[#A1A1AA] max-w-2xl">
          Como pasarse el control, pero con el mundo entero.
        </p>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="relative rounded-2xl border border-white/10 bg-[#181B23]/80 p-6"
            >
              <div className="flex items-center justify-between">
                <step.icon aria-hidden className="h-6 w-6 text-[#8BCB6B]" />
                <span className="font-mono text-sm text-[#A1A1AA]">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-[#EAEAEA]">
                {step.title}
              </h3>
              <p className="mt-2 text-[#A1A1AA]">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-[#A1A1AA]">
          Para que tus amigos se conecten, solo falta compartir tu IP o usar una
          VPN como Tailscale o ZeroTier.
        </p>
      </section>

      {/* Features */}
      <section className="border-y border-white/5 bg-[#181B23]/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 grid gap-12 lg:grid-cols-[1fr_1.2fr] items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#EAEAEA]">
              Todo lo que necesitas para hostear
            </h2>
            <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2">
              {features.map((f) => (
                <div key={f.title}>
                  <f.icon aria-hidden className="h-5 w-5 text-[#8BCB6B]" />
                  <h3 className="mt-3 font-semibold text-[#EAEAEA]">
                    {f.title}
                  </h3>
                  <p className="mt-1 text-sm text-[#A1A1AA]">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
          <figure className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/40">
            <Image
              src="/pass-the-host-create-server.png"
              alt="Diálogo para crear un servidor nuevo en Pass the host"
              width={3840}
              height={2036}
              sizes="(min-width: 1024px) 600px, 100vw"
              className="w-full h-auto"
            />
          </figure>
        </div>
      </section>

      {/* Almacenamiento */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
        <h2 className="text-3xl sm:text-4xl font-bold text-[#EAEAEA]">
          Tu nube, tus datos
        </h2>
        <p className="mt-3 text-[#A1A1AA] max-w-2xl">
          Pass the host no tiene servidores propios. Los mundos viven en el
          almacenamiento que tú elijas.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#181B23]/80 p-6">
            <div className="flex items-center gap-3">
              <TbBucket
                aria-hidden
                className="h-5 w-5 shrink-0 text-[#8BCB6B]"
              />
              <h3 className="text-lg font-semibold text-[#EAEAEA]">
                Almacenamiento compatible con S3
              </h3>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-[#8BCB6B]/15 px-2.5 py-0.5 text-xs text-[#A3D98A]">
                Más rápido
              </span>
            </div>
            <p className="mt-2 text-[#A1A1AA]">
              Conecta cualquier bucket con tus claves de acceso. Es la opción
              más rápida para subir y bajar tus mundos.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {providers.map((p) => (
                <li
                  key={p}
                  className="rounded-full border border-white/10 px-3 py-1 text-sm text-[#EAEAEA]"
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#8BCB6B]/30 bg-[#8BCB6B]/[0.06] p-6">
            <div className="flex items-center gap-3">
              <GoogleDriveLogo className="h-5 w-5 shrink-0" />
              <h3 className="text-lg font-semibold text-[#EAEAEA]">
                Google Drive
              </h3>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-[#8BCB6B]/15 px-2.5 py-0.5 text-xs text-[#A3D98A]">
                Nuevo
              </span>
            </div>
            <p className="mt-2 text-[#A1A1AA]">
              Inicia sesión con Google y comparte la carpeta de un servidor con
              tus amigos. Cualquiera con acceso podrá hostearlo, sin claves ni
              buckets.
            </p>
            <p className="mt-4 text-sm text-[#A1A1AA]">
              La app solo usa Drive para guardar los archivos de tus servidores.{" "}
              <Link
                href="/privacy"
                className="text-[#A3D98A] underline underline-offset-4"
              >
                Política de privacidad
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section
        id="preguntas-frecuentes"
        className="max-w-3xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-16"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-[#EAEAEA]">
          Preguntas frecuentes
        </h2>
        <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[#EAEAEA] [&::-webkit-details-marker]:hidden">
                <h3>{f.q}</h3>
                <span
                  aria-hidden
                  className="text-xl text-[#8BCB6B] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-[#A1A1AA]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <div className="rounded-3xl border border-white/10 bg-[#181B23] px-6 py-14 text-center">
          <Image
            src={icon}
            alt=""
            width={72}
            height={72}
            className="mx-auto rounded-full"
          />
          <h2 className="mt-6 text-3xl font-bold text-[#EAEAEA]">
            Pásale el host a tus amigos
          </h2>
          <p className="mt-3 text-[#A1A1AA]">
            Descarga la última versión para tu sistema.
          </p>
          <DownloadButton
            downloads={downloads}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#8BCB6B] px-5 py-3 font-semibold text-[#0F1115] hover:bg-[#A3D98A] transition-colors"
          >
            <LuDownload aria-hidden className="h-5 w-5" />
          </DownloadButton>
        </div>
      </section>
    </main>
  );
}
