import mongoose from "mongoose";

const DryRunItemSchema = new mongoose.Schema(
  {
    excelRowIndex: Number,
    videoId: String,
    titleFromExcel: String,
    oldTitle: String,
    newTitle: String,
    action: { type: String, enum: ["update", "skip"] },
    reason: String,
  },
  { _id: false },
);

const DryRunSessionSchema = new mongoose.Schema(
  {
    channelId: { type: String, required: true, index: true },
    totalRows: { type: Number, required: true },
    willUpdateCount: { type: Number, required: true },
    willSkipCount: { type: Number, required: true },
    items: [DryRunItemSchema],
  },
  {
    timestamps: true,
  },
);

const DryRunSession = mongoose.model("DryRunSession", DryRunSessionSchema);
export default DryRunSession;
