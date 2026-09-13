import type {
  AttendanceEntry,
  AuditLogEntry,
  AppNotification,
  EmploymentStatus,
  Invitation,
  InvitationStatus,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  NotificationKind,
  Presence,
  Profile,
  Role,
  WorkMode
} from './index';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: Role;
          job_title: string;
          department: string;
          manager_id: string | null;
          phone: string;
          location: string;
          timezone: string;
          work_mode: WorkMode;
          status: EmploymentStatus;
          hire_date: string;
          emergency_contact: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: Role;
          job_title?: string;
          department?: string;
          manager_id?: string | null;
          phone?: string;
          location?: string;
          timezone?: string;
          work_mode?: WorkMode;
          status?: EmploymentStatus;
          hire_date?: string;
          emergency_contact?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      invitations: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: Role;
          job_title: string;
          department: string;
          work_mode: WorkMode;
          token_hash: string;
          status: InvitationStatus;
          invited_by: string;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          role?: Role;
          job_title: string;
          department: string;
          work_mode?: WorkMode;
          token_hash: string;
          status?: InvitationStatus;
          invited_by: string;
          created_at?: string;
          expires_at?: string;
        };
        Update: Partial<Database['public']['Tables']['invitations']['Insert']>;
      };
      attendance: {
        Row: {
          id: string;
          employee_id: string;
          work_date: string;
          clock_in: string;
          clock_out: string | null;
          break_minutes: number;
          work_mode: WorkMode;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          work_date?: string;
          clock_in?: string;
          clock_out?: string | null;
          break_minutes?: number;
          work_mode?: WorkMode;
          note?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['attendance']['Insert']>;
      };
      presence: {
        Row: {
          employee_id: string;
          status: 'working' | 'on_break' | 'off_shift' | 'on_leave';
          work_mode: WorkMode;
          updated_at: string;
        };
        Insert: {
          employee_id: string;
          status?: 'working' | 'on_break' | 'off_shift' | 'on_leave';
          work_mode?: WorkMode;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['presence']['Insert']>;
      };
      leave_entitlements: {
        Row: {
          employee_id: string;
          year: number;
          type: LeaveType;
          days: number;
        };
        Insert: {
          employee_id: string;
          year: number;
          type: LeaveType;
          days?: number;
        };
        Update: Partial<Database['public']['Tables']['leave_entitlements']['Insert']>;
      };
      leave_requests: {
        Row: {
          id: string;
          employee_id: string;
          type: LeaveType;
          start_date: string;
          end_date: string;
          days: number;
          reason: string;
          status: LeaveStatus;
          decided_by: string | null;
          decided_at: string | null;
          decision_note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          type: LeaveType;
          start_date: string;
          end_date: string;
          days: number;
          reason: string;
          status?: LeaveStatus;
          decided_by?: string | null;
          decided_at?: string | null;
          decision_note?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['leave_requests']['Insert']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          title: string;
          body: string;
          link: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          title: string;
          body?: string;
          link?: string;
          read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_email: string;
          action: string;
          entity: string;
          entity_id: string;
          meta: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_email: string;
          action: string;
          entity: string;
          entity_id: string;
          meta?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: {
        Args: {
          p_token_hash: string;
          p_password: string;
        };
        Returns: string;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
  };
}

// Model transformation helpers (snake_case DB rows <-> camelCase App models)

export function mapProfileFromDb(row: Database['public']['Tables']['profiles']['Row']): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    jobTitle: row.job_title,
    department: row.department,
    managerId: row.manager_id,
    phone: row.phone,
    location: row.location,
    timezone: row.timezone,
    workMode: row.work_mode,
    status: row.status,
    hireDate: row.hire_date,
    emergencyContact: row.emergency_contact,
    createdAt: row.created_at
  };
}

export function mapAttendanceFromDb(row: Database['public']['Tables']['attendance']['Row']): AttendanceEntry {
  return {
    id: row.id,
    employeeId: row.employee_id,
    date: row.work_date,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    breakMinutes: row.break_minutes,
    workMode: row.work_mode,
    note: row.note
  };
}

export function mapPresenceFromDb(row: Database['public']['Tables']['presence']['Row']): Presence {
  return {
    employeeId: row.employee_id,
    status: row.status,
    workMode: row.work_mode,
    updatedAt: row.updated_at
  };
}

export function mapLeaveRequestFromDb(row: Database['public']['Tables']['leave_requests']['Row']): LeaveRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    days: row.days,
    reason: row.reason,
    status: row.status,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at
  };
}

export function mapNotificationFromDb(row: Database['public']['Tables']['notifications']['Row']): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind as NotificationKind,
    title: row.title,
    body: row.body,
    link: row.link,
    read: row.read,
    createdAt: row.created_at
  };
}

export function mapAuditLogFromDb(row: Database['public']['Tables']['audit_logs']['Row']): AuditLogEntry {
  return {
    id: row.id,
    actorId: row.actor_id || '',
    actorEmail: row.actor_email,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    meta: (row.meta as Record<string, string | number | boolean | null>) || {},
    createdAt: row.created_at
  };
}

export function mapInvitationFromDb(row: Database['public']['Tables']['invitations']['Row']): Invitation {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    jobTitle: row.job_title,
    department: row.department,
    workMode: row.work_mode,
    token: row.token_hash,
    status: row.status,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}
