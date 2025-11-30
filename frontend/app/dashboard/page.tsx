import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Panel Zarządzania</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/schedule"
          className="block p-6 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">Grafik Pracy</h2>
          <p className="text-muted-foreground">
            Planuj zmiany, zarządzaj zapotrzebowaniem i generuj harmonogramy.
          </p>
        </Link>
        <Link
          href="/dashboard/employees"
          className="block p-6 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">Pracownicy</h2>
          <p className="text-muted-foreground">
            Zarządzaj bazą pracowników, ich rolami i stawkami.
          </p>
        </Link>
        <Link
          href="/dashboard/availability"
          className="block p-6 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">Dyspozycyjność</h2>
          <p className="text-muted-foreground">
            Przeglądaj i edytuj dostępność pracowników.
          </p>
        </Link>
      </div>
    </div>
  );
}
