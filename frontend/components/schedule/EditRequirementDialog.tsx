"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requirementsApi, ApiClientError, type Requirement } from "@/lib/api";
import { format, getDay } from "date-fns";
import { useToast } from "@/components/ui/toast";

interface EditRequirementDialogProps {
  requirement: Requirement | Partial<Requirement>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onDeleted?: () => void;
  organizationId: number;
  weekStart: Date;
  availableRoles: string[];
}

export function EditRequirementDialog({
  requirement,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
  organizationId,
  weekStart,
  availableRoles,
}: EditRequirementDialogProps) {
  const [positionName, setPositionName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [headcount, setHeadcount] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [loading, setLoading] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const isNew = !requirement.id;

  useEffect(() => {
    if (open) {
      if (isNew) {
        // Reset for new requirement
        setPositionName("");
        setStartTime("09:00");
        setEndTime("17:00");
        setHeadcount(1);
        setDayOfWeek(0);
      } else {
        // Load existing requirement
        setPositionName(requirement.position_name || "");
        setStartTime(requirement.start_time?.substring(0, 5) || "09:00");
        setEndTime(requirement.end_time?.substring(0, 5) || "17:00");
        setHeadcount(requirement.headcount || 1);
        setDayOfWeek(requirement.day_of_week ?? 0);
      }
    }
  }, [open, requirement, isNew]);

  const handleSave = async () => {
    if (!positionName || !startTime || !endTime || headcount < 1) {
      showToast("Wypełnij wszystkie pola", "error");
      return;
    }

    if (startTime >= endTime) {
      showToast("Godzina zakończenia musi być późniejsza niż rozpoczęcia", "error");
      return;
    }

    try {
      setLoading(true);

      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const startTimeStr = `${startTime}:00`;
      const endTimeStr = `${endTime}:00`;

      if (isNew) {
        // Create new requirement
        await requirementsApi.create({
          organization_id: organizationId,
          week_start_date: weekStartStr,
          day_of_week: dayOfWeek,
          position_name: positionName,
          start_time: startTimeStr,
          end_time: endTimeStr,
          headcount: headcount,
        });
        showToast("Zapotrzebowanie utworzone", "success");
      } else {
        // Update existing requirement
        if (requirement.id) {
          await requirementsApi.update(requirement.id, {
            week_start_date: weekStartStr,
            day_of_week: dayOfWeek,
            position_name: positionName,
            start_time: startTimeStr,
            end_time: endTimeStr,
            headcount: headcount,
          });
          showToast("Zapotrzebowanie zaktualizowane", "success");
        }
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error("Error saving requirement:", err);
      let errorMessage = "Nie udało się zapisać zapotrzebowania";
      if (err instanceof ApiClientError) {
        if (typeof err.data.detail === 'string') {
          errorMessage = err.data.detail;
        }
      }
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!requirement.id) return;

    if (!confirm("Czy na pewno chcesz usunąć to zapotrzebowanie?")) {
      return;
    }

    try {
      setLoading(true);
      await requirementsApi.delete(requirement.id);
      showToast("Zapotrzebowanie usunięte", "success");
      onDeleted?.();
      onOpenChange(false);
    } catch (err) {
      console.error("Error deleting requirement:", err);
      showToast("Nie udało się usunąć zapotrzebowania", "error");
    } finally {
      setLoading(false);
    }
  };

  const dayNames = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {isNew ? "Dodaj Zapotrzebowanie" : "Edytuj Zapotrzebowanie"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="day">Dzień tygodnia</Label>
              <Select value={dayOfWeek.toString()} onValueChange={(val) => setDayOfWeek(parseInt(val))}>
                <SelectTrigger id="day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayNames.map((name, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Stanowisko</Label>
              <Select value={positionName} onValueChange={setPositionName}>
                <SelectTrigger id="position">
                  <SelectValue placeholder="Wybierz stanowisko" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Od</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Do</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="headcount">Ilość osób</Label>
              <Input
                id="headcount"
                type="number"
                min="1"
                value={headcount}
                onChange={(e) => setHeadcount(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <DialogFooter>
            {!isNew && onDeleted && (
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                Usuń
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Anuluj
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ToastComponent}
    </>
  );
}

