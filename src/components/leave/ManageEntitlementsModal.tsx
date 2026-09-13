import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Profile } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import {
  LEAVE_TYPES,
  LEAVE_TYPE_LABEL,
  LEAVE_TYPE_DESCRIPTIONS,
  DEFAULT_LEAVE_QUOTAS,
  computeBalances,
  updateEmployeeEntitlements
} from '../../utils/api/leave';
import { getDb } from '../../utils/store';
import { toMessage } from '../../utils/policies';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { PlusIcon } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ManageEntitlementsModal({ open, onClose, onSuccess }: Props) {
  const { session } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [entitlements, setEntitlements] = useState<Record<string, number>>({});
  const [customLeaveTypes, setCustomLeaveTypes] = useState<string[]>([]);
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeKey, setNewTypeKey] = useState('');
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [newTypeDesc, setNewTypeDesc] = useState('');
  const [newTypeQuota, setNewTypeQuota] = useState('5');
  const [submitting, setSubmitting] = useState(false);

  const allLeaveTypes = useMemo(
    () => Array.from(new Set([...LEAVE_TYPES, ...customLeaveTypes])),
    [customLeaveTypes]
  );

  useEffect(() => {
    if (open) {
      const db = getDb();
      const activeProfiles = db.profiles.filter((p) => p.status === 'active');
      setProfiles(activeProfiles);
      if (activeProfiles.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(activeProfiles[0].id);
      }
    }
  }, [open, selectedEmployeeId]);

  useEffect(() => {
    if (selectedEmployeeId) {
      const balances = computeBalances(selectedEmployeeId);
      const map: Record<string, number> = {};
      allLeaveTypes.forEach((t) => {
        const found = balances.find((b) => b.type === t);
        map[t] = found ? found.entitlementDays : DEFAULT_LEAVE_QUOTAS[t] ?? 0;
      });
      setEntitlements(map);
    }
  }, [selectedEmployeeId, allLeaveTypes]);

  const handleQuotaChange = (typeKey: string, value: string) => {
    const num = parseInt(value, 10);
    setEntitlements((prev) => ({
      ...prev,
      [typeKey]: isNaN(num) ? 0 : num
    }));
  };

  const handleAddCustomType = (e: React.FormEvent) => {
    e.preventDefault();
    const key = newTypeKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key || !newTypeLabel.trim()) {
      toast.error('Please enter a valid key and label for the leave type.');
      return;
    }
    LEAVE_TYPE_LABEL[key] = newTypeLabel.trim();
    if (newTypeDesc.trim()) {
      LEAVE_TYPE_DESCRIPTIONS[key] = newTypeDesc.trim();
    }
    const defaultVal = parseInt(newTypeQuota, 10) || 5;
    DEFAULT_LEAVE_QUOTAS[key] = defaultVal;

    if (!customLeaveTypes.includes(key) && !LEAVE_TYPES.includes(key)) {
      setCustomLeaveTypes((prev) => [...prev, key]);
      if (!LEAVE_TYPES.includes(key)) {
        LEAVE_TYPES.push(key);
      }
    }

    setEntitlements((prev) => ({
      ...prev,
      [key]: defaultVal
    }));

    setNewTypeKey('');
    setNewTypeLabel('');
    setNewTypeDesc('');
    setNewTypeQuota('5');
    setShowAddType(false);
    toast.success(`Added new leave type: ${newTypeLabel}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) return;
    setSubmitting(true);
    try {
      await updateEmployeeEntitlements(session, selectedEmployeeId, entitlements);
      toast.success('Annual leave entitlements updated successfully.');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(toMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="HR Admin - Manage Annual Leave Quotas"
      description="Configure annual leave day counts per employee and add custom leave types."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="entitlements-form" type="submit" loading={submitting}>
            Save Entitlements
          </Button>
        </>
      }
    >
      <form id="entitlements-form" onSubmit={handleSubmit} className="space-y-4">
        <SelectField
          label="Select Employee"
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName} ({p.jobTitle} - {p.department})
            </option>
          ))}
        </SelectField>

        <div className="rounded-lg border border-line bg-canvas/40 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-ink">
              Annual Days Allocated ({new Date().getFullYear()})
            </h3>
            <button
              type="button"
              onClick={() => setShowAddType(!showAddType)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:text-brand-800"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {showAddType ? 'Cancel New Type' : 'Add Custom Leave Type'}
            </button>
          </div>

          {showAddType ? (
            <div className="rounded-md border border-brand-200 bg-surface p-3 space-y-2">
              <p className="text-[12px] font-semibold text-brand-800">Add New Leave Type</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <TextField
                  label="Type Key (e.g. study_leave)"
                  value={newTypeKey}
                  onChange={(e) => setNewTypeKey(e.target.value)}
                  placeholder="study_leave"
                />
                <TextField
                  label="Display Label"
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                  placeholder="Study Leave"
                />
              </div>
              <TextField
                label="Guideline / Description"
                value={newTypeDesc}
                onChange={(e) => setNewTypeDesc(e.target.value)}
                placeholder="For examinations and research days."
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" size="sm" onClick={handleAddCustomType}>
                  Add Leave Type
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {allLeaveTypes.map((typeKey) => (
              <div key={typeKey} className="rounded-md border border-line bg-surface p-2.5">
                <label className="block text-[12px] font-bold text-ink">
                  {LEAVE_TYPE_LABEL[typeKey] || typeKey}
                </label>
                {LEAVE_TYPE_DESCRIPTIONS[typeKey] ? (
                  <p className="text-[11px] text-ink-soft line-clamp-1">
                    {LEAVE_TYPE_DESCRIPTIONS[typeKey]}
                  </p>
                ) : null}
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={entitlements[typeKey] ?? 0}
                    onChange={(e) => handleQuotaChange(typeKey, e.target.value)}
                    className="h-8 w-24 rounded border border-line px-2 text-xs font-semibold text-ink outline-none focus:border-brand-500"
                  />
                  <span className="text-[11px] text-ink-faint">days / year</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
