"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Employee } from "@/lib/api";

interface EmployeeSidebarProps {
  employees: Employee[];
  selectedDate: Date; // The date for which we're checking availability
  getEmployeeAvailability: (employeeId: number, date: Date) => { start: string; end: string } | null;
}

/**
 * EmployeeSidebar - A sidebar containing draggable employee items.
 * Employees can be dragged from here onto requirement rows in the timeline.
 */
export function EmployeeSidebar({
  employees,
  selectedDate,
  getEmployeeAvailability,
}: EmployeeSidebarProps) {
  return (
    <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Pracownicy
      </h3>
      <div className="space-y-2">
        {employees.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
            Brak pracowników
          </p>
        ) : (
          employees.map((employee) => {
            const availability = getEmployeeAvailability(employee.id, selectedDate);
            const isAvailable = availability !== null;

            return (
              <DraggableEmployee
                key={employee.id}
                employee={employee}
                availability={availability}
                isAvailable={isAvailable}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

interface DraggableEmployeeProps {
  employee: Employee;
  availability: { start: string; end: string } | null;
  isAvailable: boolean;
}

function DraggableEmployee({
  employee,
  availability,
  isAvailable,
}: DraggableEmployeeProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `employee-${employee.id}`,
    data: {
      type: 'employee',
      employee,
      availability,
    },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 100 : undefined,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        rounded-md border p-3 cursor-grab active:cursor-grabbing shadow-sm
        transition-opacity
        ${isAvailable
          ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30"
          : "border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-700/50 opacity-60"
        }
        ${isDragging ? "opacity-50" : ""}
      `}
    >
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {employee.first_name} {employee.last_name}
      </div>
      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
        {employee.role}
      </div>
      {availability && (
        <div className="text-xs text-green-700 dark:text-green-300 mt-1">
          Dostępny: {availability.start} - {availability.end}
        </div>
      )}
      {!isAvailable && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Niedostępny
        </div>
      )}
    </div>
  );
}

