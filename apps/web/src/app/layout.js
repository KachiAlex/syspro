import './globals.css'

export const metadata = {
  title: 'Syspro ERP - Multi-Tenant Business Management',
  description: 'Production-ready multi-tenant ERP system built with NestJS, React, and PostgreSQL',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}