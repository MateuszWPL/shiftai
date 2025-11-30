"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { shiftsApi, ApiClientError, type Shift } from "@/lib/api";
import { startOfWeek, addDays } from "date-fns";

// Zod schema
const timeSlotSchema = z.object({
  start_hour: z.coerce.number().min(0).max(23),
  start_minute: z.coerce.number().min(0).max(59).default(0),
  end_hour: z.coerce.number().min(0).max(23),
  end_minute: z.coerce.number().min(0).max(59).default(0),
  role: z.string().min(1, "Rola jest wymagana"),
  count: z.coerce.number().min(1).max(100),
}).refine((data) => {
  const startTotal = data.start_hour * 60 + (data.start_minute || 0);
  const endTotal = data.end_hour * 60 + (data.end_minute || 0);
  return endTotal > startTotal;
}, {
  message: "Czas zakończenia musi być po czasie rozpoczęcia",
  path: ["end_hour"],
});

const weeklyDemandSchema = z.object({
  day_of_week: z.number().min(0).max(6),
  time_slots: z.array(timeSlotSchema).min(1, "Wymagany jest przynajmniej jeden przedział czasowy"),
});

type WeeklyDemandFormData = z.infer<typeof weeklyDemandSchema>;

interface WeeklyDemandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newShifts?: Shift[]) => void;
  onError?: (message: string) => void;
  organizationId: number;
  weekStartDate: Date; // Monday of the week
  availableRoles?: string[];
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Poniedziałek" },
  { value: 1, label: "Wtorek" },
  { value: 2, label: "Środa" },
  { value: 3, label: "Czwartek" },
  { value: 4, label: "Piątek" },
  { value: 5, label: "Sobota" },
  { value: 6, label: "Niedziela" },
];

export function WeeklyDemandDialog({
  open,
  onOpenChange,
  onSuccess,
  onError,
  organizationId,
  weekStartDate,
  availableRoles = [],
}: WeeklyDemandDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    watch,
    setValue,
  } = useForm<WeeklyDemandFormData>({
    resolver: zodResolver(weeklyDemandSchema),
    defaultValues: {
      day_of_week: 0, // Monday
      time_slots: [
        {
          start_hour: 8,
          start_minute: 0,
          end_hour: 12,
          end_minute: 0,
          role: "",
          count: 1,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "time_slots",
  });

  const selectedDay = watch("day_of_week");

  const onSubmit = async (data: WeeklyDemandFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Convert weekStartDate to UTC start of day
      const mondayUTC = new Date(Date.UTC(
        weekStartDate.getUTCFullYear(),
        weekStartDate.getUTCMonth(),
        weekStartDate.getUTCDate(),
        0, 0, 0, 0
      ));

      const payload = {
        week_start_date: mondayUTC.toISOString(),
        day_of_week: data.day_of_week,
        time_slots: data.time_slots.map(slot => ({
          start_hour: slot.start_hour,
          start_minute: slot.start_minute || 0,
          end_hour: slot.end_hour,
          end_minute: slot.end_minute || 0,
          role: slot.role,
          count: slot.count,
        })),
      };

      const newShifts = await shiftsApi.createWeeklyDemand(organizationId, payload);

      reset();
      onOpenChange(false);
      onSuccess(newShifts);
    } catch (error) {
      console.error("Error creating weekly demand:", error);
      let errorMessage = "Nie udało się utworzyć zapotrzebowania. Spróbuj ponownie.";
      
      if (error instanceof ApiClientError) {
        if (typeof error.data.detail === 'string') {
          errorMessage = error.data.detail;
        } else if (Array.isArray(error.data.detail)) {
          errorMessage = error.data.detail
            .map((e) => `${e.loc.join('.')}: ${e.msg}`)
            .join(', ');
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setSubmitError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dodaj Tygodniowe Zapotrzebowanie</DialogTitle>
          <DialogDescription>
            Zaplanuj potrzeby kadrowe na konkretny dzień tygodnia. Dodaj wiele przedziałów czasowych z różnymi rolami i ilościami.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="day_of_week">Dzień Tygodnia *</Label>
            <Select
              value={selectedDay?.toString()}
              onValueChange={(value) => setValue("day_of_week", parseInt(value))}
            >
              <SelectTrigger id="day_of_week">
                <SelectValue placeholder="Wybierz dzień" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day) => (
                  <SelectItem key={day.value} value={day.value.toString()}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.day_of_week && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.day_of_week.message}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Przedziały Czasowe *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({
                  start_hour: 8,
                  start_minute: 0,
                  end_hour: 12,
                  end_minute: 0,
                  role: "",
                  count: 1,
                })}
              >
                + Dodaj Przedział
              </Button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Przedział {index + 1}</Label>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      Usuń
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Start</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        placeholder="Godz"
                        {...register(`time_slots.${index}.start_hour`)}
                      />
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        placeholder="Min"
                        {...register(`time_slots.${index}.start_minute`)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Koniec</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        placeholder="Godz"
                        {...register(`time_slots.${index}.end_hour`)}
                      />
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        placeholder="Min"
                        {...register(`time_slots.${index}.end_minute`)}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Rola *</Label>
                    {availableRoles.length > 0 ? (
                      <Select
                        value={watch(`time_slots.${index}.role`)}
                        onValueChange={(value) => setValue(`time_slots.${index}.role`, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Wybierz rolę" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="np. Kelner, Kucharz"
                        {...register(`time_slots.${index}.role`)}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Ilość *</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="Liczba"
                      {...register(`time_slots.${index}.count`)}
                    />
                  </div>
                </div>

                {errors.time_slots?.[index] && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {errors.time_slots[index]?.message || "Nieprawidłowy przedział"}
                  </p>
                )}
              </div>
            ))}
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
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Tworzenie..." : "Utwórz Zapotrzebowanie"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

