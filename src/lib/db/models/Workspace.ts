import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWorkspace extends Document<string> {
  _id: string;
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    collection: "Workspaces",
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

WorkspaceSchema.virtual("id").get(function () {
  return this._id;
});

export const Workspace: Model<IWorkspace> =
  mongoose.models.Workspace ||
  mongoose.model<IWorkspace>("Workspace", WorkspaceSchema);
