"use client";

import { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Employee } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmployeeSidebarProps {
  employees: Employee[];
}

function DraggableEmployee({ employee }: { employee: Employee }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new-shift-employee-${employee.id}`,
    data: { 
      type: "new-shift",
      employee 
    },
  });

  const style = isDragging ? {
    opacity: 0.5,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className="flex items-center gap-3 p-3 mb-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing hover:border-blue-400 dark:hover:border-blue-500 transition-colors shadow-sm"
    >
      <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 font-medium text-xs">
        {employee.first_name[0]}{employee.last_name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate text-gray-900 dark:text-gray-100">
          {employee.first_name} {employee.last_name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {employee.role}
        </div>
      </div>
    </div>
  );
}

export function EmployeeSidebar({ employees }: EmployeeSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const roles = useMemo(() => {
    const uniqueRoles = new Set(employees.map(e => e.role));
    return Array.from(uniqueRoles).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const matchesSearch = 
        employee.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.last_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = selectedRole ? employee.role === selectedRole : true;

      return matchesSearch && matchesRole;
    });
  }, [employees, searchQuery, selectedRole]);

  return (
    <div className="h-full flex flex-col bg-gray-50/50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-800 w-80">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-4">
        <div>
          <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-50">Pracownicy</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Przeciągnij na kalendarz</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
          <Input
            placeholder="Szukaj pracownika..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge 
            variant={selectedRole === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedRole(null)}
          >
            Wszyscy
          </Badge>
          {roles.map(role => (
            <Badge
              key={role}
              variant={selectedRole === role ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedRole(selectedRole === role ? null : role)}
            >
              {role}
            </Badge>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-1">
          {filteredEmployees.map(employee => (
            <DraggableEmployee key={employee.id} employee={employee} />
          ))}
          
          {filteredEmployees.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              Brak pracowników spełniających kryteria
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
