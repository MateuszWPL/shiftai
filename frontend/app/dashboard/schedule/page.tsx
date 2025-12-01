"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { shiftsApi, employeesApi, ApiClientError, type Shift, type Employee } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { format, addDays, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { TimeGrid } from "@/components/schedule/TimeGrid";
import { EmployeeSidebar } from "@/components/schedule/EmployeeSidebar";

export default function SchedulePage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const { showToast, ToastComponent } = useToast();

  // Hardcoded organization ID for MVP
  const ORGANIZATION_ID = 1;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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
          : "Nie udało się pobrać zmian. Spróbuj ponownie."
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
    return getCurrentWeekStart();
  }, [selectedWeekStart, getCurrentWeekStart]);

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
      showToast(`Wygenerowano ${result.length} zmian z dostępności!`, "success");
      await fetchShifts();
    } catch (err) {
      console.error("Error auto-assigning shifts:", err);
      let errorMessage = "Nie udało się automatycznie przypisać zmian. Spróbuj ponownie.";
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

  const handleClearDay = useCallback(async () => {
    const confirmMessage = "Czy na pewno chcesz usunąć wszystkie zmiany z tego tygodnia? Tej operacji nie można cofnąć.";
    
    if (!confirm(confirmMessage)) return;

    try {
      setClearing(true);
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

      await shiftsApi.deleteRange(ORGANIZATION_ID, requestData);
      showToast("Wyczyszczono zmiany z całego tygodnia", "success");
      
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
      setError("Nie udało się wyczyścić zmian.");
      showToast("Nie udało się wyczyścić zmian.", "error");
      fetchShifts();
    } finally {
      setClearing(false);
    }
  }, [weekStart, fetchShifts, showToast]);

  // DnD Handler
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const activeData = active.data.current;
    const targetDayIso = over.id.toString().replace("day-", "");
    const targetDay = new Date(targetDayIso);

    // Case 1: Creating a new shift from Sidebar
    if (activeData?.type === "new-shift") {
      const employee = activeData.employee as Employee;
      
      // Default to 12:00 - 20:00 for dropped shifts if no time specified
      // In a real grid, we would calculate time based on Y position
      // For now, let's just create a standard shift
      
      const start = new Date(Date.UTC(
        targetDay.getUTCFullYear(),
        targetDay.getUTCMonth(),
        targetDay.getUTCDate(),
        12, 0, 0
      ));
      
      const end = new Date(Date.UTC(
        targetDay.getUTCFullYear(),
        targetDay.getUTCMonth(),
        targetDay.getUTCDate(),
        20, 0, 0
      ));

      try {
        // Optimistic update
        const tempId = Date.now(); // Temporary ID
        const newShift: Shift = {
          id: tempId,
          employee_id: employee.id,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          role: employee.role,
          is_published: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        setShifts(prev => [...prev, newShift]);

        await shiftsApi.createDemand(ORGANIZATION_ID, {
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          role: employee.role,
          count: 1
        }).then(async (createdShifts) => {
             // The createDemand endpoint creates open shifts. We need to assign the employee.
             // This is a bit hacky because we don't have a direct "create assigned shift" endpoint yet.
             // We should probably add one or use update.
             // For now, let's assume we update the first created shift.
             if (createdShifts && createdShifts.length > 0) {
                 const createdShift = createdShifts[0];
                 await shiftsApi.update(createdShift.id, {
                     employee_id: employee.id
                 });
                 // Refresh to get correct ID and state
                 fetchShifts();
             }
        });
        
        showToast("Utworzono nową zmianę", "success");
      } catch (err) {
        console.error("Error creating shift:", err);
        showToast("Nie udało się utworzyć zmiany", "error");
        fetchShifts();
      }
    }
    
    // Case 2: Moving an existing shift
    else if (activeData?.type === "existing-shift") {
      const shift = activeData.shift as Shift;
      
      // Calculate new date
      const currentStart = parseISO(shift.start_time);
      const currentEnd = parseISO(shift.end_time);
      
      // Check if day changed
      const currentDayUTC = new Date(Date.UTC(currentStart.getUTCFullYear(), currentStart.getUTCMonth(), currentStart.getUTCDate()));
      const targetDayUTC = new Date(Date.UTC(targetDay.getUTCFullYear(), targetDay.getUTCMonth(), targetDay.getUTCDate()));

      if (currentDayUTC.getTime() === targetDayUTC.getTime()) {
        return; // Dropped on same day, do nothing (time change not implemented via drag yet)
      }

      // Calculate new start/end times preserving hours/minutes
      const newStart = new Date(targetDayUTC);
      newStart.setUTCHours(currentStart.getUTCHours(), currentStart.getUTCMinutes(), 0, 0);
      
      const newEnd = new Date(targetDayUTC);
      newEnd.setUTCHours(currentEnd.getUTCHours(), currentEnd.getUTCMinutes(), 0, 0);
      
      if (currentEnd.getUTCDate() !== currentStart.getUTCDate()) {
         newEnd.setUTCDate(newEnd.getUTCDate() + 1);
      }

      try {
        // Optimistic update
        const updatedShift = { ...shift, start_time: newStart.toISOString(), end_time: newEnd.toISOString() };
        setShifts(prev => prev.map(s => s.id === shift.id ? updatedShift : s));

        await shiftsApi.update(shift.id, {
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        });
        
        showToast("Przesunięto zmianę pomyślnie", "success");
      } catch (err) {
        console.error("Error moving shift:", err);
        showToast("Nie udało się przesunąć zmiany", "error");
        fetchShifts();
      }
    }
  };

  const handleDragStart = (event: any) => {
    setActiveDragItem(event.active.data.current);
  };

  return (
    <div className="container mx-auto py-6 px-4 h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Grafik Pracy</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Przeciągnij pracowników, aby zaplanować zmiany</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleClearDay()} disabled={clearing} variant="outline" size="sm">
            {clearing ? "Czyszczenie..." : "Wyczyść Tydzień"}
          </Button>
          <Button onClick={handleAutoAssign} disabled={autoAssigning} size="sm">
            {autoAssigning ? "Generowanie..." : "Wypełnij z Dostępności"}
          </Button>
        </div>
      </div>

      {ToastComponent}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between border border-gray-200 bg-white px-4 py-2 rounded-lg mb-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={handlePrevWeek} className="flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Poprzedni
        </Button>
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
            {format(weekStart, "d MMM", { locale: pl })} - {format(addDays(weekStart, 6), "d MMM yyyy", { locale: pl })}
          </div>
          <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs text-gray-500 hover:text-gray-700 h-6 px-2">
            Obecny tydzień
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={handleNextWeek} className="flex items-center gap-1">
          Następny <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
        <div className="flex flex-1 overflow-hidden gap-4">
          <EmployeeSidebar employees={employees} />
          <div className="flex-1 min-w-0">
            <TimeGrid 
              weekStart={weekStart} 
              shifts={shifts} 
              employees={employees}
              onShiftClick={(shift) => {
                // TODO: Open edit dialog
                console.log("Edit shift", shift);
              }}
            />
          </div>
        </div>

        <DragOverlay>
          {activeDragItem?.type === "new-shift" && (
             <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-400 shadow-lg opacity-80 w-64">
               <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-xs">
                 {activeDragItem.employee.first_name[0]}{activeDragItem.employee.last_name[0]}
               </div>
               <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                 {activeDragItem.employee.first_name} {activeDragItem.employee.last_name}
               </div>
             </div>
          )}
          {activeDragItem?.type === "existing-shift" && (
             <div className="rounded-md border p-2 bg-blue-100 border-blue-200 shadow-lg opacity-80 w-32 text-xs">
               <div className="font-semibold text-blue-900">
                 {employees.find(e => e.id === activeDragItem.shift.employee_id)?.first_name}
               </div>
             </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
