"use client";

import React, { useEffect, useState } from "react";

import VendorsWorkspace from "./vendors-workspace";

export default function VendorsPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Vendors</h1>
      <VendorsWorkspace />
    </main>
  );
}
