"""Notificaciones por correo (SMTP estándar)."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


def _parse_recipients(settings: Settings) -> list[str]:
    raw = (settings.ticket_notify_emails or "").strip()
    if not raw:
        return []
    return [e.strip() for e in raw.split(",") if e.strip()]


def send_ticket_created_email(
    *,
    ticket_id: str,
    plate: str,
    title: str,
    priority: str,
    description: str | None,
    anomaly_id: str | None = None,
    settings: Settings | None = None,
) -> bool:
    """
    Envía correo si SMTP_ENABLED=1 y hay destinatarios en TICKET_NOTIFY_EMAILS.
    Devuelve True si se intentó enviar con éxito; False si está deshabilitado o sin config.
    """
    cfg = settings or get_settings()
    if not cfg.smtp_enabled:
        return False

    recipients = _parse_recipients(cfg)
    if not recipients:
        logger.warning("SMTP activo pero TICKET_NOTIFY_EMAILS vacío; no se envía correo de ticket")
        return False

    if not cfg.smtp_host or not cfg.smtp_from:
        logger.warning("SMTP incompleto (host/from); no se envía correo de ticket")
        return False

    front = (cfg.frontend_base_url or "").rstrip("/")
    ticket_link = f"{front}/tickets" if front else "(configura FRONTEND_BASE_URL para enlace directo)"

    body_text = (
        f"Se creó un ticket de mantenimiento en Telema Mobility.\n\n"
        f"ID: {ticket_id}\n"
        f"Vehículo: {plate}\n"
        f"Prioridad: {priority}\n"
        f"Título: {title}\n"
    )
    if anomaly_id:
        body_text += f"Anomalía origen: {anomaly_id}\n"
    if description:
        body_text += f"\nDescripción:\n{description}\n"
    body_text += f"\nVer tickets: {ticket_link}\n"

    msg = EmailMessage()
    msg["Subject"] = f"[Telema] Ticket {priority.upper()} · {plate} · {title[:60]}"
    msg["From"] = cfg.smtp_from
    msg["To"] = ", ".join(recipients)
    msg.set_content(body_text)

    try:
        if cfg.smtp_use_tls:
            with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=30) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
                if cfg.smtp_user and cfg.smtp_password:
                    smtp.login(cfg.smtp_user, cfg.smtp_password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=30) as smtp:
                if cfg.smtp_user and cfg.smtp_password:
                    smtp.login(cfg.smtp_user, cfg.smtp_password)
                smtp.send_message(msg)
        logger.info("Correo de ticket enviado a %s (ticket %s)", recipients, ticket_id)
        return True
    except Exception:
        logger.exception("No se pudo enviar correo de ticket %s", ticket_id)
        return False
