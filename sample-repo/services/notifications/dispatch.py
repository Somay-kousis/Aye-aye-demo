from services.notifications import templates


def send_password_reset(mailer, user, reset_url: str, activity_url: str, ttl_minutes: int) -> None:
    mailer.send(
        to=user.email,
        subject=templates.PASSWORD_RESET_SUBJECT,
        body=templates.PASSWORD_RESET_BODY.format(
            name=user.name,
            reset_url=reset_url,
            activity_url=activity_url,
            ttl_minutes=ttl_minutes,
        ),
    )


def send_welcome(mailer, user, login_url: str) -> None:
    mailer.send(
        to=user.email,
        subject=templates.WELCOME_SUBJECT,
        body=templates.WELCOME_BODY.format(name=user.name, login_url=login_url),
    )
