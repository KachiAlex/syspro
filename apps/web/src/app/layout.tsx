import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Syspro ERP - Multi-Tenant Business Management',
  description: 'Production-ready multi-tenant ERP system built with NestJS, React, and PostgreSQL',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}