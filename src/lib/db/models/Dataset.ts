import mongoose, { Schema, Document as MongooseDoc, Model } from "mongoose";

export interface IDatasetColumn {
  name: string;
  inferredType: "string" | "number" | "date" | "boolean" | "category" | "unknown";
  nullCount: number;
  uniqueCount: number;
  sampleValues: string[];
}

export interface IDataQualityIssue {
  id: string;
  type: "missing_values" | "duplicates" | "outliers" | "inconsistent_date" | "inconsistent_category" | "column_naming" | "formatting";
  severity: "low" | "medium" | "high";
  column?: string;
  affectedCount: number;
  description: string;
  recommendedAction: string;
}

export interface IDataProfilingReport {
  qualityScore: number; // 0 - 100
  totalRows: number;
  totalColumns: number;
  duplicateRowsCount: number;
  missingCellsCount: number;
  totalCellsCount: number;
  issues: IDataQualityIssue[];
  summary: string;
}

export interface IDataset extends MongooseDoc<string> {
  _id: string;
  id: string;
  workspaceId: string;
  uploadedByUserId: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  cleanedStorageKey?: string | null;
  format: "csv" | "xlsx";
  rowCount: number;
  columnCount: number;
  columns: IDatasetColumn[];
  previewRows: Record<string, any>[];
  cleanedPreviewRows?: Record<string, any>[];
  profilingReport?: IDataProfilingReport | null;
  cleaningSummary?: {
    transformationsAppliedCount: number;
    rowsRemovedCount: number;
    cellsModifiedCount: number;
    finalQualityScore: number;
    completedAt: Date;
  } | null;
  status: "UPLOADED" | "PROFILING" | "READY" | "CLEANING" | "CLEANED" | "FAILED";
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DatasetColumnSchema = new Schema<IDatasetColumn>(
  {
    name: { type: String, required: true },
    inferredType: { type: String, default: "string" },
    nullCount: { type: Number, default: 0 },
    uniqueCount: { type: Number, default: 0 },
    sampleValues: { type: [String], default: [] },
  },
  { _id: false }
);

const DataQualityIssueSchema = new Schema<IDataQualityIssue>(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    severity: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    column: { type: String, default: null },
    affectedCount: { type: Number, default: 0 },
    description: { type: String, required: true },
    recommendedAction: { type: String, required: true },
  },
  { _id: false }
);

const DataProfilingReportSchema = new Schema<IDataProfilingReport>(
  {
    qualityScore: { type: Number, default: 100 },
    totalRows: { type: Number, default: 0 },
    totalColumns: { type: Number, default: 0 },
    duplicateRowsCount: { type: Number, default: 0 },
    missingCellsCount: { type: Number, default: 0 },
    totalCellsCount: { type: Number, default: 0 },
    issues: { type: [DataQualityIssueSchema], default: [] },
    summary: { type: String, default: "" },
  },
  { _id: false }
);

const DatasetSchema = new Schema<IDataset>(
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
    uploadedByUserId: {
      type: String,
      required: true,
      index: true,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    cleanedStorageKey: {
      type: String,
      default: null,
    },
    format: {
      type: String,
      enum: ["csv", "xlsx"],
      required: true,
    },
    rowCount: {
      type: Number,
      default: 0,
    },
    columnCount: {
      type: Number,
      default: 0,
    },
    columns: {
      type: [DatasetColumnSchema],
      default: [],
    },
    previewRows: {
      type: [Schema.Types.Mixed] as any,
      default: [],
    },
    cleanedPreviewRows: {
      type: [Schema.Types.Mixed] as any,
      default: [],
    },
    profilingReport: {
      type: DataProfilingReportSchema,
      default: null,
    },
    cleaningSummary: {
      type: Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: ["UPLOADED", "PROFILING", "READY", "CLEANING", "CLEANED", "FAILED"],
      default: "UPLOADED",
      index: true,
    },
    failureReason: {
      type: String,
      default: null,
    },
  },
  {
    collection: "Datasets",
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

DatasetSchema.virtual("id").get(function () {
  return this._id;
});

export const DatasetModel: Model<IDataset> =
  mongoose.models.Dataset || mongoose.model<IDataset>("Dataset", DatasetSchema);

export { DatasetModel as Dataset };
