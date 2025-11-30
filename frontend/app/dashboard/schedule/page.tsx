"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { shiftsApi, employeesApi, ApiClientError, type Shift, type Employee } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { format, startOfWeek, addDays, subWeeks, addWeeks, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WeeklyDemandDialog } from "@/components/schedule/WeeklyDemandDialog";
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

// --- Components for DnD ---

interface DraggableShiftProps {
  shift: Shift;
  employeeName: string;
  formatTime: (date: string) => string;
}

function DraggableShift({ shift, employeeName, formatTime }: DraggableShiftProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `shift-${shift.id}`,
    data: { shift },
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : undefined,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  const isAssigned = shift.employee_id !== null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-md border p-2 mb-2 cursor-grab active:cursor-grabbing shadow-sm ${
        isAssigned
          ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
          : "border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
      }`}
    >
      <div className={`text-xs font-medium ${isAssigned ? "text-blue-900 dark:text-blue-200" : "text-gray-700 dark:text-gray-300"}`}>
        {isAssigned ? employeeName : `${shift.role} Needed`}
      </div>
      <div className={`mt-1 text-xs ${isAssigned ? "text-blue-700 dark:text-blue-300" : "text-gray-600 dark:text-gray-400"}`}>
        {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
      </div>
      {isAssigned && (
        <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
          {shift.role}
        </div>
      )}
    </div>
  );
}

interface DroppableDayProps {
  day: Date;
  shifts: Shift[];
  employees: Employee[];
  formatTime: (date: string) => string;
  getEmployeeName: (id: number | null) => string;
  onClearDay: () => void;
  clearing: boolean;
}

function DroppableDay({ day, shifts, employees, formatTime, getEmployeeName, onClearDay, clearing }: DroppableDayProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.toISOString()}`,
    data: { day },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[400px] border-r border-gray-200 p-4 dark:border-gray-800 last:border-r-0 transition-colors ${
        isOver ? "bg-blue-50 dark:bg-blue-900/10" : ""
      }`}
    >
      {shifts.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-4">
          No shifts
        </p>
      ) : (
        <div className="space-y-2">
          {shifts.map((shift) => (
            <DraggableShift
              key={shift.id}
              shift={shift}
              employeeName={getEmployeeName(shift.employee_id)}
              formatTime={formatTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Page Component ---

export default function SchedulePage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demandDialogOpen, setDemandDialogOpen] = useState(false);
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
  const [activeDragShift, setActiveDragShift] = useState<Shift | null>(null);
  const { showToast, ToastComponent } = useToast();

  // Hardcoded organization ID for MVP
  const ORGANIZATION_ID = 1;

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await shiftsApi.getAll(ORGANIZATION_ID);
      setShifts(data);
    } catch (err) {
      console.error("Error fetching shifts:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch shifts. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await employeesApi.getAll(ORGANIZATION_ID);
      setEmployees(data);
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
    fetchEmployees();
  }, [fetchShifts, fetchEmployees]);

  // Calculate current week start (Monday) in UTC
  const getCurrentWeekStart = useCallback((): Date => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const date = now.getUTCDate();
    const dayOfWeek = now.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return new Date(Date.UTC(year, month, date - daysToMonday, 0, 0, 0, 0));
  }, []);

  // Initialize selected week
  const weekStart = useMemo(() => {
    if (selectedWeekStart) {
      return selectedWeekStart;
    }
    if (shifts.length > 0 && !selectedWeekStart) {
      const earliestShift = shifts.reduce((earliest, shift) => {
        const shiftDate = parseISO(shift.start_time);
        const earliestDate = parseISO(earliest.start_time);
        return shiftDate < earliestDate ? shift : earliest;
      });
      const earliestDate = parseISO(earliestShift.start_time);
      const year = earliestDate.getUTCFullYear();
      const month = earliestDate.getUTCMonth();
      const date = earliestDate.getUTCDate();
      const dayOfWeek = earliestDate.getUTCDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      return new Date(Date.UTC(year, month, date - daysToMonday, 0, 0, 0, 0));
    }
    return getCurrentWeekStart();
  }, [selectedWeekStart, shifts, getCurrentWeekStart]);

  const handlePrevWeek = useCallback(() => {
    const prevWeek = new Date(weekStart);
    prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
    setSelectedWeekStart(prevWeek);
  }, [weekStart]);

  const handleNextWeek = useCallback(() => {
    const nextWeek = new Date(weekStart);
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
    setSelectedWeekStart(nextWeek);
  }, [weekStart]);

  const handleToday = useCallback(() => {
    setSelectedWeekStart(null);
  }, []);

  const handleAutoAssign = useCallback(async () => {
    try {
      setAutoAssigning(true);
      setError(null);
      const startDateUTC = new Date(Date.UTC(
        weekStart.getUTCFullYear(),
        weekStart.getUTCMonth(),
        weekStart.getUTCDate(),
        0, 0, 0, 0
      ));
      const endDateUTC = new Date(Date.UTC(
        weekStart.getUTCFullYear(),
        weekStart.getUTCMonth(),
        weekStart.getUTCDate() + 6,
        23, 59, 59, 999
      ));

      const requestData = {
        start_date: startDateUTC.toISOString(),
        end_date: endDateUTC.toISOString(),
      };

      const result = await shiftsApi.autoAssign(ORGANIZATION_ID, requestData);
      showToast(`Auto-assigned ${result.length} shifts successfully!`, "success");
      await fetchShifts();
    } catch (err) {
      console.error("Error auto-assigning shifts:", err);
      let errorMessage = "Failed to auto-assign shifts. Please try again.";
      if (err instanceof ApiClientError) {
        if (typeof err.data.detail === 'string') {
          errorMessage = err.data.detail;
        } else if (Array.isArray(err.data.detail)) {
          errorMessage = err.data.detail.map((e) => `${e.loc.join('.')}: ${e.msg}`).join(', ');
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setAutoAssigning(false);
    }
  }, [weekStart, fetchShifts, showToast]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const handleClearDay = useCallback(async (dayIndex?: number) => {
    const targetDay = dayIndex !== undefined ? weekDays[dayIndex] : null;
    const confirmMessage = targetDay
      ? `Are you sure you want to clear all shifts for ${format(targetDay, "EEEE, MMM d")}? This cannot be undone.`
      : "Are you sure you want to clear all shifts for this week? This cannot be undone.";
    
    if (!confirm(confirmMessage)) return;

    try {
      setClearing(true);
      setError(null);
      let startDateUTC: Date;
      let endDateUTC: Date;

      if (targetDay) {
        startDateUTC = new Date(Date.UTC(
          targetDay.getUTCFullYear(),
          targetDay.getUTCMonth(),
          targetDay.getUTCDate(),
          0, 0, 0, 0
        ));
        endDateUTC = new Date(Date.UTC(
          targetDay.getUTCFullYear(),
          targetDay.getUTCMonth(),
          targetDay.getUTCDate(),
          23, 59, 59, 999
        ));
      } else {
        startDateUTC = new Date(Date.UTC(
          weekStart.getUTCFullYear(),
          weekStart.getUTCMonth(),
          weekStart.getUTCDate(),
          0, 0, 0, 0
        ));
        endDateUTC = new Date(Date.UTC(
          weekStart.getUTCFullYear(),
          weekStart.getUTCMonth(),
          weekStart.getUTCDate() + 6,
          23, 59, 59, 999
        ));
      }

      const requestData = {
        start_date: startDateUTC.toISOString(),
        end_date: endDateUTC.toISOString(),
      };

      await shiftsApi.deleteRange(ORGANIZATION_ID, requestData);
      showToast(targetDay ? `Cleared all shifts for ${format(targetDay, "EEEE")}` : "Cleared all shifts for this week", "success");
      
      setShifts(prev => prev.filter(shift => {
        const shiftDate = parseISO(shift.start_time);
        const shiftDateUTC = new Date(Date.UTC(shiftDate.getUTCFullYear(), shiftDate.getUTCMonth(), shiftDate.getUTCDate()));
        const startUTC = new Date(Date.UTC(startDateUTC.getUTCFullYear(), startDateUTC.getUTCMonth(), startDateUTC.getUTCDate()));
        const endUTC = new Date(Date.UTC(endDateUTC.getUTCFullYear(), endDateUTC.getUTCMonth(), endDateUTC.getUTCDate()));
        return shiftDateUTC < startUTC || shiftDateUTC > endUTC;
      }));
      
      setTimeout(() => fetchShifts().catch(console.error), 300);
    } catch (err) {
      console.error("Error clearing shifts:", err);
      setError("Failed to clear shifts.");
      showToast("Failed to clear shifts.", "error");
      fetchShifts();
    } finally {
      setClearing(false);
    }
  }, [weekStart, weekDays, fetchShifts, showToast]);

  const getEmployeeName = useCallback((employeeId: number | null): string => {
    if (employeeId === null) return "Open Shift";
    const employee = employees.find((emp) => emp.id === employeeId);
    return employee ? `${employee.first_name} ${employee.last_name}` : `Employee #${employeeId}`;
  }, [employees]);

  const formatTime = useCallback((dateString: string): string => {
    const date = parseISO(dateString);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }, []);

  const availableRoles = useMemo(() => {
    const roles = new Set(employees.map((emp) => emp.role));
    return Array.from(roles).sort();
  }, [employees]);

  // DnD Handler
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragShift(null);

    if (!over) return;

    const shiftId = parseInt(active.id.toString().replace("shift-", ""));
    const targetDayIso = over.id.toString().replace("day-", "");
    const targetDay = new Date(targetDayIso);

    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;

    // Calculate new times
    const currentStart = parseISO(shift.start_time);
    const currentEnd = parseISO(shift.end_time);
    
    // Check if day changed
    const currentDayUTC = new Date(Date.UTC(currentStart.getUTCFullYear(), currentStart.getUTCMonth(), currentStart.getUTCDate()));
    const targetDayUTC = new Date(Date.UTC(targetDay.getUTCFullYear(), targetDay.getUTCMonth(), targetDay.getUTCDate()));

    if (currentDayUTC.getTime() === targetDayUTC.getTime()) {
      return; // Dropped on same day, do nothing for now (reordering not implemented)
    }

    // Calculate new start/end times preserving hours/minutes
    const newStart = new Date(targetDayUTC);
    newStart.setUTCHours(currentStart.getUTCHours(), currentStart.getUTCMinutes(), 0, 0);
    
    const newEnd = new Date(targetDayUTC);
    newEnd.setUTCHours(currentEnd.getUTCHours(), currentEnd.getUTCMinutes(), 0, 0);
    
    // Handle overnight shifts (end time on next day)
    if (currentEnd.getUTCDate() !== currentStart.getUTCDate()) {
       newEnd.setUTCDate(newEnd.getUTCDate() + 1);
    }

    try {
      // Optimistic update
      const updatedShift = { ...shift, start_time: newStart.toISOString(), end_time: newEnd.toISOString() };
      setShifts(prev => prev.map(s => s.id === shiftId ? updatedShift : s));

      await shiftsApi.update(shiftId, {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      });
      
      showToast("Shift moved successfully", "success");
    } catch (err) {
      console.error("Error moving shift:", err);
      showToast("Failed to move shift", "error");
      fetchShifts(); // Revert on error
    }
  };

  const handleDragStart = (event: any) => {
    const shiftId = parseInt(event.active.id.toString().replace("shift-", ""));
    const shift = shifts.find(s => s.id === shiftId);
    if (shift) setActiveDragShift(shift);
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Schedule</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Plan staffing demand and auto-assign shifts</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setDemandDialogOpen(true)} variant="outline">Add Demand</Button>
          <Button onClick={() => handleClearDay()} disabled={clearing} variant="outline">
            {clearing ? "Clearing..." : "Clear Week"}
          </Button>
          <Button onClick={handleAutoAssign} disabled={autoAssigning}>
            {autoAssigning ? "Assigning..." : "Auto-Assign"}
          </Button>
        </div>
      </div>

      <WeeklyDemandDialog
        open={demandDialogOpen}
        onOpenChange={setDemandDialogOpen}
        onSuccess={async (newShifts) => {
          if (newShifts && newShifts.length > 0) setShifts(prev => [...prev, ...newShifts]);
          fetchShifts().catch(console.error);
          showToast("Demand created successfully!", "success");
        }}
        organizationId={ORGANIZATION_ID}
        weekStartDate={weekStart}
        availableRoles={availableRoles}
      />

      {ToastComponent}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
          <div className="space-y-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      )}

      {!loading && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <Button variant="outline" size="sm" onClick={handlePrevWeek} className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Previous Week
            </Button>
            <div className="text-center">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
                {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
              </div>
              <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs text-gray-500 hover:text-gray-700">
                Go to Current Week
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleNextWeek} className="flex items-center gap-1">
              Next Week <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
            <div className="overflow-x-auto">
              <div className="min-w-full">
                <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800">
                  {weekDays.map((day, idx) => (
                    <div key={idx} className="border-r border-gray-200 p-4 text-center dark:border-gray-800 last:border-r-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{format(day, "EEE")}</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-50">{format(day, "MMM d")}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClearDay(idx)}
                          disabled={clearing}
                          className="h-6 w-6 p-0 text-xs text-gray-400 hover:text-red-600"
                          title={`Clear ${format(day, "EEEE")}`}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {weekDays.map((day, dayIdx) => {
                    // Filter shifts for this day
                    const dayShifts = shifts.filter((shift) => {
                      const shiftDate = parseISO(shift.start_time);
                      const shiftDateUTC = new Date(Date.UTC(shiftDate.getUTCFullYear(), shiftDate.getUTCMonth(), shiftDate.getUTCDate()));
                      const dayUTC = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
                      return shiftDateUTC.getTime() === dayUTC.getTime();
                    });
                    
                    return (
                      <DroppableDay
                        key={dayIdx}
                        day={day}
                        shifts={dayShifts}
                        employees={employees}
                        formatTime={formatTime}
                        getEmployeeName={getEmployeeName}
                        onClearDay={() => handleClearDay(dayIdx)}
                        clearing={clearing}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            
            <DragOverlay>
              {activeDragShift ? (
                 <div className={`rounded-md border p-2 mb-2 shadow-lg opacity-80 ${
                    activeDragShift.employee_id !== null
                      ? "border-blue-200 bg-blue-50"
                      : "border-gray-300 bg-gray-100"
                  }`}>
                  <div className="text-xs font-medium">
                    {activeDragShift.employee_id !== null ? getEmployeeName(activeDragShift.employee_id) : `${activeDragShift.role} Needed`}
                  </div>
                  <div className="mt-1 text-xs">
                    {formatTime(activeDragShift.start_time)} - {formatTime(activeDragShift.end_time)}
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  );
}
