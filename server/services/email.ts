// Sends email through SMTP when it is configured, and always records the
// message in the email_log table so admins and lab assistants can see what
// was sent. Without SMTP settings the log is the only "delivery", which is
// handy for demos.

import nodemailer from 'nodemailer';
import { env } from '../env';
import { emailLogRepo } from '../repositories/notifications';
import { usersRepo } from '../repositories/users';

const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

export const emailDelivery: 'smtp' | 'log' = transporter ? 'smtp' : 'log';

export interface EmailMessage {
  subject: string;
  body: string;
}

export function sendEmail(to: string, message: EmailMessage) {
  const id = emailLogRepo.create(to, message.subject, message.body, 'logged');
  if (!transporter) return;

  // Sent in the background so a slow mail server never holds up a request.
  transporter
    .sendMail({ from: env.smtp.from, to, subject: message.subject, text: message.body })
    .then(() => emailLogRepo.setStatus(id, 'sent'))
    .catch((error: Error) => {
      console.error(`Email to ${to} failed:`, error.message);
      emailLogRepo.setStatus(id, 'failed', error.message);
    });
}

export function labAssistantEmails(): string[] {
  if (env.labAssistantEmails.length) return env.labAssistantEmails;
  return usersRepo.listActiveByRole('lab_assistant').map((u) => u.email);
}

export function emailLabAssistants(message: EmailMessage) {
  labAssistantEmails().forEach((to) => sendEmail(to, message));
}
