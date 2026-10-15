import mongoose, { Schema, Document as MongooseDoc, Model } from "mongoose";

export interface IDocument extends MongooseDoc<string> {
  _id: string;
  id: string;
  workspaceId: string;
  uploadedByUserId?: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  processingStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  /** Top-level media type category */
  mediaType: "document" | "image" | "audio" | "video";
  purpose?: string | null;
  extractedText?: string | null;
  pageCount?: number;
  chunkCount?: number;
  onboardingSuggestion?: Record<string, any> | null;
  onboardingConfig?: {
    documentType?: string;
    department?: string;
    chunkingStrategy?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    sensitivityLabel?: string;
    validationRules?: string[];
    tags?: string[];
    summary?: string;
    approvedAt?: Date;
    approvedByUserId?: string;
  } | null;
  /** Full transcription data for audio and video files */
  transcription?: {
    text: string;
    language?: string;
    durationSeconds?: number;
    segments: Array<{
      id: number;
      start: number;
      end: number;
      text: string;
    }>;
  } | null;
  /** Media-specific metadata */
  mediaMetadata?: {
    durationSeconds?: number;
    /** For images / video frames */
    width?: number;
    height?: number;
    /** Video frame count sampled */
    frameCount?: number;
    /** OCR engine used */
    ocrEngine?: string;
    /** Whether OCR was run on a scanned PDF */
    isScannedPdf?: boolean;
    /** Groq audio model used */
    transcriptionModel?: string;
  } | null;
  /** Cached AI Meeting Intelligence synthesis */
  meetingSynthesis?: {
    title?: string;
    executiveSummary: string;
    topics: Array<{
      title: string;
      timestampStart?: number;
      timestampEnd?: number;
      formattedTimestamp?: string;
      summary: string;
    }>;
    decisions: string[];
    actionItems: Array<{
      task: string;
      owner?: string;
      priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      dueDate?: string;
      timestamp?: string;
      exportedTaskId?: string;
    }>;
    generatedAt: Date;
  } | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
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
      default: null,
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
    processingStatus: {
      type: String,
      enum: ["PENDING", "PROCESSING", "READY", "FAILED"],
      default: "PENDING",
      index: true,
    },
    mediaType: {
      type: String,
      enum: ["document", "image", "audio", "video"],
      default: "document",
      index: true,
    },
    purpose: {
      type: String,
      default: null,
    },
    extractedText: {
      type: String,
      default: null,
    },
    pageCount: {
      type: Number,
      default: 1,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    onboardingSuggestion: {
      type: Schema.Types.Mixed,
      default: null,
    },
    onboardingConfig: {
      type: Schema.Types.Mixed,
      default: null,
    },
    transcription: {
      type: Schema.Types.Mixed,
      default: null,
    },
    mediaMetadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
    meetingSynthesis: {
      type: Schema.Types.Mixed,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
  },
  {
    collection: "Documents",
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

DocumentSchema.virtual("id").get(function () {
  return this._id;
});

export const DocumentModel: Model<IDocument> =
  mongoose.models.Document ||
  mongoose.model<IDocument>("Document", DocumentSchema);

export { DocumentModel as Document };
