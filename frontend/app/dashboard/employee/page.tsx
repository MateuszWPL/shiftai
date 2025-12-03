'use client';

import { useEffect, useState, useCallback } from 'react';
import { employeesApi, availabilityApi, type Employee, type Availability, ApiClientError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/components/ui/toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state for availability
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [endsNextDay, setEndsNextDay] = useState(false);
  const [preferenceScore, setPreferenceScore] = useState(10);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const { showToast, ToastComponent } = useToast();

  const loadData = useCallback(async () => {
    if (!user || user.role !== 'employee') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [profileData, shiftsData, availabilitiesData] = await Promise.all([
        employeesApi.getMyProfile(),
        employeesApi.getMyShifts(),
        employeesApi.getMyAvailability(),
      ]);
      setEmployee(profileData);
      setShifts(shiftsData);
      setAvailabilities(availabilitiesData);
    } catch (err) {
      console.error('Error loading data:', err);
      if (err instanceof ApiClientError && err.status === 403) {
        showToast('Ten panel jest dostępny tylko dla pracowników', 'error');
      } else {
        showToast('Nie udało się załadować danych', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmitAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !employee) {
      showToast('Wybierz datę', 'error');
      return;
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      showToast('Wprowadź poprawny format czasu (GG:MM)', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      const startDateTime = new Date(Date.UTC(
        selectedDate.getUTCFullYear(),
        selectedDate.getUTCMonth(),
        selectedDate.getUTCDate(),
        startHour,
        startMinute,
        0,
        0
      ));

      const endDateDay = endsNextDay 
        ? selectedDate.getUTCDate() + 1
        : selectedDate.getUTCDate();

      const endDateTime = new Date(Date.UTC(
        selectedDate.getUTCFullYear(),
        selectedDate.getUTCMonth(),
        endDateDay,
        endHour,
        endMinute,
        0,
        0
      ));

      if (!endsNextDay && endDateTime <= startDateTime) {
        showToast('Godzina zakończenia musi być po godzinie rozpoczęcia', 'error');
        setSubmitting(false);
        return;
      }

      const hoursDiff = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 24) {
        showToast('Okno dostępności nie może przekraczać 24 godzin', 'error');
        setSubmitting(false);
        return;
      }

      await availabilityApi.create({
        employee_id: employee.id,
        availabilities: [{
          employee_id: employee.id,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          preference_score: preferenceScore,
        }],
      });

      showToast('Dyspozycyjność została dodana', 'success');
      
      // Reset form
      setStartTime('09:00');
      setEndTime('17:00');
      setEndsNextDay(false);
      setPreferenceScore(10);
      
      // Reload availabilities
      const updatedAvailabilities = await employeesApi.getMyAvailability();
      setAvailabilities(updatedAvailabilities);
    } catch (err) {
      console.error('Error adding availability:', err);
      if (err instanceof ApiClientError) {
        const errorMessage = typeof err.data.detail === 'string' 
          ? err.data.detail 
          : 'Nie udało się dodać dyspozycyjności';
        showToast(errorMessage, 'error');
      } else {
        showToast('Nie udało się dodać dyspozycyjności', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAvailability = async (availabilityId: number) => {
    if (!confirm('Czy na pewno chcesz usunąć tę dyspozycyjność?')) {
      return;
    }

    try {
      await availabilityApi.delete(availabilityId);
      showToast('Dyspozycyjność została usunięta', 'success');
      const updatedAvailabilities = await employeesApi.getMyAvailability();
      setAvailabilities(updatedAvailabilities);
    } catch (err) {
      console.error('Error deleting availability:', err);
      if (err instanceof ApiClientError) {
        const errorMessage = typeof err.data.detail === 'string' 
          ? err.data.detail 
          : 'Nie udało się usunąć dyspozycyjności';
        showToast(errorMessage, 'error');
      } else {
        showToast('Nie udało się usunąć dyspozycyjności', 'error');
      }
    }
  };

  const formatAvailability = (avail: Availability): string => {
    const start = new Date(avail.start_time);
    const end = new Date(avail.end_time);
    
    const dayName = start.toLocaleDateString('pl-PL', { weekday: 'short', timeZone: 'UTC' });
    const day = start.getUTCDate();
    const month = start.toLocaleDateString('pl-PL', { month: 'short', timeZone: 'UTC' });
    
    const startHour = start.getUTCHours().toString().padStart(2, '0');
    const startMinute = start.getUTCMinutes().toString().padStart(2, '0');
    const startTime = `${startHour}:${startMinute}`;
    
    const endHour = end.getUTCHours().toString().padStart(2, '0');
    const endMinute = end.getUTCMinutes().toString().padStart(2, '0');
    const endTime = `${endHour}:${endMinute}`;
    
    const isNextDay = end.getUTCDate() !== start.getUTCDate() || 
                      end.getUTCMonth() !== start.getUTCMonth() ||
                      end.getUTCFullYear() !== start.getUTCFullYear();
    
    if (isNextDay) {
      const endDay = end.getUTCDate();
      const endMonth = end.toLocaleDateString('pl-PL', { month: 'short', timeZone: 'UTC' });
      return `${dayName}, ${day} ${month}: ${startTime} - ${endDay} ${endMonth} ${endTime} (Pref: ${avail.preference_score})`;
    }
    
    return `${dayName}, ${day} ${month}: ${startTime} - ${endTime} (Pref: ${avail.preference_score})`;
  };

  const formatShift = (shift: any): string => {
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);
    
    const dayName = start.toLocaleDateString('pl-PL', { weekday: 'short', timeZone: 'UTC' });
    const day = start.getUTCDate();
    const month = start.toLocaleDateString('pl-PL', { month: 'short', timeZone: 'UTC' });
    
    const startHour = start.getUTCHours().toString().padStart(2, '0');
    const startMinute = start.getUTCMinutes().toString().padStart(2, '0');
    const startTime = `${startHour}:${startMinute}`;
    
    const endHour = end.getUTCHours().toString().padStart(2, '0');
    const endMinute = end.getUTCMinutes().toString().padStart(2, '0');
    const endTime = `${endHour}:${endMinute}`;
    
    return `${dayName}, ${day} ${month}: ${startTime} - ${endTime} (${shift.role})`;
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="container mx-auto py-8 px-4">
          <p className="text-muted-foreground">Ładowanie...</p>
        </div>
      </AuthGuard>
    );
  }

  if (!employee) {
    return (
      <AuthGuard>
        <div className="container mx-auto py-8 px-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Nie znaleziono profilu pracownika. Skontaktuj się z administratorem.
            </p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Mój panel</h1>
            <p className="text-muted-foreground mt-2">
              Witaj, {employee.first_name} {employee.last_name}! Tutaj możesz przeglądać swój grafik i zarządzać dyspozycyjnością.
            </p>
          </div>

          {ToastComponent}

          {/* Shifts Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Mój grafik</h2>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data i godzina</TableHead>
                    <TableHead>Rola</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Brak przypisanych zmian
                      </TableCell>
                    </TableRow>
                  ) : (
                    shifts.map((shift) => (
                      <TableRow key={shift.id}>
                        <TableCell className="font-medium">
                          {formatShift(shift)}
                        </TableCell>
                        <TableCell>{shift.role}</TableCell>
                        <TableCell>
                          {shift.is_published ? (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Opublikowany
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              Nieopublikowany
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Availability Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Moja dyspozycyjność</h2>
            
            {/* Add Availability Form */}
            <div className="rounded-lg border p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Dodaj dyspozycyjność</h3>
              
              <form onSubmit={handleSubmitAvailability} className="space-y-4">
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
                          ? selectedDate.toLocaleDateString('pl-PL', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : 'Wybierz datę'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        selected={selectedDate}
                        onSelect={(date) => {
                          if (date) {
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Godzina rozpoczęcia (GG:MM)</Label>
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
                    <Label htmlFor="end_time">Godzina zakończenia (GG:MM)</Label>
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
                    Kończy się następnego dnia (dla zmian przechodzących przez północ)
                  </Label>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="preference_score">
                      Preferencja: {preferenceScore}
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
                    value={[preferenceScore]}
                    onValueChange={(value) => setPreferenceScore(value[0])}
                    disabled={submitting}
                  />
                </div>

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? 'Zapisywanie...' : 'Dodaj dyspozycyjność'}
                </Button>
              </form>
            </div>

            {/* Existing Availability List */}
            <div className="rounded-lg border">
              <div className="border-b px-4 py-3">
                <h3 className="text-lg font-semibold">Istniejąca dyspozycyjność</h3>
              </div>
              <div className="divide-y">
                {availabilities.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Brak dodanych slotów dyspozycyjności
                  </div>
                ) : (
                  availabilities.map((avail) => (
                    <div
                      key={avail.id}
                      className="flex items-center justify-between px-4 py-3 text-sm"
                    >
                      <span>{formatAvailability(avail)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAvailability(avail.id)}
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
        </div>
      </div>
    </AuthGuard>
  );
}

