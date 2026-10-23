"use client";

import React, { useState, useRef } from "react";
import { X, AlertCircle, CheckCircle, FileText, Download } from "lucide-react";

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (contacts: any[]) => Promise<void>;
}

export default function ImportContactsModal({
  isOpen,
  onClose,
  onImport,
}: ImportContactsModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing">(
    "upload"
  );
  const [file, setFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) {
      throw new Error("CSV file must have header row and at least one data row");
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const expectedHeaders = [
      "firstname",
      "lastname",
      "email",
      "phone",
      "company",
      "title",
      "type",
      "segment",
    ];

    // Check if all required headers are present
    const missingHeaders = expectedHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(
        `Missing required columns: ${missingHeaders.join(", ")}`
      );
    }

    const parsedContacts = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines

      const values = lines[i].split(",").map((v) => v.trim());
      const contact: any = {};

      headers.forEach((header, index) => {
        contact[header] = values[index] || "";
      });

      // Validate required fields
      if (!contact.firstname || !contact.lastname || !contact.email) {
        throw new Error(
          `Row ${i + 1}: Missing required fields (firstName, lastName, email)`
        );
      }

      // Validate email format
      if (!contact.email.includes("@")) {
        throw new Error(`Row ${i + 1}: Invalid email format`);
      }

      parsedContacts.push({
        firstName: contact.firstname,
        lastName: contact.lastname,
        email: contact.email,
        phone: contact.phone || "",
        company: contact.company || "",
        title: contact.title || "",
        type: ["Customer", "Prospect", "Partner", "Vendor"].includes(
          contact.type
        )
          ? contact.type
          : "Customer",
        segment: ["VIP", "Premium", "Standard", "Inactive"].includes(
          contact.segment
        )
          ? contact.segment
          : "Standard",
        notes: contact.notes || "",
      });
    }

    return parsedContacts;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please select a CSV file");
      return;
    }

    setFile(selectedFile);
    setError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        const parsedContacts = parseCSV(csvText);

        if (parsedContacts.length === 0) {
          throw new Error("No valid contacts found in CSV");
        }

        setContacts(parsedContacts);
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
    try {
      await onImport(contacts);
      setSuccessMessage(`Successfully imported ${contacts.length} contacts!`);
      setTimeout(() => {
        setStep("upload");
        setFile(null);
        setContacts([]);
        setSuccessMessage("");
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to import contacts");
      setStep("preview");
    }
  };

  const downloadSample = () => {
    const link = document.createElement("a");
    link.href = "/sample-contacts.csv";
    link.download = "sample-contacts.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-theme-overlay flex items-center justify-center z-50">
      <div className="bg-theme-surface rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-border">
          <h2 className="text-xl font-bold text-theme-text-primary">Import Contacts</h2>
          <button
            onClick={onClose}
            className="text-theme-text-secondary hover:text-theme-text-primary transition"
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
                  <h3 className="text-lg font-semibold text-theme-text-primary mb-3">
                    Upload CSV File
                  </h3>
                  <p className="text-sm text-theme-text-secondary mb-4">
                    Import multiple contacts at once using a CSV file. Make sure
                    your file includes required columns:{" "}
                    <span className="font-medium">
                      firstName, lastName, email, phone, company, title, type,
                      segment
                    </span>
                  </p>

                  {/* File Upload Area */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-theme-border rounded-lg p-8 text-center cursor-pointer hover:border-theme-accent hover:bg-theme-muted transition"
                  >
                    <FileText className="w-12 h-12 text-theme-text-tertiary mx-auto mb-3" />
                    <p className="text-sm font-medium text-theme-text-primary">
                      Click to select or drag and drop
                    </p>
                    <p className="text-xs text-theme-text-secondary mt-1">CSV files only</p>
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
                  <h4 className="font-semibold text-theme-text-primary mb-2">
                    Need a template?
                  </h4>
                  <p className="text-sm text-blue-800 mb-3">
                    Download our sample CSV file to see the correct format and
                    use it as a template.
                  </p>
                  <button
                    onClick={downloadSample}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-theme-accent text-theme-text-primary rounded-lg hover:bg-theme-accent-hover transition-colors text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download Sample
                  </button>
                </div>

                {/* File Info */}
                {file && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-green-700">
                        Ready to preview
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "preview" && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-theme-text-primary mb-2">
                  Preview ({contacts.length} contacts)
                </h3>
                <p className="text-sm text-theme-text-secondary">
                  Review the contacts that will be imported. Make sure all
                  information looks correct.
                </p>
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto border border-theme-border rounded-lg mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-theme-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-theme-text-primary">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-theme-text-primary">
                        Email
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-theme-text-primary">
                        Company
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-theme-text-primary">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-theme-text-primary">
                        Segment
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.slice(0, 10).map((contact, index) => (
                      <tr
                        key={index}
                        className="border-t border-theme-border hover:bg-theme-muted"
                      >
                        <td className="px-4 py-3 text-theme-text-primary">
                          {contact.firstName} {contact.lastName}
                        </td>
                        <td className="px-4 py-3 text-theme-text-secondary">
                          {contact.email}
                        </td>
                        <td className="px-4 py-3 text-theme-text-secondary">
                          {contact.company}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {contact.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            {contact.segment}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {contacts.length > 10 && (
                <p className="text-xs text-theme-text-secondary mb-4">
                  Showing 10 of {contacts.length} contacts...
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-theme-border">
                <button
                  onClick={() => {
                    setStep("upload");
                    setFile(null);
                    setContacts([]);
                  }}
                  className="px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-theme-accent text-theme-text-primary rounded-lg hover:bg-theme-accent-hover transition-colors font-medium"
                >
                  Import {contacts.length} Contacts
                </button>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin mb-4">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
              </div>
              <p className="text-theme-text-primary font-medium">Importing contacts...</p>
              <p className="text-sm text-theme-text-secondary mt-2">
                Please wait while we import {contacts.length} contacts
              </p>
            </div>
          )}

          {successMessage && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="w-12 h-12 text-green-600 mb-3" />
              <p className="text-theme-text-primary font-medium">{successMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
