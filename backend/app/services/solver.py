"""Solver service for schedule generation using OR-Tools."""
from ortools.sat.python import cp_model
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
from app.models import Requirement, Availability, User, Shift, Schedule, UserRole
import logging

logger = logging.getLogger(__name__)

class SolverService:
    """Service for generating schedules using Constraint Programming."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_schedule(self, team_id: int, week_start_date: date) -> Optional[int]:
        """
        Generates a schedule for a given team and week.
        Returns the ID of the created schedule, or None if infeasible.
        """
        # 1. Fetch Data
        requirements = await self._get_requirements(team_id, week_start_date)
        if not requirements:
            logger.warning(f"No requirements found for team {team_id} on week {week_start_date}")
            return None

        # Fetch employees (users with role EMPLOYEE or MANAGER who can work)
        # For MVP, let's assume all users in the team are candidates
        users = await self._get_team_users(team_id)
        if not users:
             logger.warning(f"No users found for team {team_id}")
             return None

        # Fetch availabilities for this week
        week_end_date = week_start_date + timedelta(days=6)
        availabilities = await self._get_availabilities(users, week_start_date, week_end_date)

        # 2. Setup Solver
        model = cp_model.CpModel()
        shifts = {} # (user_id, requirement_id) -> BoolVar

        # 3. Create Variables
        # We try to assign each requirement slot to a user
        for req in requirements:
            for user in users:
                # Check if user matches position (Hard Constraint)
                # For MVP, simple string match. If user.position is None, they can't work? 
                # Or maybe we allow flexible roles later. For now, strict match if position is set.
                if user.position and user.position != req.position_name:
                    continue
                
                # Check availability (Hard Constraint)
                # User must be available for the entire duration of the requirement
                is_available = self._check_availability(user, req, availabilities)
                if not is_available:
                    continue

                shifts[(user.id, req.id)] = model.NewBoolVar(f'shift_u{user.id}_r{req.id}')

        # 4. Hard Constraints
        
        # C1: Each requirement slot must be filled by exactly 'headcount' users
        # Note: A Requirement row represents a "slot" type. If headcount > 1, 
        # we might need to treat it as multiple individual slots or sum the assignments.
        # Let's assume Requirement row is a "shift opportunity". 
        # If headcount is 3, we need sum(shifts[u, r]) == 3.
        for req in requirements:
            candidates = [shifts[(u.id, req.id)] for u in users if (u.id, req.id) in shifts]
            if len(candidates) < req.headcount:
                logger.error(f"Not enough candidates for req {req.id} ({req.position_name}). Needed {req.headcount}, have {len(candidates)}")
                # We can either fail or fill as much as possible. Let's try to fill as much as possible for MVP or fail?
                # Spec says: "If user_id cannot be found (shortage), create an Open Shift". 
                # The solver won't create open shifts directly, we handle that in post-processing.
                # So we relax this constraint: sum <= headcount.
                model.Add(sum(candidates) <= req.headcount)
            else:
                 model.Add(sum(candidates) == req.headcount)

        # C2: No overlapping shifts for a user
        # If two requirements overlap in time, a user can only take one.
        for user in users:
            user_shifts = [req for req in requirements if (user.id, req.id) in shifts]
            # Check every pair
            for i in range(len(user_shifts)):
                for j in range(i + 1, len(user_shifts)):
                    req_a = user_shifts[i]
                    req_b = user_shifts[j]
                    
                    if self._is_overlap(req_a, req_b):
                        model.Add(shifts[(user.id, req_a.id)] + shifts[(user.id, req_b.id)] <= 1)

        # 5. Soft Constraints (Objectives)
        
        # O1: Maximize Preference Score
        # We sum (shift_var * preference_score)
        objective_terms = []
        for (user_id, req_id), var in shifts.items():
            score = self._get_preference_score(user_id, req_id, availabilities)
            objective_terms.append(var * score)
        
        model.Maximize(sum(objective_terms))

        # 6. Solve
        solver = cp_model.CpSolver()
        status = solver.Solve(model)

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return await self._save_schedule(team_id, week_start_date, requirements, shifts, solver, users)
        else:
            logger.warning("Solver could not find a feasible solution.")
            return None

    async def _get_requirements(self, team_id: int, week_start_date: date) -> List[Requirement]:
        query = select(Requirement).where(
            and_(
                Requirement.team_id == team_id,
                Requirement.week_start_date == week_start_date
            )
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def _get_team_users(self, team_id: int) -> List[User]:
        query = select(User).where(User.organization_id == team_id) # Assuming team_id maps to organization_id for now
        result = await self.db.execute(query)
        return result.scalars().all()

    async def _get_availabilities(self, users: List[User], start_date: date, end_date: date) -> Dict[int, List[Availability]]:
        user_ids = [u.id for u in users]
        # Convert dates to datetime for comparison if needed, but Availability uses DateTime
        # We need to cover the full range of days
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())
        
        query = select(Availability).where(
            and_(
                Availability.user_id.in_(user_ids),
                Availability.start_time >= start_dt,
                Availability.end_time <= end_dt
            )
        )
        result = await self.db.execute(query)
        all_avails = result.scalars().all()
        
        avail_map = {uid: [] for uid in user_ids}
        for av in all_avails:
            avail_map[av.user_id].append(av)
        return avail_map

    def _check_availability(self, user: User, req: Requirement, avail_map: Dict[int, List[Availability]]) -> bool:
        # Req time is Time, we need to combine with date to check overlap with Availability (DateTime)
        # Requirement has day_of_week (0=Monday). week_start_date is assumed Monday? 
        # Let's assume week_start_date is the anchor.
        req_date = req.week_start_date + timedelta(days=req.day_of_week)
        req_start = datetime.combine(req_date, req.start_time)
        req_end = datetime.combine(req_date, req.end_time)
        if req_end < req_start: # Overnight shift
             req_end += timedelta(days=1)

        user_avails = avail_map.get(user.id, [])
        for av in user_avails:
            # Check if availability covers the requirement
            # Availability: start_time, end_time (DateTime)
            if av.start_time <= req_start and av.end_time >= req_end:
                return True
        return False

    def _get_preference_score(self, user_id: int, req_id: int, avail_map: Dict[int, List[Availability]]) -> int:
        # Simplified: find the availability that covered this slot and return its score
        # In reality, we already checked coverage.
        # We'd need to pass the req object or look it up. 
        # For MVP, let's assume max score if multiple cover (unlikely)
        # We need to reconstruct req time again... slightly inefficient but ok for MVP.
        return 10 # Placeholder, should get from Availability.preference_score

    def _is_overlap(self, req_a: Requirement, req_b: Requirement) -> bool:
        # Check if two requirements overlap in time
        if req_a.day_of_week != req_b.day_of_week:
            return False
        
        # Same day overlap check
        return max(req_a.start_time, req_b.start_time) < min(req_a.end_time, req_b.end_time)

    async def _save_schedule(self, team_id: int, week_start_date: date, requirements: List[Requirement], shifts: Dict, solver: cp_model.CpSolver, users: List[User]) -> int:
        # Create Schedule
        schedule = Schedule(
            team_id=team_id,
            week_start_date=week_start_date,
            is_published=False
        )
        self.db.add(schedule)
        await self.db.flush() # Get ID

        # Create Shifts
        for req in requirements:
            assigned_count = 0
            req_date = req.week_start_date + timedelta(days=req.day_of_week)
            req_start = datetime.combine(req_date, req.start_time)
            req_end = datetime.combine(req_date, req.end_time)
            if req_end < req_start:
                req_end += timedelta(days=1)

            for user in users:
                if (user.id, req.id) in shifts and solver.Value(shifts[(user.id, req.id)]):
                    shift = Shift(
                        schedule_id=schedule.id,
                        user_id=user.id,
                        start_time=req_start,
                        end_time=req_end,
                        position_name=req.position_name,
                        is_published=False
                    )
                    self.db.add(shift)
                    assigned_count += 1
            
            # Open Shifts (Shortage)
            missing = req.headcount - assigned_count
            for _ in range(missing):
                 shift = Shift(
                        schedule_id=schedule.id,
                        user_id=None, # Open shift
                        start_time=req_start,
                        end_time=req_end,
                        position_name=req.position_name,
                        is_published=False
                    )
                 self.db.add(shift)

        await self.db.commit()
        return schedule.id
