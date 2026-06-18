import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: Request) {
  try {
    const context = validateTenantContext(request as any, "read");
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'performance';
    const format = searchParams.get('format') || 'pdf';

    // Mock export data - replace with real report generation
    let content = '';
    let contentType = 'application/pdf';
    let filename = `projects-report-${reportType}-${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      contentType = 'text/csv';
      filename += '.csv';
      content = generateCSVReport(reportType);
    } else if (format === 'excel') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename += '.xlsx';
      content = generateExcelReport(reportType);
    } else {
      contentType = 'application/pdf';
      filename += '.pdf';
      content = generatePDFReport(reportType);
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Failed to export report:', error);
    return NextResponse.json({ error: 'Failed to export report' }, { status: 500 });
  }
}

function generateCSVReport(reportType: string): string {
  const headers = ['Metric', 'Value'];
  const rows: string[][] = [];

  if (reportType === 'performance') {
    rows.push(['Total Projects', '12']);
    rows.push(['Completed Projects', '4']);
    rows.push(['Active Projects', '5']);
    rows.push(['Completion Rate', '33%']);
  } else if (reportType === 'financial') {
    rows.push(['Total Budget', '$500,000']);
    rows.push(['Total Spent', '$350,000']);
    rows.push(['Remaining', '$150,000']);
    rows.push(['Budget Utilization', '70%']);
  } else if (reportType === 'timeline') {
    rows.push(['Total Projects', '12']);
    rows.push(['On Time Projects', '8']);
    rows.push(['Overdue Projects', '1']);
    rows.push(['On Time Percentage', '67%']);
  } else if (reportType === 'resource') {
    rows.push(['Total Team Members', '45']);
    rows.push(['Average Team Size', '5']);
    rows.push(['Resource Utilization', '85%']);
  }

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  return csv;
}

function generateExcelReport(reportType: string): string {
  // Mock Excel generation - in production, use a library like xlsx
  return generateCSVReport(reportType);
}

function generatePDFReport(reportType: string): string {
  // Mock PDF generation - in production, use a library like pdfkit or puppeteer
  return `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(${reportType} Report) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
0000000303 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
397
%%EOF`;
}
