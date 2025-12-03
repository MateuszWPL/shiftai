"""Invitation routers."""
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import get_db
from app.core.security import get_password_hash, create_access_token
from app.models.invitation import Invitation, InvitationStatus
from app.models.user import User, UserRole
from app.models.organization import Organization
from app.schemas.invitation import InvitationCreate, InvitationResponse, InvitationAccept
from app.schemas.auth import UserWithToken
from app.api.v1.routers.auth import get_current_user_dependency
from app.services.email import send_invitation_email

router = APIRouter(prefix="/invitations", tags=["Invitations"])


def generate_invitation_token() -> str:
    """Generate a secure random token for invitation."""
    return secrets.token_urlsafe(32)


@router.post("/", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    invitation_data: InvitationCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> InvitationResponse:
    """Create an invitation for a team member."""
    
    # Check if user has organization
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Musisz najpierw utworzyć zespół"
        )
    
    # Check if user with this email already exists
    result = await db.execute(
        select(User).where(User.email == invitation_data.email)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Użytkownik z tym adresem email już istnieje"
        )
    
    # Check if there's already a pending invitation for this email and organization
    result = await db.execute(
        select(Invitation).where(
            Invitation.email == invitation_data.email,
            Invitation.organization_id == current_user.organization_id,
            Invitation.status == InvitationStatus.PENDING
        )
    )
    existing_invitation = result.scalar_one_or_none()
    
    if existing_invitation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zaproszenie dla tego adresu email już istnieje"
        )
    
    # Get organization
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    organization = result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zespół nie został znaleziony"
        )
    
    # Create invitation
    token = generate_invitation_token()
    invitation = Invitation(
        email=invitation_data.email,
        token=token,
        organization_id=current_user.organization_id,
        invited_by_user_id=current_user.id,
        status=InvitationStatus.PENDING,
        expires_at=Invitation.create_expires_at(days=7),
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
    background_tasks.add_task(
        send_invitation_email,
        email=invitation_data.email,
        full_name=invitation_data.full_name,
        organization_name=organization.name,
        invitation_token=token,
    )
    
    return InvitationResponse(
        id=invitation.id,
        email=invitation.email,
        organization_id=invitation.organization_id,
        status=invitation.status,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
    )


@router.get("/", response_model=list[InvitationResponse])
async def list_invitations(
    current_user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> list[InvitationResponse]:
    """List all invitations for current user's organization."""
    
    if not current_user.organization_id:
        return []
    
    result = await db.execute(
        select(Invitation).where(
            Invitation.organization_id == current_user.organization_id
        ).order_by(Invitation.created_at.desc())
    )
    invitations = result.scalars().all()
    
    return [
        InvitationResponse(
            id=inv.id,
            email=inv.email,
            organization_id=inv.organization_id,
            status=inv.status,
            expires_at=inv.expires_at,
            created_at=inv.created_at,
        )
        for inv in invitations
    ]


@router.post("/accept", response_model=UserWithToken, status_code=status.HTTP_201_CREATED)
async def accept_invitation(
    invitation_data: InvitationAccept,
    db: AsyncSession = Depends(get_db),
) -> UserWithToken:
    """Accept an invitation and create user account."""
    
    # Find invitation by token
    result = await db.execute(
        select(Invitation).where(Invitation.token == invitation_data.token)
    )
    invitation = result.scalar_one_or_none()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nieprawidłowy token zaproszenia"
        )
    
    # Check if invitation is expired
    if invitation.is_expired():
        invitation.status = InvitationStatus.EXPIRED
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zaproszenie wygasło"
        )
    
    # Check if invitation is already accepted
    if invitation.status == InvitationStatus.ACCEPTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zaproszenie zostało już zaakceptowane"
        )
    
    # Check if user already exists
    result = await db.execute(
        select(User).where(User.email == invitation.email)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Użytkownik z tym adresem email już istnieje"
        )
    
    # Create user
    hashed_password = get_password_hash(invitation_data.password)
    user = User(
        email=invitation.email,
        hashed_password=hashed_password,
        organization_id=invitation.organization_id,
        role=UserRole.MANAGER,
    )
    db.add(user)
    
    # Update invitation status
    invitation.status = InvitationStatus.ACCEPTED
    from datetime import datetime, timezone
    invitation.accepted_at = datetime.now(timezone.utc)
    
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie można utworzyć użytkownika"
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

