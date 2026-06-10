from app.core.config import Settings
from app.core.email_notify import send_ticket_created_email


def test_email_skipped_when_disabled() -> None:
    cfg = Settings(
        database_url="postgresql+psycopg://x:x@127.0.0.1:1/x",
        database_url_async="postgresql+asyncpg://x:x@127.0.0.1:1/x",
        jwt_secret="test-secret-minimum-len",
        smtp_enabled=False,
        ticket_notify_emails="a@b.com",
    )
    assert (
        send_ticket_created_email(
            ticket_id="00000000-0000-4000-8000-000000000099",
            plate="TEST-1",
            title="Prueba",
            priority="high",
            description=None,
            settings=cfg,
        )
        is False
    )


def test_email_skipped_without_recipients() -> None:
    cfg = Settings(
        database_url="postgresql+psycopg://x:x@127.0.0.1:1/x",
        database_url_async="postgresql+asyncpg://x:x@127.0.0.1:1/x",
        jwt_secret="test-secret-minimum-len",
        smtp_enabled=True,
        smtp_host="smtp.example.com",
        smtp_from="noreply@example.com",
        ticket_notify_emails="",
    )
    assert (
        send_ticket_created_email(
            ticket_id="00000000-0000-4000-8000-000000000099",
            plate="TEST-1",
            title="Prueba",
            priority="medium",
            description="desc",
            settings=cfg,
        )
        is False
    )
