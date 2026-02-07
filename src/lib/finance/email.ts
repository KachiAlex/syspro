/**
 * Email Service for Expenses Module
 * Handles notification emails for expense lifecycle events
 */

interface EmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

interface ExpenseNotification {
  expenseId: string;
  description: string;
  amount: number;
  totalAmount: number;
  taxAmount: number;
  category: string;
  createdBy: string;
  createdAt: string;
  approvalStatus: string;
  vendor?: string;
}

/**
 * Send email via configured service (Resend, SendGrid, etc.)
 * For now, logs to console - replace with actual email service
 */
async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // In production, integrate with Resend, SendGrid, or AWS SES
    // Example with Resend:
    // const { Resend } = await import('resend');
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // const response = await resend.emails.send({
    //   from: process.env.EMAIL_FROM || 'noreply@syspro.com',
    //   to: options.to,
    //   subject: options.subject,
    //   html: options.htmlBody,
    // });
    // return { success: response.id ? true : false, messageId: response.id };

    console.log(`[EMAIL] Sending to: ${options.to}`);
    console.log(`[EMAIL] Subject: ${options.subject}`);
    console.log(`[EMAIL] Body:\n${options.htmlBody}`);

    return {
      success: true,
      messageId: `email-${Date.now()}`,
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Email template: Expense submitted for approval
 */
export function getExpenseSubmittedTemplate(
  expense: ExpenseNotification,
  approverName: string,
  approverEmail: string
): EmailOptions {
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
    .footer { background: #1e293b; color: #94a3b8; padding: 10px; text-align: center; font-size: 12px; }
    .detail { margin: 10px 0; }
    .label { font-weight: bold; color: #475569; }
    .amount { font-size: 24px; font-weight: bold; color: #059669; }
    .button { background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Expense Approval Required</h2>
    </div>
    <div class="content">
      <p>Hello ${approverName},</p>
      <p><strong>${expense.createdBy}</strong> has submitted a new expense for your approval.</p>
      
      <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <div class="detail">
          <span class="label">Expense ID:</span> ${expense.expenseId}
        </div>
        <div class="detail">
          <span class="label">Description:</span> ${expense.description}
        </div>
        <div class="detail">
          <span class="label">Category:</span> ${expense.category}
        </div>
        ${expense.vendor ? `<div class="detail"><span class="label">Vendor:</span> ${expense.vendor}</div>` : ""}
        <div class="detail">
          <span class="label">Amount:</span> ₦${(expense.amount / 1000000).toFixed(2)}M
        </div>
        ${expense.taxAmount > 0 ? `<div class="detail"><span class="label">Tax:</span> ₦${(expense.taxAmount / 1000000).toFixed(2)}M</div>` : ""}
        <div class="detail" style="margin-top: 15px; border-top: 2px solid #e2e8f0; padding-top: 15px;">
          <span class="label">Total:</span> <span class="amount">₦${(expense.totalAmount / 1000000).toFixed(2)}M</span>
        </div>
      </div>

      <p><a href="http://syspro.local/tenant-admin?tab=expenses&id=${expense.expenseId}" class="button">Review Expense</a></p>
      
      <p>Please review and approve or reject this expense in the system.</p>
    </div>
    <div class="footer">
      <p>© 2026 Syspro ERP | This is an automated message, please do not reply</p>
    </div>
  </div>
</body>
</html>
  `;

  return {
    to: approverEmail,
    subject: `[Expense Approval] ${expense.expenseId} - ₦${(expense.amount / 1000000).toFixed(2)}M from ${expense.createdBy}`,
    htmlBody,
    textBody: `Expense ${expense.expenseId} submitted for approval by ${expense.createdBy}. Amount: ₦${(expense.totalAmount / 1000000).toFixed(2)}M. Please review in the system.`,
  };
}

/**
 * Email template: Expense approved
 */
export function getExpenseApprovedTemplate(
  expense: ExpenseNotification,
  submitterEmail: string,
  approverName: string,
  reason?: string
): EmailOptions {
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
    .footer { background: #1e293b; color: #94a3b8; padding: 10px; text-align: center; font-size: 12px; }
    .detail { margin: 10px 0; }
    .label { font-weight: bold; color: #475569; }
    .badge { background: #d1fae5; color: #065f46; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>✓ Expense Approved</h2>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Your expense <strong>${expense.expenseId}</strong> has been <span class="badge">✓ APPROVED</span></p>
      
      <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <div class="detail">
          <span class="label">Description:</span> ${expense.description}
        </div>
        <div class="detail">
          <span class="label">Amount:</span> ₦${(expense.totalAmount / 1000000).toFixed(2)}M
        </div>
        <div class="detail">
          <span class="label">Approved By:</span> ${approverName}
        </div>
        ${reason ? `<div class="detail"><span class="label">Comments:</span> ${reason}</div>` : ""}
      </div>

      <p>This expense is now ready for payment processing. You will receive another notification once it has been paid.</p>
    </div>
    <div class="footer">
      <p>© 2026 Syspro ERP | This is an automated message, please do not reply</p>
    </div>
  </div>
</body>
</html>
  `;

  return {
    to: submitterEmail,
    subject: `[Approved] Expense ${expense.expenseId} - ₦${(expense.totalAmount / 1000000).toFixed(2)}M`,
    htmlBody,
    textBody: `Your expense ${expense.expenseId} has been approved by ${approverName}.`,
  };
}

/**
 * Email template: Expense rejected
 */
export function getExpenseRejectedTemplate(
  expense: ExpenseNotification,
  submitterEmail: string,
  approverName: string,
  reason: string
): EmailOptions {
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
    .footer { background: #1e293b; color: #94a3b8; padding: 10px; text-align: center; font-size: 12px; }
    .detail { margin: 10px 0; }
    .label { font-weight: bold; color: #475569; }
    .badge { background: #fee2e2; color: #991b1b; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 10px; }
    .alert { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>✗ Expense Rejected</h2>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Your expense <strong>${expense.expenseId}</strong> has been <span class="badge">✗ REJECTED</span></p>
      
      <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <div class="detail">
          <span class="label">Description:</span> ${expense.description}
        </div>
        <div class="detail">
          <span class="label">Amount:</span> ₦${(expense.totalAmount / 1000000).toFixed(2)}M
        </div>
        <div class="detail">
          <span class="label">Rejected By:</span> ${approverName}
        </div>
      </div>

      <div class="alert">
        <strong>Reason for rejection:</strong><br>
        ${reason}
      </div>

      <p>Please address the concerns and resubmit the expense if needed. Contact ${approverName} for clarification.</p>
    </div>
    <div class="footer">
      <p>© 2026 Syspro ERP | This is an automated message, please do not reply</p>
    </div>
  </div>
</body>
</html>
  `;

  return {
    to: submitterEmail,
    subject: `[Rejected] Expense ${expense.expenseId} - Action Required`,
    htmlBody,
    textBody: `Your expense ${expense.expenseId} has been rejected by ${approverName}. Reason: ${reason}`,
  };
}

/**
 * Email template: Expense paid
 */
export function getExpensePaidTemplate(
  expense: ExpenseNotification,
  submitterEmail: string,
  paymentMethod: string,
  paymentDate: string
): EmailOptions {
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0891b2; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
    .footer { background: #1e293b; color: #94a3b8; padding: 10px; text-align: center; font-size: 12px; }
    .detail { margin: 10px 0; }
    .label { font-weight: bold; color: #475569; }
    .badge { background: #cffafe; color: #164e63; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>💳 Payment Processed</h2>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Your expense <strong>${expense.expenseId}</strong> has been <span class="badge">✓ PAID</span></p>
      
      <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <div class="detail">
          <span class="label">Description:</span> ${expense.description}
        </div>
        <div class="detail">
          <span class="label">Amount Paid:</span> ₦${(expense.totalAmount / 1000000).toFixed(2)}M
        </div>
        <div class="detail">
          <span class="label">Payment Method:</span> ${paymentMethod}
        </div>
        <div class="detail">
          <span class="label">Payment Date:</span> ${paymentDate}
        </div>
      </div>

      <p>The funds have been processed and will be in your account shortly.</p>
    </div>
    <div class="footer">
      <p>© 2026 Syspro ERP | This is an automated message, please do not reply</p>
    </div>
  </div>
</body>
</html>
  `;

  return {
    to: submitterEmail,
    subject: `[Paid] Expense ${expense.expenseId} - ₦${(expense.totalAmount / 1000000).toFixed(2)}M`,
    htmlBody,
    textBody: `Your expense ${expense.expenseId} has been paid via ${paymentMethod} on ${paymentDate}.`,
  };
}

/**
 * Send approval notification to all required approvers
 */
export async function notifyApprovers(
  expense: ExpenseNotification,
  approvers: Array<{ name: string; email: string }>
): Promise<void> {
  const results = await Promise.all(
    approvers.map((approver) => {
      const emailOptions = getExpenseSubmittedTemplate(expense, approver.name, approver.email);
      return sendEmail(emailOptions);
    })
  );

  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    console.error(`Failed to send ${failures.length} approval notifications`);
  }
}

/**
 * Send approval confirmation to submitter
 */
export async function notifyExpenseApproved(
  expense: ExpenseNotification,
  submitterEmail: string,
  approverName: string,
  reason?: string
): Promise<void> {
  const emailOptions = getExpenseApprovedTemplate(expense, submitterEmail, approverName, reason);
  const result = await sendEmail(emailOptions);

  if (!result.success) {
    console.error("Failed to send approval notification:", result.error);
  }
}

/**
 * Send rejection notification to submitter
 */
export async function notifyExpenseRejected(
  expense: ExpenseNotification,
  submitterEmail: string,
  approverName: string,
  reason: string
): Promise<void> {
  const emailOptions = getExpenseRejectedTemplate(expense, submitterEmail, approverName, reason);
  const result = await sendEmail(emailOptions);

  if (!result.success) {
    console.error("Failed to send rejection notification:", result.error);
  }
}

/**
 * Send payment confirmation to submitter
 */
export async function notifyExpensePaid(
  expense: ExpenseNotification,
  submitterEmail: string,
  paymentMethod: string,
  paymentDate: string
): Promise<void> {
  const emailOptions = getExpensePaidTemplate(expense, submitterEmail, paymentMethod, paymentDate);
  const result = await sendEmail(emailOptions);

  if (!result.success) {
    console.error("Failed to send payment notification:", result.error);
  }
}
