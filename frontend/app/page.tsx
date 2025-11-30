import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background text-foreground">
      <main className="flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
          Witaj w ShiftAI
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground mb-8">
          Inteligentny system zarządzania grafikami pracy. Optymalizuj czas, zarządzaj zespołem i planuj zmiany z łatwością.
        </p>
        <div className="flex gap-4">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            Przejdź do Panelu
          </Link>
          <Link
            href="/dashboard/schedule"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            Zobacz Grafik
          </Link>
        </div>
      </main>
    </div>
  );
}
