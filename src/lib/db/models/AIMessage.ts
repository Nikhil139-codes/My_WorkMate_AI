import mongoose, { Schema, Document, Model } from "mongoose";

export interface AIMessageCitation {
  documentId: string;
  documentName: string;
  pageNumber?: number;
  chunkIndex?: number;
  excerpt: string;
  modality?: "text" | "ocr" | "audio_transcript" | "video_visual" | "video_transcript";
  timestampStart?: number;
  timestampEnd?: number;
  formattedTimestamp?: string;
  mediaType?: string;
}

export interface IAIMessage extends Document<string> {
  _id: string;
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  modelId?: string | null;
  citations?: AIMessageCitation[];
  createdAt: Date;
}

const AIMessageSchema = new Schema<IAIMessage>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    modelId: {
      type: String,
      default: null,
    },
    citations: {
      type: [
        {
          documentId: { type: String, required: true },
          documentName: { type: String, required: true },
          pageNumber: { type: Number, default: 1 },
          chunkIndex: { type: Number, default: 0 },
          excerpt: { type: String, required: true },
          modality: { type: String },
          timestampStart: { type: Number },
          timestampEnd: { type: Number },
          formattedTimestamp: { type: String },
          mediaType: { type: String },
        },
      ],
      default: undefined,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: "AIMessages",
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

AIMessageSchema.virtual("id").get(function () {
  return this._id;
});

export const AIMessage: Model<IAIMessage> =
  mongoose.models.AIMessage ||
  mongoose.model<IAIMessage>("AIMessage", AIMessageSchema);
