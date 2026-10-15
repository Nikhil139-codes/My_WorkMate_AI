import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMicroAppField {
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
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
  defaultValue?: any;
}

export interface IMicroApp extends Document<string> {
  _id: string;
  id: string;
  workspaceId: string;
  createdByUserId: string;
  title: string;
  description: string;
  slug: string;
  status: "draft" | "published" | "expired" | "archived";
  category: "survey" | "feedback" | "registration" | "request" | "tracker" | "custom";
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    layout?: "card" | "full";
  };
  fields: IMicroAppField[];
  settings: {
    submitButtonText: string;
    successMessage: string;
    allowMultipleSubmissions: boolean;
    requireAuth: boolean;
    notifyEmail?: string;
    expiresAt?: Date | null;
  };
  submissionsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const MicroAppFieldSchema = new Schema<IMicroAppField>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ["text", "textarea", "email", "number", "select", "checkbox", "multiselect", "date", "rating"],
      required: true,
    },
    placeholder: { type: String, default: "" },
    required: { type: Boolean, default: false },
    helpText: { type: String, default: "" },
    options: { type: [String], default: [] },
    validation: {
      min: { type: Number },
      max: { type: Number },
      pattern: { type: String },
      minLength: { type: Number },
      maxLength: { type: Number },
    },
    defaultValue: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const MicroAppSchema = new Schema<IMicroApp>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    workspaceId: {
      type: String,
      required: true,
      index: true,
    },
    createdByUserId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "expired", "archived"],
      default: "draft",
      index: true,
    },
    category: {
      type: String,
      enum: ["survey", "feedback", "registration", "request", "tracker", "custom"],
      default: "custom",
    },
    theme: {
      primaryColor: { type: String, default: "#4F46E5" },
      backgroundColor: { type: String, default: "#F8FAFC" },
      layout: { type: String, enum: ["card", "full"], default: "card" },
    },
    fields: {
      type: [MicroAppFieldSchema],
      default: [],
    },
    settings: {
      submitButtonText: { type: String, default: "Submit" },
      successMessage: { type: String, default: "Thank you! Your response has been recorded." },
      allowMultipleSubmissions: { type: Boolean, default: true },
      requireAuth: { type: Boolean, default: false },
      notifyEmail: { type: String },
      expiresAt: { type: Date, default: null, index: true },
    },
    submissionsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    collection: "MicroApps",
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

MicroAppSchema.virtual("id").get(function () {
  return this._id;
});

export const MicroApp: Model<IMicroApp> =
  mongoose.models.MicroApp || mongoose.model<IMicroApp>("MicroApp", MicroAppSchema);
