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
import { AddEmployeeDialog } from "@/components/employees/AddEmployeeDialog";
import { useToast } from "@/components/ui/toast";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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
          : "Failed to fetch employees. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [ORGANIZATION_ID]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleEmployeeAdded = useCallback(() => {
    fetchEmployees();
    showToast("Employee added successfully!", "success");
  }, [fetchEmployees, showToast]);

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
            Employees
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage your organization&apos;s employees
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="default">
          Add Employee
        </Button>
      </div>

      <AddEmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleEmployeeAdded}
        onError={handleEmployeeError}
        organizationId={ORGANIZATION_ID}
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
                No employees found. Click &quot;Add Employee&quot; to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold">Hourly Rate</TableHead>
                  <TableHead className="font-semibold text-right">
                    Actions
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
                        onClick={() => {}}
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                      >
                        View
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

