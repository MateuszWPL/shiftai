"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { requirementsApi, employeesApi, availabilityApi, shiftsApi, ApiClientError, type Requirement, type Employee, type Availability, type Shift } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { format, startOfWeek, addDays, subWeeks, addWeeks, parseISO, getDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { EditRequirementDialog } from "@/components/schedule/EditRequirementDialog";
import { AvailabilitySidebar } from "@/components/schedule/AvailabilitySidebar";
import { useAuth } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";

// Helper to get day of week (0=Monday, 6=Sunday)
const getDayOfWeek = (date: Date): number => {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
};

// Helper to format time from datetime string
const formatTime = (dateString: string): string => {
  const date = parseISO(dateString);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Helper to format time from time string (HH:mm:ss)
const formatTimeString = (timeString: string): string => {
  return timeString.substring(0, 5);
};

// Helper to calculate hour from time string
const getHourFromTime = (timeString: string): number => {
  return parseInt(timeString.split(':')[0]);
};

// Helper to calculate minute from time string
const getMinuteFromTime = (timeString: string): number => {
  return parseInt(timeString.split(':')[1]);
};

// Draggable Requirement Component
interface DraggableRequirementProps {
  requirement: Requirement;
  weekStart: Date;
}

function DraggableRequirement({ requirement, weekStart }: DraggableRequirementProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `requirement-${requirement.id}`,
    data: { requirement },
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : undefined,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  const dayDate = addDays(weekStart, requirement.day_of_week);
  const startTime = formatTimeString(requirement.start_time);
  const endTime = formatTimeString(requirement.end_time);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="rounded-md border-2 border-blue-400 bg-blue-100 dark:bg-blue-900/30 p-2 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="text-xs font-semibold text-blue-900 dark:text-blue-200">
        {requirement.position_name}
      </div>
      <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
        {startTime} - {endTime}
      </div>
      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
        {requirement.headcount} {requirement.headcount === 1 ? 'osoba' : 'osoby'}
      </div>
    </div>
  );
}

// Droppable Day Cell Component
interface DroppableDayCellProps {
  day: Date;
  dayIndex: number;
  hour: number;
  requirements: Requirement[];
  weekStart: Date;
  onRequirementClick: (req: Requirement) => void;
}

function DroppableDayCell({ day, dayIndex, hour, requirements, weekStart, onRequirementClick }: DroppableDayCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayIndex}-hour-${hour}`,
    data: { day, hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={`h-[32px] border-r border-b border-gray-200 dark:border-gray-700 p-0.5 relative ${
        isOver ? "bg-blue-50 dark:bg-blue-900/10" : ""
      }`}
    >
      {/* Empty cell - requirements are rendered separately with row-span */}
    </div>
  );
}

export default function SchedulePage() {
  const { user } = useAuth();
  const organizationId = user?.organization_id;
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Calculate current week start (Monday)
  const getCurrentWeekStart = useCallback((): Date => {
    const now = new Date();
    return startOfWeek(now, { weekStartsOn: 1 }); // 1 = Monday
  }, []);

  const weekStart = useMemo(() => {
    return selectedWeekStart || getCurrentWeekStart();
  }, [selectedWeekStart, getCurrentWeekStart]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Hours from 0 to 23
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const fetchRequirements = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const data = await requirementsApi.getAll(organizationId);
      // Filter for current week
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekRequirements = data.filter(req => {
        const reqWeekStart = req.week_start_date.includes('T')
          ? req.week_start_date.split('T')[0]
          : req.week_start_date;
        return reqWeekStart === weekStartStr;
      });
      setRequirements(weekRequirements);
    } catch (err) {
      console.error("Error fetching requirements:", err);
      setError("Nie udało się pobrać zapotrzebowania");
      showToast("Nie udało się pobrać zapotrzebowania", "error");
    }
  }, [organizationId, weekStart, showToast]);

  const fetchEmployees = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const data = await employeesApi.getAll(organizationId);
      setEmployees(data);
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  }, [organizationId]);

  const fetchAvailabilities = useCallback(async () => {
    try {
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekEnd = addDays(weekStart, 7);
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

      // Fetch availability for all employees for the week
      const allAvailabilities: Availability[] = [];
      for (const employee of employees) {
        try {
          const data = await availabilityApi.get(employee.id, weekStartStr, weekEndStr);
          allAvailabilities.push(...data);
        } catch (err) {
          console.error(`Error fetching availability for employee ${employee.id}:`, err);
        }
      }
      setAvailabilities(allAvailabilities);
    } catch (err) {
      console.error("Error fetching availabilities:", err);
    }
  }, [weekStart, employees]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      await fetchEmployees();
      setLoading(false);
    };
    loadData();
  }, [fetchEmployees]);

  useEffect(() => {
    if (employees.length > 0) {
      fetchRequirements();
      fetchAvailabilities();
    }
  }, [weekStart, employees, fetchRequirements, fetchAvailabilities]);

  const handlePrevWeek = useCallback(() => {
    setSelectedWeekStart(subWeeks(weekStart, 1));
  }, [weekStart]);

  const handleNextWeek = useCallback(() => {
    setSelectedWeekStart(addWeeks(weekStart, 1));
  }, [weekStart]);

  const handleToday = useCallback(() => {
    setSelectedWeekStart(null);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id.toString());
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;

    if (!over) return;

    // Handle requirement drag
    if (active.id.toString().startsWith('requirement-')) {
      const requirementId = parseInt(active.id.toString().replace('requirement-', ''));
      const requirement = requirements.find(r => r.id === requirementId);
      if (!requirement) return;

      // Parse drop target (day-hour)
      const overId = over.id.toString();
      if (overId.startsWith('day-')) {
        const match = overId.match(/day-(\d+)-hour-(\d+)/);
        if (match) {
          const dayIndex = parseInt(match[1]);
          const newDay = weekDays[dayIndex];
          const newDayOfWeek = getDayOfWeek(newDay);

          // Only update if day changed
          if (requirement.day_of_week !== newDayOfWeek) {
            try {
              await requirementsApi.update(requirement.id, {
                day_of_week: newDayOfWeek,
              });
              showToast("Zapotrzebowanie przeniesione", "success");
              await fetchRequirements();
            } catch (err) {
              console.error("Error updating requirement:", err);
              showToast("Nie udało się zaktualizować zapotrzebowania", "error");
            }
          }
        }
      }
    }

    // Handle availability drag to create shift
    if (active.id.toString().startsWith('availability-')) {
      const availabilityId = parseInt(active.id.toString().replace('availability-', ''));
      const availability = availabilities.find(a => a.id === availabilityId);
      if (!availability) return;

      const overId = over.id.toString();
      if (overId.startsWith('day-')) {
        const match = overId.match(/day-(\d+)-hour-(\d+)/);
        if (match) {
          const dayIndex = parseInt(match[1]);
          const hour = parseInt(match[2]);
          const targetDay = weekDays[dayIndex];

          // Find matching requirement for this day and hour
          const dayOfWeek = getDayOfWeek(targetDay);
          const matchingRequirement = requirements.find(req => {
            if (req.day_of_week !== dayOfWeek) return false;
            const reqStartHour = getHourFromTime(req.start_time);
            const reqEndHour = getHourFromTime(req.end_time);
            return reqStartHour <= hour && reqEndHour > hour;
          });

          if (!matchingRequirement) {
            showToast("Brak zapotrzebowania dla tego czasu", "error");
            return;
          }

          // Check if availability matches requirement time
          const availStart = parseISO(availability.start_time);
          const availEnd = parseISO(availability.end_time);
          const reqStartTime = formatTimeString(matchingRequirement.start_time);
          const reqEndTime = formatTimeString(matchingRequirement.end_time);

          // Create shift from availability
          try {
            const targetDateStr = format(targetDay, 'yyyy-MM-dd');
            const [reqStartHour, reqStartMin] = reqStartTime.split(':').map(Number);
            const [reqEndHour, reqEndMin] = reqEndTime.split(':').map(Number);

            const startDateTime = new Date(`${targetDateStr}T${String(reqStartHour).padStart(2, '0')}:${String(reqStartMin).padStart(2, '0')}:00Z`);
            let endDateTime = new Date(`${targetDateStr}T${String(reqEndHour).padStart(2, '0')}:${String(reqEndMin).padStart(2, '0')}:00Z`);

            // Handle overnight shifts
            if (endDateTime <= startDateTime) {
              endDateTime = addDays(endDateTime, 1);
            }

            // Use availability time if it's within requirement
            const availStartHour = availStart.getUTCHours();
            const availStartMin = availStart.getUTCMinutes();
            const availEndHour = availEnd.getUTCHours();
            const availEndMin = availEnd.getUTCMinutes();

            const actualStart = new Date(startDateTime);
            if (availStartHour > reqStartHour || (availStartHour === reqStartHour && availStartMin > reqStartMin)) {
              actualStart.setUTCHours(availStartHour, availStartMin);
            }

            const actualEnd = new Date(endDateTime);
            if (availEndHour < reqEndHour || (availEndHour === reqEndHour && availEndMin < reqEndMin)) {
              actualEnd.setUTCHours(availEndHour, availEndMin);
            }

            // Create shift
            if (!organizationId) {
              showToast("Brak przypisania do zespołu", "error");
              return;
            }
            
            const createdShifts = await shiftsApi.createDemand(organizationId, {
              start_time: actualStart.toISOString(),
              end_time: actualEnd.toISOString(),
              role: matchingRequirement.position_name,
              count: 1,
            });

            if (createdShifts.length === 0) {
              throw new Error("Failed to create shift");
            }

            const openShift = createdShifts[0];
            await shiftsApi.update(openShift.id, {
              employee_id: availability.employee_id,
            });

            showToast("Przypisano pracownika do zmiany", "success");
            // Refresh data
            await fetchRequirements();
          } catch (err) {
            console.error("Error creating shift:", err);
            showToast("Nie udało się utworzyć zmiany", "error");
          }
        }
      }
    }
  };

  const handleRequirementClick = (req: Requirement) => {
    setEditingRequirement(req);
  };

  const handleRequirementSaved = async () => {
    setEditingRequirement(null);
    await fetchRequirements();
    showToast("Zapotrzebowanie zaktualizowane", "success");
  };

  const handleRequirementDeleted = async () => {
    setEditingRequirement(null);
    await fetchRequirements();
    showToast("Zapotrzebowanie usunięte", "success");
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
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Grafik Pracy</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Ręczne zarządzanie grafikiem</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEditingRequirement({} as Requirement)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Dodaj Zapotrzebowanie
          </Button>
          <Button onClick={handlePrevWeek} variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[200px]">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
              {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </div>
            <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs text-gray-500 hover:text-gray-700">
              Dzisiaj
            </Button>
          </div>
          <Button onClick={handleNextWeek} variant="outline" size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-center text-gray-500 dark:text-gray-400">Ładowanie...</div>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4">
            {/* Main Calendar Grid */}
            <div className="flex-1 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
              <div className="overflow-auto max-h-[calc(100vh-250px)]">
                <div className="inline-block min-w-full relative">
                  <div className="grid grid-cols-[50px_repeat(7,1fr)]">
                    {/* Header row */}
                    <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-r border-b border-gray-200 dark:border-gray-700 p-1"></div>
                    {weekDays.map((day, idx) => (
                      <div
                        key={idx}
                        className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-r border-b border-gray-200 dark:border-gray-700 p-1.5 text-center last:border-r-0"
                      >
                        <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                          {format(day, "EEE")}
                        </div>
                        <div className="text-xs font-semibold text-gray-900 dark:text-gray-50">
                          {format(day, "d MMM")}
                        </div>
                      </div>
                    ))}
                    
                    {/* Hour rows with cells */}
                    {hours.map((hour) => (
                      <div key={`hour-row-${hour}`} className="contents">
                        <div
                          className="sticky left-0 z-10 bg-white dark:bg-gray-900 border-r border-b border-gray-200 dark:border-gray-700 p-0.5 text-center"
                        >
                          <div className="text-[9px] font-medium text-gray-500 dark:text-gray-400 leading-tight">
                            {String(hour).padStart(2, '0')}:00
                          </div>
                        </div>
                        {weekDays.map((day, dayIdx) => (
                          <DroppableDayCell
                            key={`${hour}-${dayIdx}`}
                            day={day}
                            dayIndex={dayIdx}
                            hour={hour}
                            requirements={requirements}
                            weekStart={weekStart}
                            onRequirementClick={handleRequirementClick}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  
                  {/* Requirements overlay - positioned absolutely over the grid */}
                  {weekDays.map((day, dayIdx) => {
                    const dayOfWeek = getDayOfWeek(day);
                    const dayRequirements = requirements.filter(req => req.day_of_week === dayOfWeek);
                    
                    return dayRequirements.map((req) => {
                      const reqStartHour = getHourFromTime(req.start_time);
                      const reqStartMinute = getMinuteFromTime(req.start_time);
                      const reqEndHour = getHourFromTime(req.end_time);
                      const reqEndMinute = getMinuteFromTime(req.end_time);
                      
                      const reqStartMinutes = reqStartHour * 60 + reqStartMinute;
                      const reqEndMinutes = reqEndHour * 60 + reqEndMinute;
                      const durationMinutes = reqEndMinutes - reqStartMinutes;
                      const topOffset = (reqStartMinutes / 60) * 32; // 32px per hour
                      const height = (durationMinutes / 60) * 32;
                      
                      // Calculate left position: 50px (hour column) + dayIdx * (100% / 7)
                      const leftPercent = (100 / 7) * dayIdx;
                      const leftOffset = `calc(50px + ${leftPercent}%)`;
                      const width = `calc(${100 / 7}% - 4px)`;
                      
                      return (
                        <div
                          key={`req-${req.id}-day-${dayIdx}`}
                          onClick={() => handleRequirementClick(req)}
                          className="absolute rounded border-2 border-blue-400 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-1 cursor-pointer hover:shadow-md transition-shadow z-20 flex flex-col justify-center pointer-events-auto"
                          style={{
                            top: `${topOffset + 33}px`, // +33 for header row (approx)
                            left: leftOffset,
                            width: width,
                            height: `${Math.max(32, height)}px`,
                          }}
                        >
                          <div className="text-[9px] font-semibold text-blue-900 dark:text-blue-200 truncate leading-tight">
                            {req.position_name}
                          </div>
                          <div className="text-[8px] text-blue-700 dark:text-blue-300 leading-tight">
                            {formatTimeString(req.start_time)}-{formatTimeString(req.end_time)} ({req.headcount})
                          </div>
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            </div>

            {/* Availability Sidebar */}
            <AvailabilitySidebar
              employees={employees}
              availabilities={availabilities}
              weekStart={weekStart}
            />
          </div>

          <DragOverlay>
            {activeDragId?.startsWith('requirement-') ? (
              <div className="rounded-md border-2 border-blue-400 bg-blue-100 dark:bg-blue-900/30 p-2 shadow-lg">
                <div className="text-xs font-semibold text-blue-900 dark:text-blue-200">Zapotrzebowanie</div>
              </div>
            ) : activeDragId?.startsWith('availability-') ? (
              <div className="rounded-md border-2 border-green-400 bg-green-100 dark:bg-green-900/30 p-2 shadow-lg">
                <div className="text-xs font-semibold text-green-900 dark:text-green-200">Dyspozycyjność</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {editingRequirement && (
        <EditRequirementDialog
          requirement={editingRequirement}
          open={!!editingRequirement}
          onOpenChange={(open) => !open && setEditingRequirement(null)}
          onSaved={handleRequirementSaved}
          onDeleted={handleRequirementDeleted}
          organizationId={organizationId!}
          weekStart={weekStart}
          availableRoles={Array.from(new Set(employees.map(e => e.role)))}
        />
      )}

      {ToastComponent}
      </div>
    </AuthGuard>
  );
}
