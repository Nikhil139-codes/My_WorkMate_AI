import mongoose, { Schema, Document as MongooseDoc, Model } from "mongoose";

export interface ICleaningPlanStep {
  id: string;
  operation:
    | "remove_duplicates"
    | "trim_whitespace"
    | "standardize_text"
    | "standardize_dates"
    | "rename_column"
    | "drop_column"
    | "fill_missing"
    | "drop_missing_rows"
    | "replace_values"
    | "filter_rows"
    | "handle_outliers";
  column?: string;
  params?: Record<string, any>;
  description: string;
  impact: string;
  approved: boolean;
  status: "PENDING" | "APPLIED" | "REJECTED" | "FAILED";
  affectedRowsCount?: number;
  error?: string;
}

export interface ICleaningJob extends MongooseDoc<string> {
  _id: string;
  id: string;
  datasetId: string;
  workspaceId: string;
  userId: string;
  userPrompt?: string | null;
  aiReasoning?: string | null;
  plan: ICleaningPlanStep[];
  beforeMetrics: {
    rowCount: number;
    colCount: number;
    qualityScore: number;
  };
  afterMetrics?: {
    rowCount: number;
    colCount: number;
    qualityScore: number;
  } | null;
  status: "PROPOSED" | "APPROVED" | "EXECUTING" | "COMPLETED" | "FAILED";
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const CleaningPlanStepSchema = new Schema<ICleaningPlanStep>(
  {
    id: { type: String, required: true },
    operation: { type: String, required: true },
    column: { type: String, default: null },
    params: { type: Schema.Types.Mixed, default: {} },
    description: { type: String, required: true },
    impact: { type: String, required: true },
    approved: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["PENDING", "APPLIED", "REJECTED", "FAILED"],
      default: "PENDING",
    },
    affectedRowsCount: { type: Number, default: 0 },
    error: { type: String, default: null },
  },
  { _id: false }
);

const CleaningJobSchema = new Schema<ICleaningJob>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    datasetId: {
      type: String,
      required: true,
      index: true,
    },
    workspaceId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userPrompt: {
      type: String,
      default: null,
    },
    aiReasoning: {
      type: String,
      default: null,
    },
    plan: {
      type: [CleaningPlanStepSchema],
      default: [],
    },
    beforeMetrics: {
      type: Schema.Types.Mixed,
      required: true,
    },
    afterMetrics: {
      type: Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: ["PROPOSED", "APPROVED", "EXECUTING", "COMPLETED", "FAILED"],
      default: "PROPOSED",
      index: true,
    },
    failureReason: {
      type: String,
      default: null,
    },
  },
  {
    collection: "CleaningJobs",
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

CleaningJobSchema.virtual("id").get(function () {
  return this._id;
});

export const CleaningJobModel: Model<ICleaningJob> =
  mongoose.models.CleaningJob ||
  mongoose.model<ICleaningJob>("CleaningJob", CleaningJobSchema);

export { CleaningJobModel as CleaningJob };
