import nodemailer, { type Transporter } from "nodemailer";

import { env } from "./env";
import { configuredSmtpOptions, etherealSmtpOptions } from "../utils/smtp-security";

let transporter: Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST && env.NODE_ENV !== "production") {
    // Generate a test account dynamically using Ethereal
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport(etherealSmtpOptions(testAccount));
  } else {
    transporter = nodemailer.createTransport(configuredSmtpOptions(process.env));
  }

  return transporter;
}

export const mailer = {
  async sendPasswordResetEmail(to: string, resetLink: string) {
    const t = await getTransporter();

    await t.sendMail({
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

  },
};
