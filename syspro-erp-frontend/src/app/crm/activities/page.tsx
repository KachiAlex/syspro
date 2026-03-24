"use client";

import { useSearchParams } from "next/navigation";
import ActivitiesPage from "./ActivitiesPage";

export default function Page() {
  const searchParams = useSearchParams();
  const tenantSlug = searchParams.get("tenantSlug");

  return <ActivitiesPage tenantSlug={tenantSlug} />;
}
