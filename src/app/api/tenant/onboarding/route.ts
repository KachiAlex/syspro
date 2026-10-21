export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getOnboardingState,
  markCompleted,
  resetOnboarding,
  setDismissed,
  skipStep,
  updateTenantProfile,
  type OnboardingStepId,
} from "@/lib/tenant/onboarding";
import { ONBOARDING_STEPS } from "@/lib/tenant/onboarding";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "admin", "read");
  if (!gate.ok) return gate.response;
  try {
    const state = await getOnboardingState(context.tenantSlug);
    return NextResponse.json(state);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const stepIds = ONBOARDING_STEPS.map((s) => s.id) as [OnboardingStepId, ...OnboardingStepId[]];

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("skip"), step: z.enum(stepIds) }),
  z.object({ action: z.literal("unskip"), step: z.enum(stepIds) }),
  z.object({ action: z.literal("dismiss"), dismissed: z.boolean().default(true) }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("reset") }),
  z.object({
    action: z.literal("profile"),
    name: z.string().optional(),
    industry: z.string().optional(),
    region: z.string().optional(),
    baseCurrency: z.string().optional(),
    timezone: z.string().optional(),
  }),
]);

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "admin", "write");
  if (!gate.ok) return gate.response;
  try {
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid onboarding action", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const slug = context.tenantSlug;

    switch (body.action) {
      case "skip":
        await skipStep(slug, body.step, true);
        break;
      case "unskip":
        await skipStep(slug, body.step, false);
        break;
      case "dismiss":
        await setDismissed(slug, body.dismissed);
        break;
      case "complete":
        await markCompleted(slug);
        break;
      case "reset":
        await resetOnboarding(slug);
        break;
      case "profile":
        await updateTenantProfile(slug, body);
        break;
    }

    return NextResponse.json(await getOnboardingState(slug));
  } catch (err: any) {
    const message = err?.message || "Onboarding action failed";
    const status = /required|pending|cannot/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
