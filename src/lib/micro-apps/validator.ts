import { IMicroApp, IMicroAppField } from "@/lib/db/models/MicroApp";

export interface SubmissionValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  sanitizedData: Record<string, any>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates user submission against the micro-app's field specifications.
 * Enforces field types, required flags, boundaries, and sanitizes values.
 */
export function validateSubmission(
  app: IMicroApp,
  data: any
): SubmissionValidationResult {
  const errors: Record<string, string> = {};
  const sanitized: Record<string, any> = {};

  if (!data || typeof data !== "object") {
    return {
      valid: false,
      errors: { _general: "Invalid submission data: must be an object." },
      sanitizedData: {},
    };
  }

  for (const field of app.fields) {
    const rawVal = data[field.id];

    // Check required
    const isEmpty =
      rawVal === undefined ||
      rawVal === null ||
      rawVal === "" ||
      (Array.isArray(rawVal) && rawVal.length === 0);

    if (field.required && isEmpty) {
      errors[field.id] = `${field.label} is required.`;
      continue;
    }

    if (isEmpty) {
      sanitized[field.id] = null;
      continue;
    }

    switch (field.type) {
      case "text":
      case "textarea": {
        const str = String(rawVal).trim().slice(0, 4000);
        if (field.validation?.minLength && str.length < field.validation.minLength) {
          errors[field.id] = `${field.label} must be at least ${field.validation.minLength} characters.`;
        } else if (field.validation?.maxLength && str.length > field.validation.maxLength) {
          errors[field.id] = `${field.label} cannot exceed ${field.validation.maxLength} characters.`;
        } else {
          sanitized[field.id] = str;
        }
        break;
      }

      case "email": {
        const emailStr = String(rawVal).trim().toLowerCase().slice(0, 254);
        if (!EMAIL_REGEX.test(emailStr)) {
          errors[field.id] = `Please enter a valid email address.`;
        } else {
          sanitized[field.id] = emailStr;
        }
        break;
      }

      case "number": {
        const num = Number(rawVal);
        if (isNaN(num)) {
          errors[field.id] = `${field.label} must be a valid number.`;
        } else if (field.validation?.min !== undefined && num < field.validation.min) {
          errors[field.id] = `${field.label} cannot be less than ${field.validation.min}.`;
        } else if (field.validation?.max !== undefined && num > field.validation.max) {
          errors[field.id] = `${field.label} cannot be greater than ${field.validation.max}.`;
        } else {
          sanitized[field.id] = num;
        }
        break;
      }

      case "rating": {
        const rating = parseInt(String(rawVal), 10);
        if (isNaN(rating) || rating < 1 || rating > 5) {
          errors[field.id] = `${field.label} must be a rating between 1 and 5.`;
        } else {
          sanitized[field.id] = rating;
        }
        break;
      }

      case "select": {
        const selected = String(rawVal).trim();
        const validOptions = field.options || [];
        if (validOptions.length > 0 && !validOptions.includes(selected)) {
          errors[field.id] = `Invalid selection for ${field.label}.`;
        } else {
          sanitized[field.id] = selected;
        }
        break;
      }

      case "checkbox": {
        sanitized[field.id] = Boolean(rawVal);
        break;
      }

      case "multiselect": {
        if (!Array.isArray(rawVal)) {
          errors[field.id] = `${field.label} must be an array of selected options.`;
        } else {
          const validOptions = new Set(field.options || []);
          const cleanSelections = rawVal
            .map(String)
            .filter((opt) => validOptions.size === 0 || validOptions.has(opt));
          sanitized[field.id] = cleanSelections;
        }
        break;
      }

      case "date": {
        const dateParsed = new Date(String(rawVal));
        if (isNaN(dateParsed.getTime())) {
          errors[field.id] = `Please enter a valid date for ${field.label}.`;
        } else {
          sanitized[field.id] = dateParsed.toISOString().split("T")[0];
        }
        break;
      }

      default:
        sanitized[field.id] = String(rawVal).slice(0, 1000);
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: sanitized,
  };
}

/**
 * Serialize an array of submissions to a CSV format.
 */
export function serializeSubmissionsToCSV(
  fields: IMicroAppField[],
  submissions: Array<{ id: string; submittedAt: Date; data: Record<string, any> }>
): string {
  const headers = [
    "Submission ID",
    "Submitted At",
    ...fields.map((f) => `"${f.label.replace(/"/g, '""')}"`),
  ];

  const rows = submissions.map((sub) => {
    const formattedDate = new Date(sub.submittedAt).toISOString();
    const fieldValues = fields.map((f) => {
      const val = sub.data?.[f.id];
      if (val === undefined || val === null) return '""';
      if (Array.isArray(val)) {
        return `"${val.join("; ").replace(/"/g, '""')}"`;
      }
      return `"${String(val).replace(/"/g, '""')}"`;
    });

    return [`"${sub.id}"`, `"${formattedDate}"`, ...fieldValues].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
