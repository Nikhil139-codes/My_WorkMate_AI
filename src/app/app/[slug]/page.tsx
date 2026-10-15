"use client";

import { useEffect, useState, use } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Star,
  Send,
  Calendar,
  Lock,
  Clock,
  Layers,
} from "lucide-react";

interface FieldSpec {
  id: string;
  label: string;
  type: "text" | "textarea" | "email" | "number" | "select" | "checkbox" | "multiselect" | "date" | "rating";
  placeholder?: string;
  required: boolean;
  helpText?: string;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
}

interface PublicApp {
  id: string;
  title: string;
  description: string;
  slug: string;
  category: string;
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    layout?: "card" | "full";
  };
  fields: FieldSpec[];
  settings: {
    submitButtonText: string;
    successMessage: string;
    expiresAt?: string | null;
  };
}

export default function PublicAppPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<PublicApp | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Form State
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [submissionId, setSubmissionId] = useState("");

  useEffect(() => {
    async function fetchApp() {
      try {
        const res = await fetch(`/api/public/apps/${slug}`);
        const data = await res.json();

        if (data.expired) {
          setIsExpired(true);
          setStatusMessage(data.message);
          return;
        }

        if (data.unavailable) {
          setIsUnavailable(true);
          setStatusMessage(data.message);
          return;
        }

        if (!res.ok || !data.app) {
          setIsUnavailable(true);
          setStatusMessage(data.error || "This micro-app could not be found.");
          return;
        }

        setApp(data.app);

        // Initialize default form values
        const initial: Record<string, any> = {};
        for (const f of data.app.fields) {
          if (f.type === "checkbox") initial[f.id] = false;
          else if (f.type === "multiselect") initial[f.id] = [];
          else if (f.type === "rating") initial[f.id] = 0;
          else initial[f.id] = "";
        }
        setFormData(initial);
      } catch (err: any) {
        setIsUnavailable(true);
        setStatusMessage("Error loading micro-app.");
      } finally {
        setLoading(false);
      }
    }

    fetchApp();
  }, [slug]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    if (formErrors[fieldId]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const handleMultiselectToggle = (fieldId: string, option: string) => {
    setFormData((prev) => {
      const current: string[] = Array.isArray(prev[fieldId]) ? prev[fieldId] : [];
      const updated = current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option];
      return { ...prev, [fieldId]: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app || isSubmitting) return;

    // Client-side required check
    const errors: Record<string, string> = {};
    for (const f of app.fields) {
      const val = formData[f.id];
      if (f.required) {
        if (
          val === undefined ||
          val === null ||
          val === "" ||
          (Array.isArray(val) && val.length === 0) ||
          (f.type === "rating" && Number(val) === 0)
        ) {
          errors[f.id] = `${f.label} is required.`;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const res = await fetch(`/api/public/apps/${app.slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: formData }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          setFormErrors(data.errors);
        } else {
          alert(data.error || "Submission failed. Please try again.");
        }
        return;
      }

      setSubmitted(true);
      setSuccessMessage(data.message || app.settings.successMessage);
      setSubmissionId(data.submissionId);
    } catch (err: any) {
      alert("Submission error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-xs text-slate-500 font-medium">Loading Micro-App...</p>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4">
            <Clock className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Micro-App Expired</h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            {statusMessage || "This disposable mini-application has reached its expiration time and is no longer accepting submissions."}
          </p>
          <div className="mt-6 border-t border-slate-100 pt-4 text-[11px] text-slate-400">
            Powered by WorkMate AI Disposable Micro-App Engine
          </div>
        </div>
      </div>
    );
  }

  if (isUnavailable || !app) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 mb-4">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">App Unavailable</h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            {statusMessage || "This micro-app is currently not accepting submissions or does not exist."}
          </p>
        </div>
      </div>
    );
  }

  const primaryColor = app.theme?.primaryColor || "#4F46E5";

  return (
    <div
      className="min-h-screen py-10 px-4 sm:px-6 flex flex-col justify-center items-center"
      style={{ backgroundColor: app.theme?.backgroundColor || "#F8FAFC" }}
    >
      <div className="w-full max-w-xl">
        {/* App Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl transition-all">
          {/* Header Accent Bar */}
          <div className="h-2 w-full" style={{ backgroundColor: primaryColor }} />

          <div className="p-6 md:p-8">
            {submitted ? (
              <div className="py-8 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Submission Recorded</h2>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                    {successMessage}
                  </p>
                </div>
                {submissionId && (
                  <p className="text-[11px] font-mono text-slate-400">
                    Confirmation ID: {submissionId.slice(-8).toUpperCase()}
                  </p>
                )}
                <div className="pt-4">
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      // Reset values
                      const reset: Record<string, any> = {};
                      for (const f of app.fields) {
                        if (f.type === "checkbox") reset[f.id] = false;
                        else if (f.type === "multiselect") reset[f.id] = [];
                        else if (f.type === "rating") reset[f.id] = 0;
                        else reset[f.id] = "";
                      }
                      setFormData(reset);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Submit another response
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Title & Description */}
                <div className="border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                      {app.category}
                    </span>
                    {app.settings.expiresAt && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-mono">
                        <Clock className="h-3 w-3" />
                        <span>
                          Expires {new Date(app.settings.expiresAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                    {app.title}
                  </h1>
                  {app.description && (
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      {app.description}
                    </p>
                  )}
                </div>

                {/* Form Fields */}
                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                  {app.fields.map((field) => {
                    const hasError = Boolean(formErrors[field.id]);

                    return (
                      <div key={field.id} className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          {field.label}
                          {field.required && (
                            <span className="text-red-500 ml-1 font-bold">*</span>
                          )}
                        </label>

                        {field.helpText && (
                          <p className="text-[11px] text-slate-400">{field.helpText}</p>
                        )}

                        {/* Text / Email / Number */}
                        {["text", "email", "number"].includes(field.type) && (
                          <input
                            type={field.type}
                            placeholder={field.placeholder || ""}
                            value={formData[field.id] ?? ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            className={`w-full rounded-xl border bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden transition-all ${
                              hasError
                                ? "border-red-400 bg-red-50/30 focus:border-red-500"
                                : "border-slate-200 focus:border-indigo-500"
                            }`}
                          />
                        )}

                        {/* Textarea */}
                        {field.type === "textarea" && (
                          <textarea
                            rows={3}
                            placeholder={field.placeholder || ""}
                            value={formData[field.id] ?? ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            className={`w-full rounded-xl border bg-slate-50/70 p-3.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden transition-all ${
                              hasError
                                ? "border-red-400 bg-red-50/30 focus:border-red-500"
                                : "border-slate-200 focus:border-indigo-500"
                            }`}
                          />
                        )}

                        {/* Date */}
                        {field.type === "date" && (
                          <input
                            type="date"
                            value={formData[field.id] ?? ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            className={`w-full rounded-xl border bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden transition-all ${
                              hasError
                                ? "border-red-400 bg-red-50/30 focus:border-red-500"
                                : "border-slate-200 focus:border-indigo-500"
                            }`}
                          />
                        )}

                        {/* Select Dropdown */}
                        {field.type === "select" && (
                          <select
                            value={formData[field.id] ?? ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden transition-all ${
                              hasError
                                ? "border-red-400 bg-red-50/30 focus:border-red-500"
                                : "border-slate-200 focus:border-indigo-500"
                            }`}
                          >
                            <option value="">
                              {field.placeholder || "Select an option..."}
                            </option>
                            {(field.options || []).map((opt, i) => (
                              <option key={i} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}

                        {/* Star Rating (1-5) */}
                        {field.type === "rating" && (
                          <div className="flex items-center gap-2 pt-1">
                            {[1, 2, 3, 4, 5].map((star) => {
                              const currentRating = Number(formData[field.id] || 0);
                              const isFilled = star <= currentRating;
                              return (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => handleFieldChange(field.id, star)}
                                  className="p-1 rounded-lg hover:scale-110 transition-transform"
                                >
                                  <Star
                                    className={`h-6 w-6 transition-colors ${
                                      isFilled
                                        ? "fill-amber-400 text-amber-400"
                                        : "text-slate-300 hover:text-amber-300"
                                    }`}
                                  />
                                </button>
                              );
                            })}
                            <span className="text-xs font-bold text-slate-500 ml-2">
                              {Number(formData[field.id] || 0) > 0
                                ? `${formData[field.id]} / 5 stars`
                                : "Tap to rate"}
                            </span>
                          </div>
                        )}

                        {/* Checkbox Single */}
                        {field.type === "checkbox" && (
                          <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(formData[field.id])}
                              onChange={(e) =>
                                handleFieldChange(field.id, e.target.checked)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-700">
                              {field.placeholder || field.label}
                            </span>
                          </label>
                        )}

                        {/* Multiselect Checkbox Group */}
                        {field.type === "multiselect" && (
                          <div className="space-y-1.5 pt-1">
                            {(field.options || []).map((opt, i) => {
                              const checked = (
                                (formData[field.id] as string[]) || []
                              ).includes(opt);
                              return (
                                <label
                                  key={i}
                                  className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      handleMultiselectToggle(field.id, opt)
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span>{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {hasError && (
                          <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span>{formErrors[field.id]}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-md hover:brightness-110 active:brightness-95 transition-all disabled:opacity-50"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span>
                        {isSubmitting
                          ? "Submitting..."
                          : app.settings.submitButtonText || "Submit Response"}
                      </span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Footer Brand */}
        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          <span>WorkMate AI • Disposable Micro-App Engine</span>
        </div>
      </div>
    </div>
  );
}
