import type { AuditLogEntry, Database, Session } from '../../types';
import { requireAdmin } from '../policies';
import { getDb, nowIso, sleep, uid } from '../store';

/**
 * Audit rows are append-only: no service exposes an update or delete, matching
 * the insert-only RLS policy on public.audit_logs.
 */
export function recordAudit(
db: Database,
session: Session,
action: string,
entity: string,
entityId: string,
meta: AuditLogEntry['meta'] = {})
: void {
  db.auditLogs.unshift({
    id: uid('log'),
    actorId: session.userId,
    actorEmail: session.email,
    action,
    entity,
    entityId,
    meta,
    createdAt: nowIso()
  });
}

export interface AuditFilter {
  entity?: string;
  search?: string;
}

export async function listAuditLogs(session: Session | null, filter: AuditFilter = {}): Promise<AuditLogEntry[]> {
  requireAdmin(session);
  await sleep();
  const search = filter.search?.trim().toLowerCase() ?? '';
  return getDb().
  auditLogs.filter((log) => filter.entity && filter.entity !== 'all' ? log.entity === filter.entity : true).
  filter((log) =>
  search ?
  `${log.action} ${log.actorEmail} ${log.entity} ${JSON.stringify(log.meta)}`.toLowerCase().includes(search) :
  true
  ).
  slice(0, 200);
}