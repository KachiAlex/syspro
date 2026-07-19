import { NextRequest, NextResponse } from 'next/server';
import {
  insertStaffReportTemplate,
  listStaffReportTemplates,
  getStaffReportTemplateById,
  updateStaffReportTemplate,
  deleteStaffReportTemplate,
} from '@/lib/hr/db';

const VALID_REPORT_TYPES = ['daily', 'weekly', 'monthly', 'quarterly'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenantSlug');
    const reportType = searchParams.get('reportType') ?? undefined;
    const id = searchParams.get('id') ?? undefined;

    if (!tenantSlug) {
      return NextResponse.json({ error: 'tenantSlug is required' }, { status: 400 });
    }

    if (id) {
      const template = await getStaffReportTemplateById(tenantSlug, id);
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      return NextResponse.json({ template });
    }

    const templates = await listStaffReportTemplates(tenantSlug, { reportType });
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error loading staff report templates:', error);
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug, reportType, name, isDefault, sections, createdBy } = body;

    if (!tenantSlug || !reportType || !name || !Array.isArray(sections)) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantSlug, reportType, name, sections' },
        { status: 400 }
      );
    }

    if (!VALID_REPORT_TYPES.includes(reportType)) {
      return NextResponse.json(
        { error: `Invalid reportType. Must be one of: ${VALID_REPORT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const template = await insertStaffReportTemplate({
      tenantSlug,
      reportType,
      name,
      isDefault: !!isDefault,
      sections,
      createdBy,
    });

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error) {
    console.error('Error creating staff report template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, tenantSlug, reportType, name, isDefault, sections } = body;

    if (!id || !tenantSlug) {
      return NextResponse.json({ error: 'Missing id and tenantSlug' }, { status: 400 });
    }

    const template = await updateStaffReportTemplate(tenantSlug, id, {
      reportType,
      name,
      isDefault,
      sections,
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('Error updating staff report template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const tenantSlug = searchParams.get('tenantSlug');

    if (!id || !tenantSlug) {
      return NextResponse.json({ error: 'Missing id and tenantSlug' }, { status: 400 });
    }

    await deleteStaffReportTemplate(tenantSlug, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting staff report template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
