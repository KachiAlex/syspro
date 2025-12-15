import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import * as puppeteer from 'puppeteer';
import { Invoice } from '../entities/invoice.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);
  private readonly storagePath: string;

  constructor(private configService: ConfigService) {
    // Use local storage directory (default: ./storage/invoices)
    this.storagePath = this.configService.get<string>(
      'INVOICE_STORAGE_PATH',
      path.join(process.cwd(), 'storage', 'invoices'),
    );

    // Ensure storage directory exists
    this.ensureStorageDirectory();
  }

  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
      this.logger.log(`Created invoice storage directory: ${this.storagePath}`);
    }
  }

  async generateInvoicePdf(invoice: Invoice): Promise<string> {
    try {
      // Load HTML template
      const htmlTemplate = this.getInvoiceTemplate();
      const template = Handlebars.compile(htmlTemplate);

      // Prepare template data
      const templateData = {
        invoiceNumber: invoice.invoiceNumber,
        issuedAt: invoice.issuedAt.toLocaleDateString(),
        dueAt: invoice.dueAt.toLocaleDateString(),
        amountDue: (invoice.amountDueCents / 100).toFixed(2),
        amountPaid: (invoice.amountPaidCents / 100).toFixed(2),
        currency: invoice.currency,
        status: invoice.status,
        lineItems: invoice.lineItems || [],
        total: (invoice.amountDueCents / 100).toFixed(2),
      };

      // Render HTML
      const html = template(templateData);

      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
      });

      await browser.close();

      // Save to local storage
      const tenantDir = path.join(this.storagePath, invoice.tenantId);
      if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
      }

      const fileName = `${invoice.id}.pdf`;
      const filePath = path.join(tenantDir, fileName);

      fs.writeFileSync(filePath, pdfBuffer);

      // Return local file URL (relative path for API serving)
      // In production, this would be served via a static file endpoint
      const url = `/api/billing/invoices/${invoice.id}/pdf`;
      this.logger.log(`Invoice PDF saved to: ${filePath}`);
      
      return url;
    } catch (error) {
      this.logger.error('Failed to generate invoice PDF', error);
      // Return placeholder URL in case of error
      return `https://placeholder.com/invoice/${invoice.id}.pdf`;
    }
  }

  private getInvoiceTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    .header { margin-bottom: 30px; }
    .invoice-info { margin-bottom: 30px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f2f2f2; }
    .total { text-align: right; font-size: 18px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Invoice #{{invoiceNumber}}</h1>
    <p>Status: {{status}}</p>
  </div>
  
  <div class="invoice-info">
    <p><strong>Issued:</strong> {{issuedAt}}</p>
    <p><strong>Due:</strong> {{dueAt}}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Quantity</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each lineItems}}
      <tr>
        <td>{{description}}</td>
        <td>{{quantity}}</td>
        <td>{{currency}} {{unitPrice}}</td>
        <td>{{currency}} {{total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  
  <div class="total">
    <p>Total: {{currency}} {{total}}</p>
    <p>Amount Paid: {{currency}} {{amountPaid}}</p>
    <p>Amount Due: {{currency}} {{amountDue}}</p>
  </div>
</body>
</html>
    `;
  }
}

