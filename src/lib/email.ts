/**
 * Centralized Email Service
 * Uses Resend when RESEND_API_KEY is configured, otherwise falls back to console logging in development.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM || "noreply@syspro.app";
}

/**
 * Send an email via the configured provider.
 * In production, set RESEND_API_KEY to enable Resend.
 * In development without a key, logs to console.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[Email Service] (dev mode — no RESEND_API_KEY)");
      console.log(`  To: ${message.to}`);
      console.log(`  Subject: ${message.subject}`);
      console.log(`  Body: ${message.text || message.html.substring(0, 200)}...`);
      return { success: true, messageId: `dev-${Date.now()}` };
    }
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({
      from: getFromAddress(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (response.error) {
      return { success: false, error: response.error.message };
    }

    return { success: true, messageId: response.data?.id };
  } catch (error: any) {
    console.error("Email send failed:", error);
    return { success: false, error: error?.message || "Unknown email error" };
  }
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<EmailResult> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1e293b;">Password Reset</h2>
      <p style="color: #475569; font-size: 15px;">Hi ${name},</p>
      <p style="color: #475569; font-size: 15px;">
        We received a request to reset your password. Click the button below to choose a new password:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
          Reset Password
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 13px;">
        If you didn't request this, you can safely ignore this email. The link expires in 30 minutes.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">SysPro ERP — This is an automated message, please do not reply.</p>
    </div>
  `;
  const text = `Hi ${name},\n\nWe received a request to reset your password. Visit this link to choose a new password:\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email. The link expires in 30 minutes.`;

  return sendEmail({ to, subject: "Reset your SysPro password", html, text });
}

/**
 * Send portal activation email with credentials
 */
export async function sendPortalActivationEmail(
  to: string,
  name: string,
  password: string,
  loginUrl: string
): Promise<EmailResult> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1e293b;">Your Portal Account is Active</h2>
      <p style="color: #475569; font-size: 15px;">Hi ${name},</p>
      <p style="color: #475569; font-size: 15px;">
        Your employee portal account has been activated. Here are your login credentials:
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">Email:</p>
        <p style="margin: 0 0 16px; color: #1e293b; font-size: 15px; font-weight: 600;">${to}</p>
        <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">Temporary Password:</p>
        <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600; font-family: monospace;">${password}</p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${loginUrl}" style="display: inline-block; padding: 12px 32px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
          Log in to Portal
        </a>
      </div>
      <p style="color: #ef4444; font-size: 13px; font-weight: 500;">
        Please change your password after logging in for the first time.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">SysPro ERP — This is an automated message, please do not reply.</p>
    </div>
  `;
  const text = `Hi ${name},\n\nYour employee portal account has been activated.\n\nEmail: ${to}\nTemporary Password: ${password}\n\nLog in at: ${loginUrl}\n\nPlease change your password after logging in.`;

  return sendEmail({ to, subject: "Your SysPro portal account is active", html, text });
}

/**
 * Send an expense approval/rejection notification
 */
export async function sendExpenseNotificationEmail(
  to: string,
  name: string,
  description: string,
  amount: number,
  status: string,
  currency = "USD"
): Promise<EmailResult> {
  const statusColor = status === "approved" ? "#16a34a" : status === "rejected" ? "#dc2626" : "#ca8a04";
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1e293b;">Expense ${status.charAt(0).toUpperCase() + status.slice(1)}</h2>
      <p style="color: #475569; font-size: 15px;">Hi ${name},</p>
      <p style="color: #475569; font-size: 15px;">
        Your expense request has been <strong style="color: ${statusColor};">${status}</strong>.
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">Description:</p>
        <p style="margin: 0 0 16px; color: #1e293b; font-size: 15px;">${description}</p>
        <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">Amount:</p>
        <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">${currency} ${Number(amount).toLocaleString()}</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">SysPro ERP — This is an automated message, please do not reply.</p>
    </div>
  `;
  const text = `Hi ${name},\n\nYour expense "${description}" for ${currency} ${amount} has been ${status}.\n\nSysPro ERP`;

  return sendEmail({ to, subject: `Expense ${status}: ${description}`, html, text });
}
