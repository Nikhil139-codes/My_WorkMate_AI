import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITask extends Document<string> {
  _id: string;
  id: string;
  workspaceId: string;
  title: string;
  description?: string | null;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  owner?: string | null;
  assignedToUserId?: string | null;
  dueDate?: Date | null;
  dependencies?: string[];
  meetingId?: string | null;
  meetingActionItemId?: string | null;
  sourceExcerpt?: string | null;
  isExplicitCommitment?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
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
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED"],
      default: "TODO",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },
    owner: {
      type: String,
      default: null,
      trim: true,
    },
    assignedToUserId: {
      type: String,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    dependencies: {
      type: [String],
      default: [],
    },
    meetingId: {
      type: String,
      default: null,
      index: true,
    },
    meetingActionItemId: {
      type: String,
      default: null,
      index: true,
    },
    sourceExcerpt: {
      type: String,
      default: null,
    },
    isExplicitCommitment: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: "Tasks",
    timestamps: true,
    strict: false,
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

TaskSchema.virtual("id").get(function () {
  return this._id;
});

// Refresh cached model if it lacks newly defined paths like 'owner'
if (mongoose.models && mongoose.models.Task) {
  if (!mongoose.models.Task.schema?.paths?.owner) {
    delete (mongoose.models as any).Task;
  }
}

export const Task: Model<ITask> =
  mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);
