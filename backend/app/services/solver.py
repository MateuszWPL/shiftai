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
        Solve shift assignment problem.
        
        Args:
            employees: List of Employee objects
            availabilities: List of Availability objects
            shifts_needed: List of dicts with keys: 'id', 'start' (datetime), 'end' (datetime)
        
        Returns:
            List of assignments: [{'employee_id': int, 'shift_id': int, 'start': datetime, 'end': datetime}]
        
        Raises:
            ValueError: If no solution is found
        """
        if not employees:
            raise ValueError("No employees provided")
        
        if not shifts_needed:
            return []
        
        # Initialize model
        model = cp_model.CpModel()
        
        # Create employee and shift indices
        employee_ids = [emp.id for emp in employees]
        shift_ids = [shift['id'] for shift in shifts_needed]
        
        # Create employee lookup
        employee_map = {emp.id: emp for emp in employees}
        
        # Create availability lookup by employee_id
        availability_map: Dict[int, List[Availability]] = {}
        for avail in availabilities:
            if avail.employee_id not in availability_map:
                availability_map[avail.employee_id] = []
            availability_map[avail.employee_id].append(avail)
        
        # Create shift lookup
        shift_map = {shift['id']: shift for shift in shifts_needed}
        
        # Decision variables: x[employee_id, shift_id] = 1 if employee is assigned to shift
        x = {}
        for emp_id in employee_ids:
            for shift_id in shift_ids:
                x[emp_id, shift_id] = model.NewBoolVar(f'x_{emp_id}_{shift_id}')
        
        # Constraint 1: One employee per shift (each shift must be assigned to exactly one employee)
        for shift_id in shift_ids:
            model.Add(sum(x[emp_id, shift_id] for emp_id in employee_ids) == 1)
        
        # Constraint 2: Availability check - employee can only be assigned if they have availability
        # Constraint 3: No overlapping shifts for same employee
        # Constraint 4: Max hours per week
        
        # Precompute shift hours and check availability/overlaps
        shift_hours = {}  # (shift_id) -> hours
        employee_shift_availability = {}  # (emp_id, shift_id) -> bool (can be assigned)
        
        for shift_id in shift_ids:
            shift = shift_map[shift_id]
            shift_start = shift['start']
            shift_end = shift['end']
            
            # Calculate shift duration in hours
            duration = (shift_end - shift_start).total_seconds() / 3600.0
            shift_hours[shift_id] = duration
            
            # Check availability for each employee
            for emp_id in employee_ids:
                can_assign = False
                
                # Check if employee has availability covering this shift
                if emp_id in availability_map:
                    for avail in availability_map[emp_id]:
                        # Shift must be fully within availability window
                        if avail.start_time <= shift_start and avail.end_time >= shift_end:
                            can_assign = True
                            break
                
                employee_shift_availability[emp_id, shift_id] = can_assign
                
                # If employee cannot be assigned (no availability), force x[emp_id, shift_id] = 0
                if not can_assign:
                    model.Add(x[emp_id, shift_id] == 0)
        
        # Constraint 3: No overlapping shifts for same employee
        # For each employee, ensure no two assigned shifts overlap
        for emp_id in employee_ids:
            for i, shift_id1 in enumerate(shift_ids):
                for shift_id2 in shift_ids[i + 1:]:
                    shift1 = shift_map[shift_id1]
                    shift2 = shift_map[shift_id2]
                    
                    # Check if shifts overlap
                    if self._shifts_overlap(shift1['start'], shift1['end'], shift2['start'], shift2['end']):
                        # Cannot assign both to same employee
                        model.Add(x[emp_id, shift_id1] + x[emp_id, shift_id2] <= 1)
        
        # Constraint 4: Max hours per week
        # Calculate total hours for each employee (convert to minutes for integer arithmetic)
        for emp_id in employee_ids:
            employee = employee_map[emp_id]
            max_hours = employee.max_hours_per_week
            max_minutes = max_hours * 60  # Convert to minutes
            
            # Sum of minutes for all assigned shifts
            total_minutes = sum(
                x[emp_id, shift_id] * int(shift_hours[shift_id] * 60)
                for shift_id in shift_ids
            )
            
            model.Add(total_minutes <= max_minutes)
        
        # Objective: Maximize preference scores
        # We want to assign people who WANT to work (higher preference_score)
        objective_terms = []
        for emp_id in employee_ids:
            for shift_id in shift_ids:
                if employee_shift_availability[emp_id, shift_id]:
                    # Find the availability that covers this shift
                    preference = 0
                    if emp_id in availability_map:
                        for avail in availability_map[emp_id]:
                            if avail.start_time <= shift_map[shift_id]['start'] and avail.end_time >= shift_map[shift_id]['end']:
                                preference = avail.preference_score
                                break
                    
                    objective_terms.append(x[emp_id, shift_id] * preference)
        
        model.Maximize(sum(objective_terms))
        
        # Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 30.0  # Time limit
        status = solver.Solve(model)
        
        # Check solution status
        if status == cp_model.INFEASIBLE:
            raise ValueError(
                "No solution found. The problem is infeasible. "
                "This may be due to insufficient availability, conflicting constraints, "
                "or employees exceeding max hours."
            )
        elif status == cp_model.MODEL_INVALID:
            raise ValueError("Model is invalid. Please check input data.")
        elif status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            raise ValueError(
                f"No solution found. Status: {solver.StatusName(status)}. "
                "This may be due to insufficient availability or conflicting constraints."
            )
        
        # Extract assignments
        assignments = []
        for emp_id in employee_ids:
            for shift_id in shift_ids:
                if solver.Value(x[emp_id, shift_id]) == 1:
                    shift = shift_map[shift_id]
                    assignments.append({
                        'employee_id': emp_id,
                        'shift_id': shift_id,
                        'start': shift['start'],
                        'end': shift['end'],
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

