"""Employee and Availability routers."""
import secrets
from datetime import datetime, date, timezone, time as dt_time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import get_db
from app.core.config import settings
from app.core.security import get_password_hash, create_access_token
from app.models.employee import Employee
from app.models.availability import Availability
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.models.employee_invitation import EmployeeInvitation, EmployeeInvitationStatus
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeResponse,
    AvailabilityCreate,
    AvailabilityBulkCreate,
    AvailabilityResponse,
)
from app.schemas.employee_invitation import EmployeeInvitationResponse, EmployeeInvitationAccept
from app.schemas.auth import UserWithToken
from app.api.v1.routers.auth import get_current_user_dependency
from app.services.email import send_employee_invitation_email
from app.models.shift import Shift

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_data: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
) -> EmployeeResponse:
    """Create a new employee."""
    # Check if organization exists
    org_result = await db.execute(
        select(Organization).where(Organization.id == employee_data.organization_id)
    )
    organization = org_result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {employee_data.organization_id} not found. Please create the organization first."
        )
    
    # Create employee
    db_employee = Employee(
        first_name=employee_data.first_name,
        last_name=employee_data.last_name,
        email=employee_data.email,
        phone=employee_data.phone,
        role=employee_data.role,
        organization_id=employee_data.organization_id,
        hourly_rate=employee_data.hourly_rate,
        max_hours_per_week=employee_data.max_hours_per_week,
    )
    
    try:
        db.add(db_employee)
        await db.commit()
        await db.refresh(db_employee)
    except IntegrityError as e:
        await db.rollback()
        # Handle any other integrity errors (e.g., unique constraints)
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        if "organization_id" in error_msg.lower() or "foreign key" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Organization with id {employee_data.organization_id} not found"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database integrity error: {error_msg}"
        )
    
    return EmployeeResponse.model_validate(db_employee)


@router.get("/{org_id}", response_model=List[EmployeeResponse])
async def get_employees_by_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db),
) -> List[EmployeeResponse]:
    """Get all employees for an organization."""
    if org_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization ID"
        )
    
    result = await db.execute(
        select(Employee).where(Employee.organization_id == org_id)
    )
    employees = result.scalars().all()
    
    if not employees:
        return []
    
    return [EmployeeResponse.model_validate(emp) for emp in employees]


@router.post(
    "/availability",
    response_model=List[AvailabilityResponse],
    status_code=status.HTTP_201_CREATED,
)
async def bulk_create_availability(
    availability_data: AvailabilityBulkCreate,
    db: AsyncSession = Depends(get_db),
) -> List[AvailabilityResponse]:
    """Bulk add availability slots with duplicate prevention."""
    if not availability_data.availabilities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one availability slot is required"
        )
    
    created_availabilities = []
    
    for avail in availability_data.availabilities:
        # Validate time range
        if avail.end_time <= avail.start_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"end_time must be after start_time for employee_id {avail.employee_id}"
            )
        
        # Check if employee exists
        employee_result = await db.execute(
            select(Employee).where(Employee.id == avail.employee_id)
        )
        employee = employee_result.scalar_one_or_none()
        
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with id {avail.employee_id} not found"
            )
        
        # Check for overlapping/duplicate availability slots
        # Delete existing slots that overlap with this time range
        await db.execute(
            delete(Availability).where(
                and_(
                    Availability.employee_id == avail.employee_id,
                    Availability.start_time < avail.end_time,
                    Availability.end_time > avail.start_time,
                )
            )
        )
        
        # Create new availability slot
        db_availability = Availability(
            employee_id=avail.employee_id,
            start_time=avail.start_time,
            end_time=avail.end_time,
            preference_score=avail.preference_score,
        )
        
        db.add(db_availability)
        await db.flush()  # Flush to get the ID
        await db.refresh(db_availability)
        
        created_availabilities.append(db_availability)
    
    await db.commit()
    
    return [AvailabilityResponse.model_validate(avail) for avail in created_availabilities]


@router.get(
    "/availability/{employee_id}",
    response_model=List[AvailabilityResponse],
)
async def get_employee_availability(
    employee_id: int,
    start_date: Optional[date] = Query(None, description="Start date filter (inclusive)"),
    end_date: Optional[date] = Query(None, description="End date filter (inclusive)"),
    db: AsyncSession = Depends(get_db),
) -> List[AvailabilityResponse]:
    """Get availability slots for an employee within a date range."""
    if employee_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid employee ID"
        )
    
    # Check if employee exists
    employee_result = await db.execute(
        select(Employee).where(Employee.id == employee_id)
    )
    employee = employee_result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with id {employee_id} not found"
        )
    
    # Build query
    query = select(Availability).where(Availability.employee_id == employee_id)
    
    # Apply date filters if provided
    if start_date:
        # Convert date to datetime at start of day (UTC)
        start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        query = query.where(Availability.start_time >= start_datetime)
    
    if end_date:
        # Convert date to datetime at end of day (UTC)
        end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        query = query.where(Availability.end_time <= end_datetime)
    
    # Validate date range if both are provided
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date"
        )
    
    # Order by start_time
    query = query.order_by(Availability.start_time)
    
    result = await db.execute(query)
    availabilities = result.scalars().all()
    
    return [AvailabilityResponse.model_validate(avail) for avail in availabilities]


@router.delete(
    "/availability/{availability_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_availability(
    availability_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete an availability slot."""
    if availability_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid availability ID"
        )
    
    # Check if availability exists
    availability_result = await db.execute(
        select(Availability).where(Availability.id == availability_id)
    )
    availability = availability_result.scalar_one_or_none()
    
    if not availability:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Availability with id {availability_id} not found"
        )
    
    # Delete the availability
    await db.execute(delete(Availability).where(Availability.id == availability_id))
    await db.commit()
    
    return None


def generate_employee_invitation_token() -> str:
    """Generate a secure random token for employee invitation."""
    return secrets.token_urlsafe(32)


@router.post("/{employee_id}/invite", response_model=EmployeeInvitationResponse, status_code=status.HTTP_201_CREATED)
async def invite_employee(
    employee_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> EmployeeInvitationResponse:
    """Create an invitation for an employee to set up their account."""
    
    # Check if employee exists
    result = await db.execute(
        select(Employee).where(Employee.id == employee_id)
    )
    employee = result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pracownik nie został znaleziony"
        )
    
    # Check if employee has email
    if not employee.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pracownik musi mieć adres email, aby otrzymać zaproszenie"
        )
    
    # Check if employee already has an account
    if employee.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pracownik ma już konto w systemie"
        )
    
    # Check if there's already a pending invitation
    result = await db.execute(
        select(EmployeeInvitation).where(
            EmployeeInvitation.employee_id == employee_id,
            EmployeeInvitation.status == EmployeeInvitationStatus.PENDING
        )
    )
    existing_invitation = result.scalar_one_or_none()
    
    if existing_invitation:
        # Return existing invitation with URL
        invitation_url = f"{settings.FRONTEND_URL}/accept-employee-invitation?token={existing_invitation.token}"
        return EmployeeInvitationResponse(
            id=existing_invitation.id,
            employee_id=existing_invitation.employee_id,
            token=existing_invitation.token,
            status=existing_invitation.status.value,
            expires_at=existing_invitation.expires_at,
            accepted_at=existing_invitation.accepted_at,
            invitation_url=invitation_url,
            created_at=existing_invitation.created_at,
        )
    
    # Get organization
    result = await db.execute(
        select(Organization).where(Organization.id == employee.organization_id)
    )
    organization = result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zespół nie został znaleziony"
        )
    
    # Create invitation
    token = generate_employee_invitation_token()
    invitation = EmployeeInvitation(
        employee_id=employee_id,
        token=token,
        status=EmployeeInvitationStatus.PENDING,
        expires_at=EmployeeInvitation.create_expires_at(days=7),
    )
    db.add(invitation)
    
    try:
        await db.commit()
        await db.refresh(invitation)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie można utworzyć zaproszenia"
        )
    
    # Send invitation email in background
    employee_name = f"{employee.first_name} {employee.last_name}"
    background_tasks.add_task(
        send_employee_invitation_email,
        email=employee.email,
        employee_name=employee_name,
        organization_name=organization.name,
        invitation_token=token,
    )
    
    invitation_url = f"{settings.FRONTEND_URL}/accept-employee-invitation?token={token}"
    
    return EmployeeInvitationResponse(
        id=invitation.id,
        employee_id=invitation.employee_id,
        token=invitation.token,
        status=invitation.status.value,
        expires_at=invitation.expires_at,
        accepted_at=invitation.accepted_at,
        invitation_url=invitation_url,
        created_at=invitation.created_at,
    )


@router.get("/{employee_id}/invitation", response_model=EmployeeInvitationResponse)
async def get_employee_invitation(
    employee_id: int,
    current_user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> EmployeeInvitationResponse:
    """Get invitation link for an employee."""
    
    # Check if employee exists
    result = await db.execute(
        select(Employee).where(Employee.id == employee_id)
    )
    employee = result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pracownik nie został znaleziony"
        )
    
    # Check if employee already has an account
    if employee.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pracownik ma już konto w systemie"
        )
    
    # Get invitation
    result = await db.execute(
        select(EmployeeInvitation).where(
            EmployeeInvitation.employee_id == employee_id
        ).order_by(EmployeeInvitation.created_at.desc())
    )
    invitation = result.scalar_one_or_none()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brak zaproszenia dla tego pracownika"
        )
    
    invitation_url = f"{settings.FRONTEND_URL}/accept-employee-invitation?token={invitation.token}"
    
    return EmployeeInvitationResponse(
        id=invitation.id,
        employee_id=invitation.employee_id,
        token=invitation.token,
        status=invitation.status.value,
        expires_at=invitation.expires_at,
        accepted_at=invitation.accepted_at,
        invitation_url=invitation_url,
        created_at=invitation.created_at,
    )


@router.post("/invitations/accept", response_model=UserWithToken, status_code=status.HTTP_201_CREATED)
async def accept_employee_invitation(
    invitation_data: EmployeeInvitationAccept,
    db: AsyncSession = Depends(get_db),
) -> UserWithToken:
    """Accept an employee invitation and create user account."""
    
    # Find invitation by token
    result = await db.execute(
        select(EmployeeInvitation).where(EmployeeInvitation.token == invitation_data.token)
    )
    invitation = result.scalar_one_or_none()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nieprawidłowy token zaproszenia"
        )
    
    # Check if invitation is expired
    if invitation.is_expired():
        invitation.status = EmployeeInvitationStatus.EXPIRED
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zaproszenie wygasło"
        )
    
    # Check if invitation is already accepted
    if invitation.status == EmployeeInvitationStatus.ACCEPTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zaproszenie zostało już zaakceptowane"
        )
    
    # Get employee
    result = await db.execute(
        select(Employee).where(Employee.id == invitation.employee_id)
    )
    employee = result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pracownik nie został znaleziony"
        )
    
    # Check if employee already has an account
    if employee.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pracownik ma już konto w systemie"
        )
    
    # Check if user with this email already exists
    if not employee.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pracownik nie ma adresu email"
        )
    
    result = await db.execute(
        select(User).where(User.email == employee.email)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Użytkownik z tym adresem email już istnieje"
        )
    
    # Create user
    hashed_password = get_password_hash(invitation_data.password)
    full_name = f"{employee.first_name} {employee.last_name}"
    user = User(
        email=employee.email,
        hashed_password=hashed_password,
        full_name=full_name,
        organization_id=employee.organization_id,
        role=UserRole.EMPLOYEE,
    )
    db.add(user)
    await db.flush()  # Flush to get user.id
    
    # Link employee to user
    employee.user_id = user.id
    
    # Update invitation status
    invitation.status = EmployeeInvitationStatus.ACCEPTED
    invitation.accepted_at = datetime.now(timezone.utc)
    
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie można utworzyć konta"
        )
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "organization_id": user.organization_id}
    )
    
    return UserWithToken(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        organization_id=user.organization_id,
        access_token=access_token,
        token_type="bearer",
    )


@router.get("/me/shifts", response_model=List[dict])
async def get_my_shifts(
    start_date: Optional[date] = Query(None, description="Start date filter (inclusive)"),
    end_date: Optional[date] = Query(None, description="End date filter (inclusive)"),
    current_user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """Get shifts for the current employee user."""
    
    # Check if user is an employee
    if current_user.role != UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ten endpoint jest dostępny tylko dla pracowników"
        )
    
    # Get employee linked to this user
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono profilu pracownika powiązanego z tym kontem"
        )
    
    # Build query for shifts
    query = select(Shift).where(Shift.employee_id == employee.id)
    
    # Apply date filters if provided
    if start_date:
        start_datetime = datetime.combine(start_date, dt_time.min).replace(tzinfo=timezone.utc)
        query = query.where(Shift.start_time >= start_datetime)
    
    if end_date:
        end_datetime = datetime.combine(end_date, dt_time.max).replace(tzinfo=timezone.utc)
        query = query.where(Shift.end_time <= end_datetime)
    
    # Validate date range if both are provided
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data rozpoczęcia musi być przed datą zakończenia"
        )
    
    # Order by start_time
    query = query.order_by(Shift.start_time)
    
    result = await db.execute(query)
    shifts = result.scalars().all()
    
    # Format response
    return [
        {
            "id": shift.id,
            "start_time": shift.start_time.isoformat(),
            "end_time": shift.end_time.isoformat(),
            "role": shift.role,
            "is_published": shift.is_published,
        }
        for shift in shifts
    ]


@router.get("/me/availability", response_model=List[AvailabilityResponse])
async def get_my_availability(
    start_date: Optional[date] = Query(None, description="Start date filter (inclusive)"),
    end_date: Optional[date] = Query(None, description="End date filter (inclusive)"),
    current_user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> List[AvailabilityResponse]:
    """Get availability for the current employee user."""
    
    # Check if user is an employee
    if current_user.role != UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ten endpoint jest dostępny tylko dla pracowników"
        )
    
    # Get employee linked to this user
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono profilu pracownika powiązanego z tym kontem"
        )
    
    # Build query
    query = select(Availability).where(Availability.employee_id == employee.id)
    
    # Apply date filters if provided
    if start_date:
        start_datetime = datetime.combine(start_date, dt_time.min).replace(tzinfo=timezone.utc)
        query = query.where(Availability.start_time >= start_datetime)
    
    if end_date:
        end_datetime = datetime.combine(end_date, dt_time.max).replace(tzinfo=timezone.utc)
        query = query.where(Availability.end_time <= end_datetime)
    
    # Validate date range if both are provided
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data rozpoczęcia musi być przed datą zakończenia"
        )
    
    # Order by start_time
    query = query.order_by(Availability.start_time)
    
    result = await db.execute(query)
    availabilities = result.scalars().all()
    
    return [AvailabilityResponse.model_validate(avail) for avail in availabilities]


@router.get("/me", response_model=EmployeeResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> EmployeeResponse:
    """Get current employee profile."""
    
    # Check if user is an employee
    if current_user.role != UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ten endpoint jest dostępny tylko dla pracowników"
        )
    
    # Get employee linked to this user
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono profilu pracownika powiązanego z tym kontem"
        )
    
    return EmployeeResponse.model_validate(employee)