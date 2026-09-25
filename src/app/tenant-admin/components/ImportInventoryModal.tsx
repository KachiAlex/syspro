"use client";

import React, { useState, useRef } from "react";
import { X, AlertCircle, CheckCircle, FileText, Download } from "lucide-react";

interface ImportInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: any[]) => Promise<{ imported: number; updated: number; failed: number; errors: { row: number; sku: string; error: string }[] }>;
}

interface ParsedItem {
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unitPrice: number;
  salePrice: number;
  reorderLevel: number;
  location: string;
  supplier: string;
  description: string;
}

const REQUIRED_HEADERS = ["name", "sku", "category"];
const ALL_HEADERS = [
  "name",
  "sku",
  "category",
  "quantity",
  "unitprice",
  "saleprice",
  "reorderlevel",
  "location",
  "supplier",
  "description",
];

// Minimal quote-aware CSV line splitter (handles "a,b" and "" escapes)
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function parseCSV(csvText: string): ParsedItem[] {
  const lines = csvText.replace(/\r\n?/g, "\n").trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV file must have a header row and at least one data row");
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(", ")}`);
  }

  const items: ParsedItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (ALL_HEADERS.includes(h)) row[h] = values[idx] ?? "";
    });

    if (!row.name || !row.sku || !row.category) {
      throw new Error(`Row ${i + 1}: missing required fields (name, sku, category)`);
    }

    const num = (v: string | undefined) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    items.push({
      name: row.name,
      sku: row.sku,
      category: row.category,
      quantity: num(row.quantity),
      unitPrice: num(row.unitprice),
      salePrice: row.saleprice ? num(row.saleprice) : num(row.unitprice),
      reorderLevel: num(row.reorderlevel),
      location: row.location || "",
      supplier: row.supplier || "",
      description: row.description || "",
    });
  }
  return items;
}

export default function ImportInventoryModal({
  isOpen,
  onClose,
  onImport,
}: ImportInventoryModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [error, setError] = useState<string>("");
  const [rowErrors, setRowErrors] = useState<{ row: number; sku: string; error: string }[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setItems([]);
    setError("");
    setRowErrors([]);
    setSuccessMessage("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a CSV file");
      return;
    }

    setFile(selectedFile);
    setError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = parseCSV(event.target?.result as string);
        if (parsed.length === 0) throw new Error("No valid items found in CSV");
        setItems(parsed);
        setStep("preview");
      } catch (err: any) {
        setError(err.message || "Failed to parse CSV file");
        setFile(null);
      }
    };
    reader.onerror = () => {
      setError("Failed to read file");
      setFile(null);
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    setStep("importing");
    setRowErrors([]);
    try {
      const result = await onImport(items);
      if (result.failed > 0) {
        setRowErrors(result.errors);
        setError(`${result.failed} row(s) failed — see details below. ${result.imported} imported, ${result.updated} updated.`);
        setStep("preview");
        return;
      }
      setSuccessMessage(
        `Successfully imported ${result.imported} item(s)` +
          (result.updated > 0 ? `, updated ${result.updated} existing` : "") +
          "!"
      );
      setTimeout(() => {
        reset();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to import items");
      setStep("preview");
    }
  };

  const downloadSample = () => {
    const link = document.createElement("a");
    link.href = "/sample-inventory.csv";
    link.download = "sample-inventory.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Import Inventory</h2>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700 transition"
            disabled={step === "importing"}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "upload" && (
            <div>
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Upload CSV File
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Import multiple inventory items at once. Required columns:{" "}
                    <span className="font-medium">name, sku, category</span>.
                    Optional: quantity, unitPrice, salePrice, reorderLevel,
                    location, supplier, description. Rows with an existing SKU
                    will update that item.
                  </p>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
                  >
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-900">
                      Click to select or drag and drop
                    </p>
                    <p className="text-xs text-gray-600 mt-1">CSV files only</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {/* Sample Template */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Need a template?
                  </h4>
                  <p className="text-sm text-blue-800 mb-3">
                    Download our sample CSV file to see the correct format and
                    use it as a template.
                  </p>
                  <button
                    onClick={downloadSample}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-black rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </button>
                </div>

                {file && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-green-700">Ready to preview</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "preview" && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Preview ({items.length} items)
                </h3>
                <p className="text-sm text-gray-600">
                  Review the items that will be imported. Existing SKUs will be
                  updated rather than duplicated.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                  {rowErrors.length > 0 && (
                    <ul className="text-xs text-red-700 list-disc list-inside max-h-32 overflow-y-auto">
                      {rowErrors.map((e, i) => (
                        <li key={i}>
                          Row {e.row}
                          {e.sku ? ` (SKU: ${e.sku})` : ""}: {e.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">SKU</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Name</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Category</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-900">Qty</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-900">Unit Price</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-900">Reorder</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 10).map((item, index) => (
                      <tr key={index} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{item.sku}</td>
                        <td className="px-4 py-3 text-gray-900">{item.name}</td>
                        <td className="px-4 py-3 text-gray-600">{item.category}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{item.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{item.reorderLevel}</td>
                        <td className="px-4 py-3 text-gray-600">{item.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {items.length > 10 && (
                <p className="text-xs text-gray-600 mb-4">
                  Showing 10 of {items.length} items...
                </p>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setStep("upload");
                    setFile(null);
                    setItems([]);
                    setError("");
                    setRowErrors([]);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-blue-600 text-black rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Import {items.length} Items
                </button>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin mb-4">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
              </div>
              <p className="text-gray-900 font-medium">Importing items...</p>
              <p className="text-sm text-gray-600 mt-2">
                Please wait while we import {items.length} items
              </p>
            </div>
          )}

          {successMessage && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="w-12 h-12 text-green-600 mb-3" />
              <p className="text-gray-900 font-medium">{successMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
