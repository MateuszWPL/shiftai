"""Email service using Resend API."""
import httpx
from typing import Optional
from app.core.config import settings


async def send_invitation_email(
    email: str,
    full_name: str,
    organization_name: str,
    invitation_token: str,
) -> bool:
    """Send invitation email via Resend API."""
    
    if not settings.RESEND_API_KEY:
        # In development, just log the invitation link
        invitation_url = f"{settings.FRONTEND_URL}/accept-invitation?token={invitation_token}"
        print(f"[EMAIL] Invitation link for {email}: {invitation_url}")
        return True
    
    invitation_url = f"{settings.FRONTEND_URL}/accept-invitation?token={invitation_token}"
    
    email_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .button {{ display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            .button:hover {{ background-color: #0056b3; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Zaproszenie do zespołu</h1>
            <p>Witaj {full_name},</p>
            <p>Zostałeś zaproszony do dołączenia do zespołu <strong>{organization_name}</strong> w systemie Antigravity.</p>
            <p>Kliknij poniższy link, aby założyć konto i dołączyć do zespołu:</p>
            <a href="{invitation_url}" class="button">Akceptuj zaproszenie</a>
            <p>Lub skopiuj i wklej ten link do przeglądarki:</p>
            <p>{invitation_url}</p>
            <p>Link jest ważny przez 7 dni.</p>
            <p>Jeśli nie prosiłeś o to zaproszenie, możesz zignorować tę wiadomość.</p>
        </div>
    </body>
    </html>
    """
    
    email_text = f"""
    Witaj {full_name},
    
    Zostałeś zaproszony do dołączenia do zespołu {organization_name} w systemie Antigravity.
    
    Kliknij poniższy link, aby założyć konto i dołączyć do zespołu:
    {invitation_url}
    
    Link jest ważny przez 7 dni.
    
    Jeśli nie prosiłeś o to zaproszenie, możesz zignorować tę wiadomość.
    """
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.RESEND_FROM_EMAIL,
                    "to": [email],
                    "subject": f"Zaproszenie do zespołu {organization_name}",
                    "html": email_html,
                    "text": email_text,
                },
                timeout=10.0,
            )
            response.raise_for_status()
            return True
        except httpx.HTTPError as e:
            print(f"[EMAIL ERROR] Failed to send invitation email: {e}")
            return False


async def send_employee_invitation_email(
    email: str,
    employee_name: str,
    organization_name: str,
    invitation_token: str,
) -> bool:
    """Send employee invitation email via Resend API."""
    
    if not settings.RESEND_API_KEY:
        # In development, just log the invitation link
        invitation_url = f"{settings.FRONTEND_URL}/accept-employee-invitation?token={invitation_token}"
        print(f"[EMAIL] Employee invitation link for {email}: {invitation_url}")
        return True
    
    invitation_url = f"{settings.FRONTEND_URL}/accept-employee-invitation?token={invitation_token}"
    
    email_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .button {{ display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            .button:hover {{ background-color: #0056b3; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Zaproszenie do systemu Antigravity</h1>
            <p>Witaj {employee_name},</p>
            <p>Zostałeś dodany jako pracownik w zespole <strong>{organization_name}</strong> w systemie Antigravity.</p>
            <p>Kliknij poniższy link, aby ustawić hasło i uzyskać dostęp do swojego panelu:</p>
            <a href="{invitation_url}" class="button">Ustaw hasło i zaloguj się</a>
            <p>Lub skopiuj i wklej ten link do przeglądarki:</p>
            <p>{invitation_url}</p>
            <p>Link jest ważny przez 7 dni.</p>
            <p>W swoim panelu będziesz mógł:</p>
            <ul>
                <li>Przeglądać swój grafik pracy</li>
                <li>Zarządzać swoją dyspozycyjnością</li>
                <li>Proponować zamiany zmian</li>
            </ul>
            <p>Jeśli nie prosiłeś o to zaproszenie, możesz zignorować tę wiadomość.</p>
        </div>
    </body>
    </html>
    """
    
    email_text = f"""
    Witaj {employee_name},
    
    Zostałeś dodany jako pracownik w zespole {organization_name} w systemie Antigravity.
    
    Kliknij poniższy link, aby ustawić hasło i uzyskać dostęp do swojego panelu:
    {invitation_url}
    
    Link jest ważny przez 7 dni.
    
    W swoim panelu będziesz mógł:
    - Przeglądać swój grafik pracy
    - Zarządzać swoją dyspozycyjnością
    - Proponować zamiany zmian
    
    Jeśli nie prosiłeś o to zaproszenie, możesz zignorować tę wiadomość.
    """
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.RESEND_FROM_EMAIL,
                    "to": [email],
                    "subject": f"Zaproszenie do systemu Antigravity - {organization_name}",
                    "html": email_html,
                    "text": email_text,
                },
                timeout=10.0,
            )
            response.raise_for_status()
            return True
        except httpx.HTTPError as e:
            print(f"[EMAIL ERROR] Failed to send employee invitation email: {e}")
            return False

