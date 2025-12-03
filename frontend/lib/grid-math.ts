/**
 * Grid Math Utilities
 * Handles time-to-grid-column conversions and auto-cut calculations for the timeline
 */

/**
 * Converts a time string (HH:mm) to a grid column index.
 * Grid has 96 columns (15-minute intervals from 00:00 to 24:00).
 * 
 * @param time - Time string in format "HH:mm" (e.g., "14:15")
 * @returns Grid column index (0-95)
 */
export function timeToGridColumn(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  // Each column represents 15 minutes
  const column = Math.floor(totalMinutes / 15);
  // Clamp to valid range [0, 95]
  return Math.max(0, Math.min(95, column));
}

/**
 * Converts a grid column index to a time string.
 * 
 * @param column - Grid column index (0-95)
 * @returns Time string in format "HH:mm"
 */
export function gridColumnToTime(column: number): string {
  const clampedColumn = Math.max(0, Math.min(95, column));
  const totalMinutes = clampedColumn * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Calculates the auto-cut end time for a shift.
 * If an employee is dropped onto a requirement slot, but their availability
 * ends before the requirement ends, the shift is truncated to the availability end time.
 * 
 * @param dropTime - The time where the employee was dropped (HH:mm)
 * @param demandEnd - The requirement's end time (HH:mm)
 * @param employeeAvailabilityEnd - The employee's availability end time (HH:mm) or null if not available
 * @returns The valid end time for the new shift (HH:mm), or null if invalid
 */
export function calculateAutoCut(
  dropTime: string,
  demandEnd: string,
  employeeAvailabilityEnd: string | null
): string | null {
  // Parse times to minutes for comparison
  const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const dropMinutes = parseTime(dropTime);
  const demandEndMinutes = parseTime(demandEnd);

  // If drop time is after or equal to demand end, invalid
  if (dropMinutes >= demandEndMinutes) {
    return null;
  }

  // If no availability constraint, use demand end
  if (!employeeAvailabilityEnd) {
    return demandEnd;
  }

  const availabilityEndMinutes = parseTime(employeeAvailabilityEnd);

  // If drop time is after or equal to availability end, invalid
  if (dropMinutes >= availabilityEndMinutes) {
    return null;
  }

  // Return the minimum of demand end and availability end
  const validEndMinutes = Math.min(demandEndMinutes, availabilityEndMinutes);
  const hours = Math.floor(validEndMinutes / 60);
  const minutes = validEndMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Calculates the grid column span for a time range.
 * 
 * @param startTime - Start time (HH:mm)
 * @param endTime - End time (HH:mm)
 * @returns Number of columns the range spans
 */
export function calculateGridSpan(startTime: string, endTime: string): number {
  const startColumn = timeToGridColumn(startTime);
  const endColumn = timeToGridColumn(endTime);
  return Math.max(1, endColumn - startColumn);
}

/**
 * Gets the time at a specific X coordinate within a grid container.
 * 
 * @param clientX - Mouse/touch X coordinate relative to viewport
 * @param containerElement - The grid container element
 * @param totalColumns - Total number of columns (default: 96)
 * @returns Time string (HH:mm) or null if calculation fails
 */
export function getTimeFromXCoordinate(
  clientX: number,
  containerElement: HTMLElement,
  totalColumns: number = 96
): string | null {
  const rect = containerElement.getBoundingClientRect();
  const relativeX = clientX - rect.left;
  const columnWidth = rect.width / totalColumns;
  const column = Math.floor(relativeX / columnWidth);
  const clampedColumn = Math.max(0, Math.min(totalColumns - 1, column));
  return gridColumnToTime(clampedColumn);
}

