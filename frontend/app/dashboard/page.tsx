'use client';

import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AuthGuard>
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-2">Panel Zarządzania</h1>
        {user?.full_name && (
          <p className="text-muted-foreground mb-8">
            Witaj, {user.full_name}!
          </p>
        )}
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
            href="/dashboard/team"
            className="block p-6 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">Zespół</h2>
            <p className="text-muted-foreground">
              Zarządzaj członkami zespołu i zaproszeniami.
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
    </AuthGuard>
  );
}
