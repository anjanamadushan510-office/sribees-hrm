export type Role = 'admin' | 'employee';

export type EmploymentStatus = 'active' | 'invited' | 'suspended';

export type WorkMode = 'office' | 'remote' | 'hybrid';

export type LeaveType = 'annual' | 'sick' | 'unpaid' | 'parental';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  jobTitle: string;
  department: string;
  managerId: string | null;
  phone: string;
  location: string;
  timezone: string;
  workMode: WorkMode;
  status: EmploymentStatus;
  hireDate: string;
  emergencyContact: string;
  createdAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  jobTitle: string;
  department: string;
  workMode: WorkMode;
  token: string;
  status: InvitationStatus;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

/** One row per employee per calendar day. */
export interface AttendanceEntry {
  id: string;
  employeeId: string;
  /** ISO date, e.g. 2026-09-11 */
  date: string;
  /** ISO timestamp */
  clockIn: string;
  /** null while the shift is open */
  clockOut: string | null;
  breakMinutes: number;
  workMode: WorkMode;
  note: string;
}

/** Live remote-workforce presence, one row per employee. */
export interface Presence {
  employeeId: string;
  status: 'working' | 'on_break' | 'off_shift' | 'on_leave';
  workMode: WorkMode;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string;
  createdAt: string;
}

/** Only the entitlement is stored. Used/pending days are always derived from requests. */
export interface LeaveEntitlement {
  employeeId: string;
  year: number;
  type: LeaveType;
  days: number;
}

export interface LeaveBalance {
  type: LeaveType;
  entitlementDays: number;
  approvedDays: number;
  pendingDays: number;
  remainingDays: number;
}

export type NotificationKind =
'leave_submitted' |
'leave_decided' |
'invitation_sent' |
'invitation_accepted' |
'attendance_reminder';

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string;
  meta: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface Session {
  userId: string;
  email: string;
  role: Role;
  issuedAt: string;
}

export interface Database {
  profiles: Profile[];
  credentials: Record<string, string>;
  invitations: Invitation[];
  attendance: AttendanceEntry[];
  presence: Presence[];
  leaveRequests: LeaveRequest[];
  leaveEntitlements: LeaveEntitlement[];
  notifications: AppNotification[];
  auditLogs: AuditLogEntry[];
}