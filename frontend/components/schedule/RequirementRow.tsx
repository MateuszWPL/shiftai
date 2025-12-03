"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Requirement, Shift, Employee } from "@/lib/api";
import { ShiftBlock } from "./ShiftBlock";
import { timeToGridColumn, calculateGridSpan } from "@/lib/grid-math";

interface RequirementRowProps {
  requirement: Requirement;
  shifts: Shift[]; // Shifts assigned to this requirement
  employees: Employee[];
  selectedDate: Date; // The actual date for this requirement (calculated from week_start_date + day_of_week)
  getEmployeeName: (employeeId: number | null) => string;
}

/**
 * RequirementRow - A row in the timeline representing a demand slot.
 * Contains:
 * - A gray "Ghost Bar" showing the demand timeframe (background layer)
 * - Colored "Shift Blocks" showing assigned employees (foreground layer)
 */
export function RequirementRow({
  requirement,
  shifts,
  employees,
  selectedDate,
  getEmployeeName,
}: RequirementRowProps) {
  // Convert time string (HH:mm:ss) to HH:mm format
  const formatTime = (timeString: string): string => {
    return timeString.substring(0, 5); // Extract HH:mm from HH:mm:ss
  };

  const startTime = formatTime(requirement.start_time);
  const endTime = formatTime(requirement.end_time);

  // Calculate grid position
  const startColumn = timeToGridColumn(startTime);
  const span = calculateGridSpan(startTime, endTime);

  // Filter shifts that belong to this requirement
  // A shift belongs if it matches the date, position, and overlaps with the requirement time
  const requirementDateStr = selectedDate.toISOString().split('T')[0];
  const relevantShifts = shifts.filter((shift) => {
    const shiftDate = new Date(shift.start_time);
    const shiftDateStr = shiftDate.toISOString().split('T')[0];
    const shiftStartTime = formatTime(shift.start_time);
    const shiftEndTime = formatTime(shift.end_time);

    return (
      shiftDateStr === requirementDateStr &&
      shift.role === requirement.position_name &&
      // Check if shift overlaps with requirement
      (shiftStartTime < endTime && shiftEndTime > startTime)
    );
  });

  const { setNodeRef, isOver } = useDroppable({
    id: `requirement-${requirement.id}`,
    data: {
      type: 'requirement',
      requirement,
      selectedDate,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        relative h-16 border-b border-gray-200 dark:border-gray-700
        ${isOver ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}
      `}
    >
      {/* Row Label (Left Side) */}
      <div className="absolute left-0 top-0 bottom-0 w-48 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center px-3 z-10">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {requirement.position_name}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {startTime} - {endTime} ({requirement.headcount} {requirement.headcount === 1 ? 'osoba' : 'osoby'})
          </div>
        </div>
      </div>

      {/* Timeline Grid Area (Right Side) */}
      <div className="ml-48 h-full relative">
        {/* Ghost Bar (Background Layer) */}
        <div
          className="absolute top-2 bottom-2 rounded bg-gray-200 dark:bg-gray-700 opacity-40"
          style={{
            left: `${(startColumn / 96) * 100}%`,
            width: `${(span / 96) * 100}%`,
          }}
        />

        {/* Shift Blocks (Foreground Layer) */}
        <div className="absolute inset-0 grid grid-cols-[repeat(96,minmax(0,1fr))] gap-0">
          {relevantShifts.map((shift) => (
            <ShiftBlock
              key={shift.id}
              shift={shift}
              employeeName={getEmployeeName(shift.employee_id)}
              requirementStartTime={startTime}
              requirementEndTime={endTime}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

