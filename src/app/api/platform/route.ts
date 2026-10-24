export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  allowedActions, applyTransition, deleteWorkflow, listWorkflows, upsertWorkflow,
} from "@/lib/platform/workflows";
import {
  listPrintFormats, renderPrintFormat, upsertPrintFormat,
} from "@/lib/platform/print-formats";
import {
  createSubscription, listDeliveries, listSubscriptions,
  processDeliveries, retryDelivery, updateSubscription,
} from "@/lib/platform/webhooks";
import {
  createWebForm, listSubmissions, listWebForms, updateWebForm,
} from "@/lib/platform/web-forms";
import {
  createImport, entitySpec, IMPORTABLE_ENTITIES, listImports, runImport,
} from "@/lib/platform/data-import";
import {
  completeVisit, createSchedule, listSchedules, listVisits,
  processDueSchedules, updateSchedule,
} from "@/lib/platform/maintenance";
import {
  getGatewayConfig, initializeGatewayPayment, listGatewayConfigs, listPaymentLinks,
  upsertGatewayConfig,
} from "@/lib/finance/gateway-providers";
import { knownStatesForDocType } from "@/lib/platform/doc-states";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") ?? "workflows";

    switch (view) {
      case "workflows":
        return NextResponse.json({ workflows: await listWorkflows(context.tenantSlug, searchParams.get("docType") ?? undefined) });
      case "doc-states": {
        const docType = String(searchParams.get("docType") ?? "");
        const names = new Set<string>(knownStatesForDocType(docType));
        const workflows = await listWorkflows(context.tenantSlug, docType || undefined);
        for (const w of workflows) {
          for (const s of (w.states ?? []) as { name?: string }[]) {
            if (s?.name) names.add(s.name);
          }
        }
        return NextResponse.json({ states: [...names] });
      }
      case "allowed-actions":
        return NextResponse.json({ actions: await allowedActions(context.tenantSlug, String(searchParams.get("docType")), String(searchParams.get("state")), (searchParams.get("roles") ?? "").split(",").filter(Boolean)) });
      case "print-formats":
        return NextResponse.json({ formats: await listPrintFormats(context.tenantSlug, searchParams.get("docType") ?? undefined) });
      case "webhooks":
        return NextResponse.json({ subscriptions: await listSubscriptions(context.tenantSlug), deliveries: await listDeliveries(context.tenantSlug, searchParams.get("status") ?? undefined) });
      case "web-forms":
        return NextResponse.json({ forms: await listWebForms(context.tenantSlug) });
      case "form-submissions":
        return NextResponse.json({ submissions: await listSubmissions(context.tenantSlug, String(searchParams.get("formId"))) });
      case "data-imports":
        return NextResponse.json({ imports: await listImports(context.tenantSlug), entities: IMPORTABLE_ENTITIES.map((e) => ({ entity: e, spec: entitySpec(e) })) });
      case "gateways":
        return NextResponse.json({ configs: await listGatewayConfigs(context.tenantSlug), links: await listPaymentLinks(context.tenantSlug, searchParams.get("invoiceId") ?? undefined) });
      case "maintenance":
        return NextResponse.json({ schedules: await listSchedules(context.tenantSlug), visits: await listVisits(context.tenantSlug) });
      default:
        return NextResponse.json({ error: "Unknown view" }, { status: 400 });
    }
  } catch (error) {
    console.error("Platform read failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();

    switch (body.action) {
      case "upsert-workflow":
        return NextResponse.json({ workflow: await upsertWorkflow({
          tenantSlug: context.tenantSlug, id: body.id, docType: String(body.docType),
          name: String(body.name), statusField: body.statusField,
          states: body.states ?? [], transitions: body.transitions ?? [],
          isActive: body.isActive, createdBy: context.userId,
        }) });
      case "delete-workflow":
        await deleteWorkflow(context.tenantSlug, String(body.id));
        return NextResponse.json({ ok: true });
      case "apply-transition":
        return NextResponse.json(await applyTransition({
          tenantSlug: context.tenantSlug, docType: String(body.docType),
          currentState: String(body.currentState), action: String(body.transitionAction),
          roles: body.roles ?? [],
        }));
      case "upsert-print-format":
        return NextResponse.json({ format: await upsertPrintFormat({
          tenantSlug: context.tenantSlug, id: body.id, docType: String(body.docType),
          name: String(body.name), isDefault: body.isDefault,
          headerHtml: body.headerHtml, bodyHtml: String(body.bodyHtml ?? ""),
          footerHtml: body.footerHtml, css: body.css, createdBy: context.userId,
        }) });
      case "render-print-format": {
        const r = await renderPrintFormat({
          tenantSlug: context.tenantSlug, docType: String(body.docType),
          doc: body.doc ?? {}, formatId: body.formatId,
        });
        return new NextResponse(r.html, { headers: { "Content-Type": "text/html" } });
      }
      case "create-webhook":
        return NextResponse.json({ subscription: await createSubscription({
          tenantSlug: context.tenantSlug, name: String(body.name),
          targetUrl: String(body.targetUrl), secret: body.secret,
          docTypes: body.docTypes ?? [], events: body.events,
        }) }, { status: 201 });
      case "update-webhook":
        return NextResponse.json({ subscription: await updateSubscription({
          tenantSlug: context.tenantSlug, id: String(body.id),
          isActive: body.isActive, targetUrl: body.targetUrl,
          secret: body.secret, docTypes: body.docTypes, events: body.events,
        }) });
      case "retry-delivery":
        await retryDelivery(context.tenantSlug, String(body.id));
        return NextResponse.json({ ok: true });
      case "process-deliveries":
        return NextResponse.json(await processDeliveries(body.limit));
      case "create-web-form":
        return NextResponse.json({ form: await createWebForm({
          tenantSlug: context.tenantSlug, name: String(body.name),
          slug: String(body.slug), targetEntity: String(body.targetEntity),
          schema: body.schema ?? [], successMessage: body.successMessage,
          notifyEmail: body.notifyEmail,
        }) }, { status: 201 });
      case "update-web-form":
        return NextResponse.json({ form: await updateWebForm({
          tenantSlug: context.tenantSlug, id: String(body.id),
          isActive: body.isActive, schema: body.schema,
          name: body.name, notifyEmail: body.notifyEmail,
        }) });
      case "create-import":
        return NextResponse.json({ dataImport: await createImport({
          tenantSlug: context.tenantSlug, entity: String(body.entity),
          fileName: body.fileName, columnMap: body.columnMap ?? {},
          createdBy: context.userId,
        }) }, { status: 201 });
      case "run-import":
        return NextResponse.json(await runImport({
          tenantSlug: context.tenantSlug, importId: String(body.importId),
          csvText: String(body.csvText ?? ""),
        }));
      case "upsert-gateway": {
        const provider = String(body.provider ?? "");
        if (!["paystack", "flutterwave"].includes(provider)) {
          return NextResponse.json({ error: "provider must be paystack or flutterwave" }, { status: 400 });
        }
        if (!body.secretKey) {
          return NextResponse.json({ error: "secretKey is required" }, { status: 400 });
        }
        return NextResponse.json({ config: await upsertGatewayConfig({
          tenantSlug: context.tenantSlug, provider: provider as "paystack" | "flutterwave",
          publicKey: typeof body.publicKey === "string" ? body.publicKey.trim() : body.publicKey,
          secretKey: String(body.secretKey).trim(),
          webhookSecret: typeof body.webhookSecret === "string" ? body.webhookSecret.trim() : body.webhookSecret,
          mode: body.mode, isActive: body.isActive,
        }) });
      }
      case "verify-gateway": {
        const provider = String(body.provider ?? "paystack");
        const cfg = await getGatewayConfig(context.tenantSlug, provider as "paystack" | "flutterwave");
        if (!cfg?.secret_key) {
          return NextResponse.json({ ok: false, error: `No active ${provider} config — save keys first` });
        }
        try {
          const url = provider === "paystack"
            ? "https://api.paystack.co/bank?country=nigeria&perPage=1"
            : "https://api.flutterwave.com/v3/banks/NG";
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${String(cfg.secret_key).trim()}` },
          });
          const payload = await res.json().catch(() => null);
          if (res.ok && (payload?.status === true || payload?.status === "success")) {
            return NextResponse.json({ ok: true, message: `${provider} keys are valid (${cfg.mode ?? "test"} mode)` });
          }
          return NextResponse.json({
            ok: false,
            error: `${provider} rejected the key: ${payload?.message ?? `HTTP ${res.status}`}. Make sure the Secret key starts with ${provider === "paystack" ? "sk_" : "FLWSECK-"} — not the public key.`,
          });
        } catch (e) {
          return NextResponse.json({ ok: false, error: "Could not reach the provider" });
        }
      }
      case "init-payment": {
        const provider = String(body.provider ?? "paystack");
        if (!["paystack", "flutterwave"].includes(provider)) {
          return NextResponse.json({ error: "provider must be paystack or flutterwave" }, { status: 400 });
        }
        return NextResponse.json(await initializeGatewayPayment({
          tenantSlug: context.tenantSlug, invoiceId: String(body.invoiceId),
          provider: provider as "paystack" | "flutterwave", customerEmail: String(body.customerEmail),
          callbackUrl: body.callbackUrl,
        }));
      }
      case "create-schedule":
        return NextResponse.json({ schedule: await createSchedule({
          tenantSlug: context.tenantSlug, assetName: String(body.assetName),
          assetId: body.assetId, itemName: body.itemName,
          frequency: body.frequency, nextDue: String(body.nextDue),
          assignedTo: body.assignedTo, notes: body.notes,
        }) }, { status: 201 });
      case "update-schedule":
        return NextResponse.json({ schedule: await updateSchedule({
          tenantSlug: context.tenantSlug, id: String(body.id),
          nextDue: body.nextDue, assignedTo: body.assignedTo,
          isActive: body.isActive, frequency: body.frequency, notes: body.notes,
        }) });
      case "process-maintenance":
        return NextResponse.json(await processDueSchedules(context.tenantSlug));
      case "complete-visit":
        return NextResponse.json({ visit: await completeVisit({
          tenantSlug: context.tenantSlug, visitId: String(body.visitId),
          workDone: body.workDone, engineer: body.engineer,
        }) });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = /not found|not permitted|Invalid|required|must be|Unknown|not configured/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
