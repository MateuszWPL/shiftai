"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { addDays, format, parseISO } from "date-fns";
import type { Requirement, Shift, Employee, Availability } from "@/lib/api";
import { requirementsApi, shiftsApi, availabilityApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { getTimeFromXCoordinate, calculateAutoCut, timeToGridColumn } from "@/lib/grid-math";
import { RequirementRow } from "./RequirementRow";
import { EmployeeSidebar } from "./EmployeeSidebar";

interface TimelineBoardProps {
  organizationId: number;
  weekStartDate: Date; // Monday of the week
  selectedDate: Date; // The specific date to display (defaults to Monday)
  employees: Employee[];
  onShiftCreated?: (shift: Shift) => void;
}

/**
 * TimelineBoard - The main timeline component with role-centric view.
 * Rows represent Requirements (demand slots), not employees.
 * X-axis: Time (00:00-24:00) with 15-minute granularity (96 columns).
 */
export function TimelineBoard({
  organizationId,
  weekStartDate,
  selectedDate,
  employees,
  onShiftCreated,
}: TimelineBoardProps) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [availabilities, setAvailabilities] = useState<Map<number, Availability[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();

  // Pointer sensor for drag & drop (works on touch devices)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  // Fetch requirements for the selected week
  const fetchRequirements = useCallback(async () => {
    try {
      const data = await requirementsApi.getAll(organizationId);
      // Filter requirements for the selected week
      // Requirements have week_start_date (Monday) that should match exactly
      const weekStartStr = weekStartDate.toISOString().split('T')[0];

      const weekRequirements = data.filter((req) => {
        // Normalize both dates to YYYY-MM-DD format for comparison
        // Handle both date strings (YYYY-MM-DD) and datetime strings (YYYY-MM-DDTHH:mm:ss)
        const reqWeekStart = req.week_start_date.includes('T')
          ? req.week_start_date.split('T')[0]
          : req.week_start_date;
        return reqWeekStart === weekStartStr;
      });

      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log('Requirements fetch:', {
          total: data.length,
          weekStart: weekStartStr,
          filtered: weekRequirements.length,
          allWeekStarts: data.map(r => r.week_start_date),
        });
      }

      setRequirements(weekRequirements);
    } catch (err) {
      console.error("Error fetching requirements:", err);
      showToast("Nie udało się pobrać zapotrzebowania", "error");
    }
  }, [organizationId, weekStartDate, showToast]);

  // Fetch shifts for the selected date
  const fetchShifts = useCallback(async () => {
    try {
      const data = await shiftsApi.getAll(organizationId);
      // Filter shifts for the selected date
      const dateStr = selectedDate.toISOString().split('T')[0];
      const dayShifts = data.filter((shift) => {
        const shiftDate = new Date(shift.start_time);
        return shiftDate.toISOString().split('T')[0] === dateStr;
      });
      setShifts(dayShifts);
    } catch (err) {
      console.error("Error fetching shifts:", err);
      showToast("Nie udało się pobrać zmian", "error");
    }
  }, [organizationId, selectedDate, showToast]);

  // Fetch availabilities for employees for the selected date
  const fetchAvailabilities = useCallback(async () => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const nextDayStr = addDays(selectedDate, 1).toISOString().split('T')[0];

    const availabilityMap = new Map<number, Availability[]>();

    await Promise.all(
      employees.map(async (employee) => {
        try {
          const data = await availabilityApi.get(employee.id, dateStr, nextDayStr);
          // Filter for the exact date
          const dayAvailabilities = data.filter((avail) => {
            const availDate = new Date(avail.start_time);
            return availDate.toISOString().split('T')[0] === dateStr;
          });
          if (dayAvailabilities.length > 0) {
            availabilityMap.set(employee.id, dayAvailabilities);
          }
        } catch (err) {
          console.error(`Error fetching availability for employee ${employee.id}:`, err);
        }
      })
    );

    setAvailabilities(availabilityMap);
  }, [employees, selectedDate]);

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRequirements(), fetchShifts(), fetchAvailabilities()]);
      setLoading(false);
    };
    loadData();
  }, [fetchRequirements, fetchShifts, fetchAvailabilities]);

  // Get employee name helper
  const getEmployeeName = useCallback(
    (employeeId: number | null): string => {
      if (employeeId === null) return "Wakat";
      const employee = employees.find((emp) => emp.id === employeeId);
      return employee ? `${employee.first_name} ${employee.last_name}` : `Pracownik #${employeeId}`;
    },
    [employees]
  );

  // Get employee availability for a specific date
  const getEmployeeAvailability = useCallback(
    (employeeId: number, date: Date): { start: string; end: string } | null => {
      const dateStr = date.toISOString().split('T')[0];
      const employeeAvailabilities = availabilities.get(employeeId) || [];

      // Find availability that matches the date
      const matchingAvailability = employeeAvailabilities.find((avail) => {
        const availDate = new Date(avail.start_time);
        return availDate.toISOString().split('T')[0] === dateStr;
      });

      if (!matchingAvailability) return null;

      // Extract time from ISO string
      const getTime = (isoString: string): string => {
        const date = new Date(isoString);
        return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
      };

      return {
        start: getTime(matchingAvailability.start_time),
        end: getTime(matchingAvailability.end_time),
      };
    },
    [availabilities]
  );

  // Filter requirements for the selected date
  const dayOfWeek = selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1; // Convert to 0=Monday, 6=Sunday
  const dayRequirements = useMemo(() => {
    return requirements.filter((req) => req.day_of_week === dayOfWeek);
  }, [requirements, dayOfWeek]);

  // Generate time header labels (every hour)
  const timeHeaders = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const hours = String(i).padStart(2, '0');
      return `${hours}:00`;
    });
  }, []);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id.toString());
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;

    if (!over) return;

    // Check if we're dropping an employee onto a requirement
    if (active.id.toString().startsWith('employee-') && over.id.toString().startsWith('requirement-')) {
      const employeeId = parseInt(active.id.toString().replace('employee-', ''));
      const requirementId = parseInt(over.id.toString().replace('requirement-', ''));

      const employee = employees.find((emp) => emp.id === employeeId);
      const requirement = requirements.find((req) => req.id === requirementId);

      if (!employee || !requirement) return;

      // Format requirement times (HH:mm:ss -> HH:mm)
      const formatTime = (timeString: string): string => timeString.substring(0, 5);
      const requirementStart = formatTime(requirement.start_time);
      const requirementEnd = formatTime(requirement.end_time);

      // Get drop position from mouse coordinates
      const containerElement = document.querySelector('[data-timeline-container]') as HTMLElement;
      if (!containerElement) return;

      // Get drop coordinates - try to get from the event, fallback to center
      let dropX: number;
      if (event.activatorEvent && 'clientX' in event.activatorEvent) {
        dropX = (event.activatorEvent as PointerEvent).clientX;
      } else {
        // Fallback: drop at the start of the requirement
        const rect = containerElement.getBoundingClientRect();
        const startColumn = timeToGridColumn(requirementStart);
        dropX = rect.left + (startColumn / 96) * rect.width;
      }

      const dropTime = getTimeFromXCoordinate(dropX, containerElement, 96);
      if (!dropTime) return;

      // Validate drop time is within requirement range
      if (dropTime < requirementStart || dropTime >= requirementEnd) {
        showToast("Nie można przypisać poza zakresem zapotrzebowania", "error");
        return;
      }

      // Get employee availability
      const availability = getEmployeeAvailability(employeeId, selectedDate);

      // Calculate auto-cut end time
      const shiftStart = dropTime;
      const shiftEnd = calculateAutoCut(
        dropTime,
        requirementEnd,
        availability?.end || null
      );

      if (!shiftEnd || shiftStart >= shiftEnd) {
        showToast("Pracownik nie jest dostępny w tym czasie", "error");
        return;
      }

      // Create shift
      try {
        // Convert times to ISO datetime strings for the selected date
        const dateStr = selectedDate.toISOString().split('T')[0];
        const [startHours, startMinutes] = shiftStart.split(':').map(Number);
        const [endHours, endMinutes] = shiftEnd.split(':').map(Number);

        const startDateTime = new Date(`${dateStr}T${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}:00Z`);
        const endDateTime = new Date(`${dateStr}T${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:00Z`);

        // Handle overnight shifts (if end time is earlier than start time, it's next day)
        if (endDateTime <= startDateTime) {
          endDateTime.setUTCDate(endDateTime.getUTCDate() + 1);
        }

        // Create shift via API (create open shift, then assign employee)
        // First create an open shift using createDemand
        const createdShifts = await shiftsApi.createDemand(organizationId, {
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          role: requirement.position_name,
          count: 1,
        });

        if (createdShifts.length === 0) {
          throw new Error("Failed to create shift");
        }

        const openShift = createdShifts[0];
        const optimisticShiftId = openShift.id;

        // Optimistic update
        const optimisticShift: Shift = {
          ...openShift,
          employee_id: employeeId,
        };
        setShifts((prev) => [...prev, optimisticShift]);

        // Update the shift to assign the employee
        const createdShift = await shiftsApi.update(openShift.id, {
          employee_id: employeeId,
        });

        // Replace optimistic shift with real one
        setShifts((prev) => prev.filter((s) => s.id !== optimisticShiftId));
        setShifts((prev) => [...prev, createdShift]);
        onShiftCreated?.(createdShift);

        showToast(`Przypisano ${employee.first_name} ${employee.last_name}`, "success");
        await fetchShifts(); // Refresh to get accurate data
      } catch (err) {
        console.error("Error creating shift:", err);
        showToast("Nie udało się utworzyć zmiany", "error");
        // Revert optimistic update - fetch fresh data
        await fetchShifts();
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-500 dark:text-gray-400">Ładowanie...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Employee Sidebar */}
        <EmployeeSidebar
          employees={employees}
          selectedDate={selectedDate}
          getEmployeeAvailability={getEmployeeAvailability}
        />

        {/* Timeline Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Time Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="h-12 flex">
              {/* Label column */}
              <div className="w-48 border-r border-gray-200 dark:border-gray-700 flex items-center px-3">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {format(selectedDate, "EEEE, d MMM yyyy")}
                </span>
              </div>
              {/* Time columns */}
              <div className="flex-1 grid grid-cols-[repeat(96,minmax(0,1fr))] relative">
                {timeHeaders.map((time, idx) => {
                  const column = idx * 4; // Each hour = 4 columns (15min intervals)
                  return (
                    <div
                      key={time}
                      className="border-r border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 px-1"
                      style={{ gridColumnStart: column + 1, gridColumnEnd: column + 5 }}
                    >
                      {time}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Requirements Rows */}
          <div className="flex-1 overflow-y-auto" data-timeline-container>
            {dayRequirements.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Brak zapotrzebowania dla tego dnia
                </div>
              </div>
            ) : (
              dayRequirements.map((requirement) => (
                <RequirementRow
                  key={requirement.id}
                  requirement={requirement}
                  shifts={shifts}
                  employees={employees}
                  selectedDate={selectedDate}
                  getEmployeeName={getEmployeeName}
                />
              ))
            )}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDragId?.startsWith('employee-') ? (
            <div className="rounded-md border border-green-300 bg-green-50 p-3 shadow-lg">
              <div className="text-sm font-medium">Przeciągnij pracownika</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {ToastComponent}
    </div>
  );
}

