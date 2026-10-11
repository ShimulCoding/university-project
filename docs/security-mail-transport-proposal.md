# Approved recovery-email transport change

The user approved implementation and local verification on 2026-10-12. No production setting or real email delivery has been changed.

## Reproduced finding (SEC-20)

At `88a75c9`, `backend/src/config/mailer.ts:13,35` creates SMTP transports without `requireTLS`. On 2026-10-12 the real application mailer sent a synthetic reset message to a loopback SMTP fixture that did not advertise STARTTLS. The fixture confirmed receipt in plaintext. No real mail, reset tokens, users, credentials or external server were involved. Production SMTP is not configured/discovered; a real network interception has not been attempted.

An attacker controlling the SMTP path or a misconfigured relay can suppress the TLS capability and observe recovery capabilities (and potentially configured SMTP authentication). Nodemailer documents automatic STARTTLS as opportunistic unless `requireTLS` is enabled: [official SMTP transport options](https://nodemailer.com/smtp).

## Proposed permanent fix

- Require verified TLS for both configured SMTP and development Ethereal transports. Support implicit TLS on port 465 and required STARTTLS on port 587; keep certificate validation enabled, a TLS 1.2 minimum, bounded timeouts, and disable arbitrary file/URL content sources.
- Reject malformed SMTP settings and incomplete credentials without printing them. Preserve the generic password-recovery response and private operational logging. No plaintext fallback and no `rejectUnauthorized: false` bypass.
- Add synthetic loopback negative tests proving an absent/failed STARTTLS upgrade sends neither AUTH nor message contents, plus a successful locally trusted TLS fixture. Use private temporary fixture keys, never committed real secrets. Re-run recovery/MFA/project regressions.

This changes recovery delivery behavior for insecure SMTP servers, so it requires the user's approval under the security rules. Implementation and verification are confined to the review branch and local fixtures; no production configuration or mail delivery is authorized. A provider's actual TLS, delivery, sender policy and mailbox security remain unverified.
