import { notificationsRepo } from '../repositories/notifications';
import { usersRepo } from '../repositories/users';
import { emailLabAssistants, sendEmail, type EmailMessage } from './email';
import type { InAppMessage } from './messages';

// Sends an in-app notification and, optionally, an email to one user.
export function notifyUser(userId: number, inApp: InAppMessage | null, email?: EmailMessage) {
  const user = usersRepo.findRowById(userId);
  if (!user || !user.is_active) return;
  if (inApp) notificationsRepo.create(userId, inApp.type, inApp.title, inApp.message, inApp.link);
  if (email) sendEmail(user.email, email);
}

// Emails the lab assistants and shows the notice in their notification bell.
export function notifyLabAssistants(email: EmailMessage, inApp: InAppMessage) {
  emailLabAssistants(email);
  usersRepo
    .listActiveByRole('lab_assistant')
    .forEach((u) => notificationsRepo.create(u.id, inApp.type, inApp.title, inApp.message, inApp.link));
}
