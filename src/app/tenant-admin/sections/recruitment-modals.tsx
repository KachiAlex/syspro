'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { HRService } from './hr-service';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void | Promise<void>;
  mode?: 'create' | 'edit';
  initialData?: any;
}

function ModalOverlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-theme-bg rounded-xl border border-theme-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border">
          <h3 className="text-lg font-semibold text-theme-text-primary">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-theme-muted text-theme-text-tertiary">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, required, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-theme-text-primary mb-1">
        {label}{required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-theme-muted border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
        required={required}
      />
    </div>
  );
}

function NumberField({ label, value, onChange, required, min, placeholder }: {
  label: string; value: number | ''; onChange: (v: number | '') => void; required?: boolean; min?: number; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-theme-text-primary mb-1">
        {label}{required && <span className="text-red-400">*</span>}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder={placeholder}
        min={min}
        className="w-full px-3 py-2 bg-theme-muted border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
        required={required}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, required, rows = 3, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; rows?: number; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-theme-text-primary mb-1">
        {label}{required && <span className="text-red-400">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 bg-theme-muted border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        required={required}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-theme-text-primary mb-1">
        {label}{required && <span className="text-red-400">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-theme-muted border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
        required={required}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function TagsField({ label, tags, onChange }: { label: string; tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('');
  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInput('');
    }
  };
  return (
    <div>
      <label className="block text-sm font-medium text-theme-text-primary mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder="Type and press Enter"
          className="flex-1 px-3 py-2 bg-theme-muted border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="button" onClick={addTag} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:text-red-400"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
    </div>
  );
}

function CancelBtn({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-muted border border-theme-border rounded-lg hover:bg-theme-sidebar-hover">
      Cancel
    </button>
  );
}

function SubmitBtn({ label }: { label: string }) {
  return (
    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
      {label}
    </button>
  );
}

// ─── Requisition Modal ───
export function RequisitionModal({
  isOpen, onClose, onSubmit, mode = 'create', initialData, departments, tenantSlug, onDepartmentCreated
}: BaseModalProps & {
  departments: { id: string; name: string }[];
  tenantSlug: string;
  onDepartmentCreated?: (dept: { id: string; name: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('full-time');
  const [salaryRange, setSalaryRange] = useState('');
  const [headcount, setHeadcount] = useState<number | ''>(1);
  const [budget, setBudget] = useState<number | ''>('');
  const [minExperienceYears, setMinExperienceYears] = useState<number | ''>('');
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [preferredSkills, setPreferredSkills] = useState<string[]>([]);
  const [requiredCertifications, setRequiredCertifications] = useState<string[]>([]);
  const [educationLevel, setEducationLevel] = useState('');
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDescription, setNewDeptDescription] = useState('');
  const [creatingDept, setCreatingDept] = useState(false);
  const [localDepartments, setLocalDepartments] = useState(departments);
  const [fetchingDepts, setFetchingDepts] = useState(false);

  useEffect(() => {
    setLocalDepartments(departments);
  }, [departments]);

  useEffect(() => {
    if (isOpen && tenantSlug) {
      setFetchingDepts(true);
      HRService.getDepartmentRecords(tenantSlug)
        .then((depts) => setLocalDepartments(depts))
        .catch(() => { /* keep existing */ })
        .finally(() => setFetchingDepts(false));
    }
  }, [isOpen, tenantSlug]);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDepartmentId(initialData.departmentId || '');
      setDescription(initialData.description || '');
      setRequirements(initialData.requirements || '');
      setLocation(initialData.location || '');
      setEmploymentType(initialData.employmentType || 'full-time');
      setSalaryRange(initialData.salaryRange || '');
      setHeadcount(initialData.headcount ?? 1);
      setBudget(initialData.budget ?? '');
      setMinExperienceYears(initialData.minExperienceYears ?? '');
      setRequiredSkills(initialData.requiredSkills || []);
      setPreferredSkills((initialData as any)?.preferredSkills || []);
      setRequiredCertifications((initialData as any)?.requiredCertifications || []);
      setEducationLevel((initialData as any)?.educationLevel || '');
    } else {
      setTitle(''); setDepartmentId(''); setDescription(''); setRequirements(''); setLocation('');
      setEmploymentType('full-time'); setSalaryRange(''); setHeadcount(1); setBudget(''); setMinExperienceYears(''); setRequiredSkills([]);
      setPreferredSkills([]); setRequiredCertifications([]); setEducationLevel('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const deptOptions = [
    { value: '', label: fetchingDepts ? 'Loading departments...' : 'Select department...' },
    ...localDepartments.map((d) => ({ value: d.id, label: d.name })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit({ title, departmentId, description, requirements, location, employmentType, salaryRange, headcount: headcount || 1, budget: budget || undefined, minExperienceYears: minExperienceYears || undefined, requiredSkills, preferredSkills, requiredCertifications, educationLevel: educationLevel || undefined });
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to create requisition';
      alert(msg);
    }
  };

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim() || !tenantSlug) return;
    setCreatingDept(true);
    try {
      const created = await HRService.createDepartment(tenantSlug, {
        name: newDeptName.trim(),
        description: newDeptDescription.trim() || undefined,
      });
      const newDept = { id: created.id, name: created.name };
      onDepartmentCreated?.(newDept);
      setLocalDepartments((prev) => [...prev, newDept]);
      setDepartmentId(created.id);
      setShowCreateDept(false);
      setNewDeptName('');
      setNewDeptDescription('');
    } catch (err) {
      console.error('Failed to create department:', err);
      alert('Failed to create department. See console for details.');
    } finally {
      setCreatingDept(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose} title={mode === 'edit' ? 'Edit Requisition' : 'New Job Requisition'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Title" value={title} onChange={setTitle} required />
        <SelectField label="Department" value={departmentId} onChange={setDepartmentId} required options={deptOptions} />
        {!showCreateDept ? (
          <button
            type="button"
            onClick={() => setShowCreateDept(true)}
            className="text-sm text-blue-400 hover:text-blue-300 -mt-2"
          >
            + Create new department
          </button>
        ) : (
          <div className="border border-theme-border rounded-lg p-4 space-y-3 bg-theme-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-theme-text-primary">New Department</span>
              <button type="button" onClick={() => setShowCreateDept(false)} className="text-xs text-theme-text-tertiary hover:text-theme-text-secondary">Cancel</button>
            </div>
            <div className="space-y-3">
              <TextField label="Department Name" value={newDeptName} onChange={setNewDeptName} required />
              <TextField label="Description" value={newDeptDescription} onChange={setNewDeptDescription} />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCreateDepartment}
                  disabled={creatingDept || !newDeptName.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {creatingDept ? 'Creating...' : 'Create & Select'}
                </button>
              </div>
            </div>
          </div>
        )}
        <TextArea label="Description" value={description} onChange={setDescription} required />
        <TextArea label="Requirements" value={requirements} onChange={setRequirements} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Location" value={location} onChange={setLocation} />
          <SelectField label="Employment Type" value={employmentType} onChange={setEmploymentType} options={[
            { value: 'full-time', label: 'Full-time' }, { value: 'part-time', label: 'Part-time' },
            { value: 'contract', label: 'Contract' }, { value: 'intern', label: 'Intern' },
          ]} />
        </div>
        <TextField label="Salary Range" value={salaryRange} onChange={setSalaryRange} placeholder="e.g. $80k - $120k" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField label="Headcount" value={headcount} onChange={setHeadcount} min={1} />
          <NumberField label="Budget" value={budget} onChange={setBudget} min={0} />
          <NumberField label="Min Experience (yrs)" value={minExperienceYears} onChange={setMinExperienceYears} min={0} />
        </div>
        <TagsField label="Required Skills" tags={requiredSkills} onChange={setRequiredSkills} />
        <TagsField label="Preferred Skills" tags={preferredSkills} onChange={setPreferredSkills} />
        <TagsField label="Required Certifications" tags={requiredCertifications} onChange={setRequiredCertifications} />
        <SelectField label="Education Level" value={educationLevel} onChange={setEducationLevel} options={[
          { value: '', label: 'Any / Not specified' },
          { value: 'high_school', label: 'High School' },
          { value: 'diploma', label: 'Diploma' },
          { value: 'associate', label: 'Associate Degree' },
          { value: 'bachelor', label: 'Bachelor\'s Degree' },
          { value: 'master', label: 'Master\'s Degree' },
          { value: 'mba', label: 'MBA' },
          { value: 'phd', label: 'PhD / Doctorate' },
        ]} />
        <div className="flex justify-end gap-3 pt-2">
          <CancelBtn onClose={onClose} />
          <SubmitBtn label={mode === 'edit' ? 'Save Changes' : 'Create Requisition'} />
        </div>
      </form>
    </ModalOverlay>
  );
}

// ─── Candidate Modal ───
export function CandidateModal({ isOpen, onClose, onSubmit, mode = 'create', initialData }: BaseModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [source, setSource] = useState('manual');
  const [currentStage, setCurrentStage] = useState('new');
  const [skills, setSkills] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState<number | ''>('');
  const [education, setEducation] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [expectedSalary, setExpectedSalary] = useState<number | ''>('');
  const [candLocation, setCandLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.fullName || '');
      setEmail(initialData.email || '');
      setPhone(initialData.phone || '');
      setResumeUrl(initialData.resumeUrl || '');
      setSource(initialData.source || 'manual');
      setCurrentStage(initialData.currentStage || 'new');
      setSkills(initialData.skills || []);
      setExperienceYears(initialData.experienceYears ?? '');
      setEducation(initialData.education || '');
      setCertifications((initialData as any)?.certifications || []);
      setExpectedSalary((initialData as any)?.expectedSalary ?? '');
      setCandLocation((initialData as any)?.location || '');
      setNotes(initialData.notes || '');
    } else {
      setFullName(''); setEmail(''); setPhone(''); setResumeUrl(''); setSource('manual');
      setCurrentStage('new'); setSkills([]); setExperienceYears(''); setEducation(''); setCertifications([]); setExpectedSalary(''); setCandLocation(''); setNotes('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ fullName, email, phone, resumeUrl, source, currentStage, skills, experienceYears: experienceYears || undefined, education, certifications, expectedSalary: expectedSalary || undefined, location: candLocation, notes });
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose} title={mode === 'edit' ? 'Edit Candidate' : 'Add Candidate'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Full Name" value={fullName} onChange={setFullName} required />
        <TextField label="Email" value={email} onChange={setEmail} required type="email" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Phone" value={phone} onChange={setPhone} />
          <SelectField label="Source" value={source} onChange={setSource} options={[
          { value: '', label: 'Select source...' },
          { value: 'career_page', label: 'Career Page' },
          { value: 'linkedin', label: 'LinkedIn' },
          { value: 'indeed', label: 'Indeed' },
          { value: 'referral', label: 'Referral' },
          { value: 'agency', label: 'Agency' },
          { value: 'job_fair', label: 'Job Fair' },
          { value: 'manual', label: 'Manual' },
        ]} />
        </div>
        <SelectField label="Current Stage" value={currentStage} onChange={setCurrentStage} options={[
          { value: 'new', label: 'New' }, { value: 'screening', label: 'Screening' },
          { value: 'shortlist', label: 'Shortlist' }, { value: 'interview', label: 'Interview' },
          { value: 'offer', label: 'Offer' }, { value: 'hired', label: 'Hired' },
          { value: 'rejected', label: 'Rejected' }, { value: 'talent_pool', label: 'Talent Pool' },
        ]} />
        <TextField label="Resume URL" value={resumeUrl} onChange={setResumeUrl} type="url" />
        <TagsField label="Skills" tags={skills} onChange={setSkills} />
        <NumberField label="Experience (years)" value={experienceYears} onChange={setExperienceYears} min={0} />
        <TextField label="Education" value={education} onChange={setEducation} />
        <TagsField label="Certifications" tags={certifications} onChange={setCertifications} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField label="Expected Salary" value={expectedSalary} onChange={setExpectedSalary} min={0} />
          <TextField label="Location" value={candLocation} onChange={setCandLocation} />
        </div>
        <TextArea label="Notes" value={notes} onChange={setNotes} />
        <div className="flex justify-end gap-3 pt-2">
          <CancelBtn onClose={onClose} />
          <SubmitBtn label={mode === 'edit' ? 'Save Changes' : 'Add Candidate'} />
        </div>
      </form>
    </ModalOverlay>
  );
}

// ─── Application Modal ───
export function ApplicationModal({
  isOpen, onClose, onSubmit, mode = 'create', initialData, candidates, requisitions
}: BaseModalProps & { candidates: { id: string; fullName: string }[]; requisitions: { id: string; title: string }[] }) {
  const [candidateId, setCandidateId] = useState('');
  const [requisitionId, setRequisitionId] = useState('');
  const [coverLetter, setCoverLetter] = useState('');

  useEffect(() => {
    if (initialData) {
      setCandidateId(initialData.candidateId || '');
      setRequisitionId(initialData.requisitionId || '');
      setCoverLetter(initialData.coverLetter || '');
    } else {
      setCandidateId(''); setRequisitionId(''); setCoverLetter('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const candOptions = [{ value: '', label: 'Select candidate...' }, ...candidates.map((c) => ({ value: c.id, label: c.fullName }))];
  const reqOptions = [{ value: '', label: 'Select requisition...' }, ...requisitions.map((r) => ({ value: r.id, label: r.title }))];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ candidateId, requisitionId, coverLetter });
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose} title={mode === 'edit' ? 'Edit Application' : 'New Application'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <SelectField label="Candidate" value={candidateId} onChange={setCandidateId} required options={candOptions} />
        <SelectField label="Requisition" value={requisitionId} onChange={setRequisitionId} required options={reqOptions} />
        <TextArea label="Cover Letter" value={coverLetter} onChange={setCoverLetter} />
        <div className="flex justify-end gap-3 pt-2">
          <CancelBtn onClose={onClose} />
          <SubmitBtn label={mode === 'edit' ? 'Save Changes' : 'Create Application'} />
        </div>
      </form>
    </ModalOverlay>
  );
}

// ─── Interview Modal ───
export function InterviewModal({
  isOpen, onClose, onSubmit, mode = 'create', initialData, applications
}: BaseModalProps & { applications: { id: string; candidateName: string }[] }) {
  const [applicationId, setApplicationId] = useState('');
  const [roundNumber, setRoundNumber] = useState<number | ''>(1);
  const [type, setType] = useState('phone_screen');
  const [scheduledAt, setScheduledAt] = useState('');
  const [interviewerIds, setInterviewerIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setApplicationId(initialData.applicationId || '');
      setRoundNumber(initialData.roundNumber ?? 1);
      setType(initialData.type || 'phone_screen');
      setScheduledAt(initialData.scheduledAt ? new Date(initialData.scheduledAt).toISOString().slice(0, 16) : '');
      setInterviewerIds(initialData.interviewerIds || []);
      setNotes(initialData.notes || '');
    } else {
      setApplicationId(''); setRoundNumber(1); setType('phone_screen'); setScheduledAt(''); setInterviewerIds([]); setNotes('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const appOptions = [{ value: '', label: 'Select application...' }, ...applications.map((a) => ({ value: a.id, label: a.candidateName }))];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ applicationId, roundNumber: roundNumber || 1, type, scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined, interviewerIds, notes });
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose} title={mode === 'edit' ? 'Edit Interview' : 'Schedule Interview'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <SelectField label="Application" value={applicationId} onChange={setApplicationId} required options={appOptions} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField label="Round" value={roundNumber} onChange={setRoundNumber} min={1} />
          <SelectField label="Type" value={type} onChange={setType} options={[
            { value: 'phone_screen', label: 'Phone Screen' }, { value: 'technical', label: 'Technical' },
            { value: 'behavioral', label: 'Behavioral' }, { value: 'cultural', label: 'Cultural' },
            { value: 'executive', label: 'Executive' }, { value: 'panel', label: 'Panel' },
          ]} />
        </div>
        <TextField label="Scheduled At" value={scheduledAt} onChange={setScheduledAt} required type="datetime-local" />
        <TagsField label="Interviewer IDs" tags={interviewerIds} onChange={setInterviewerIds} />
        <TextArea label="Notes" value={notes} onChange={setNotes} />
        <div className="flex justify-end gap-3 pt-2">
          <CancelBtn onClose={onClose} />
          <SubmitBtn label={mode === 'edit' ? 'Save Changes' : 'Schedule Interview'} />
        </div>
      </form>
    </ModalOverlay>
  );
}

// ─── Offer Modal ───
export function OfferModal({
  isOpen, onClose, onSubmit, mode = 'create', initialData, applications
}: BaseModalProps & { applications: { id: string; candidateName: string }[] }) {
  const [applicationId, setApplicationId] = useState('');
  const [salary, setSalary] = useState<number | ''>('');
  const [bonus, setBonus] = useState<number | ''>('');
  const [benefits, setBenefits] = useState('');
  const [startDate, setStartDate] = useState('');
  const [reportingManagerId, setReportingManagerId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    if (initialData) {
      setApplicationId(initialData.applicationId || '');
      setSalary(initialData.salary ?? '');
      setBonus(initialData.bonus ?? '');
      setBenefits(initialData.benefits ? JSON.stringify(initialData.benefits, null, 2) : '');
      setStartDate(initialData.startDate ? initialData.startDate.split('T')[0] : '');
      setReportingManagerId(initialData.reportingManagerId || '');
      setExpiresAt(initialData.expiresAt ? initialData.expiresAt.split('T')[0] : '');
    } else {
      setApplicationId(''); setSalary(''); setBonus(''); setBenefits(''); setStartDate(''); setReportingManagerId(''); setExpiresAt('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const appOptions = [{ value: '', label: 'Select application...' }, ...applications.map((a) => ({ value: a.id, label: a.candidateName }))];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let parsedBenefits: Record<string, any> | undefined;
    if (benefits.trim()) {
      try { parsedBenefits = JSON.parse(benefits); } catch { parsedBenefits = { note: benefits }; }
    }
    onSubmit({ applicationId, salary: Number(salary) || 0, bonus: bonus ? Number(bonus) : undefined, benefits: parsedBenefits, startDate: startDate ? new Date(startDate).toISOString() : undefined, reportingManagerId, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined });
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose} title={mode === 'edit' ? 'Edit Offer' : 'Create Offer'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <SelectField label="Application" value={applicationId} onChange={setApplicationId} required options={appOptions} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField label="Salary" value={salary} onChange={setSalary} required />
          <NumberField label="Bonus" value={bonus} onChange={setBonus} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Start Date" value={startDate} onChange={setStartDate} type="date" />
          <TextField label="Expires At" value={expiresAt} onChange={setExpiresAt} type="date" />
        </div>
        <TextField label="Reporting Manager ID" value={reportingManagerId} onChange={setReportingManagerId} />
        <TextArea label="Benefits (JSON or text)" value={benefits} onChange={setBenefits} rows={3} placeholder='{"health": true, "pto": 20}' />
        <div className="flex justify-end gap-3 pt-2">
          <CancelBtn onClose={onClose} />
          <SubmitBtn label={mode === 'edit' ? 'Save Changes' : 'Create Offer'} />
        </div>
      </form>
    </ModalOverlay>
  );
}

// ─── Department Modal ───
export function DepartmentModal({
  isOpen, onClose, onSubmit, mode = 'create', initialData, users, departments
}: BaseModalProps & {
  users: { id: string; name: string; email: string }[];
  departments: { id: string; name: string }[];
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState<number | ''>('');
  const [costCenter, setCostCenter] = useState('');
  const [managerId, setManagerId] = useState('');
  const [parentDepartmentId, setParentDepartmentId] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setBudget(initialData.budget ?? '');
      setCostCenter(initialData.costCenter || '');
      setManagerId(initialData.managerId || '');
      setParentDepartmentId(initialData.parentDepartmentId || '');
    } else {
      setName(''); setDescription(''); setBudget(''); setCostCenter(''); setManagerId(''); setParentDepartmentId('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const userOptions = [{ value: '', label: 'Select head...' }, ...users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))];
  const parentOptions = [{ value: '', label: 'No parent' }, ...departments.filter((d) => d.id !== initialData?.id).map((d) => ({ value: d.id, label: d.name }))];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit({ name, description, budget: budget ? Number(budget) : undefined, costCenter: costCenter || undefined, managerId: managerId || undefined, parentDepartmentId: parentDepartmentId || undefined });
      onClose();
    } catch {
      // error already alerted by parent; keep modal open
    }
  };

  return (
    <ModalOverlay onClose={onClose} title={mode === 'edit' ? 'Edit Department' : 'New Department'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Name" value={name} onChange={setName} required />
        <TextArea label="Description" value={description} onChange={setDescription} />
        <SelectField label="Head" value={managerId} onChange={setManagerId} options={userOptions} />
        <SelectField label="Parent Department" value={parentDepartmentId} onChange={setParentDepartmentId} options={parentOptions} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField label="Budget" value={budget} onChange={setBudget} min={0} />
          <TextField label="Cost Center" value={costCenter} onChange={setCostCenter} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <CancelBtn onClose={onClose} />
          <SubmitBtn label={mode === 'edit' ? 'Save Changes' : 'Create Department'} />
        </div>
      </form>
    </ModalOverlay>
  );
}

// ─── Onboarding Task Modal ───
export function OnboardingTaskModal({ isOpen, onClose, onSubmit, mode = 'create', initialData }: BaseModalProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [category, setCategory] = useState('hr');
  const [task, setTask] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (initialData) {
      setEmployeeId(initialData.employeeId || '');
      setCategory(initialData.category || 'hr');
      setTask(initialData.task || '');
      setAssignedToUserId(initialData.assignedToUserId || '');
      setDueDate(initialData.dueDate ? initialData.dueDate.split('T')[0] : '');
    } else {
      setEmployeeId(''); setCategory('hr'); setTask(''); setAssignedToUserId(''); setDueDate('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ employeeId, category, task, assignedToUserId, dueDate: dueDate ? new Date(dueDate).toISOString() : undefined });
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose} title={mode === 'edit' ? 'Edit Onboarding Task' : 'Add Onboarding Task'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Employee ID" value={employeeId} onChange={setEmployeeId} required />
        <SelectField label="Category" value={category} onChange={setCategory} options={[
          { value: 'hr', label: 'HR' }, { value: 'it', label: 'IT' },
          { value: 'admin', label: 'Admin' }, { value: 'manager', label: 'Manager' },
          { value: 'compliance', label: 'Compliance' },
        ]} />
        <TextField label="Task" value={task} onChange={setTask} required />
        <TextField label="Assigned To (User ID)" value={assignedToUserId} onChange={setAssignedToUserId} required />
        <TextField label="Due Date" value={dueDate} onChange={setDueDate} type="date" />
        <div className="flex justify-end gap-3 pt-2">
          <CancelBtn onClose={onClose} />
          <SubmitBtn label={mode === 'edit' ? 'Save Changes' : 'Add Task'} />
        </div>
      </form>
    </ModalOverlay>
  );
}
