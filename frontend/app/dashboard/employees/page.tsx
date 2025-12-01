"use client";

import { useEffect, useState, useCallback } from "react";
import { employeesApi, type Employee } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmployeeDialog } from "@/components/employees/EmployeeDialog";
import { useToast } from "@/components/ui/toast";
import { Pencil } from "lucide-react";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const { showToast, ToastComponent } = useToast();

  // Hardcoded organization ID for MVP
  const ORGANIZATION_ID = 1;

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await employeesApi.getAll(ORGANIZATION_ID);
      setEmployees(data);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Nie udało się pobrać listy pracowników. Spróbuj ponownie."
      );
    } finally {
      setLoading(false);
    }
  }, [ORGANIZATION_ID]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleAddClick = () => {
    setSelectedEmployee(null);
    setDialogOpen(true);
  };

  const handleEditClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDialogOpen(true);
  };

  const handleEmployeeSaved = useCallback(() => {
    fetchEmployees();
    showToast(selectedEmployee ? "Zaktualizowano dane pracownika!" : "Dodano nowego pracownika!", "success");
  }, [fetchEmployees, showToast, selectedEmployee]);

  const handleEmployeeError = useCallback((message: string) => {
    showToast(message, "error");
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

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Pracownicy
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Zarządzaj pracownikami w swojej organizacji
          </p>
        </div>
        <Button onClick={handleAddClick} size="default">
          Dodaj Pracownika
        </Button>
      </div>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleEmployeeSaved}
        onError={handleEmployeeError}
        organizationId={ORGANIZATION_ID}
        employee={selectedEmployee}
      />

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
                Brak pracowników. Kliknij "Dodaj Pracownika", aby rozpocząć.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Imię i Nazwisko</TableHead>
                  <TableHead className="font-semibold">Rola</TableHead>
                  <TableHead className="font-semibold">Stawka Godzinowa</TableHead>
                  <TableHead className="font-semibold text-right">
                    Akcje
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {formatName(employee)}
                    </TableCell>
                    <TableCell>{employee.role}</TableCell>
                    <TableCell>{formatCurrency(employee.hourly_rate)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(employee)}
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edytuj
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

