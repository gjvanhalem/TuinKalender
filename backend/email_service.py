import os
import mailtrap as mt
from typing import Optional

def send_invitation_email(email: str, invited_by_name: Optional[str] = None, garden_name: Optional[str] = None, locale: str = "en"):
    token = os.getenv("MAILTRAP_TOKEN")
    sender_email = os.getenv("MAILTRAP_SENDER_EMAIL", "hello@plan-te.app")
    sender_name = os.getenv("MAILTRAP_SENDER_NAME", "Plan-te")
    base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    frontend_url = f"{base_url}/{locale}"

    if not token:
        print("MAILTRAP_TOKEN not found, skipping email.")
        return

    if garden_name:
        subject = f"You've been invited to the garden '{garden_name}' on Plan-te! 🌿"
        intro = f"{invited_by_name or 'Someone'} has invited you to view their garden '{garden_name}' on Plan-te."
    else:
        subject = "Welcome to Plan-te! 🌿"
        intro = "You've been invited to join Plan-te, your personal gardening assistant."

    text_content = f"""
{subject}

{intro}

Plan-te helps you manage your garden effortlessly with:
- Smart AI gardening advice
- Weather-aware plant care
- Personalized gardening calendar
- Multi-language support

Ready to get started? Click the link below to login and start gardening:
{frontend_url}

Happy gardening!
The Plan-te team
    """

    html_content = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
        <h1 style="color: #10b981; margin-top: 0;">Plan-te 🌿</h1>
        <p style="font-size: 16px; line-height: 1.5; color: #374151;">
            {intro}
        </p>
        <div style="background-color: #f9fafb; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                <li>Smart AI gardening advice</li>
                <li>Weather-aware plant care</li>
                <li>Personalized gardening calendar</li>
                <li>Multi-language support</li>
            </ul>
        </div>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{frontend_url}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Get Started</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 14px; color: #6b7280; text-align: center;">
            Happy gardening!<br>The Plan-te team
        </p>
    </div>
    """

    mail = mt.Mail(
        sender=mt.Address(email=sender_email, name=sender_name),
        to=[mt.Address(email=email)],
        subject=subject,
        text=text_content,
        html=html_content,
        category="Invitation"
    )

    client = mt.MailtrapClient(token=token)
    try:
        client.send(mail)
        print(f"Invitation email sent to {email}")
    except Exception as e:
        print(f"Failed to send email to {email}: {e}")

def send_garden_share_email(email: str, invited_by_name: str, garden_name: str, locale: str = "en"):
    token = os.getenv("MAILTRAP_TOKEN")
    sender_email = os.getenv("MAILTRAP_SENDER_EMAIL", "hello@plan-te.app")
    sender_name = os.getenv("MAILTRAP_SENDER_NAME", "Plan-te")
    base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    frontend_url = f"{base_url}/{locale}"

    if not token:
        print("MAILTRAP_TOKEN not found, skipping email.")
        return

    subject = f"New Garden Shared: {garden_name} 🌿"
    intro = f"Hi! {invited_by_name} has shared their garden '{garden_name}' with you."

    text_content = f"""
{subject}

{intro}

You can now view and manage this garden in your Plan-te dashboard.

View your gardens:
{frontend_url}/gardens

Happy gardening!
The Plan-te team
    """

    html_content = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
        <h1 style="color: #10b981; margin-top: 0;">Plan-te 🌿</h1>
        <p style="font-size: 16px; line-height: 1.5; color: #374151;">
            {intro}
        </p>
        <p style="font-size: 16px; line-height: 1.5; color: #374151;">
            You can now view and manage this garden in your Plan-te dashboard.
        </p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{frontend_url}/gardens" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Gardens</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 14px; color: #6b7280; text-align: center;">
            Happy gardening!<br>The Plan-te team
        </p>
    </div>
    """

    mail = mt.Mail(
        sender=mt.Address(email=sender_email, name=sender_name),
        to=[mt.Address(email=email)],
        subject=subject,
        text=text_content,
        html=html_content,
        category="Garden Share"
    )

    client = mt.MailtrapClient(token=token)
    try:
        client.send(mail)
        print(f"Garden share email sent to {email}")
    except Exception as e:
        print(f"Failed to send garden share email to {email}: {e}")

def send_weekly_summary_email(email: str, user_name: str, garden_summaries: list, locale: str = "en"):
    token = os.getenv("MAILTRAP_TOKEN")
    sender_email = os.getenv("MAILTRAP_SENDER_EMAIL", "hello@plan-te.app")
    sender_name = os.getenv("MAILTRAP_SENDER_NAME", "Plan-te")
    base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    frontend_url = f"{base_url}/{locale}"

    if not token:
        return

    subject = "Your Weekly Garden Summary 🌿"
    
    # Build garden HTML sections
    gardens_html = ""
    for g in garden_summaries:
        temp_html = f"<strong>{g['name']}</strong>"
        if g.get('weather'):
            temp_html += f"<p>Weather: {g['weather']}</p>"
        if g.get('advice'):
            temp_html += f"<div style='background: #f0fdf4; padding: 10px; border-radius: 5px; margin: 10px 0;'>{g['advice']}</div>"
        gardens_html += f"<div style='margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;'>{temp_html}</div>"

    html_content = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
        <h1 style="color: #10b981; margin-top: 0;">Plan-te 🌿</h1>
        <p>Hi {user_name or 'Gardener'}, here is the update for your gardens this week:</p>
        
        {gardens_html}
        
        <p style="text-align: center; margin: 30px 0;">
            <a href="{frontend_url}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Dashboard</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
            You receive this email because you enabled 'Weekly Summary' in your settings.
        </p>
    </div>
    """

    mail = mt.Mail(
        sender=mt.Address(email=sender_email, name=sender_name),
        to=[mt.Address(email=email)],
        subject=subject,
        html=html_content,
        category="Weekly Summary"
    )

    client = mt.MailtrapClient(token=token)
    try:
        client.send(mail)
    except Exception as e:
        print(f"Failed to send weekly summary to {email}: {e}")
