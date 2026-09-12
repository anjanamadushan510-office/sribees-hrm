import type { Session } from '../../types';
import { getDb, nowIso, sleep } from '../store';
import { requireAdmin } from '../policies';
import { listAuditLogs } from './audit';
import { listAttendance } from './attendance';
import { getEmployee, listEmployees, listInvitations, updateEmployment, inviteEmployee } from './employees';
import { createLeaveRequest, decideLeaveRequest, listLeaveRequests } from './leave';
import { markNotificationRead } from './notifications';

export interface CheckResult {
  id: string;
  scenario: string;
  expectation: string;
  passed: boolean;
  detail: string;
}

function forgeSession(userId: string, role: 'admin' | 'employee'): Session {
  const profile = getDb().profiles.find((p) => p.id === userId);
  // Deliberately claims a role the client does not have — the policy layer must
  // ignore it and read the real role from the database row.
  return { userId, email: profile?.email ?? 'unknown@example.com', role, issuedAt: nowIso() };
}

async function expectRejection(
id: string,
scenario: string,
expectation: string,
action: () => Promise<unknown>)
: Promise<CheckResult> {
  try {
    await action();
    return { id, scenario, expectation, passed: false, detail: 'The operation was ALLOWED. This is a security hole.' };
  } catch (error) {
    return {
      id,
      scenario,
      expectation,
      passed: true,
      detail: `Rejected: ${error instanceof Error ? error.message : 'unknown error'}`
    };
  }
}

/**
 * Executes the critical authorization scenarios against the real policy layer.
 * Every scenario is expected to be REJECTED, so running them never mutates data.
 */
export async function runSecurityChecks(session: Session | null): Promise<CheckResult[]> {
  requireAdmin(session);
  await sleep(300);

  const db = getDb();
  const employee = db.profiles.find((p) => p.role === 'employee' && p.status === 'active');
  const otherEmployee = db.profiles.find(
    (p) => p.role === 'employee' && p.status === 'active' && p.id !== employee?.id
  );
  const suspended = db.profiles.find((p) => p.status === 'suspended');
  const admin = db.profiles.find((p) => p.role === 'admin' && p.status === 'active');

  if (!employee || !otherEmployee || !admin) {
    return [
    {
      id: 'setup',
      scenario: 'Test fixtures',
      expectation: 'At least two active employees and one administrator exist',
      passed: false,
      detail: 'Not enough accounts in the database to run the scenarios.'
    }];

  }

  const employeeSession = forgeSession(employee.id, 'employee');
  const escalated = forgeSession(employee.id, 'admin');
  const results: CheckResult[] = [];

  results.push(
    await expectRejection(
      'privilege-escalation',
      'Employee sends a session claiming role=admin',
      'Role is read from the database, not the token payload',
      () => listInvitations(escalated)
    )
  );

  results.push(
    await expectRejection(
      'cross-user-attendance',
      'Employee reads a colleague’s attendance records',
      'Attendance is readable only by its owner and HR',
      () => listAttendance(employeeSession, { employeeId: otherEmployee.id })
    )
  );

  results.push(
    await expectRejection(
      'cross-user-leave',
      'Employee filters leave requests by a colleague’s id',
      'Leave rows are scoped to the requesting user',
      () => listLeaveRequests(employeeSession, { employeeId: otherEmployee.id })
    )
  );

  results.push(
    await expectRejection(
      'self-promotion',
      'Employee edits their own employment record to become an admin',
      'Employment and role fields are HR-only',
      () =>
      updateEmployment(employeeSession, employee.id, {
        jobTitle: employee.jobTitle,
        department: employee.department,
        workMode: employee.workMode,
        role: 'admin',
        managerId: employee.managerId
      })
    )
  );

  results.push(
    await expectRejection(
      'foreign-notification',
      'Employee marks a colleague’s notification as read',
      'Notifications are writable only by their recipient',
      () => {
        const foreign = db.notifications.find((n) => n.userId !== employee.id);
        return markNotificationRead(employeeSession, foreign?.id ?? 'missing');
      }
    )
  );

  results.push(
    await expectRejection(
      'audit-read',
      'Employee opens the audit log',
      'Audit history is restricted to HR administrators',
      () => listAuditLogs(employeeSession)
    )
  );

  results.push(
    await expectRejection(
      'invite-as-employee',
      'Employee invites a new user',
      'Only HR can create invitations',
      () =>
      inviteEmployee(employeeSession, {
        email: 'intruder@sribees.com',
        fullName: 'Intruder Test',
        role: 'admin',
        jobTitle: 'Test',
        department: 'Test',
        workMode: 'remote'
      })
    )
  );

  const ownPending = db.leaveRequests.find((r) => r.employeeId === admin.id && r.status === 'pending');
  results.push(
    await expectRejection(
      'self-approval',
      'Administrator approves their own leave request',
      'Separation of duties — another administrator must decide',
      () => decideLeaveRequest(forgeSession(admin.id, 'admin'), ownPending?.id ?? 'missing', 'approved', 'Self test')
    )
  );

  if (suspended) {
    results.push(
      await expectRejection(
        'suspended-account',
        'Suspended employee uses a still-valid session',
        'Suspended accounts lose access immediately',
        () => listEmployees(forgeSession(suspended.id, 'employee'))
      )
    );
  }

  results.push(
    await expectRejection(
      'server-validation',
      'Malformed invitation submitted straight to the service layer',
      'Validation runs on the server, not only in the form',
      () =>
      inviteEmployee(session, {
        email: 'not-an-email',
        fullName: '',
        role: 'employee',
        jobTitle: '',
        department: '',
        workMode: 'remote'
      })
    )
  );

  results.push(
    await expectRejection(
      'balance-overdraft',
      'Employee requests more annual leave than they have left',
      'Balances are enforced server-side before insert',
      () =>
      createLeaveRequest(employeeSession, {
        type: 'annual',
        startDate: '2026-01-05',
        endDate: '2026-12-31',
        reason: 'Attempting to exceed the annual entitlement.'
      })
    )
  );

  // Read-only check: sensitive columns must be stripped from directory reads.
  const colleague = await getEmployee(employeeSession, otherEmployee.id);
  const leaked = [colleague.phone, colleague.emergencyContact, colleague.hireDate].filter(Boolean);
  results.push({
    id: 'column-redaction',
    scenario: 'Employee opens a colleague’s directory record',
    expectation: 'Phone, emergency contact and start date are withheld',
    passed: leaked.length === 0,
    detail:
    leaked.length === 0 ?
    'Sensitive columns were withheld from the response.' :
    `Leaked ${leaked.length} sensitive field(s).`
  });

  return results;
}