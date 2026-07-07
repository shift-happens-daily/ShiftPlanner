from sqlalchemy import text
from sqlalchemy.orm import Session


def ensure_email_verification_schema(db: Session) -> None:
    db.execute(
        text(
            """
            ALTER TABLE users
                ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(128),
                ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP
            """
        )
    )
    db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS users_email_verification_token_unique
            ON users (email_verification_token)
            WHERE email_verification_token IS NOT NULL
            """
        )
    )
    db.commit()
