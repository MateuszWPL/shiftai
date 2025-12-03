"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO, addDays } from "date-fns";
import type { Employee, Availability } from "@/lib/api";

interface AvailabilitySidebarProps {
  employees: Employee[];
  availabilities: Availability[];
  weekStart: Date;
}

export function AvailabilitySidebar({ employees, availabilities, weekStart }: AvailabilitySidebarProps) {
  // Group availabilities by employee
  const availabilitiesByEmployee = new Map<number, Availability[]>();
  for (const avail of availabilities) {
    if (!availabilitiesByEmployee.has(avail.employee_id)) {
      availabilitiesByEmployee.set(avail.employee_id, []);
    }
    availabilitiesByEmployee.get(avail.employee_id)!.push(avail);
  }

  // Get employee name
  const getEmployeeName = (employeeId: number): string => {
    const employee = employees.find(e => e.id === employeeId);
    return employee ? `${employee.first_name} ${employee.last_name}` : `Pracownik #${employeeId}`;
  };

  // Get employee role
  const getEmployeeRole = (employeeId: number): string => {
    const employee = employees.find(e => e.id === employeeId);
    return employee ? employee.role : '';
  };

  // Format time from datetime string
  const formatTime = (dateString: string): string => {
    const date = parseISO(dateString);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Get day name from date
  const getDayName = (date: Date): string => {
    return format(date, 'EEE');
  };

  return (
    <div className="w-80 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Dyspozycyjności
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Przeciągnij do kalendarza
        </p>
      </div>
      <div className="overflow-y-auto max-h-[calc(100vh-200px)] p-4 space-y-4">
        {employees.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
            Brak pracowników
          </p>
        ) : (
          employees.map((employee) => {
            const employeeAvailabilities = availabilitiesByEmployee.get(employee.id) || [];
            
            if (employeeAvailabilities.length === 0) {
              return null; // Don't show employees without availability
            }

            return (
              <div key={employee.id} className="space-y-2">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {employee.first_name} {employee.last_name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {employee.role}
                </div>
                <div className="space-y-1">
                  {employeeAvailabilities.map((avail) => {
                    const availDate = parseISO(avail.start_time);
                    const dayName = getDayName(availDate);
                    const startTime = formatTime(avail.start_time);
                    const endTime = formatTime(avail.end_time);

                    return (
                      <DraggableAvailability
                        key={avail.id}
                        availability={avail}
                        employeeName={`${employee.first_name} ${employee.last_name}`}
                        employeeRole={employee.role}
                        dayName={dayName}
                        startTime={startTime}
                        endTime={endTime}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

interface DraggableAvailabilityProps {
  availability: Availability;
  employeeName: string;
  employeeRole: string;
  dayName: string;
  startTime: string;
  endTime: string;
}

function DraggableAvailability({
  availability,
  employeeName,
  employeeRole,
  dayName,
  startTime,
  endTime,
}: DraggableAvailabilityProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `availability-${availability.id}`,
    data: { availability },
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : undefined,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  // Color based on preference score
  const getColorClass = (score: number) => {
    if (score >= 8) return "border-green-400 bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200";
    if (score >= 5) return "border-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200";
    return "border-orange-400 bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-200";
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-md border-2 p-2 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${getColorClass(availability.preference_score)}`}
    >
      <div className="text-xs font-semibold truncate">
        {dayName} {startTime} - {endTime}
      </div>
      <div className="text-xs mt-1 opacity-80">
        {employeeRole}
      </div>
    </div>
  );
}

