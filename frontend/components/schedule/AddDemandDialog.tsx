"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { shiftsApi, ApiClientError } from "@/lib/api";

// Zod schema matching the API DemandRequest schema
const demandFormSchema = z.object({
  role: z.string().min(1, "Role is required").max(100),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  count: z.coerce.number().min(1, "Quantity must be at least 1").max(100, "Quantity cannot exceed 100"),
}).refine((data) => {
  const start = new Date(data.start_time);
  const end = new Date(data.end_time);
  return end > start;
}, {
  message: "End time must be after start time",
  path: ["end_time"],
});

type DemandFormData = z.infer<typeof demandFormSchema>;

interface AddDemandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onError?: (message: string) => void;
  organizationId: number;
  defaultDate?: Date; // Optional default date for the time inputs
  availableRoles?: string[]; // Available roles from employees
}

export function AddDemandDialog({
  open,
  onOpenChange,
  onSuccess,
  onError,
  organizationId,
  defaultDate,
  availableRoles = [],
}: AddDemandDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Get default times for today or provided date
  const getDefaultDate = () => {
    const date = defaultDate || new Date();
    // Set to 8:00 AM UTC
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      8,
      0,
      0
    ));
  };

  const getDefaultEndDate = () => {
    const start = getDefaultDate();
    // Add 4 hours (12:00 PM UTC)
    return new Date(start.getTime() + 4 * 60 * 60 * 1000);
  };

  const formatDateTimeLocal = (date: Date): string => {
    // Convert UTC date to local datetime-local format
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const parseDateTimeLocal = (value: string): Date => {
    // Parse datetime-local input and convert to UTC
    const localDate = new Date(value);
    return new Date(Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      localDate.getHours(),
      localDate.getMinutes()
    ));
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<DemandFormData>({
    resolver: zodResolver(demandFormSchema),
    defaultValues: {
      role: "",
      start_time: formatDateTimeLocal(getDefaultDate()),
      end_time: formatDateTimeLocal(getDefaultEndDate()),
      count: 1,
    },
  });

  const selectedRole = watch("role");

  const onSubmit = async (data: DemandFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Convert local datetime to UTC ISO strings
      const startTime = parseDateTimeLocal(data.start_time);
      const endTime = parseDateTimeLocal(data.end_time);

      const payload = {
        role: data.role,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        count: data.count,
      };

      await shiftsApi.createDemand(organizationId, payload);

      // Reset form and close dialog
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error creating demand:", error);
      let errorMessage = "Failed to create demand. Please try again.";
      
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Staffing Demand</DialogTitle>
          <DialogDescription>
            Create open shifts that need to be filled. The AI will assign employees later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            {availableRoles.length > 0 ? (
              <Select
                value={selectedRole}
                onValueChange={(value) => setValue("role", value)}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
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
                id="role"
                {...register("role")}
                placeholder="e.g., Waiter, Cook"
              />
            )}
            {errors.role && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.role.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time *</Label>
              <Input
                id="start_time"
                type="datetime-local"
                {...register("start_time")}
              />
              {errors.start_time && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {errors.start_time.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">End Time *</Label>
              <Input
                id="end_time"
                type="datetime-local"
                {...register("end_time")}
              />
              {errors.end_time && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {errors.end_time.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="count">Quantity *</Label>
            <Input
              id="count"
              type="number"
              min="1"
              max="100"
              {...register("count")}
              placeholder="How many people needed"
            />
            {errors.count && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.count.message}
              </p>
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
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Demand"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

