import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWorkspaceMembership extends Document<string> {
  _id: string;
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

const WorkspaceMembershipSchema = new Schema<IWorkspaceMembership>(
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
    userId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["OWNER", "ADMIN", "MEMBER"],
      default: "MEMBER",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "WorkspaceMemberships",
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

WorkspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

WorkspaceMembershipSchema.virtual("id").get(function () {
  return this._id;
});

export const WorkspaceMembership: Model<IWorkspaceMembership> =
  mongoose.models.WorkspaceMembership ||
  mongoose.model<IWorkspaceMembership>(
    "WorkspaceMembership",
    WorkspaceMembershipSchema
  );
