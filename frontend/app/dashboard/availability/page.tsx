"use client";

import { useEffect, useState, useCallback } from "react";
import { employeesApi, availabilityApi, type Employee, type Availability } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api";

const ORGANIZATION_ID = 1;

export default function AvailabilityPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [endsNextDay, setEndsNextDay] = useState(false);
  const [preferenceScore, setPreferenceScore] = useState(10);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const { showToast, ToastComponent } = useToast();

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const data = await employeesApi.getAll(ORGANIZATION_ID);
        setEmployees(data);
        // Auto-select first employee if available
        if (data.length > 0 && !selectedEmployeeId) {
          setSelectedEmployeeId(data[0].id);
        }
      } catch (err) {
        console.error("Error fetching employees:", err);
        showToast(
          err instanceof Error ? err.message : "Failed to fetch employees",
          "error"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  // Fetch availability when employee is selected
  const fetchAvailability = useCallback(async (employeeId: number) => {
    try {
      const data = await availabilityApi.get(employeeId);
      setAvailabilities(data);
    } catch (err) {
      console.error("Error fetching availability:", err);
      showToast(
        err instanceof Error ? err.message : "Failed to fetch availability",
        "error"
      );
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchAvailability(selectedEmployeeId);
    } else {
      setAvailabilities([]);
    }
  }, [selectedEmployeeId, fetchAvailability]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEmployeeId || !selectedDate) {
      showToast("Proszę wybrać pracownika i datę", "error");
      return;
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      showToast("Proszę podać poprawny czas w formacie GG:MM", "error");
      return;
    }

    // Combine date and time - use UTC to match backend
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    
    // Create dates in UTC to avoid timezone issues
    // Use UTC methods to get the date components, not local time
    const startDateTime = new Date(Date.UTC(
      selectedDate.getUTCFullYear(),
      selectedDate.getUTCMonth(),
      selectedDate.getUTCDate(),
      startHour,
      startMinute,
      0
    ));
    
    // Calculate end date - add 1 day if endsNextDay is checked
    // Use UTC methods to get the date components
    const endDateDay = endsNextDay 
      ? selectedDate.getUTCDate() + 1
      : selectedDate.getUTCDate();
    
    const endDateTime = new Date(Date.UTC(
      selectedDate.getUTCFullYear(),
      selectedDate.getUTCMonth(),
      endDateDay,
      endHour,
      endMinute,
      0
    ));

    // Validate time range (if not ending next day, end must be after start)
    if (!endsNextDay && endDateTime <= startDateTime) {
      showToast("Czas zakończenia musi być po czasie rozpoczęcia", "error");
      return;
    }
    
    // If ending next day, validate that end time is reasonable (e.g., not more than 24 hours later)
    if (endsNextDay) {
      const hoursDiff = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 24) {
        showToast("Dostępność nie może przekraczać 24 godzin", "error");
        return;
      }
      if (hoursDiff <= 0) {
        showToast("Czas zakończenia musi być po czasie rozpoczęcia", "error");
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        availabilities: [
          {
            employee_id: selectedEmployeeId,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            preference_score: preferenceScore,
          },
        ],
      };

      // Debug: log what we're sending
      console.log("Creating availability:", {
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
        endsNextDay,
        selectedDate: selectedDate.toISOString(),
      });

      await availabilityApi.create(payload);
      
      // Reset form
      setStartTime("09:00");
      setEndTime("17:00");
      setEndsNextDay(false);
      setPreferenceScore(10);
      
      // Refresh availability list
      if (selectedEmployeeId) {
        await fetchAvailability(selectedEmployeeId);
      }
      
      showToast("Dostępność dodana pomyślnie!", "success");
    } catch (error) {
      console.error("Error creating availability:", error);
      let errorMessage = "Nie udało się dodać dostępności. Spróbuj ponownie.";
      
      if (error instanceof ApiClientError) {
        errorMessage =
          typeof error.data.detail === "string"
            ? error.data.detail
            : error.data.detail?.[0]?.msg || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      showToast(errorMessage, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const formatAvailability = (avail: Availability): string => {
    const start = new Date(avail.start_time);
    const end = new Date(avail.end_time);
    
    // Use UTC methods to display times consistently
    const dayName = start.toLocaleDateString("pl-PL", { weekday: "short", timeZone: "UTC" });
    const day = start.getUTCDate();
    const month = start.toLocaleDateString("pl-PL", { month: "short", timeZone: "UTC" });
    
    // Format time in UTC (HH:MM)
    const startHour = start.getUTCHours().toString().padStart(2, "0");
    const startMinute = start.getUTCMinutes().toString().padStart(2, "0");
    const startTime = `${startHour}:${startMinute}`;
    
    const endHour = end.getUTCHours().toString().padStart(2, "0");
    const endMinute = end.getUTCMinutes().toString().padStart(2, "0");
    const endTime = `${endHour}:${endMinute}`;
    
    // Check if end date is different from start date (next day)
    const isNextDay = end.getUTCDate() !== start.getUTCDate() || 
                      end.getUTCMonth() !== start.getUTCMonth() ||
                      end.getUTCFullYear() !== start.getUTCFullYear();
    
    if (isNextDay) {
      const endDay = end.getUTCDate();
      const endMonth = end.toLocaleDateString("pl-PL", { month: "short", timeZone: "UTC" });
      return `${dayName}, ${day} ${month}: ${startTime} - ${endDay} ${endMonth} ${endTime} (Pref: ${avail.preference_score})`;
    }
    
    return `${dayName}, ${day} ${month}: ${startTime} - ${endTime} (Pref: ${avail.preference_score})`;
  };

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          Dostępność Pracowników
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Zarządzaj godzinami dostępności swoich pracowników
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column - Employee List */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <h2 className="text-lg font-semibold">Pracownicy</h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  Ładowanie...
                </div>
              ) : employees.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  Brak pracowników
                </div>
              ) : (
                employees.map((employee) => (
                  <button
                    key={employee.id}
                    onClick={() => setSelectedEmployeeId(employee.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      selectedEmployeeId === employee.id
                        ? "bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                        : "hover:bg-gray-50 text-gray-700 dark:hover:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    <div className="font-medium">
                      {employee.first_name} {employee.last_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {employee.role}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Availability Editor */}
        <div className="lg:col-span-2">
          {selectedEmployee ? (
            <div className="space-y-6">
              {/* Add Availability Form */}
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-lg font-semibold">
                  Dodaj Dostępność dla {selectedEmployee.first_name}{" "}
                  {selectedEmployee.last_name}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Date Picker */}
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          {selectedDate
                            ? selectedDate.toLocaleDateString("pl-PL", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })
                            : "Wybierz datę"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          selected={selectedDate}
                          onSelect={(date) => {
                            if (date) {
                              // Create a new date at midnight UTC to avoid timezone issues
                              const utcDate = new Date(Date.UTC(
                                date.getFullYear(),
                                date.getMonth(),
                                date.getDate(),
                                0, 0, 0, 0
                              ));
                              setSelectedDate(utcDate);
                            } else {
                              setSelectedDate(date);
                            }
                            setCalendarOpen(false);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Time Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_time">Start (GG:MM)</Label>
                      <Input
                        id="start_time"
                        type="text"
                        placeholder="09:00"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                        disabled={submitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_time">Koniec (GG:MM)</Label>
                      <Input
                        id="end_time"
                        type="text"
                        placeholder="17:00"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  {/* Ends Next Day Checkbox */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="ends_next_day"
                      checked={endsNextDay}
                      onChange={(e) => setEndsNextDay(e.target.checked)}
                      disabled={submitting}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Label 
                      htmlFor="ends_next_day" 
                      className="text-sm font-normal cursor-pointer"
                    >
                      Kończy się następnego dnia (dla zmian nocnych)
                    </Label>
                  </div>

                  {/* Preference Score Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="preference_score">
                        Poziom Preferencji: {preferenceScore}
                      </Label>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        1 = Może pracować, 10 = Chce pracować
                      </span>
                    </div>
                    <Slider
                      id="preference_score"
                      min={1}
                      max={10}
                      step={1}
                      value={preferenceScore}
                      onValueChange={setPreferenceScore}
                      disabled={submitting}
                    />
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? "Zapisywanie..." : "Zapisz Dostępność"}
                  </Button>
                </form>
              </div>

              {/* Existing Availability List */}
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                  <h2 className="text-lg font-semibold">Istniejąca Dostępność</h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {availabilities.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      Brak dodanej dostępności
                    </div>
                  ) : (
                    availabilities.map((avail) => (
                      <div
                        key={avail.id}
                        className="flex items-center justify-between px-4 py-3 text-sm text-gray-700 dark:text-gray-300"
                      >
                        <span>{formatAvailability(avail)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (confirm("Czy na pewno chcesz usunąć tę dostępność?")) {
                              try {
                                await availabilityApi.delete(avail.id);
                                showToast("Dostępność usunięta pomyślnie!", "success");
                                if (selectedEmployeeId) {
                                  await fetchAvailability(selectedEmployeeId);
                                }
                              } catch (error) {
                                console.error("Error deleting availability:", error);
                                let errorMessage = "Nie udało się usunąć dostępności. Spróbuj ponownie.";
                                if (error instanceof ApiClientError) {
                                  errorMessage =
                                    typeof error.data.detail === "string"
                                      ? error.data.detail
                                      : errorMessage;
                                }
                                showToast(errorMessage, "error");
                              }
                            }
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                        >
                          Usuń
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Wybierz pracownika z listy, aby zarządzać jego dostępnością
              </p>
            </div>
          )}
        </div>
      </div>

      {ToastComponent}
    </div>
  );
}

