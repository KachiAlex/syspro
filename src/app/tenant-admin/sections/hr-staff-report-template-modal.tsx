'use client';

import React, { useEffect, useState } from 'react';
import { X, Plus, Loader2, Trash2, CheckCircle, AlertCircle, GripVertical } from 'lucide-react';
import { HRService } from './hr-service';

interface ReportTemplateSection {
  key: string;
  label: string;
  prompt: string;
  required?: boolean;
  inputType?: 'textarea' | 'bullets' | 'checklist';
  keywords?: string[];
}

interface StaffReportTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  currentUserName?: string;
}

const REPORT_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const DEFAULT_SECTIONS: ReportTemplateSection[] = [
  { key: 'objectives', label: 'Objectives', prompt: 'What were your objectives for this period?', inputType: 'textarea', keywords: ['objective', 'goal', 'target'] },
  { key: 'activities', label: 'Key Activities', prompt: 'What activities did you carry out?', inputType: 'textarea', keywords: ['activity', 'work done', 'completed'] },
  { key: 'achievements', label: 'Achievements', prompt: 'What did you accomplish?', inputType: 'textarea', keywords: ['achievement', 'accomplished', 'delivered'] },
  { key: 'meetings', label: 'Meetings', prompt: 'Meetings or calls attended.', inputType: 'textarea', keywords: ['meeting', 'call', 'sync'] },
  { key: 'blockers', label: 'Blockers / Issues', prompt: 'Any blockers or issues faced?', inputType: 'textarea', keywords: ['blocker', 'issue', 'problem'] },
  { key: 'challenges', label: 'Challenges', prompt: 'What challenges did you encounter?', inputType: 'textarea', keywords: ['challenge', 'difficulty', 'setback'] },
  { key: 'nextSteps', label: 'Next Steps', prompt: 'What are your next steps?', inputType: 'textarea', keywords: ['next step', 'plan', 'tomorrow'] },
  { key: 'additionalNotes', label: 'Additional Notes', prompt: 'Any other notes?', inputType: 'textarea', keywords: ['note', 'mention', 'additional'] },
];

function toKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const StaffReportTemplateModal: React.FC<StaffReportTemplateModalProps> = ({
  isOpen,
  onClose,
  tenantSlug,
  currentUserName,
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [reportType, setReportType] = useState('daily');
  const [isDefault, setIsDefault] = useState(false);
  const [sections, setSections] = useState<ReportTemplateSection[]>(DEFAULT_SECTIONS.map((s) => ({ ...s })));

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await HRService.getStaffReportTemplates(tenantSlug);
      setTemplates(fetched || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      resetForm();
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, tenantSlug]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setReportType('daily');
    setIsDefault(false);
    setSections(DEFAULT_SECTIONS.map((s) => ({ ...s })));
  };

  const startEdit = (template: any) => {
    setEditingId(template.id);
    setName(template.name || '');
    setReportType(template.reportType || 'daily');
    setIsDefault(template.isDefault || false);
    setSections(
      Array.isArray(template.sections) && template.sections.length > 0
        ? template.sections.map((s: any) => ({
            key: s.key || toKey(s.label),
            label: s.label,
            prompt: s.prompt,
            required: s.required || false,
            inputType: s.inputType || 'textarea',
            keywords: s.keywords || [],
          }))
        : DEFAULT_SECTIONS.map((s) => ({ ...s }))
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }
    const invalid = sections.some((s) => !s.label.trim());
    if (invalid) {
      setError('All sections must have a label.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payloadSections = sections.map((s) => ({ ...s, key: s.key || toKey(s.label) }));
      if (editingId) {
        await HRService.updateStaffReportTemplate(tenantSlug, editingId, {
          name: name.trim(),
          reportType: reportType as any,
          isDefault,
          sections: payloadSections,
        });
      } else {
        await HRService.createStaffReportTemplate(tenantSlug, {
          name: name.trim(),
          reportType: reportType as any,
          isDefault,
          sections: payloadSections,
          createdBy: currentUserName,
        });
      }
      setSuccess(editingId ? 'Template updated.' : 'Template created.');
      resetForm();
      loadTemplates();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await HRService.deleteStaffReportTemplate(tenantSlug, id);
      setSuccess('Template deleted.');
      loadTemplates();
      if (editingId === id) resetForm();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete template.');
    }
  };

  const addSection = () => {
    const label = `New Section ${sections.length + 1}`;
    setSections((prev) => [
      ...prev,
      { key: toKey(label), label, prompt: '', required: false, inputType: 'textarea', keywords: [] },
    ]);
  };

  const removeSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSection = (index: number, field: keyof ReportTemplateSection, value: any) => {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const next = { ...s, [field]: value };
        if (field === 'label') {
          next.key = toKey(value);
          if (!next.prompt) {
            next.prompt = `Please describe ${value}.`;
          }
        }
        return next;
      })
    );
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(newIndex, 0, item);
      return next;
    });
  };

  const updateKeywords = (index: number, value: string) => {
    const list = value
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    updateSection(index, 'keywords', list);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-theme-bg w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl border border-theme-border shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-theme-border">
          <div>
            <h3 className="text-lg font-semibold text-theme-text-primary">Report Templates</h3>
            <p className="text-sm text-theme-text-secondary">Create or edit templates for staff reports.</p>
          </div>
          <button onClick={onClose} className="text-theme-text-tertiary hover:text-theme-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" /> {success}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <h4 className="text-sm font-medium text-theme-text-primary">Existing Templates</h4>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-theme-text-secondary">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-theme-text-secondary">No templates yet.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        editingId === t.id
                          ? 'border-blue-500 bg-blue-500/5'
                          : 'border-theme-border bg-theme-muted hover:bg-theme-sidebar-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div onClick={() => startEdit(t)} className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-theme-text-primary truncate">{t.name}</p>
                          <p className="text-xs text-theme-text-secondary capitalize">
                            {t.reportType}{t.isDefault ? ' • default' : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="ml-2 text-red-400 hover:text-red-300"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={resetForm}
                className="w-full px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-muted border border-theme-border rounded-lg hover:bg-theme-sidebar-hover"
              >
                + New Template
              </button>
            </div>

            <div className="lg:col-span-2 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-theme-text-primary mb-1">Template Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Engineering Weekly"
                    className="bg-theme-muted w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-theme-text-primary mb-1">Report Type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="bg-theme-muted w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {REPORT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-theme-text-primary">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-theme-border"
                />
                Set as default for {reportType} reports
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-theme-text-primary">Sections</h4>
                  <button
                    onClick={addSection}
                    className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
                  >
                    <Plus className="w-3 h-3" /> Add Section
                  </button>
                </div>

                {sections.map((section, index) => (
                  <div key={index} className="p-3 rounded-lg border border-theme-border bg-theme-muted space-y-3">
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-theme-text-tertiary mt-2" />
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-theme-text-primary mb-1">Label</label>
                          <input
                            type="text"
                            value={section.label}
                            onChange={(e) => updateSection(index, 'label', e.target.value)}
                            className="bg-theme-bg w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-theme-text-primary mb-1">Input Type</label>
                          <select
                            value={section.inputType}
                            onChange={(e) => updateSection(index, 'inputType', e.target.value)}
                            className="bg-theme-bg w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="textarea">Textarea</option>
                            <option value="bullets">Bullets</option>
                            <option value="checklist">Checklist</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveSection(index, -1)}
                          disabled={index === 0}
                          className="text-theme-text-tertiary hover:text-theme-text-primary disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveSection(index, 1)}
                          disabled={index === sections.length - 1}
                          className="text-theme-text-tertiary hover:text-theme-text-primary disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeSection(index)}
                          className="text-red-400 hover:text-red-300"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-theme-text-primary mb-1">Prompt</label>
                      <input
                        type="text"
                        value={section.prompt}
                        onChange={(e) => updateSection(index, 'prompt', e.target.value)}
                        placeholder="Question or instruction shown to the staff member"
                        className="bg-theme-bg w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-theme-text-primary mb-1">
                        Keywords for AI (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={(section.keywords || []).join(', ')}
                        onChange={(e) => updateKeywords(index, e.target.value)}
                        placeholder="e.g. meeting, call, sync"
                        className="bg-theme-bg w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-theme-text-primary">
                      <input
                        type="checkbox"
                        checked={!!section.required}
                        onChange={(e) => updateSection(index, 'required', e.target.checked)}
                        className="rounded border-theme-border"
                      />
                      Required
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-theme-border">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-theme-text-secondary hover:text-theme-text-primary"
                >
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {editingId ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffReportTemplateModal;
