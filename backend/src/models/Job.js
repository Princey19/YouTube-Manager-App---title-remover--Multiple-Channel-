import mongoose from "mongoose";

const JobSchema = new mongoose.Schema(
  {
    channelId: { type: String, required: true, index: true },
    excelRowIndex: { type: Number },
    videoId: { type: String, required: true, index: true },
    titleFromExcel: { type: String },

    oldTitle: { type: String },
    newTitle: { type: String, required: true },

    status: {
      type: String,
      enum: ["pending", "updated", "skipped", "failed"],
      default: "pending",
      index: true,
    },
    errorMessage: { type: String },

    processedAt: { type: Date },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "DryRunSession" },
  },
  {
    timestamps: true,
  },
);

JobSchema.index({ createdAt: 1 });
JobSchema.index({ processedAt: 1 });

const Job = mongoose.model("Job", JobSchema);
export default Job;
