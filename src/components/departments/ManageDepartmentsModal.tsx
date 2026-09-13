import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import {
  addDepartment,
  deleteDepartment,
  listManagedDepartments,
  renameDepartment
} from '../../utils/api/departments';
import { getDb } from '../../utils/store';
import { toMessage } from '../../utils/policies';
import { Button } from '../ui/Button';
import { TextField } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Building2Icon, Edit3Icon, PlusIcon, Trash2Icon, CheckIcon, XIcon } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ManageDepartmentsModal({ open, onClose, onSuccess }: Props) {
  const { session } = useAuth();
  const [departments, setDepartments] = useState<string[]>([]);
  const [employeeCounts, setEmployeeCounts] = useState<Record<string, number>>({});
  const [newDepartment, setNewDepartment] = useState('');
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadDepartments = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await listManagedDepartments(session);
      setDepartments(list);

      const db = getDb();
      const counts: Record<string, number> = {};
      list.forEach((d) => {
        counts[d] = db.profiles.filter(
          (p) => p.department.toLowerCase() === d.toLowerCase() && p.status === 'active'
        ).length;
      });
      setEmployeeCounts(counts);
    } catch (err) {
      toast.error(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (open) {
      void loadDepartments();
      setNewDepartment('');
      setEditingDept(null);
    }
  }, [open, loadDepartments]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepartment.trim()) return;
    setSubmitting(true);
    try {
      const updated = await addDepartment(session, newDepartment.trim());
      setDepartments(updated);
      setNewDepartment('');
      toast.success(`Department "${newDepartment.trim()}" added.`);
      onSuccess();
      void loadDepartments();
    } catch (err) {
      toast.error(toMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (dept: string) => {
    setEditingDept(dept);
    setEditName(dept);
  };

  const handleRename = async (oldName: string) => {
    if (!editName.trim() || editName.trim() === oldName) {
      setEditingDept(null);
      return;
    }
    setSubmitting(true);
    try {
      const updated = await renameDepartment(session, oldName, editName.trim());
      setDepartments(updated);
      setEditingDept(null);
      toast.success(`Renamed to "${editName.trim()}".`);
      onSuccess();
      void loadDepartments();
    } catch (err) {
      toast.error(toMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (dept: string) => {
    if (!confirm(`Are you sure you want to delete department "${dept}"?`)) return;
    setSubmitting(true);
    try {
      const updated = await deleteDepartment(session, dept);
      setDepartments(updated);
      toast.success(`Department "${dept}" deleted.`);
      onSuccess();
      void loadDepartments();
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
      title="Manage Company Departments"
      description="Add, edit, or delete department units for your organization."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Add Department Form */}
        <form onSubmit={handleAdd} className="flex gap-2 items-end">
          <div className="flex-1">
            <TextField
              label="Add New Department"
              placeholder="e.g. Marketing, DevOps, Legal"
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
            />
          </div>
          <Button type="submit" loading={submitting} icon={<PlusIcon className="h-4 w-4" />}>
            Add
          </Button>
        </form>

        {/* Departments List */}
        <div className="rounded-lg border border-line bg-canvas/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
              <Building2Icon className="h-4 w-4 text-brand-600" />
              Active Departments ({departments.length})
            </h3>
          </div>

          {loading ? (
            <p className="text-[12px] text-ink-faint py-3 text-center">Loading departments...</p>
          ) : departments.length === 0 ? (
            <p className="text-[12px] text-ink-faint py-3 text-center">No departments added yet.</p>
          ) : (
            <ul className="divide-y divide-line rounded-md border border-line bg-surface">
              {departments.map((dept) => {
                const count = employeeCounts[dept] ?? 0;
                const isEditing = editingDept === dept;

                return (
                  <li key={dept} className="flex items-center justify-between p-3 text-[13px]">
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 w-full rounded border border-brand-500 px-2 text-xs font-medium text-ink outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => void handleRename(dept)}
                          className="rounded p-1 text-success hover:bg-success-soft"
                          title="Save name"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDept(null)}
                          className="rounded p-1 text-ink-faint hover:bg-canvas"
                          title="Cancel"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-ink">{dept}</span>
                          <span className="ml-2 text-[11px] font-medium text-ink-soft">
                            ({count} employee{count === 1 ? '' : 's'})
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(dept)}
                            className="rounded p-1 text-ink-soft hover:bg-canvas hover:text-ink transition-colors"
                            title="Rename department"
                          >
                            <Edit3Icon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={count > 0}
                            onClick={() => void handleDelete(dept)}
                            className={`rounded p-1 transition-colors ${
                              count > 0
                                ? 'text-ink-faint opacity-40 cursor-not-allowed'
                                : 'text-danger hover:bg-danger-soft'
                            }`}
                            title={
                              count > 0
                                ? 'Cannot delete department with active employees'
                                : 'Delete department'
                            }
                          >
                            <Trash2Icon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
