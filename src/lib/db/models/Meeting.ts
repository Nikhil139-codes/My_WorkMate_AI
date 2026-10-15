import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMeetingDecision {
  id: string;
  decision: string;
  excerpt?: string;
  timestamp?: string;
  approved: boolean;
}

export interface IMeetingActionItem {
  id: string;
  task: string;
  owner: string; // explicitly named or "Unknown"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string; // explicit date or "Unknown"
  dependencies: string[];
  excerpt?: string;
  timestamp?: string;
  isExplicitCommitment: boolean; // true = explicit commitment, false = AI-suggested
  approved: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CONVERTED";
  createdTaskId?: string;
}

export interface IMeetingTopic {
  title: string;
  summary: string;
  timestampStart?: number;
  timestampEnd?: number;
  formattedTimestamp?: string;
}

export interface IMeetingAnalysis {
  title?: string;
  executiveSummary: string;
  keyDiscussionPoints: string[];
  topics: IMeetingTopic[];
  decisions: IMeetingDecision[];
  actionItems: IMeetingActionItem[];
  unresolvedQuestions: string[];
  blockers: string[];
  followUpTopics: string[];
  analyzedAt: Date;
}

export interface IMeeting extends Document<string> {
  _id: string;
  id: string;
  workspaceId: string;
  createdByUserId: string;
  title: string;
  meetingType: string;
  participants: string[];
  meetingDate: Date;
  inputType: "PASTE" | "UPLOAD_TRANSCRIPT" | "AUDIO_RECORDING";
  sourceDocumentId?: string | null;
  transcriptText: string;
  transcriptSegments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
  status: "DRAFT" | "ANALYZING" | "READY" | "FAILED";
  analysis?: IMeetingAnalysis | null;
  followUpSummary?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const MeetingDecisionSchema = new Schema<IMeetingDecision>(
  {
    id: { type: String, required: true },
    decision: { type: String, required: true },
    excerpt: { type: String, default: "" },
    timestamp: { type: String, default: "" },
    approved: { type: Boolean, default: true },
  },
  { _id: false }
);

const MeetingActionItemSchema = new Schema<IMeetingActionItem>(
  {
    id: { type: String, required: true },
    task: { type: String, required: true },
    owner: { type: String, default: "Unknown" },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },
    dueDate: { type: String, default: "Unknown" },
    dependencies: { type: [String], default: [] },
    excerpt: { type: String, default: "" },
    timestamp: { type: String, default: "" },
    isExplicitCommitment: { type: Boolean, default: false },
    approved: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CONVERTED"],
      default: "APPROVED",
    },
    createdTaskId: { type: String, default: null },
  },
  { _id: false }
);

const MeetingTopicSchema = new Schema<IMeetingTopic>(
  {
    title: { type: String, required: true },
    summary: { type: String, required: true },
    timestampStart: { type: Number },
    timestampEnd: { type: Number },
    formattedTimestamp: { type: String },
  },
  { _id: false }
);

const MeetingAnalysisSchema = new Schema<IMeetingAnalysis>(
  {
    title: { type: String },
    executiveSummary: { type: String, default: "" },
    keyDiscussionPoints: { type: [String], default: [] },
    topics: { type: [MeetingTopicSchema], default: [] },
    decisions: { type: [MeetingDecisionSchema], default: [] },
    actionItems: { type: [MeetingActionItemSchema], default: [] },
    unresolvedQuestions: { type: [String], default: [] },
    blockers: { type: [String], default: [] },
    followUpTopics: { type: [String], default: [] },
    analyzedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MeetingSchema = new Schema<IMeeting>(
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
    meetingType: {
      type: String,
      default: "General Sync",
      trim: true,
    },
    participants: {
      type: [String],
      default: [],
    },
    meetingDate: {
      type: Date,
      default: Date.now,
    },
    inputType: {
      type: String,
      enum: ["PASTE", "UPLOAD_TRANSCRIPT", "AUDIO_RECORDING"],
      default: "PASTE",
    },
    sourceDocumentId: {
      type: String,
      default: null,
      index: true,
    },
    transcriptText: {
      type: String,
      required: true,
    },
    transcriptSegments: {
      type: [
        {
          id: { type: Number },
          start: { type: Number },
          end: { type: Number },
          text: { type: String },
          speaker: { type: String },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["DRAFT", "ANALYZING", "READY", "FAILED"],
      default: "DRAFT",
      index: true,
    },
    analysis: {
      type: MeetingAnalysisSchema,
      default: null,
    },
    followUpSummary: {
      type: String,
      default: null,
    },
  },
  {
    collection: "Meetings",
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

MeetingSchema.virtual("id").get(function () {
  return this._id;
});

export const Meeting: Model<IMeeting> =
  mongoose.models.Meeting || mongoose.model<IMeeting>("Meeting", MeetingSchema);
