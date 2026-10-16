import express from "express";
import type { ErrorRequestHandler } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as storage from "./storage.ts";

const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: "16kb" }));
app.use("/static", express.static(path.join(here, "static")));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024, files: 1 } });
class HttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
function requireSQL() { if (!storage.isSQL) throw new HttpError(404, "この教材にはメモ機能がありません"); }
function requireFiles() { if (storage.isSQL) throw new HttpError(404, "この教材にはファイル機能がありません"); }
function requireJobs() { if (!storage.hasJobs) throw new HttpError(404, "この教材にはジョブ機能がありません"); }
app.get("/", (_req, res) => res.sendFile(path.join(here, "static/index.html")));
app.get("/health", async (_req, res) => { await storage.health(); res.json({ status: "ok" }); });
app.get("/api/config", (_req, res) => res.json({ title: process.env.APP_TITLE || "Terraformの実習", mode: storage.mode, jobs: storage.hasJobs, metadata: storage.hasMetadata }));
app.get("/api/notes", async (_req, res) => { requireSQL(); res.json(await storage.notes()); });
app.post("/api/notes", async (req, res) => {
  requireSQL(); const content: unknown = req.body?.content;
  if (typeof content !== "string" || content.length < 1 || content.length > 2000) throw new HttpError(400, "メモは1〜2000文字で入力してください");
  res.status(201).json(await storage.addNote(content));
});
app.delete("/api/notes/:id", async (req, res) => { requireSQL(); if (!await storage.deleteNote(req.params.id)) throw new HttpError(404, "メモが見つかりません"); res.sendStatus(204); });
app.get("/api/files", async (_req, res) => { requireFiles(); res.json(await storage.files()); });
app.post("/api/files", upload.single("file"), async (req, res) => {
  requireFiles(); if (!req.file) throw new HttpError(400, "ファイルを選択してください");
  // multipartのfilenameはLatin-1として渡されるため、ブラウザーのUTF-8名へ戻します。
  const filename = Buffer.from(req.file.originalname, "latin1").toString("utf8");
  const title = typeof req.body?.title === "string" ? req.body.title.slice(0, 200) : "";
  res.status(201).json(await storage.addFile(filename, title, req.file.buffer));
});
app.get("/api/files/:id", async (req, res) => {
  requireFiles(); const record = await storage.fileRecord(req.params.id);
  if (!record) throw new HttpError(404, "ファイルが見つかりません");
  res.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(record.filename)}`).type("application/octet-stream").send(await storage.readFile(req.params.id));
});
app.delete("/api/files/:id", async (req, res) => {
  requireFiles(); if (!await storage.fileRecord(req.params.id)) throw new HttpError(404, "ファイルが見つかりません");
  await storage.deleteFile(req.params.id); res.sendStatus(204);
});
app.get("/api/jobs", async (_req, res) => { requireJobs(); res.json(await storage.jobs()); });
app.post("/api/jobs", async (_req, res) => { requireJobs(); res.status(202).json(await storage.createJob()); });
app.get("/api/jobs/:id", async (req, res) => { requireJobs(); const job = await storage.getJob(req.params.id); if (!job) throw new HttpError(404, "ジョブが見つかりません"); res.json(job); });
app.get("/api/jobs/:id/result", async (req, res) => {
  requireJobs(); const job = await storage.getJob(req.params.id);
  if (!job) throw new HttpError(404, "ジョブが見つかりません");
  if (job.status !== "done") throw new HttpError(409, "まだ完了していません");
  res.set("Content-Disposition", 'attachment; filename="export.csv"').type("text/csv").send(await storage.jobResult(req.params.id));
});
const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) { res.status(error.status).json({ detail: error.message }); return; }
  if (error instanceof multer.MulterError) { res.status(413).json({ detail: "この実習では1ファイル1MiBまでです。" }); return; }
  console.error(error); res.status(503).json({ detail: "保存先に接続できません。教材の状態とログを確認してください。" });
};
app.use(errors);
await storage.initialize();
app.listen(8000, "0.0.0.0", () => console.log("教材アプリをポート8000で起動しました"));
