"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import Modal from "./Modal";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDangerous = false,
  isLoading = false,
}: ConfirmationModalProps) {
  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Confirmation action failed:", error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnBackdropClick={!isLoading}
    >
      {/* Content */}
      <div className="flex gap-4">
        <div className={`flex-shrink-0 mt-0.5 ${isDangerous ? "text-red-600" : "text-yellow-600"}`}>
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <p className="text-gray-700">{message}</p>
        </div>
      </div>

      {/* Footer with Actions */}
      <div className="flex gap-3 justify-end mt-6">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cancelText}
        </button>
        <button
          onClick={handleConfirm}
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg text-gray-900 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isDangerous
              ? "bg-red-600 hover:bg-red-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isLoading ? "Processing..." : confirmText}
        </button>
      </div>
    </Modal>
  );
}
