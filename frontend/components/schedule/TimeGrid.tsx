"use client";

import { useMemo } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { Shift, Employee } from "@/lib/api";
import { format, addDays, isSameDay, setHours, setMinutes, differenceInMinutes, startOfDay } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TimeGridProps {
  weekStart: Date;
  shifts: Shift[];
  employees: Employee[];
  onShiftClick?: (shift: Shift) => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 8); // 8:00 to 24:00
const CELL_HEIGHT = 60; // pixels per hour

function ShiftBlock({ shift, employee, onClick }: { shift: Shift; employee?: Employee; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `shift-${shift.id}`,
    data: { 
      type: "existing-shift",
      shift 
    },
  });

  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);
  
  // Calculate position and height
  // Relative to 8:00 AM
  const startHour = start.getUTCHours();
  const startMinute = start.getUTCMinutes();
  const endHour = end.getUTCHours() === 0 ? 24 : end.getUTCHours(); // Handle midnight as 24
  const endMinute = end.getUTCMinutes();

  const startOffset = (startHour - 8) * CELL_HEIGHT + (startMinute / 60) * CELL_HEIGHT;
  const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  const height = (durationMinutes / 60) * CELL_HEIGHT;

  if (startOffset < 0) return null; // Skip shifts before 8 AM for now

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        top: `${startOffset}px`,
        height: `${Math.max(height, 20)}px`, // Min height for visibility
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 10,
      }}
      className={cn(
        "absolute left-1 right-1 rounded-md border px-2 py-1 text-xs shadow-sm cursor-pointer hover:brightness-95 transition-all overflow-hidden",
        employee 
          ? "bg-blue-100 border-blue-200 text-blue-900 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-100" 
          : "bg-amber-100 border-amber-200 text-amber-900 dark:bg-amber-900/40 dark:border-amber-800 dark:text-amber-100"
      )}
    >
      <div className="font-semibold truncate">
        {employee ? `${employee.first_name} ${employee.last_name}` : "Wakat"}
      </div>
      <div className="text-[10px] opacity-80 truncate">
        {format(start, "HH:mm")} - {format(end, "HH:mm")}
      </div>
      {employee && (
        <div className="text-[10px] opacity-70 truncate mt-0.5">
          {employee.role}
        </div>
      )}
    </div>
  );
}

function DayColumn({ day, shifts, employees, onShiftClick }: { day: Date; shifts: Shift[]; employees: Employee[]; onShiftClick?: (shift: Shift) => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.toISOString()}`,
    data: { day },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative border-r border-gray-200 dark:border-gray-800 min-w-[150px] flex-1 transition-colors",
        isOver && "bg-blue-50/50 dark:bg-blue-900/10"
      )}
      style={{ height: `${HOURS.length * CELL_HEIGHT}px` }}
    >
      {/* Hour Grid Lines */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="absolute w-full border-b border-gray-100 dark:border-gray-800/50"
          style={{ top: `${(hour - 8) * CELL_HEIGHT}px`, height: `${CELL_HEIGHT}px` }}
        />
      ))}

      {/* Shifts */}
      {shifts.map((shift) => (
        <ShiftBlock
          key={shift.id}
          shift={shift}
          employee={employees.find(e => e.id === shift.employee_id)}
          onClick={() => onShiftClick?.(shift)}
        />
      ))}
    </div>
  );
}

export function TimeGrid({ weekStart, shifts, employees, onShiftClick }: TimeGridProps) {
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
      {/* Header */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <div className="w-16 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50" />
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className="flex-1 min-w-[150px] p-3 text-center border-r border-gray-200 dark:border-gray-800 last:border-r-0 bg-gray-50 dark:bg-gray-900/50"
          >
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              {format(day, "EEE", { locale: pl })}
            </div>
            <div className={cn(
              "mt-1 text-sm font-bold",
              isSameDay(day, new Date()) ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-gray-100"
            )}>
              {format(day, "d MMM", { locale: pl })}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable Grid */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="flex">
          {/* Time Labels */}
          <div className="w-16 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-20 sticky left-0">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] text-xs text-gray-400 dark:text-gray-500 text-right pr-2 -mt-2.5"
              >
                {hour}:00
              </div>
            ))}
          </div>

          {/* Days */}
          {weekDays.map((day) => {
            const dayShifts = shifts.filter(s => {
              const shiftDate = new Date(s.start_time);
              // Simple check for same day (ignoring timezone complexity for MVP visualization)
              // Ideally we check overlaps with the day's time range
              return shiftDate.getUTCDate() === day.getUTCDate() && shiftDate.getUTCMonth() === day.getUTCMonth();
            });

            return (
              <DayColumn
                key={day.toISOString()}
                day={day}
                shifts={dayShifts}
                employees={employees}
                onShiftClick={onShiftClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
