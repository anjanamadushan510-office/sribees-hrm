import React from 'react';
import type { LeaveRequestRow } from '../../utils/api/leave';
import { LEAVE_TYPE_LABEL } from '../../utils/api/leave';
import { formatDate, relativeTime, todayISO } from '../../utils/time';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { LeaveBadge } from '../ui/Badge';

interface Props {
  rows: LeaveRequestRow[];
  showEmployee: boolean;
  currentUserId: string;
  isAdmin: boolean;
  onDecide?: (row: LeaveRequestRow, decision: 'approved' | 'rejected') => void;
  onCancel?: (row: LeaveRequestRow) => void;
  cancellingId?: string | null;
}

export function LeaveTable({
  rows,
  showEmployee,
  currentUserId,
  isAdmin,
  onDecide,
  onCancel,
  cancellingId
}: Props) {
  const today = todayISO();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[12px] uppercase tracking-wide text-ink-soft">
            {showEmployee ?
            <th scope="col" className="px-5 py-2.5 font-medium">
                Employee
              </th> :
            null}
            <th scope="col" className="px-5 py-2.5 font-medium">Type</th>
            <th scope="col" className="px-5 py-2.5 font-medium">Dates</th>
            <th scope="col" className="px-5 py-2.5 font-medium">Days</th>
            <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isOwn = row.employeeId === currentUserId;
            const canDecide = isAdmin && row.status === 'pending' && !isOwn;
            const canCancel =
            isOwn && (row.status === 'pending' || row.status === 'approved' && row.startDate > today) ||
            isAdmin && (row.status === 'pending' || row.status === 'approved');

            return (
              <tr key={row.id} className="border-b border-line align-top last:border-b-0">
                {showEmployee ?
                <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.employee.fullName} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{row.employee.fullName}</p>
                        <p className="truncate text-[12px] text-ink-soft">{row.employee.department}</p>
                      </div>
                    </div>
                  </td> :
                null}
                <td className="px-5 py-3">
                  <p className="font-medium text-ink">{LEAVE_TYPE_LABEL[row.type]}</p>
                  <p className="mt-0.5 max-w-xs truncate text-[12px] text-ink-soft" title={row.reason}>
                    {row.reason}
                  </p>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-ink-soft">
                  {formatDate(row.startDate)} → {formatDate(row.endDate)}
                  <span className="mt-0.5 block text-[12px] text-ink-faint">
                    Requested {relativeTime(row.createdAt)}
                  </span>
                </td>
                <td className="px-5 py-3 font-medium text-ink">{row.days}</td>
                <td className="px-5 py-3">
                  <LeaveBadge status={row.status} />
                  {row.decisionNote ?
                  <p className="mt-1 max-w-[16rem] text-[12px] leading-snug text-ink-soft">{row.decisionNote}</p> :
                  null}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {canDecide && onDecide ?
                    <>
                        <Button size="sm" onClick={() => onDecide(row, 'approved')}>
                          Approve
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => onDecide(row, 'rejected')}>
                          Reject
                        </Button>
                      </> :
                    null}
                    {canCancel && onCancel ?
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={cancellingId === row.id}
                      onClick={() => onCancel(row)}>
                      
                        Cancel
                      </Button> :
                    null}
                    {!canDecide && !canCancel ? <span className="text-[12px] text-ink-faint">—</span> : null}
                  </div>
                </td>
              </tr>);

          })}
        </tbody>
      </table>
    </div>);

}