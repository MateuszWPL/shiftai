"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { employeesApi, type Employee } from "@/lib/api";
import { ApiClientError } from "@/lib/api";

// Zod schema matching the API EmployeeCreate schema
const employeeFormSchema = z.object({
  first_name: z.string().min(1, "Imię jest wymagane").max(100),
  last_name: z.string().min(1, "Nazwisko jest wymagane").max(100),
  role: z.string().min(1, "Rola jest wymagana").max(100),
  hourly_rate: z.coerce.number().min(0, "Stawka godzinowa musi być większa lub równa 0"),
  max_hours_per_week: z.coerce
    .number()
    .min(1, "Maksymalna liczba godzin musi wynosić co najmniej 1")
    .max(168, "Maksymalna liczba godzin nie może przekraczać 168"),
  email: z.string().email("Nieprawidłowy adres email").optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onError?: (message: string) => void;
  organizationId: number;
  employee?: Employee | null; // If provided, we are in edit mode
}

export function EmployeeDialog({
  open,
  onOpenChange,
  onSuccess,
  onError,
  organizationId,
  employee,
}: EmployeeDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      role: "",
      hourly_rate: 0,
      max_hours_per_week: 40,
      email: "",
      phone: "",
    },
  });

  // Reset form when dialog opens or employee changes
  useEffect(() => {
    if (open) {
      if (employee) {
        setValue("first_name", employee.first_name);
        setValue("last_name", employee.last_name);
        setValue("role", employee.role);
        setValue("hourly_rate", parseFloat(employee.hourly_rate));
        setValue("max_hours_per_week", employee.max_hours_per_week);
        setValue("email", employee.email || "");
        setValue("phone", employee.phone || "");
      } else {
        reset({
          first_name: "",
          last_name: "",
          role: "",
          hourly_rate: 0,
          max_hours_per_week: 40,
          email: "",
          phone: "",
        });
      }
      setSubmitError(null);
    }
  }, [open, employee, reset, setValue]);

  const onSubmit = async (data: EmployeeFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        first_name: data.first_name,
        last_name: data.last_name,
        role: data.role,
        hourly_rate: typeof data.hourly_rate === 'string' ? parseFloat(data.hourly_rate) : data.hourly_rate,
        max_hours_per_week: data.max_hours_per_week,
        organization_id: organizationId,
        email: data.email || undefined,
        phone: data.phone || undefined,
      };

      if (employee) {
        await employeesApi.update(employee.id, payload);
      } else {
        await employeesApi.create(payload);
      }

      reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error saving employee:", error);
      let errorMessage = "Nie udało się zapisać pracownika. Spróbuj ponownie.";
      
      if (error instanceof ApiClientError) {
        errorMessage =
          typeof error.data.detail === "string"
            ? error.data.detail
            : error.data.detail?.[0]?.msg || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setSubmitError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      setSubmitError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{employee ? "Edytuj Pracownika" : "Dodaj Nowego Pracownika"}</DialogTitle>
          <DialogDescription>
            {employee
              ? "Zaktualizuj dane pracownika."
              : "Wypełnij formularz, aby dodać nowego pracownika do organizacji."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">
                Imię <span className="text-red-500">*</span>
              </Label>
              <Input
                id="first_name"
                {...register("first_name")}
                placeholder="Jan"
                disabled={isSubmitting}
              />
              {errors.first_name && (
                <p className="text-sm text-red-500">
                  {errors.first_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">
                Nazwisko <span className="text-red-500">*</span>
              </Label>
              <Input
                id="last_name"
                {...register("last_name")}
                placeholder="Kowalski"
                disabled={isSubmitting}
              />
              {errors.last_name && (
                <p className="text-sm text-red-500">
                  {errors.last_name.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">
              Rola <span className="text-red-500">*</span>
            </Label>
            <Input
              id="role"
              {...register("role")}
              placeholder="np. Kelner, Kucharz, Barman"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Wpisz dowolną nazwę roli.
            </p>
            {errors.role && (
              <p className="text-sm text-red-500">{errors.role.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">
                Stawka godzinowa (PLN) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                min="0"
                {...register("hourly_rate")}
                placeholder="25.50"
                disabled={isSubmitting}
              />
              {errors.hourly_rate && (
                <p className="text-sm text-red-500">
                  {errors.hourly_rate.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_hours_per_week">
                Max godzin/tydzień <span className="text-red-500">*</span>
              </Label>
              <Input
                id="max_hours_per_week"
                type="number"
                min="1"
                max="168"
                {...register("max_hours_per_week")}
                placeholder="40"
                disabled={isSubmitting}
              />
              {errors.max_hours_per_week && (
                <p className="text-sm text-red-500">
                  {errors.max_hours_per_week.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (Opcjonalnie)</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="jan.kowalski@example.com"
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon (Opcjonalnie)</Label>
            <Input
              id="phone"
              type="tel"
              {...register("phone")}
              placeholder="+48 123 456 789"
              disabled={isSubmitting}
            />
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone.message}</p>
            )}
          </div>

          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-800 dark:text-red-200">
                {submitError}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Zapisywanie..." : (employee ? "Zapisz Zmiany" : "Dodaj Pracownika")}
            </Button>
          </DialogFooter>
        </form>
        
        {employee && (
          <div className="mt-4 border-t pt-4">
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={async () => {
                if (window.confirm("Czy na pewno chcesz usunąć tego pracownika? Tej operacji nie można cofnąć.")) {
                  setIsSubmitting(true);
                  try {
                    await employeesApi.delete(employee.id);
                    onOpenChange(false);
                    onSuccess();
                  } catch (error) {
                    console.error("Error deleting employee:", error);
                    setSubmitError("Nie udało się usunąć pracownika.");
                    setIsSubmitting(false);
                  }
                }
              }}
              disabled={isSubmitting}
            >
              Usuń Pracownika
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
