import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Política de privacidad — Pass the host" },
  description:
    "Política de privacidad de Pass the Host, app de escritorio para servidores de Minecraft compartidos.",
};

export default function PassTheHostPrivacy() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-6 leading-relaxed text-[#A1A1AA] [&_h1]:text-[#EAEAEA] [&_h2]:text-[#EAEAEA] [&_h2]:pt-4">
      <h1 className="text-3xl font-bold">
        Política de privacidad — Pass the Host
      </h1>
      <p className="text-sm opacity-70">
        Última actualización: 22 de octubre de 2026
      </p>

      <p>
        Pass the Host es una aplicación de escritorio de código abierto para
        gestionar servidores de Minecraft compartidos entre amigos.
      </p>

      <h2 className="text-xl font-semibold">Datos de Google que usa</h2>
      <p>
        La app solicita acceso a Google Drive únicamente para crear, leer,
        modificar y eliminar los archivos de los servidores de Minecraft
        (mundos, configuración, archivos de bloqueo y estadísticas de sesión)
        dentro de las carpetas de Pass the Host.
      </p>

      <h2 className="text-xl font-semibold">Dónde se guardan</h2>
      <p>
        Los tokens de acceso y todos los datos se almacenan solo en tu
        computador y en tu propio Google Drive. La app no tiene servidores
        propios, no envía tus datos a terceros y no recopila analíticas.
      </p>

      <h2 className="text-xl font-semibold">Compartir</h2>
      <p>
        Los archivos solo se comparten con las personas a las que tú les das
        acceso a una carpeta desde Google Drive.
      </p>

      <h2 className="text-xl font-semibold">Revocar acceso</h2>
      <p>
        Puedes quitarle el acceso a la app cuando quieras desde{" "}
        <a
          className="text-[#A3D98A] underline"
          href="https://myaccount.google.com/permissions"
        >
          myaccount.google.com/permissions
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold">Contacto</h2>
      <p>
        <a className="text-[#A3D98A] underline" href="mailto:johann@jvdev.cl">
          johann@jvdev.cl
        </a>
      </p>
    </main>
  );
}
