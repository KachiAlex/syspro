import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "pl";
    const format = url.searchParams.get("format") || "pdf";
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    // Generate file content based on format
    let content: string;
    let mimeType: string;
    let filename: string;

    const sDate = startDate || undefined;
    const eDate = endDate || undefined;

    if (format === "excel") {
      // Generate simple CSV/Excel format
      content = generateExcelContent(type, sDate, eDate);
      mimeType = "text/csv";
      filename = `${type}-report-${sDate || 'all'}-to-${eDate || 'all'}.csv`;
    } else {
      // Generate simple text format (PDF simulation)
      content = generatePDFContent(type, sDate, eDate);
      mimeType = "text/plain";
      filename = `${type}-report-${sDate || 'all'}-to-${eDate || 'all'}.txt`;
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Report export failed:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to export report", details: errorMessage },
      { status: 500 }
    );
  }
}

function generateExcelContent(type: string, startDate?: string, endDate?: string): string {
  const reportNames: Record<string, string> = {
    pl: "Profit & Loss Statement",
    balance: "Balance Sheet",
    cashflow: "Cash Flow Statement",
    aged: "Aged Receivables",
  };

  const lines: string[] = [];
  lines.push(reportNames[type] || "Financial Report");
  lines.push(`Period: ${startDate} to ${endDate}`);
  lines.push("");
  lines.push("Item,Amount,Percentage");

  // Sample data rows
  const sampleData = [
    ["Revenue", "5000000", "100%"],
    ["Expenses", "3000000", "60%"],
    ["Net Income", "2000000", "40%"],
  ];

  sampleData.forEach((row) => {
    lines.push(row.join(","));
  });

  return lines.join("\n");
}

function generatePDFContent(type: string, startDate?: string, endDate?: string): string {
  const reportNames: Record<string, string> = {
    pl: "Profit & Loss Statement",
    balance: "Balance Sheet",
    cashflow: "Cash Flow Statement",
    aged: "Aged Receivables",
  };

  const lines: string[] = [];
  lines.push("========================================");
  lines.push(reportNames[type] || "Financial Report");
  lines.push("========================================");
  lines.push("");
  lines.push(`Period: ${startDate} to ${endDate}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("----------------------------------------");
  lines.push("Item                          Amount");
  lines.push("----------------------------------------");
  lines.push("Revenue                    ₦ 5,000,000");
  lines.push("Expenses                   ₦ 3,000,000");
  lines.push("Net Income                 ₦ 2,000,000");
  lines.push("----------------------------------------");
  lines.push("");
  lines.push("End of Report");

  return lines.join("\n");
}
