import nodemailer, { type Transporter } from "nodemailer";

import { env } from "./env";

let transporter: Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST && env.NODE_ENV !== "production") {
    // Generate a test account dynamically using Ethereal
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log("Ethereal test email account created:", testAccount.user);
  } else {
    // For production, you would configure real SMTP settings via env vars
    // e.g., using SendGrid, AWS SES, or a dedicated SMTP server.
    // For now, if these are missing, we throw an error or log a warning.
    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
      throw new Error("SMTP_HOST and SMTP_FROM are required for password recovery.");
    }
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

export const mailer = {
  async sendPasswordResetEmail(to: string, resetLink: string) {
    const t = await getTransporter();

    const info = await t.sendMail({
      from: process.env.SMTP_FROM || '"MU CSE Transparency" <noreply@mucse.org>',
      to,
      subject: "Password Reset Request",
      text: `You have requested to reset your password. Please click the following link to securely set a new password: ${resetLink}\n\nThis link will expire in 1 hour.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #334155; line-height: 1.6;">You have requested to reset your password for the MU CSE Transparency system.</p>
          <p style="color: #334155; line-height: 1.6;">Please click the button below to securely set a new password:</p>
          <div style="margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }
  },
};
