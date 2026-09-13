import type { Session } from '../../types';
import { ConflictError, ValidationError, requireAdmin, requireSession } from '../policies';
import { getDb, mutate, sleep } from '../store';
import { recordAudit } from './audit';

export const DEFAULT_DEPARTMENTS = [
  'People Operations',
  'Engineering',
  'Design',
  'Finance',
  'Customer Success'
];

export async function listManagedDepartments(session: Session | null): Promise<string[]> {
  requireSession(session);
  await sleep(150);
  const db = getDb();
  const stored = db.departments ?? [];
  const fromProfiles = db.profiles.map((p) => p.department).filter(Boolean);
  const all = Array.from(new Set([...DEFAULT_DEPARTMENTS, ...stored, ...fromProfiles]));
  return all.sort();
}

export async function addDepartment(session: Session | null, name: string): Promise<string[]> {
  const active = requireAdmin(session);
  const trimmed = name.trim();
  if (!trimmed) throw new ValidationError({ name: 'Department name cannot be empty.' });
  if (trimmed.length > 50) throw new ValidationError({ name: 'Department name is too long.' });
  await sleep(250);

  return mutate((db) => {
    if (!db.departments) {
      db.departments = [...DEFAULT_DEPARTMENTS];
    }
    const exists = db.departments.some((d) => d.toLowerCase() === trimmed.toLowerCase()) ||
      db.profiles.some((p) => p.department.toLowerCase() === trimmed.toLowerCase());
    
    if (exists) {
      throw new ConflictError('A department with that name already exists.');
    }

    db.departments.push(trimmed);
    recordAudit(db, active, 'department.created', 'department', trimmed, { name: trimmed });
    const fromProfiles = db.profiles.map((p) => p.department).filter(Boolean);
    return Array.from(new Set([...db.departments, ...fromProfiles])).sort();
  });
}

export async function renameDepartment(
  session: Session | null,
  oldName: string,
  newName: string
): Promise<string[]> {
  const active = requireAdmin(session);
  const trimmedNew = newName.trim();
  if (!trimmedNew) throw new ValidationError({ name: 'Department name cannot be empty.' });
  if (trimmedNew.length > 50) throw new ValidationError({ name: 'Department name is too long.' });
  await sleep(300);

  return mutate((db) => {
    if (!db.departments) {
      db.departments = Array.from(new Set([...DEFAULT_DEPARTMENTS, ...db.profiles.map((p) => p.department)]));
    }

    const index = db.departments.findIndex((d) => d.toLowerCase() === oldName.toLowerCase());
    if (index !== -1) {
      db.departments[index] = trimmedNew;
    } else {
      db.departments.push(trimmedNew);
    }

    // Update all employee profiles with the old department name
    db.profiles.forEach((p) => {
      if (p.department.toLowerCase() === oldName.toLowerCase()) {
        p.department = trimmedNew;
      }
    });

    // Update invitations
    db.invitations.forEach((i) => {
      if (i.department.toLowerCase() === oldName.toLowerCase()) {
        i.department = trimmedNew;
      }
    });

    recordAudit(db, active, 'department.renamed', 'department', oldName, { oldName, newName: trimmedNew });
    const fromProfiles = db.profiles.map((p) => p.department).filter(Boolean);
    return Array.from(new Set([...db.departments, ...fromProfiles])).sort();
  });
}

export async function deleteDepartment(session: Session | null, name: string): Promise<string[]> {
  const active = requireAdmin(session);
  await sleep(250);

  return mutate((db) => {
    const assignedCount = db.profiles.filter(
      (p) => p.department.toLowerCase() === name.toLowerCase() && p.status === 'active'
    ).length;

    if (assignedCount > 0) {
      throw new ConflictError(
        `Cannot delete "${name}" because ${assignedCount} active employee${assignedCount === 1 ? ' is' : 's are'} assigned to it.`
      );
    }

    if (!db.departments) {
      db.departments = Array.from(new Set([...DEFAULT_DEPARTMENTS, ...db.profiles.map((p) => p.department)]));
    }

    db.departments = db.departments.filter((d) => d.toLowerCase() !== name.toLowerCase());
    recordAudit(db, active, 'department.deleted', 'department', name, { name });

    const fromProfiles = db.profiles.map((p) => p.department).filter(Boolean);
    return Array.from(new Set([...db.departments, ...fromProfiles])).sort();
  });
}
