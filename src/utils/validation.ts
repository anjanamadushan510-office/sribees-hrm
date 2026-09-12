import { businessDaysBetween } from './time';
import type { LeaveType, Role, WorkMode } from '../types';

export type FieldErrors = Record<string, string>;

export interface InviteInput {
  email: string;
  fullName: string;
  role: Role;
  jobTitle: string;
  department: string;
  workMode: WorkMode;
}

export interface LeaveInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface ProfileInput {
  phone: string;
  location: string;
  timezone: string;
  emergencyContact: string;
  workMode?: WorkMode;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const PHONE_RE = /^[+()\d\s-]{7,20}$/;

/**
 * Shared validators. Forms call these for inline feedback and every service
 * function calls them again before writing, so a crafted request cannot bypass
 * client-side checks.
 */
export function validateInvite(input: InviteInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.fullName.trim()) errors.fullName = 'Full name is required.';else
  if (input.fullName.trim().length < 2) errors.fullName = 'Enter the full legal name.';
  if (!input.email.trim()) errors.email = 'Work email is required.';else
  if (!EMAIL_RE.test(input.email.trim())) errors.email = 'Enter a valid email address.';
  if (!input.jobTitle.trim()) errors.jobTitle = 'Job title is required.';
  if (!input.department.trim()) errors.department = 'Department is required.';
  if (input.role !== 'admin' && input.role !== 'employee') errors.role = 'Choose a valid role.';
  if (!['office', 'remote', 'hybrid'].includes(input.workMode)) errors.workMode = 'Choose a work mode.';
  return errors;
}

export function validateLeave(input: LeaveInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.startDate) errors.startDate = 'Pick a start date.';
  if (!input.endDate) errors.endDate = 'Pick an end date.';
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    errors.endDate = 'End date cannot be before the start date.';
  }
  if (input.startDate && input.endDate && businessDaysBetween(input.startDate, input.endDate) === 0) {
    errors.startDate = 'Select at least one working day.';
  }
  if (!input.reason.trim()) errors.reason = 'Add a short reason so HR can review it.';else
  if (input.reason.trim().length < 8) errors.reason = 'Give a little more detail (8+ characters).';else
  if (input.reason.length > 500) errors.reason = 'Keep the reason under 500 characters.';
  if (!['annual', 'sick', 'unpaid', 'parental'].includes(input.type)) errors.type = 'Choose a leave type.';
  return errors;
}

export function validateProfile(input: ProfileInput): FieldErrors {
  const errors: FieldErrors = {};
  if (input.phone && !PHONE_RE.test(input.phone)) errors.phone = 'Enter a valid phone number.';
  if (input.location && input.location.length > 80) errors.location = 'Location is too long.';
  if (!input.timezone.trim()) errors.timezone = 'Timezone is required.';
  if (input.emergencyContact && input.emergencyContact.length > 120) {
    errors.emergencyContact = 'Emergency contact is too long.';
  }
  return errors;
}

export function validateCredentials(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'Email is required.';else
  if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Password is required.';else
  if (password.length < 8) errors.password = 'Passwords are at least 8 characters.';
  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}