import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWorkflow extends Document<string> {
  _id: string;
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  status: string;
  runsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowSchema = new Schema<IWorkflow>(
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
    name: {
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
      enum: ["DRAFT", "ACTIVE", "COMPLETED"],
      default: "ACTIVE",
      index: true,
    },
    runsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    collection: "Workflows",
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

WorkflowSchema.virtual("id").get(function () {
  return this._id;
});

export const Workflow: Model<IWorkflow> =
  mongoose.models.Workflow ||
  mongoose.model<IWorkflow>("Workflow", WorkflowSchema);
