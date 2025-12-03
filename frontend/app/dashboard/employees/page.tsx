"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { employeesApi, type Employee, type EmployeeInvitation, ApiClientError } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AddEmployeeDialog } from "@/components/employees/AddEmployeeDialog";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import { Input } from "@/components/ui/input";

export default function EmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [invitations, setInvitations] = useState<Map<number, EmployeeInvitation>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invitingEmployeeId, setInvitingEmployeeId] = useState<number | null>(null);
  const { showToast, ToastComponent } = useToast();

  const organizationId = user?.organization_id;

  const fetchEmployees = useCallback(async () => {
    if (!organizationId) {
      setError("Brak przypisania do zespołu. Skontaktuj się z administratorem.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await employeesApi.getAll(organizationId);
      setEmployees(data);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Nie udało się załadować pracowników. Spróbuj ponownie."
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleEmployeeAdded = useCallback(() => {
    fetchEmployees();
    showToast("Pracownik został dodany pomyślnie!", "success");
  }, [fetchEmployees, showToast]);

  const handleEmployeeError = useCallback((message: string) => {
    showToast(message, "error");
  }, [showToast]);

  const handleInviteEmployee = useCallback(async (employeeId: number) => {
    setInvitingEmployeeId(employeeId);
    try {
      const invitation = await employeesApi.invite(employeeId);
      setInvitations(prev => new Map(prev).set(employeeId, invitation));
      showToast("Zaproszenie zostało wysłane!", "success");
    } catch (err) {
      if (err instanceof ApiClientError) {
        const errorMessage = typeof err.data.detail === 'string' 
          ? err.data.detail 
          : 'Wystąpił błąd podczas wysyłania zaproszenia';
        showToast(errorMessage, "error");
      } else {
        showToast("Nie udało się wysłać zaproszenia", "error");
      }
    } finally {
      setInvitingEmployeeId(null);
    }
  }, [showToast]);

  const handleLoadInvitation = useCallback(async (employeeId: number) => {
    try {
      const invitation = await employeesApi.getInvitation(employeeId);
      setInvitations(prev => new Map(prev).set(employeeId, invitation));
    } catch (err) {
      // Ignore if invitation doesn't exist
    }
  }, []);

  const handleCopyInvitationLink = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
    showToast("Link skopiowany do schowka!", "success");
  }, [showToast]);

  const formatCurrency = (value: string | number): string => {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
    }).format(numValue);
  };

  const formatName = (employee: Employee): string => {
    return `${employee.first_name} ${employee.last_name}`;
  };

  if (!organizationId) {
    return (
      <AuthGuard>
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Brak przypisania do zespołu. Skontaktuj się z administratorem.
            </p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Pracownicy
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Zarządzaj pracownikami swojej organizacji. Możesz zaprosić pracowników do systemu, aby mogli przeglądać swój grafik i zarządzać dostępnościami.
            <br />
            <span className="text-xs text-muted-foreground">
              Aby zaprosić członków zespołu z kontem (menedżerów), przejdź do sekcji{" "}
              <Link href="/dashboard/team" className="text-primary hover:underline">
                Zespół
              </Link>
            </span>
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="default">
          Dodaj pracownika
        </Button>
      </div>

      {organizationId && (
        <AddEmployeeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={handleEmployeeAdded}
          onError={handleEmployeeError}
          organizationId={organizationId}
        />
      )}

      {ToastComponent}

      {loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
          <div className="space-y-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {error}
          </p>
        </div>
      )}

      {!loading && !error && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {employees.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Brak pracowników. Kliknij &quot;Dodaj pracownika&quot;, aby rozpocząć.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Imię i nazwisko</TableHead>
                  <TableHead className="font-semibold">Rola</TableHead>
                  <TableHead className="font-semibold">Stawka godzinowa</TableHead>
                  <TableHead className="font-semibold">Status konta</TableHead>
                  <TableHead className="font-semibold">Link zaproszenia</TableHead>
                  <TableHead className="font-semibold text-right">
                    Akcje
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => {
                  const invitation = invitations.get(employee.id);
                  const hasAccount = (employee as any).user_id !== null && (employee as any).user_id !== undefined;
                  const hasEmail = !!employee.email;
                  
                  return (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        {formatName(employee)}
                        {employee.email && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {employee.email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{employee.role}</TableCell>
                      <TableCell>{formatCurrency(employee.hourly_rate)}</TableCell>
                      <TableCell>
                        {hasAccount ? (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Ma konto
                          </span>
                        ) : hasEmail ? (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Bez konta
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                            Brak email
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {invitation ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={invitation.invitation_url}
                              readOnly
                              className="text-xs h-8"
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyInvitationLink(invitation.invitation_url)}
                              className="text-xs"
                            >
                              Kopiuj
                            </Button>
                          </div>
                        ) : hasEmail && !hasAccount ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInviteEmployee(employee.id)}
                            disabled={invitingEmployeeId === employee.id}
                            className="text-xs"
                          >
                            {invitingEmployeeId === employee.id ? "Wysyłanie..." : "Zaproś"}
                          </Button>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {hasEmail && !hasAccount && !invitation && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLoadInvitation(employee.id)}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                          >
                            Pobierz link
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
      </div>
    </AuthGuard>
  );
}

