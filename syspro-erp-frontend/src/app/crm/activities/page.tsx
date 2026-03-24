"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ActivitiesPage from "./ActivitiesPage";

function PageContent() {
  const searchParams = useSearchParams();
  const tenantSlug = searchParams.get("tenantSlug");

  return <ActivitiesPage tenantSlug={tenantSlug} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <PageContent />
    </Suspense>
  );
}
