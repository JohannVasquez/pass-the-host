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
    store: "Microsoft Store",
    direct: "Descarga directa (.exe)",
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
      "Pantalla principal de Pass the host con el control del servidor, las salas y la consola",
  },
  video: {
    title: "Míralo en acción",
    subtitle: "Un amigo cierra el servidor, otro lo abre y todos siguen en el mismo mundo.",
    label: "Video: cómo funciona Pass the host",
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
      "Tus amigos se conectan desde la misma app con una sala: sin abrir puertos, sin VPN y sin IP pública.",
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
        a: "Con las salas de la app. Crea una sala y comparte su código de invitación; cuando alguien de la sala inicia el servidor, los demás pulsan Conectarse y la app abre un túnel directo a su computador. En Minecraft solo agregan el servidor localhost:25565. No hace falta abrir puertos, usar VPN ni tener IP pública.",
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
        a: "Windows (Microsoft Store o instalador .exe), macOS (Apple Silicon) y Linux (AppImage, deb y snap). La interfaz está en español, inglés, portugués (Brasil), alemán, francés y ruso.",
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
      "Política de privacidad de Pass the host: qué datos usa la app, con quién se comparten y cómo borrarlos.",
    updated: "Última actualización: 26 de octubre de 2026",
    intro:
      "Pass the host es una aplicación de escritorio de código abierto para gestionar servidores de Minecraft compartidos entre amigos. Esta política explica qué datos trata la app, dónde quedan y cómo borrarlos.",
    sections: [
      {
        h: "Datos de Google que usa",
        p: "La app solicita acceso a Google Drive únicamente para crear, leer, modificar y eliminar los archivos de los servidores de Minecraft (mundos, configuración, archivos de bloqueo y estadísticas de sesión) dentro de las carpetas de Pass the host.",
      },
      {
        h: "Dónde quedan tus datos de Google",
        p: "Los tokens de acceso de Google se guardan solo en tu computador y los archivos solo en tu propio Google Drive. Nunca pasan por los servidores de Pass the host ni se comparten con terceros. Los archivos solo se comparten con las personas a las que tú les das acceso a una carpeta desde Google Drive.",
      },
      {
        h: "Salas (jugar con amigos)",
        p: "Si usas Salas, la app registra tu dispositivo con un identificador aleatorio: no hay cuenta, correo ni contraseña. En el servidor de Pass the host se guardan ese identificador, el nombre de usuario que elegiste en la app, las salas que creas (nombre y código de invitación) y las salas a las que te uniste, con sus fechas. Los miembros de una sala ven los nombres de los demás miembros.",
      },
      {
        h: "Presencia y notificaciones",
        p: "Mientras la app está abierta, tu nombre, si estás hosteando, el nombre del servidor de Minecraft y la hora en que lo iniciaste se comparten en tiempo real con los miembros de la sala seleccionada, para mostrar quién está en línea y enviar avisos. Estos mensajes pasan por Ably, que los guarda solo el tiempo necesario para entregarlos.",
      },
      {
        h: "Conexión entre jugadores y dirección IP",
        p: "Para conectarte al servidor de un amigo, los dos equipos se conectan directamente (WebRTC). Para lograrlo intercambian sus direcciones IP públicas y locales, que quedan visibles para la otra persona de la sala. Comparte el código de tu sala solo con gente de confianza. El tráfico del juego va directo entre ustedes y no pasa por los servidores de Pass the host. Si configuras un servidor TURN propio, el tráfico puede pasar por ese servidor, y sus credenciales se guardan solo en tu computador.",
      },
      {
        h: "Proveedores",
        p: "Cloudflare aloja el servidor y la base de datos de Salas (en Estados Unidos) y registra tu dirección IP para prevenir abusos y diagnosticar errores. Ably procesa los mensajes de conexión y presencia. Pass the host no vende tus datos, no muestra publicidad y no recopila analíticas.",
      },
      {
        h: "Conservación y borrado",
        p: "Los datos de Salas se guardan mientras uses la función. Puedes salir de una sala o eliminar las que creaste desde el panel Salas, y borrar todos tus datos desde Configuración → Privacidad → Borrar mis datos. También puedes pedir el borrado escribiendo al contacto que aparece abajo.",
      },
      {
        h: "Menores de edad",
        p: "La app no pide correo, edad ni datos de contacto. Si eres menor de edad, usa un nombre de usuario que no te identifique.",
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
    store: "Microsoft Store",
    direct: "Direct download (.exe)",
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
      "Pass the host main screen with the server controls, rooms and the console",
  },
  video: {
    title: "See it in action",
    subtitle: "One friend closes the server, another opens it, and everyone keeps playing the same world.",
    label: "Video: how Pass the host works",
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
      "Your friends join from the app itself with a room: no port forwarding, no VPN, no public IP.",
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
        a: "With the app's rooms. Create a room and share its invite code; when someone in the room starts the server, the others press Connect and the app opens a direct tunnel to their computer. In Minecraft they just add the server localhost:25565. No port forwarding, VPN or public IP needed.",
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
        a: "Windows (Microsoft Store or .exe installer), macOS (Apple Silicon) and Linux (AppImage, deb and snap). The interface is available in English, Spanish, Portuguese (Brazil), German, French and Russian.",
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
      "Pass the host privacy policy: what data the app uses, who it is shared with and how to delete it.",
    updated: "Last updated: October 26, 2026",
    intro:
      "Pass the host is an open-source desktop application for managing Minecraft servers shared among friends. This policy explains what data the app handles, where it ends up and how to delete it.",
    sections: [
      {
        h: "Google data it uses",
        p: "The app requests access to Google Drive only to create, read, modify and delete Minecraft server files (worlds, configuration, lock files and session statistics) inside the Pass the host folders.",
      },
      {
        h: "Where your Google data stays",
        p: "Google access tokens are stored only on your computer and files only in your own Google Drive. They never go through the Pass the host servers and are not shared with third parties. Files are only shared with the people you give access to a folder in Google Drive.",
      },
      {
        h: "Rooms (playing with friends)",
        p: "If you use Rooms, the app registers your device with a random identifier: there is no account, email or password. The Pass the host server stores that identifier, the username you chose in the app, the rooms you create (name and invite code) and the rooms you joined, with their dates. Members of a room see the names of the other members.",
      },
      {
        h: "Presence and notifications",
        p: "While the app is open, your name, whether you are hosting, the Minecraft server name and when you started it are shared in real time with the members of the selected room, to show who is online and send alerts. These messages go through Ably, which keeps them only as long as needed to deliver them.",
      },
      {
        h: "Player connections and IP address",
        p: "To connect to a friend's server, both computers connect directly (WebRTC). To do so they exchange their public and local IP addresses, which become visible to the other person in the room. Only share your room code with people you trust. Game traffic goes directly between you and does not go through the Pass the host servers. If you set up your own TURN server, traffic may go through it, and its credentials are stored only on your computer.",
      },
      {
        h: "Providers",
        p: "Cloudflare hosts the Rooms server and database (in the United States) and logs your IP address to prevent abuse and diagnose errors. Ably processes the connection and presence messages. Pass the host does not sell your data, show ads or collect analytics.",
      },
      {
        h: "Retention and deletion",
        p: "Rooms data is kept while you use the feature. You can leave a room or delete the ones you created from the Rooms panel, and delete all your data from Settings → Privacy → Delete my data. You can also ask for deletion by writing to the contact below.",
      },
      {
        h: "Children",
        p: "The app does not ask for an email, age or contact details. If you are a minor, use a username that doesn't identify you.",
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
