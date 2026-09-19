PASSWORD_RESET_SUBJECT = "Reset your password"

PASSWORD_RESET_BODY = """Hi {name},

Someone asked to reset the password on your account. If that was you, click here
to choose a new one: {reset_url}

If you did not ask for this, you can ignore this email. To review recent sign-ins,
click here: {activity_url}

The link expires in {ttl_minutes} minutes.
"""

WELCOME_SUBJECT = "Welcome aboard"

WELCOME_BODY = """Hi {name},

Your account is ready. Sign in at {login_url} to get started.
"""
