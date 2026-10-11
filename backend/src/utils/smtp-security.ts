import { isIP } from "node:net";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

const protections: SMTPTransport.Options = {
  requireTLS: true,
  opportunisticTLS: false,
  ignoreTLS: false,
  tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
  dnsTimeout: 5000,
  disableFileAccess: true,
  disableUrlAccess: true,
  logger: false,
  debug: false,
};

export function configuredSmtpOptions(settings: NodeJS.ProcessEnv): SMTPTransport.Options {
  const host = settings.SMTP_HOST?.trim();
  const from = settings.SMTP_FROM?.trim();
  const portText = settings.SMTP_PORT ?? "587";
  const port = Number(portText);
  const secureText = settings.SMTP_SECURE;
  const user = settings.SMTP_USER, pass = settings.SMTP_PASS;
  const mailbox = from?.match(/<([^<>]+)>$/)?.[1] ?? from;
  if (!host || host.length > 253 || !(isIP(host) || host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) ||
      !from || from.length > 320 || /[\x00-\x1f\x7f]/.test(from) || !mailbox || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(mailbox) ||
      !/^\d{1,5}$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535 ||
      (secureText !== undefined && !["true", "false"].includes(secureText)) ||
      Boolean(user) !== Boolean(pass) || (user && (user.length > 1024 || /[\x00-\x1f\x7f]/.test(user))) || (pass && pass.length > 4096)) {
    throw new Error("Password recovery SMTP configuration is invalid.");
  }
  return { ...protections, tls: { ...protections.tls }, host, port,
    secure: secureText === undefined ? port === 465 : secureText === "true",
    ...(user && pass ? { auth: { user, pass } } : {}),
  };
}

export function etherealSmtpOptions(account: { user: string; pass: string }): SMTPTransport.Options {
  return { ...protections, tls: { ...protections.tls }, host: "smtp.ethereal.email", port: 587, secure: false,
    auth: { user: account.user, pass: account.pass },
  };
}
