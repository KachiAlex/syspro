import StaffReportsViewer from '@/components/staff-reports-viewer';

export default function HRStaffReportsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <StaffReportsViewer viewMode="hr" />
      </div>
    </div>
  );
}