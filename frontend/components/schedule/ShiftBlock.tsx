"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Shift } from "@/lib/api";
import { timeToGridColumn, calculateGridSpan } from "@/lib/grid-math";

interface ShiftBlockProps {
  shift: Shift;
  employeeName: string;
  requirementStartTime: string; // HH:mm - used to calculate relative position
  requirementEndTime: string; // HH:mm
}

/**
 * ShiftBlock - A draggable shift block displayed on the timeline.
 * Represents an assigned employee shift that sits on top of the Ghost Bar.
 */
export function ShiftBlock({
  shift,
  employeeName,
  requirementStartTime,
  requirementEndTime,
}: ShiftBlockProps) {
  // Extract time from ISO datetime string (assumes UTC)
  const getTimeFromISO = (isoString: string): string => {
    const date = new Date(isoString);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const shiftStartTime = getTimeFromISO(shift.start_time);
  const shiftEndTime = getTimeFromISO(shift.end_time);

  // Calculate grid position relative to requirement row
  const requirementStartColumn = timeToGridColumn(requirementStartTime);
  const shiftStartColumn = timeToGridColumn(shiftStartTime);
  const shiftSpan = calculateGridSpan(shiftStartTime, shiftEndTime);

  // Calculate relative position (shift might start before requirement)
  const relativeStart = Math.max(0, shiftStartColumn - requirementStartColumn);
  const relativeEnd = relativeStart + shiftSpan;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `shift-${shift.id}`,
    data: {
      type: 'shift',
      shift,
    },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 100 : undefined,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const isAssigned = shift.employee_id !== null;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        gridColumnStart: relativeStart + 1, // CSS Grid is 1-indexed
        gridColumnEnd: relativeEnd + 1,
        gridRow: 1,
      }}
      {...listeners}
      {...attributes}
      className={`
        rounded-md border p-1.5 cursor-grab active:cursor-grabbing shadow-sm
        text-xs font-medium
        transition-opacity
        ${isAssigned
          ? "border-blue-300 bg-blue-100 dark:border-blue-700 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100"
          : "border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
        }
        ${isDragging ? "opacity-50" : ""}
      `}
      title={`${employeeName} - ${shiftStartTime} - ${shiftEndTime}`}
    >
      <div className="truncate">{employeeName}</div>
      <div className="text-[10px] opacity-75 mt-0.5">
        {shiftStartTime} - {shiftEndTime}
      </div>
    </div>
  );
}

