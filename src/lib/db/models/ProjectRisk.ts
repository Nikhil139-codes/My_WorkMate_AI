import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRiskMitigationNote {
  id: string;
  note: string;
  authorName: string;
  createdAt: Date;
}

export interface IRiskHistoryEntry {
  id: string;
  action: "DETECTED" | "SCORE_CHANGED" | "ACKNOWLEDGED" | "MITIGATION_ADDED" | "RESOLVED" | "REOPENED";
  details: string;
  timestamp: Date;
  userId?: string | null;
}

export interface IRiskRecommendation {
  id: string;
  suggestion: string;
  rationale: string;
  actionType: "PRIORITIZE" | "RESOLVE_BLOCKER" | "ASSIGN_OWNER" | "SET_DEADLINE" | "DECISION_FOLLOWUP" | "CUSTOM";
}

export interface IProjectRisk extends Document<string> {
  _id: string;
  id: string;
  workspaceId: string;
  riskKey: string; // Unique deterministic key for deduplication
  title: string;
  description: string;
  category: "OVERDUE" | "BLOCKED_DEPENDENCY" | "MISSING_OWNER" | "MISSING_DEADLINE" | "UNRESOLVED_DECISION" | "BOTTLENECK" | "GENERAL";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  score: number; // 0–100 deterministic rule-based score
  contributingFactors: string[];
  evidence: string;
  affectedTaskIds: string[];
  affectedMeetingIds: string[];
  status: "IDENTIFIED" | "ACKNOWLEDGED" | "MITIGATING" | "RESOLVED";
  acknowledgedByUserId?: string | null;
  acknowledgedAt?: Date | null;
  resolvedByUserId?: string | null;
  resolvedAt?: Date | null;
  mitigationNotes: IRiskMitigationNote[];
  history: IRiskHistoryEntry[];
  aiRecommendations: IRiskRecommendation[];
  lastEvaluatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RiskMitigationNoteSchema = new Schema<IRiskMitigationNote>(
  {
    id: { type: String, required: true },
    note: { type: String, required: true },
    authorName: { type: String, default: "Workspace Member" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RiskHistoryEntrySchema = new Schema<IRiskHistoryEntry>(
  {
    id: { type: String, required: true },
    action: {
      type: String,
      enum: ["DETECTED", "SCORE_CHANGED", "ACKNOWLEDGED", "MITIGATION_ADDED", "RESOLVED", "REOPENED"],
      required: true,
    },
    details: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    userId: { type: String, default: null },
  },
  { _id: false }
);

const RiskRecommendationSchema = new Schema<IRiskRecommendation>(
  {
    id: { type: String, required: true },
    suggestion: { type: String, required: true },
    rationale: { type: String, default: "" },
    actionType: {
      type: String,
      enum: ["PRIORITIZE", "RESOLVE_BLOCKER", "ASSIGN_OWNER", "SET_DEADLINE", "DECISION_FOLLOWUP", "CUSTOM"],
      default: "CUSTOM",
    },
  },
  { _id: false }
);

const ProjectRiskSchema = new Schema<IProjectRisk>(
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
    riskKey: {
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
      required: true,
    },
    category: {
      type: String,
      enum: [
        "OVERDUE",
        "BLOCKED_DEPENDENCY",
        "MISSING_OWNER",
        "MISSING_DEADLINE",
        "UNRESOLVED_DECISION",
        "BOTTLENECK",
        "GENERAL",
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      required: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    contributingFactors: {
      type: [String],
      default: [],
    },
    evidence: {
      type: String,
      default: "",
    },
    affectedTaskIds: {
      type: [String],
      default: [],
    },
    affectedMeetingIds: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["IDENTIFIED", "ACKNOWLEDGED", "MITIGATING", "RESOLVED"],
      default: "IDENTIFIED",
      index: true,
    },
    acknowledgedByUserId: {
      type: String,
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    resolvedByUserId: {
      type: String,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    mitigationNotes: {
      type: [RiskMitigationNoteSchema],
      default: [],
    },
    history: {
      type: [RiskHistoryEntrySchema],
      default: [],
    },
    aiRecommendations: {
      type: [RiskRecommendationSchema],
      default: [],
    },
    lastEvaluatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "ProjectRisks",
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

ProjectRiskSchema.virtual("id").get(function () {
  return this._id;
});

// Composite index for fast workspace risk lookups
ProjectRiskSchema.index({ workspaceId: 1, riskKey: 1 });
ProjectRiskSchema.index({ workspaceId: 1, status: 1 });

export const ProjectRisk: Model<IProjectRisk> =
  mongoose.models.ProjectRisk ||
  mongoose.model<IProjectRisk>("ProjectRisk", ProjectRiskSchema);
