import mongoose, { Schema, Document as MongooseDoc, Model } from "mongoose";

export interface IDocumentChunk extends MongooseDoc<string> {
  _id: string;
  id: string;
  documentId: string;
  workspaceId: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  tokenCount?: number;
  embedding?: number[];
  /** Modality of this chunk's content */
  modality: "text" | "ocr" | "audio_transcript" | "video_visual" | "video_transcript";
  /** Start timestamp in seconds (audio / video segments) */
  timestampStart?: number;
  /** End timestamp in seconds (audio / video segments) */
  timestampEnd?: number;
  /** Human-readable "MM:SS – MM:SS" label */
  formattedTimestamp?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const DocumentChunkSchema = new Schema<IDocumentChunk>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    documentId: {
      type: String,
      required: true,
      index: true,
    },
    workspaceId: {
      type: String,
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    pageNumber: {
      type: Number,
      default: 1,
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
    embedding: {
      type: [Number],
      default: undefined,
    },
    modality: {
      type: String,
      enum: ["text", "ocr", "audio_transcript", "video_visual", "video_transcript"],
      default: "text",
      index: true,
    },
    timestampStart: {
      type: Number,
      default: null,
    },
    timestampEnd: {
      type: Number,
      default: null,
    },
    formattedTimestamp: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "DocumentChunks",
    timestamps: false,
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

// Compound index for querying chunks belonging to a document in order
DocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 });
// Compound index for workspace-scoped vector/content search
DocumentChunkSchema.index({ workspaceId: 1, documentId: 1 });
// Index for timestamp-based querying
DocumentChunkSchema.index({ workspaceId: 1, modality: 1, timestampStart: 1 });

DocumentChunkSchema.virtual("id").get(function () {
  return this._id;
});

export const DocumentChunk: Model<IDocumentChunk> =
  mongoose.models.DocumentChunk ||
  mongoose.model<IDocumentChunk>("DocumentChunk", DocumentChunkSchema);
