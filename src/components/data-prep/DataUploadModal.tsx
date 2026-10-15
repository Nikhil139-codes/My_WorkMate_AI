"use client";

import { useState, useRef } from "react";
import {
  Upload,
  X,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface DataUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDataset: any) => void;
}

const ALLOWED_EXTENSIONS = ["csv", "xlsx", "xls"];

export function DataUploadModal({ isOpen, onClose, onSuccess }: DataUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setErrorMessage(`Unsupported file format .${ext}. Please upload a CSV or XLSX spreadsheet.`);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage("File exceeds 25MB maximum upload limit.");
      return;
    }
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/data-prep/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Dataset upload failed");
        setIsUploading(false);
        return;
      }

      onSuccess(data.dataset);
      onClose();
    } catch {
      setErrorMessage("Network error occurred during dataset upload");
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#0D9488]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Upload Tabular Dataset
              </h3>
              <p className="text-[11px] text-slate-500">
                Supports CSV and XLSX spreadsheets up to 25MB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Drag & Drop */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-[#0D9488] bg-teal-50/50 scale-[0.99]"
                : selectedFile
                ? "border-emerald-300 bg-emerald-50/30"
                : "border-slate-200 bg-[#FAFBFC] hover:border-teal-300 hover:bg-white"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-2xs">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 max-w-xs truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatFileSize(selectedFile.size)} • Click or drop to replace
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-[#0D9488]">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  Drop your CSV or XLSX file here, or{" "}
                  <span className="text-[#0D9488] underline">browse</span>
                </p>
                <p className="text-[11px] text-slate-400">
                  Automated anomaly detection, duplicate removal & schema profiling
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 text-xs text-teal-900 flex items-start gap-2">
            <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-[#0D9488]" />
            <p className="text-[11px] leading-relaxed">
              <strong>Zero-Leakage AI Profiling:</strong> WorkMate AI analyzes structural metadata and statistics locally. Raw confidential rows are never transmitted across untrusted networks.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Profiling Dataset...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Upload & Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
