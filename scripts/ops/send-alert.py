#!/usr/bin/env python3
# Sends an alert email via the SMTP creds in /opt/syspro-erp/.env.
# Usage: send-alert.py "subject" "body"
import sys, smtplib
from email.message import EmailMessage

env = {}
with open("/opt/syspro-erp/.env") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")

msg = EmailMessage()
msg["From"] = env.get("EMAIL_FROM", "alerts@pisairtelerp.com")
msg["To"] = "admin@pisairtel.com"
msg["Subject"] = sys.argv[1] if len(sys.argv) > 1 else "syspro-erp alert"
msg.set_content(sys.argv[2] if len(sys.argv) > 2 else "")

with smtplib.SMTP(env["SMTP_HOST"], int(env.get("SMTP_PORT", "587")), timeout=20) as s:
    s.starttls()
    s.login(env["SMTP_USER"], env["SMTP_PASS"])
    s.send_message(msg)
