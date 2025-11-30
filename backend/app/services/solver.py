"""Shift scheduling solver using Google OR-Tools CP-SAT."""
from datetime import datetime
from typing import List, Dict, Any
from ortools.sat.python import cp_model

from app.models.employee import Employee
from app.models.availability import Availability


class ShiftSolver:
    """Solver for optimal shift assignment using CP-SAT."""
    
    def solve(
        self,
        employees: List[Employee],
        availabilities: List[Availability],
        shifts_needed: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Solve shift assignment problem with "Smart Filling" (splitting shifts).
        
        Args:
            employees: List of Employee objects
            availabilities: List of Availability objects
            shifts_needed: List of dicts with keys: 'id', 'start' (datetime), 'end' (datetime)
        
        Returns:
            List of assignments: [{'employee_id': int, 'shift_id': int, 'start': datetime, 'end': datetime}]
        """
        if not employees:
            raise ValueError("No employees provided")
        
        if not shifts_needed:
            return []
        
        # --- Smart Filling Pre-processing ---
        # Split shifts based on availability transitions to allow partial coverage
        
        # 1. Collect all relevant time points
        # We only care about time points that fall within the shifts we need to cover
        time_points = set()
        for shift in shifts_needed:
            time_points.add(shift['start'])
            time_points.add(shift['end'])
            
        # Add availability start/end times if they fall within any shift
        # This allows us to split a shift exactly where an employee becomes available/unavailable
        shift_intervals = [(s['start'], s['end']) for s in shifts_needed]
        
        for avail in availabilities:
            # Check if this availability boundary is relevant (inside any shift)
            for s_start, s_end in shift_intervals:
                if s_start < avail.start_time < s_end:
                    time_points.add(avail.start_time)
                if s_start < avail.end_time < s_end:
                    time_points.add(avail.end_time)
        
        sorted_points = sorted(list(time_points))
        
        # 2. Create split shifts (segments)
        # For each original shift, split it if it crosses any of the sorted_points
        split_shifts = []
        
        for shift in shifts_needed:
            s_start = shift['start']
            s_end = shift['end']
            
            # Find points within this shift
            points_in_shift = [p for p in sorted_points if s_start < p < s_end]
            
            if not points_in_shift:
                # No splitting needed
                split_shifts.append({
                    'unique_id': f"{shift['id']}_0", # Unique ID for solver
                    'original_id': shift['id'],
                    'start': s_start,
                    'end': s_end,
                    'role': shift.get('role'),
                })
            else:
                # Split!
                current_start = s_start
                for i, p in enumerate(points_in_shift):
                    split_shifts.append({
                        'unique_id': f"{shift['id']}_{i}",
                        'original_id': shift['id'],
                        'start': current_start,
                        'end': p,
                        'role': shift.get('role'),
                    })
                    current_start = p
                # Last segment
                split_shifts.append({
                    'unique_id': f"{shift['id']}_{len(points_in_shift)}",
                    'original_id': shift['id'],
                    'start': current_start,
                    'end': s_end,
                    'role': shift.get('role'),
                })
                
        # --- Solver Setup ---
        model = cp_model.CpModel()
        
        employee_ids = [emp.id for emp in employees]
        split_shift_ids = [s['unique_id'] for s in split_shifts]
        
        employee_map = {emp.id: emp for emp in employees}
        split_shift_map = {s['unique_id']: s for s in split_shifts}
        
        # Availability lookup
        availability_map: Dict[int, List[Availability]] = {}
        for avail in availabilities:
            if avail.employee_id not in availability_map:
                availability_map[avail.employee_id] = []
            availability_map[avail.employee_id].append(avail)
            
        # Decision variables
        x = {}
        for emp_id in employee_ids:
            for s_id in split_shift_ids:
                x[emp_id, s_id] = model.NewBoolVar(f'x_{emp_id}_{s_id}')
                
        # Constraint 1: Each segment must be assigned to exactly one employee
        for s_id in split_shift_ids:
            model.Add(sum(x[emp_id, s_id] for emp_id in employee_ids) == 1)
            
        # Precompute availability
        shift_hours = {}
        employee_segment_availability = {}
        
        for s_id in split_shift_ids:
            segment = split_shift_map[s_id]
            seg_start = segment['start']
            seg_end = segment['end']
            
            duration = (seg_end - seg_start).total_seconds() / 3600.0
            shift_hours[s_id] = duration
            
            for emp_id in employee_ids:
                can_assign = False
                if emp_id in availability_map:
                    for avail in availability_map[emp_id]:
                        if avail.start_time <= seg_start and avail.end_time >= seg_end:
                            can_assign = True
                            break
                
                employee_segment_availability[emp_id, s_id] = can_assign
                
                if not can_assign:
                    model.Add(x[emp_id, s_id] == 0)
                    
        # Constraint 3: No overlapping segments for same employee
        # (Segments from DIFFERENT original shifts that overlap in time)
        # Note: Our splitting logic ensures segments from the SAME original shift don't overlap.
        # But we might have two original shifts at the same time (e.g. 2 waiters needed).
        # We need to ensure one employee doesn't take both.
        
        # Group segments by time interval? 
        # Or just pairwise check like before.
        # Pairwise check is O(N^2) but N is small (segments).
        
        for emp_id in employee_ids:
            for i, s_id1 in enumerate(split_shift_ids):
                for s_id2 in split_shift_ids[i + 1:]:
                    seg1 = split_shift_map[s_id1]
                    seg2 = split_shift_map[s_id2]
                    
                    if self._shifts_overlap(seg1['start'], seg1['end'], seg2['start'], seg2['end']):
                        model.Add(x[emp_id, s_id1] + x[emp_id, s_id2] <= 1)
                        
        # Constraint 4: Max hours per week
        for emp_id in employee_ids:
            employee = employee_map[emp_id]
            max_hours = employee.max_hours_per_week
            max_minutes = int(max_hours * 60)
            
            total_minutes = sum(
                x[emp_id, s_id] * int(shift_hours[s_id] * 60)
                for s_id in split_shift_ids
            )
            model.Add(total_minutes <= max_minutes)
            
        # Objective: Maximize preference + Continuity
        # We want to minimize fragmentation (switching employees for the same original shift).
        # Add a bonus if adjacent segments of the same original shift are assigned to the same employee.
        
        objective_terms = []
        
        # 1. Preference scores
        for emp_id in employee_ids:
            for s_id in split_shift_ids:
                if employee_segment_availability[emp_id, s_id]:
                    preference = 0
                    if emp_id in availability_map:
                        for avail in availability_map[emp_id]:
                            seg = split_shift_map[s_id]
                            if avail.start_time <= seg['start'] and avail.end_time >= seg['end']:
                                preference = avail.preference_score
                                break
                    # Base score + preference
                    objective_terms.append(x[emp_id, s_id] * (100 + preference))

        # 2. Continuity Bonus
        # For each original shift, find its segments.
        segments_by_original = {}
        for s in split_shifts:
            orig_id = s['original_id']
            if orig_id not in segments_by_original:
                segments_by_original[orig_id] = []
            segments_by_original[orig_id].append(s)
            
        for orig_id, segments in segments_by_original.items():
            # Sort by time
            segments.sort(key=lambda s: s['start'])
            
            # For each adjacent pair
            for i in range(len(segments) - 1):
                s1 = segments[i]
                s2 = segments[i+1]
                
                # If s1 and s2 are assigned to the same employee, add bonus
                for emp_id in employee_ids:
                    # Create a boolean variable: both_assigned = x[emp, s1] AND x[emp, s2]
                    # In CP-SAT: model.AddMultiplicationEquality(target, [vars])
                    both_assigned = model.NewBoolVar(f'cont_{orig_id}_{i}_{emp_id}')
                    model.AddMultiplicationEquality(both_assigned, [x[emp_id, s1['unique_id']], x[emp_id, s2['unique_id']]])
                    
                    # Add bonus to objective
                    objective_terms.append(both_assigned * 50) # 50 points bonus for continuity
                    
        model.Maximize(sum(objective_terms))
        
        # Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 30.0
        status = solver.Solve(model)
        
        if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            raise ValueError(
                f"No solution found. Status: {solver.StatusName(status)}. "
                "Check availability and constraints."
            )
            
        # Extract assignments
        assignments = []
        for emp_id in employee_ids:
            for s_id in split_shift_ids:
                if solver.Value(x[emp_id, s_id]) == 1:
                    segment = split_shift_map[s_id]
                    assignments.append({
                        'employee_id': emp_id,
                        'shift_id': segment['original_id'], # Return the ORIGINAL ID so caller knows
                        'start': segment['start'],
                        'end': segment['end'],
                    })
                    
        return assignments

    @staticmethod
    def _shifts_overlap(
        start1: datetime,
        end1: datetime,
        start2: datetime,
        end2: datetime,
    ) -> bool:
        """Check if two time ranges overlap."""
        return start1 < end2 and start2 < end1


