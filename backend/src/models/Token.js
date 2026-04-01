import mongoose from "mongoose";

const TokenSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "google", unique: true },
    accessToken: { type: String },
    refreshToken: { type: String },
    scope: { type: String },
    tokenType: { type: String },
    expiryDate: { type: Number },
  },
  {
    timestamps: true,
  },
);

const Token = mongoose.model("Token", TokenSchema);
export default Token;
