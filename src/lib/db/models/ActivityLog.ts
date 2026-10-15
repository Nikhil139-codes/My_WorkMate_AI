import mongoose, { Schema, Document, Model } from "mongoose";

export interface IActivityLog extends Document<string> {
  _id: string;
  id: string;
  workspaceId: string;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: any;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
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
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
    },
    resourceType: {
      type: String,
      required: true,
    },
    resourceId: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: "ActivityLogs",
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

ActivityLogSchema.virtual("id").get(function () {
  return this._id;
});

export const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog ||
  mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);
