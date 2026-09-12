import type { AppNotification, Database, NotificationKind, Session } from '../../types';
import { ForbiddenError, NotFoundError, requireSession } from '../policies';
import { getDb, mutate, nowIso, sleep, uid } from '../store';

/** Server-side fan-out. Clients can never insert a notification for another user. */
export function pushNotification(
db: Database,
userId: string,
kind: NotificationKind,
title: string,
body: string,
link: string)
: void {
  db.notifications.unshift({
    id: uid('n'),
    userId,
    kind,
    title,
    body,
    link,
    read: false,
    createdAt: nowIso()
  });
}

export function notifyAdmins(
db: Database,
kind: NotificationKind,
title: string,
body: string,
link: string,
exceptUserId?: string)
: void {
  db.profiles.
  filter((p) => p.role === 'admin' && p.status === 'active' && p.id !== exceptUserId).
  forEach((admin) => pushNotification(db, admin.id, kind, title, body, link));
}

export async function listNotifications(session: Session | null): Promise<AppNotification[]> {
  const active = requireSession(session);
  await sleep(180);
  return getDb().
  notifications.filter((n) => n.userId === active.userId).
  slice(0, 50);
}

export async function markNotificationRead(session: Session | null, id: string): Promise<void> {
  const active = requireSession(session);
  await sleep(120);
  mutate((db) => {
    const notification = db.notifications.find((n) => n.id === id);
    if (!notification) throw new NotFoundError('Notification not found.');
    if (notification.userId !== active.userId) {
      throw new ForbiddenError('You can only update your own notifications.');
    }
    notification.read = true;
  });
}

export async function markAllNotificationsRead(session: Session | null): Promise<void> {
  const active = requireSession(session);
  await sleep(160);
  mutate((db) => {
    db.notifications.forEach((n) => {
      if (n.userId === active.userId) n.read = true;
    });
  });
}