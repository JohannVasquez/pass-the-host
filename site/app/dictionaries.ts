import type { Locale } from "./i18n";

const es = {
  languageName: "Español",
  languageLabel: "Idioma",
  meta: {
    title: "Pass the host — Servidores de Minecraft entre amigos",
    description:
      "App gratuita para compartir un servidor de Minecraft entre amigos sin pagar hosting: cualquiera del grupo lo inicia y el mundo se sincroniza en la nube.",
    ogLocale: "es_CL",
    ogTagline: "Gratis · Windows · macOS · Linux",
  },
  nav: {
    label: "Navegación principal",
    howItWorks: "Cómo funciona",
    faq: "Preguntas",
  },
  download: {
    label: "Descargar",
    labelFor: "Descargar para {os}",
  },
  footer: {
    madeBy: "Hecho por",
    license: "Código abierto bajo licencia MIT.",
    privacy: "Política de privacidad",
  },
  hero: {
    badge: "Gratis y de código abierto",
    title: "El servidor de Minecraft ya no depende de una sola persona.",
    subtitle:
      "Pass the host guarda el mundo en la nube para que cualquiera del grupo pueda descargarlo, iniciar el servidor y subir los cambios al terminar.",
    github: "Ver en GitHub",
    platforms: "Windows · macOS (Apple Silicon) · Linux",
    allDownloads: "Todas las descargas",
    downloadCount: "{n} descargas",
    screenshotAlt:
      "Pantalla principal de Pass the host con el control del servidor y la consola",
  },
  how: {
    title: "Cómo funciona",
    subtitle: "Como pasarse el control, pero con el mundo entero.",
    steps: [
      {
        title: "Descarga el último mundo",
        text: "La app trae desde la nube solo los archivos que cambiaron desde la última partida.",
      },
      {
        title: "Inicia el servidor",
        text: "Un lock avisa al resto que tú eres el host, así nadie lo abre dos veces ni pisa tu mundo.",
      },
      {
        title: "Juega y pasa el host",
        text: "Al cerrar, los cambios se suben solos. La próxima vez lo puede abrir cualquiera.",
      },
    ],
    connectNote:
      "Para que tus amigos se conecten, solo falta compartir tu IP o usar una VPN como Hamachi, Radmin VPN, Tailscale o ZeroTier.",
  },
  features: {
    title: "Todo lo que necesitas para hostear",
    items: [
      {
        title: "Consola integrada",
        text: "Logs en vivo y comandos rápidos sin abrir una terminal.",
      },
      {
        title: "Lock distribuido",
        text: "Evita que dos personas inicien o sobrescriban el mismo servidor.",
      },
      {
        title: "Sync diferencial",
        text: "Compara manifiestos y transfiere solo lo necesario.",
      },
      {
        title: "Vanilla, Forge y NeoForge",
        text: "Crea servidores con o sin mods en un par de clics.",
      },
      {
        title: "Java automático",
        text: "Descarga la versión de Java correcta para cada versión de Minecraft.",
      },
      {
        title: "Estadísticas de sesión",
        text: "Quién hosteó, cuándo y cuántas horas lleva cada uno.",
      },
    ],
    screenshotAlt: "Diálogo para crear un servidor nuevo en Pass the host",
  },
  storage: {
    title: "Tu nube, tus datos",
    subtitle:
      "Pass the host no tiene servidores propios. Los mundos viven en el almacenamiento que tú elijas.",
    s3Title: "Almacenamiento compatible con S3",
    s3Badge: "Más rápido",
    s3Text:
      "Conecta cualquier bucket con tus claves de acceso. Es la opción más rápida para subir y bajar tus mundos.",
    driveBadge: "Nuevo",
    driveText:
      "Inicia sesión con Google y comparte la carpeta de un servidor con tus amigos. Cualquiera con acceso podrá hostearlo, sin claves ni buckets.",
    driveNote: "La app solo usa Drive para guardar los archivos de tus servidores.",
  },
  faq: {
    title: "Preguntas frecuentes",
    items: [
      {
        q: "¿Pass the host es gratis?",
        a: "Sí. La app es gratuita y de código abierto bajo licencia MIT. Solo podrías pagar por el almacenamiento en la nube, pero Google Drive o el plan gratuito de Cloudflare R2 suelen alcanzar para un mundo de Minecraft.",
      },
      {
        q: "¿Necesito pagar un hosting o tener un servidor dedicado?",
        a: "No. El servidor corre en el computador de quien hostea esa partida. El mundo se guarda en tu propio almacenamiento en la nube, así que nadie del grupo tiene que dejar su PC encendido.",
      },
      {
        q: "¿Cómo se conectan mis amigos al servidor?",
        a: "Quien hostea comparte su IP pública (abriendo el puerto 25565 en su router) o todos se unen a una misma VPN, como Hamachi, Radmin VPN, Tailscale o ZeroTier, y se conectan a la IP que esa VPN le asigna al host.",
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
        a: "Windows (Microsoft Store o instalador .exe), macOS (Apple Silicon) y Linux (AppImage, deb y snap). La interfaz está en español e inglés.",
      },
      {
        q: "¿Dónde se guardan mis mundos?",
        a: "En el almacenamiento que tú elijas: Google Drive o cualquier bucket compatible con S3, como Cloudflare R2, AWS S3, Backblaze B2, DigitalOcean Spaces o MinIO. Pass the host no tiene servidores propios ni recibe tus archivos.",
      },
    ],
  },
  cta: {
    title: "Pásale el host a tus amigos",
    text: "Descarga la última versión para tu sistema.",
  },
  privacy: {
    title: "Política de privacidad — Pass the host",
    description:
      "Política de privacidad de Pass the host, app de escritorio para servidores de Minecraft compartidos.",
    updated: "Última actualización: 22 de octubre de 2026",
    intro:
      "Pass the host es una aplicación de escritorio de código abierto para gestionar servidores de Minecraft compartidos entre amigos.",
    sections: [
      {
        h: "Datos de Google que usa",
        p: "La app solicita acceso a Google Drive únicamente para crear, leer, modificar y eliminar los archivos de los servidores de Minecraft (mundos, configuración, archivos de bloqueo y estadísticas de sesión) dentro de las carpetas de Pass the host.",
      },
      {
        h: "Dónde se guardan",
        p: "Los tokens de acceso y todos los datos se almacenan solo en tu computador y en tu propio Google Drive. La app no tiene servidores propios, no envía tus datos a terceros y no recopila analíticas.",
      },
      {
        h: "Compartir",
        p: "Los archivos solo se comparten con las personas a las que tú les das acceso a una carpeta desde Google Drive.",
      },
    ],
    revokeTitle: "Revocar acceso",
    revokeText: "Puedes quitarle el acceso a la app cuando quieras desde",
    contactTitle: "Contacto",
  },
};

const en: typeof es = {
  languageName: "English",
  languageLabel: "Language",
  meta: {
    title: "Pass the host — Share a Minecraft server with friends",
    description:
      "Free app to share a Minecraft server with your friends without paying for hosting: anyone in the group can start it and the world syncs through the cloud.",
    ogLocale: "en_US",
    ogTagline: "Free · Windows · macOS · Linux",
  },
  nav: {
    label: "Main navigation",
    howItWorks: "How it works",
    faq: "FAQ",
  },
  download: {
    label: "Download",
    labelFor: "Download for {os}",
  },
  footer: {
    madeBy: "Made by",
    license: "Open source under the MIT license.",
    privacy: "Privacy policy",
  },
  hero: {
    badge: "Free and open source",
    title: "Your Minecraft server no longer depends on one person.",
    subtitle:
      "Pass the host keeps the world in the cloud so anyone in the group can download it, start the server and upload the changes when they're done.",
    github: "View on GitHub",
    platforms: "Windows · macOS (Apple Silicon) · Linux",
    allDownloads: "All downloads",
    downloadCount: "{n} downloads",
    screenshotAlt:
      "Pass the host main screen with the server controls and the console",
  },
  how: {
    title: "How it works",
    subtitle: "Like passing the controller, but with the whole world.",
    steps: [
      {
        title: "Download the latest world",
        text: "The app pulls from the cloud only the files that changed since the last session.",
      },
      {
        title: "Start the server",
        text: "A lock tells everyone else you're the host, so nobody opens it twice or overwrites your world.",
      },
      {
        title: "Play and pass the host",
        text: "When you close it, the changes upload automatically. Next time anyone can open it.",
      },
    ],
    connectNote:
      "For your friends to join, just share your IP or use a VPN such as Hamachi, Radmin VPN, Tailscale or ZeroTier.",
  },
  features: {
    title: "Everything you need to host",
    items: [
      {
        title: "Built-in console",
        text: "Live logs and quick commands without opening a terminal.",
      },
      {
        title: "Distributed lock",
        text: "Stops two people from starting or overwriting the same server.",
      },
      {
        title: "Differential sync",
        text: "Compares manifests and transfers only what changed.",
      },
      {
        title: "Vanilla, Forge and NeoForge",
        text: "Create servers with or without mods in a couple of clicks.",
      },
      {
        title: "Automatic Java",
        text: "Downloads the right Java version for each Minecraft version.",
      },
      {
        title: "Session stats",
        text: "Who hosted, when, and how many hours each person has played.",
      },
    ],
    screenshotAlt: "Dialog for creating a new server in Pass the host",
  },
  storage: {
    title: "Your cloud, your data",
    subtitle:
      "Pass the host has no servers of its own. Worlds live in the storage you choose.",
    s3Title: "S3-compatible storage",
    s3Badge: "Fastest",
    s3Text:
      "Connect any bucket with your access keys. It's the fastest option for uploading and downloading your worlds.",
    driveBadge: "New",
    driveText:
      "Sign in with Google and share a server's folder with your friends. Anyone with access can host it, no keys or buckets needed.",
    driveNote: "The app only uses Drive to store your servers' files.",
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      {
        q: "Is Pass the host free?",
        a: "Yes. The app is free and open source under the MIT license. The only thing you might pay for is cloud storage, but Google Drive or Cloudflare R2's free tier is usually enough for a Minecraft world.",
      },
      {
        q: "Do I need to pay for hosting or run a dedicated server?",
        a: "No. The server runs on the computer of whoever hosts that session. The world is stored in your own cloud storage, so nobody in the group has to leave their PC on.",
      },
      {
        q: "How do my friends connect to the server?",
        a: "The host shares their public IP (forwarding port 25565 on their router), or everyone joins the same VPN, such as Hamachi, Radmin VPN, Tailscale or ZeroTier, and connects to the IP that VPN assigns to the host.",
      },
      {
        q: "What happens if two people try to open the server at the same time?",
        a: "They can't. When the server starts, the app creates a lock in the cloud that shows who is hosting. Nobody else can open it or overwrite the world until that person closes it and uploads the changes.",
      },
      {
        q: "Which Minecraft versions and mod loaders are supported?",
        a: "Minecraft Java Edition servers: Vanilla, Forge and NeoForge. The app automatically downloads the Java version each Minecraft version needs.",
      },
      {
        q: "Which operating systems does it run on?",
        a: "Windows (Microsoft Store or .exe installer), macOS (Apple Silicon) and Linux (AppImage, deb and snap). The interface is available in English and Spanish.",
      },
      {
        q: "Where are my worlds stored?",
        a: "In the storage you choose: Google Drive or any S3-compatible bucket, such as Cloudflare R2, AWS S3, Backblaze B2, DigitalOcean Spaces or MinIO. Pass the host has no servers of its own and never receives your files.",
      },
    ],
  },
  cta: {
    title: "Pass the host to your friends",
    text: "Download the latest version for your system.",
  },
  privacy: {
    title: "Privacy policy — Pass the host",
    description:
      "Privacy policy for Pass the host, a desktop app for shared Minecraft servers.",
    updated: "Last updated: October 22, 2026",
    intro:
      "Pass the host is an open-source desktop application for managing Minecraft servers shared among friends.",
    sections: [
      {
        h: "Google data it uses",
        p: "The app requests access to Google Drive only to create, read, modify and delete Minecraft server files (worlds, configuration, lock files and session statistics) inside the Pass the host folders.",
      },
      {
        h: "Where it is stored",
        p: "Access tokens and all data are stored only on your computer and in your own Google Drive. The app has no servers of its own, does not send your data to third parties and does not collect analytics.",
      },
      {
        h: "Sharing",
        p: "Files are only shared with the people you give access to a folder in Google Drive.",
      },
    ],
    revokeTitle: "Revoking access",
    revokeText: "You can remove the app's access at any time from",
    contactTitle: "Contact",
  },
};

const dictionaries = { es, en };
export type Dictionary = typeof es;
export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];
