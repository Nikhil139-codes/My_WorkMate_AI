"use client";

import { useState, useRef } from "react";
import {
  Upload,
  X,
  FileText,
  AlertCircle,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (document: any, suggestion?: any) => void;
}

const ALLOWED_EXTENSIONS = [
  "pdf",
  "docx",
  "txt",
  "csv",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "mp3",
  "wav",
  "m4a",
  "ogg",
  "mp4",
  "webm",
  "mov",
];

export function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [purpose, setPurpose] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setErrorMessage(
        `Unsupported file type .${ext}. Supported formats: PDF, DOCX, TXT, CSV, PNG, JPG, WEBP, MP3, WAV, M4A, MP4, WEBM, MOV.`
      );
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage("File exceeds 50MB maximum upload limit.");
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
    if (purpose.trim()) {
      formData.append("purpose", purpose.trim());
    }

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Document upload failed");
        setIsUploading(false);
        return;
      }

      onSuccess(data.document, data.document.onboardingSuggestion);
      onClose();
    } catch {
      setErrorMessage("Network error occurred during document upload");
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
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5]">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Upload Enterprise Document
              </h3>
              <p className="text-[11px] text-slate-500">
                Supports PDF, DOCX, TXT, and CSV up to 25MB
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

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${isDragging
                ? "border-[#4F46E5] bg-indigo-50/50"
                : selectedFile
                  ? "border-emerald-300 bg-emerald-50/30"
                  : "border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-white"
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800 truncate max-w-xs">
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatFileSize(selectedFile.size)} • Ready for AI Onboarding
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5]">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  Click to select or drag and drop your file here
                </p>
                <p className="text-[11px] text-slate-400">
                  PDF, DOCX, TXT, or CSV (max 25MB)
                </p>
              </div>
            )}
          </div>

          {/* Purpose / Objective Input */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                Document Purpose / Business Objective
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Optional</span>
            </label>
            <textarea
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Q3 Strategic Financial Review, Vendor Master Services Agreement, or Technical Architecture..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-hidden"
            />
            <p className="text-[10px] text-slate-500">
              Helps the GeminiAI Document Onboarding Agent propose optimal chunking and security classification.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="flex items-center gap-2 rounded-xl bg-[#4F46E5] px-5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing & Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Upload & Analyze</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
