import Link from "next/link";

/** Nederlandstalige 404-pagina (voorheen de Engelse standaardpagina van Next.js). */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold text-moss-800">Deze pagina bestaat niet</h1>
      <p className="max-w-sm text-sm text-bark-700">
        Misschien is de link verouderd of zit er een typfout in het adres.
      </p>
      <Link href="/" className="tap-target rounded-lg bg-moss-600 px-4 py-2 font-semibold text-white">
        Naar het zoekscherm
      </Link>
    </main>
  );
}
