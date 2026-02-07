import StaffReportsViewer from '@/components/staff-reports-viewer';

export default function AdminStaffReportsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <StaffReportsViewer viewMode="admin" />
      </div>
    </div>
  );
}