import mongoose from "mongoose";

const ChannelSchema = new mongoose.Schema(
  {
    channelId: { type: String, required: true },
    channelName: { type: String, required: true },
    googleEmail: { type: String },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

ChannelSchema.index({ channelId: 1 });
ChannelSchema.index({ googleEmail: 1 });

const Channel = mongoose.model("Channel", ChannelSchema);
export default Channel;
