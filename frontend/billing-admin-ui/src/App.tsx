import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Dashboard } from './pages/Dashboard'
import { Plans } from './pages/Plans'
import { PlanEditor } from './pages/PlanEditor'
import { TenantsList } from './pages/TenantsList'
import { TenantBilling } from './pages/TenantBilling'
import { InvoicesList } from './pages/InvoicesList'
import { InvoiceView } from './pages/InvoiceView'
import { MeteringConsole } from './pages/MeteringConsole'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Topbar />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/plans" element={<Plans />} />
              <Route path="/plans/new" element={<PlanEditor />} />
              <Route path="/plans/:id/edit" element={<PlanEditor />} />
              <Route path="/tenants" element={<TenantsList />} />
              <Route path="/tenants/:id/billing" element={<TenantBilling />} />
              <Route path="/invoices" element={<InvoicesList />} />
              <Route path="/invoices/:id" element={<InvoiceView />} />
              <Route path="/metering" element={<MeteringConsole />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  )
}

export default App

