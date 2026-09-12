import type {
  AttendanceEntry,
  Database,
  LeaveEntitlement,
  LeaveRequest,
  Presence,
  Profile } from
'../types';
import { isWeekend, lastNDates, toISODate } from '../utils/time';

/** Deterministic PRNG so demo data is stable across reloads. */
function rng(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

const PEOPLE: Array<Omit<Profile, 'createdAt'>> = [
{
  id: 'u-admin',
  email: 'dana.okafor@sribees.com',
  fullName: 'Dana Okafor',
  role: 'admin',
  jobTitle: 'Head of People',
  department: 'People Operations',
  managerId: null,
  phone: '+1 415 555 0134',
  location: 'San Francisco, US',
  timezone: 'America/Los_Angeles',
  workMode: 'hybrid',
  status: 'active',
  hireDate: '2021-03-01',
  emergencyContact: 'Tomi Okafor · +1 415 555 0199'
},
{
  id: 'u-2',
  email: 'marco.silva@sribees.com',
  fullName: 'Marco Silva',
  role: 'employee',
  jobTitle: 'Senior Backend Engineer',
  department: 'Engineering',
  managerId: 'u-admin',
  phone: '+351 912 555 044',
  location: 'Lisbon, PT',
  timezone: 'Europe/Lisbon',
  workMode: 'remote',
  status: 'active',
  hireDate: '2022-06-13',
  emergencyContact: 'Ines Silva · +351 912 555 090'
},
{
  id: 'u-3',
  email: 'aisha.rahman@sribees.com',
  fullName: 'Aisha Rahman',
  role: 'employee',
  jobTitle: 'Product Designer',
  department: 'Design',
  managerId: 'u-admin',
  phone: '+44 7700 900 221',
  location: 'Manchester, UK',
  timezone: 'Europe/London',
  workMode: 'hybrid',
  status: 'active',
  hireDate: '2023-01-09',
  emergencyContact: 'Yusuf Rahman · +44 7700 900 555'
},
{
  id: 'u-4',
  email: 'liam.chen@sribees.com',
  fullName: 'Liam Chen',
  role: 'employee',
  jobTitle: 'Data Analyst',
  department: 'Finance',
  managerId: 'u-admin',
  phone: '+1 646 555 0112',
  location: 'New York, US',
  timezone: 'America/New_York',
  workMode: 'office',
  status: 'active',
  hireDate: '2023-08-21',
  emergencyContact: 'Mei Chen · +1 646 555 0177'
},
{
  id: 'u-5',
  email: 'sofia.novak@sribees.com',
  fullName: 'Sofia Novak',
  role: 'employee',
  jobTitle: 'Customer Success Lead',
  department: 'Customer Success',
  managerId: 'u-admin',
  phone: '+420 601 555 018',
  location: 'Prague, CZ',
  timezone: 'Europe/Prague',
  workMode: 'remote',
  status: 'active',
  hireDate: '2022-11-02',
  emergencyContact: 'Petr Novak · +420 601 555 077'
},
{
  id: 'u-6',
  email: 'noah.adeyemi@sribees.com',
  fullName: 'Noah Adeyemi',
  role: 'employee',
  jobTitle: 'Frontend Engineer',
  department: 'Engineering',
  managerId: 'u-admin',
  phone: '+234 802 555 0166',
  location: 'Lagos, NG',
  timezone: 'Africa/Lagos',
  workMode: 'remote',
  status: 'active',
  hireDate: '2024-02-19',
  emergencyContact: 'Bola Adeyemi · +234 802 555 0100'
},
{
  id: 'u-7',
  email: 'elena.rossi@sribees.com',
  fullName: 'Elena Rossi',
  role: 'employee',
  jobTitle: 'Recruiter',
  department: 'People Operations',
  managerId: 'u-admin',
  phone: '+39 340 555 0121',
  location: 'Milan, IT',
  timezone: 'Europe/Rome',
  workMode: 'hybrid',
  status: 'active',
  hireDate: '2024-09-16',
  emergencyContact: 'Gio Rossi · +39 340 555 0188'
},
{
  id: 'u-8',
  email: 'tomas.berg@sribees.com',
  fullName: 'Tomas Berg',
  role: 'employee',
  jobTitle: 'QA Engineer',
  department: 'Engineering',
  managerId: 'u-admin',
  phone: '+46 70 555 0143',
  location: 'Gothenburg, SE',
  timezone: 'Europe/Stockholm',
  workMode: 'office',
  status: 'suspended',
  hireDate: '2021-10-04',
  emergencyContact: 'Ida Berg · +46 70 555 0130'
}];


/**
 * Demo credentials only. A production deployment delegates all password
 * handling to Supabase Auth — no secret ever reaches the browser bundle.
 */
const DEMO_PASSWORD = 'sribees2026';

function buildAttendance(profiles: Profile[]): AttendanceEntry[] {
  const random = rng(20260911);
  const dates = lastNDates(30);
  const rows: AttendanceEntry[] = [];
  profiles.
  filter((p) => p.status === 'active').
  forEach((profile, personIndex) => {
    dates.forEach((date, dayIndex) => {
      if (isWeekend(date)) return;
      if (random() < 0.08) return;
      const startHour = 8 + Math.floor(random() * 2);
      const startMin = Math.floor(random() * 55);
      const lengthMin = 420 + Math.floor(random() * 130);
      const breakMinutes = 30 + Math.floor(random() * 30);
      const clockIn = new Date(`${date}T00:00:00`);
      clockIn.setHours(startHour, startMin, 0, 0);
      const clockOut = new Date(clockIn.getTime() + (lengthMin + breakMinutes) * 60000);
      const isToday = dayIndex === dates.length - 1;
      const open = isToday && personIndex % 3 !== 2;
      rows.push({
        id: `att-${profile.id}-${date}`,
        employeeId: profile.id,
        date,
        clockIn: clockIn.toISOString(),
        clockOut: open ? null : clockOut.toISOString(),
        breakMinutes: open ? 0 : breakMinutes,
        workMode: profile.workMode === 'hybrid' ? dayIndex % 2 === 0 ? 'office' : 'remote' : profile.workMode,
        note: ''
      });
    });
  });
  return rows;
}

function buildLeave(profiles: Profile[]): {requests: LeaveRequest[];entitlements: LeaveEntitlement[];} {
  const year = new Date().getFullYear();
  const entitlements: LeaveEntitlement[] = [];
  profiles.forEach((p) => {
    entitlements.push(
      { employeeId: p.id, year, type: 'annual', days: 25 },
      { employeeId: p.id, year, type: 'sick', days: 10 },
      { employeeId: p.id, year, type: 'parental', days: 20 },
      { employeeId: p.id, year, type: 'unpaid', days: 15 }
    );
  });

  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return toISODate(d);
  };

  const requests: LeaveRequest[] = [
  {
    id: 'lv-1',
    employeeId: 'u-2',
    type: 'annual',
    startDate: day(12),
    endDate: day(16),
    days: 3,
    reason: 'Family trip booked earlier this year.',
    status: 'pending',
    decidedBy: null,
    decidedAt: null,
    decisionNote: '',
    createdAt: new Date(Date.now() - 36 * 3600_000).toISOString()
  },
  {
    id: 'lv-2',
    employeeId: 'u-5',
    type: 'sick',
    startDate: day(-4),
    endDate: day(-3),
    days: 2,
    reason: 'Flu, doctor advised two days of rest.',
    status: 'approved',
    decidedBy: 'u-admin',
    decidedAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    decisionNote: 'Get well soon.',
    createdAt: new Date(Date.now() - 4 * 86400_000).toISOString()
  },
  {
    id: 'lv-3',
    employeeId: 'u-3',
    type: 'annual',
    startDate: day(-1),
    endDate: day(2),
    days: 3,
    reason: 'Wedding in the family, travelling abroad.',
    status: 'approved',
    decidedBy: 'u-admin',
    decidedAt: new Date(Date.now() - 6 * 86400_000).toISOString(),
    decisionNote: '',
    createdAt: new Date(Date.now() - 8 * 86400_000).toISOString()
  },
  {
    id: 'lv-4',
    employeeId: 'u-6',
    type: 'unpaid',
    startDate: day(30),
    endDate: day(37),
    days: 6,
    reason: 'Sabbatical to finish a part-time degree module.',
    status: 'pending',
    decidedBy: null,
    decidedAt: null,
    decisionNote: '',
    createdAt: new Date(Date.now() - 9 * 3600_000).toISOString()
  },
  {
    id: 'lv-5',
    employeeId: 'u-4',
    type: 'annual',
    startDate: day(-40),
    endDate: day(-36),
    days: 3,
    reason: 'Short break after quarter close.',
    status: 'rejected',
    decidedBy: 'u-admin',
    decidedAt: new Date(Date.now() - 41 * 86400_000).toISOString(),
    decisionNote: 'Overlaps with the quarterly audit — please re-submit for a later week.',
    createdAt: new Date(Date.now() - 45 * 86400_000).toISOString()
  },
  {
    id: 'lv-6',
    employeeId: 'u-admin',
    type: 'annual',
    startDate: day(55),
    endDate: day(60),
    days: 4,
    reason: 'Pre-booked summer holiday.',
    status: 'pending',
    decidedBy: null,
    decidedAt: null,
    decisionNote: '',
    createdAt: new Date(Date.now() - 5 * 86400_000).toISOString()
  }];

  return { requests, entitlements };
}

export function buildSeed(): Database {
  const createdAt = new Date('2026-01-05T09:00:00Z').toISOString();
  const profiles: Profile[] = PEOPLE.map((p) => ({ ...p, createdAt }));
  const credentials: Record<string, string> = {};
  profiles.forEach((p) => {
    credentials[p.email.toLowerCase()] = DEMO_PASSWORD;
  });

  const attendance = buildAttendance(profiles);
  const { requests, entitlements } = buildLeave(profiles);
  const today = toISODate(new Date());

  const presence: Presence[] = profiles.map((profile) => {
    if (profile.status !== 'active') {
      return { employeeId: profile.id, status: 'off_shift', workMode: profile.workMode, updatedAt: createdAt };
    }
    const onLeave = requests.some(
      (r) => r.employeeId === profile.id && r.status === 'approved' && r.startDate <= today && r.endDate >= today
    );
    const open = attendance.find((a) => a.employeeId === profile.id && a.date === today && !a.clockOut);
    return {
      employeeId: profile.id,
      status: onLeave ? 'on_leave' : open ? 'working' : 'off_shift',
      workMode: profile.workMode,
      updatedAt: new Date().toISOString()
    };
  });

  return {
    profiles,
    credentials,
    invitations: [
    {
      id: 'inv-1',
      email: 'priya.menon@sribees.com',
      fullName: 'Priya Menon',
      role: 'employee',
      jobTitle: 'Payroll Specialist',
      department: 'Finance',
      workMode: 'hybrid',
      token: 'inv-token-priya',
      status: 'pending',
      invitedBy: 'u-admin',
      createdAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
      expiresAt: new Date(Date.now() + 5 * 86400_000).toISOString()
    }],

    attendance,
    presence,
    leaveRequests: requests,
    leaveEntitlements: entitlements,
    notifications: [
    {
      id: 'n-1',
      userId: 'u-admin',
      kind: 'leave_submitted',
      title: 'Marco Silva requested annual leave',
      body: '3 working days awaiting your decision.',
      link: '/leave',
      read: false,
      createdAt: new Date(Date.now() - 36 * 3600_000).toISOString()
    },
    {
      id: 'n-2',
      userId: 'u-admin',
      kind: 'leave_submitted',
      title: 'Noah Adeyemi requested unpaid leave',
      body: '6 working days awaiting your decision.',
      link: '/leave',
      read: false,
      createdAt: new Date(Date.now() - 9 * 3600_000).toISOString()
    },
    {
      id: 'n-3',
      userId: 'u-2',
      kind: 'attendance_reminder',
      title: 'You are still clocked in',
      body: 'Remember to clock out at the end of your shift.',
      link: '/attendance',
      read: true,
      createdAt: new Date(Date.now() - 26 * 3600_000).toISOString()
    }],

    auditLogs: [
    {
      id: 'log-1',
      actorId: 'u-admin',
      actorEmail: 'dana.okafor@sribees.com',
      action: 'invitation.sent',
      entity: 'invitation',
      entityId: 'inv-1',
      meta: { email: 'priya.menon@sribees.com', role: 'employee' },
      createdAt: new Date(Date.now() - 2 * 86400_000).toISOString()
    },
    {
      id: 'log-2',
      actorId: 'u-admin',
      actorEmail: 'dana.okafor@sribees.com',
      action: 'leave.approved',
      entity: 'leave_request',
      entityId: 'lv-2',
      meta: { employeeId: 'u-5', days: 2 },
      createdAt: new Date(Date.now() - 3 * 86400_000).toISOString()
    }]

  };
}

export const DEMO_ACCOUNTS = [
{ label: 'HR / Admin', email: 'dana.okafor@sribees.com', password: DEMO_PASSWORD },
{ label: 'Employee', email: 'marco.silva@sribees.com', password: DEMO_PASSWORD }];