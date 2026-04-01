import dotenv from "dotenv";

dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";

import { applySecurityMiddleware } from "./utils/security.js";
import jobsRouter from "./routes/jobs.js";
import authRouter from "./routes/auth.js";
import channelsRouter from "./routes/channels.js";
import { startCron } from "./services/cronService.js";

const app = express();

// Basic middleware
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// CORS restriction
const allowedOrigin = process.env.FRONTEND_ORIGIN;
app.use(
  cors({
    origin: allowedOrigin ? [allowedOrigin] : undefined,
    credentials: false,
  }),
);

// Optional IP restriction and other headers
applySecurityMiddleware(app);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/channels", channelsRouter);
app.use("/api/jobs", jobsRouter);

// MongoDB connection and server start
const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/Test-Youtube-Copy";

mongoose
  .connect(MONGODB_URI, { autoIndex: true })
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
    startCron();
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });
