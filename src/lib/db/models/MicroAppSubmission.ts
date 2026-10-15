import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMicroAppSubmission extends Document<string> {
  _id: string;
  id: string;
  appId: string;
  workspaceId: string;
  data: Record<string, any>;
  submittedAt: Date;
  ipHash?: string;
  userAgent?: string;
  retentionStatus: "active" | "archived";
}

const MicroAppSubmissionSchema = new Schema<IMicroAppSubmission>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    appId: {
      type: String,
      required: true,
      index: true,
    },
    workspaceId: {
      type: String,
      required: true,
      index: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipHash: {
      type: String,
      default: null,
      index: true,
    },
    userAgent: {
      type: String,
      default: null,
    },
    retentionStatus: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
  },
  {
    collection: "MicroAppSubmissions",
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

MicroAppSubmissionSchema.virtual("id").get(function () {
  return this._id;
});

export const MicroAppSubmission: Model<IMicroAppSubmission> =
  mongoose.models.MicroAppSubmission ||
  mongoose.model<IMicroAppSubmission>("MicroAppSubmission", MicroAppSubmissionSchema);
