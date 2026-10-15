import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAIConversation extends Document<string> {
  _id: string;
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const AIConversationSchema = new Schema<IAIConversation>(
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
    title: {
      type: String,
      default: "New Conversation",
      trim: true,
    },
  },
  {
    collection: "AIConversations",
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

AIConversationSchema.virtual("id").get(function () {
  return this._id;
});

export const AIConversation: Model<IAIConversation> =
  mongoose.models.AIConversation ||
  mongoose.model<IAIConversation>("AIConversation", AIConversationSchema);
