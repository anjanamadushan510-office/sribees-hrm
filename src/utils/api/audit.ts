import type { AuditLogEntry, Database, Session } from '../../types';
import { getSupabase } from '../../lib/supabase/client';
import { mapAuditLogFromDb } from '../../types/database.types';
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
  meta: AuditLogEntry['meta'] = {}
): void {
  const supabase = getSupabase();
  if (supabase) {
    supabase.from('audit_logs').insert({
      actor_id: session.userId,
      actor_email: session.email,
      action,
      entity,
      entity_id: entityId,
      meta: meta as any
    }).then();
    return;
  }

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
  const supabase = getSupabase();

  if (supabase) {
    let query = supabase.from('audit_logs').select('*');
    if (filter.entity && filter.entity !== 'all') {
      query = query.eq('entity', filter.entity);
    }
    const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
    if (error) throw new Error(error.message);

    const logs = (data || []).map(mapAuditLogFromDb);
    if (filter.search?.trim()) {
      const search = filter.search.trim().toLowerCase();
      return logs.filter((log) =>
        `${log.action} ${log.actorEmail} ${log.entity} ${JSON.stringify(log.meta)}`.toLowerCase().includes(search)
      );
    }
    return logs;
  }

  await sleep();
  const search = filter.search?.trim().toLowerCase() ?? '';
  return getDb()
    .auditLogs.filter((log) => (filter.entity && filter.entity !== 'all' ? log.entity === filter.entity : true))
    .filter((log) =>
      search ? `${log.action} ${log.actorEmail} ${log.entity} ${JSON.stringify(log.meta)}`.toLowerCase().includes(search) : true
    )
    .slice(0, 200);
}