/** 保存処理はここに隔離し、教材ではTerraformの接続設定を読みます。 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "redis";
import { S3Client, HeadBucketCommand, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, GetQueueUrlCommand, GetQueueAttributesCommand, SendMessageCommand } from "@aws-sdk/client-sqs";

export const mode = process.env.APP_MODE || "notes";
export const isSQL = mode.startsWith("notes");
export const hasMetadata = ["files-db", "files-jobs"].includes(mode);
export const hasJobs = ["notes-jobs", "files-jobs"].includes(mode);
export interface Note { id: string; content: string; created_at: string }
export interface FileRecord { id: string; filename: string; title: string; size: string; created_at: string }
export interface Job { id: string; status: "pending" | "running" | "done" | "failed"; error: string }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 3000 });
// DB再起動でアイドル接続が切れても、Webプロセスを終了させません。
pool.on("error", (error) => console.error("PostgreSQLの待機接続が切れました：", error.message));
const now = () => new Date().toISOString();
const bucket = () => process.env.BUCKET_NAME!;
function awsConfig() {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  if (endpoint !== "http://moto:5000") throw new Error("接続先はCompose内部の http://moto:5000 に限定しています");
  return { endpoint, region: "us-east-1", maxAttempts: 1, credentials: { accessKeyId: "test", secretAccessKey: "test", sessionToken: "test" } };
}
export const s3 = () => new S3Client({ ...awsConfig(), forcePathStyle: true, requestChecksumCalculation: "WHEN_REQUIRED" });
export const dynamo = () => DynamoDBDocumentClient.from(new DynamoDBClient(awsConfig()));
export const sqs = () => new SQSClient(awsConfig());
export async function queue() {
  const client = sqs();
  const result = await client.send(new GetQueueUrlCommand({ QueueName: process.env.QUEUE_NAME! }));
  if (!result.QueueUrl) throw new Error("キューが見つかりません");
  return { client, url: result.QueueUrl };
}
const makeRedis = () => createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 3000 } });
let redisReady: Promise<ReturnType<typeof makeRedis>> | undefined;
export function redis() {
  return redisReady ??= (async () => {
    const client = makeRedis();
    client.on("error", (error) => console.error("Redis:", error.message));
    await client.connect(); return client;
  })();
}
async function scan<T>(table: string): Promise<T[]> {
  const result: T[] = []; let last: Record<string, unknown> | undefined;
  do {
    const page = await dynamo().send(new ScanCommand({ TableName: table, ConsistentRead: true, ExclusiveStartKey: last }));
    result.push(...(page.Items || []) as T[]); last = page.LastEvaluatedKey;
  } while (last);
  return result;
}
export async function initialize() {
  if (!isSQL) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(417230)");
    await client.query("CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, content TEXT NOT NULL, created_at TEXT NOT NULL)");
    await client.query("CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', result BYTEA)");
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function health() {
  if (isSQL) { await pool.query("SELECT 1"); if (hasJobs) await (await redis()).ping(); }
  else {
    await s3().send(new HeadBucketCommand({ Bucket: bucket() }));
    if (hasMetadata) await new DynamoDBClient(awsConfig()).send(new DescribeTableCommand({ TableName: process.env.FILES_TABLE! }));
    if (hasJobs) { const { client, url } = await queue(); await client.send(new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ["QueueArn"] })); }
  }
}
export async function notes(): Promise<Note[]> { return (await pool.query<Note>("SELECT * FROM notes ORDER BY created_at,id")).rows; }
export async function addNote(content: string): Promise<Note> {
  const note = { id: randomUUID(), content, created_at: now() };
  await pool.query("INSERT INTO notes VALUES ($1,$2,$3)", [note.id, note.content, note.created_at]); return note;
}
export async function deleteNote(id: string): Promise<boolean> { return (await pool.query("DELETE FROM notes WHERE id=$1", [id])).rowCount! > 0; }
export async function files(): Promise<FileRecord[]> {
  const result: FileRecord[] = [];
  if (hasMetadata) result.push(...await scan<FileRecord>(process.env.FILES_TABLE!));
  else {
    const client = s3(); let token: string | undefined;
    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: "files/", ContinuationToken: token }));
      for (const object of page.Contents || []) {
        const response = await client.send(new HeadObjectCommand({ Bucket: bucket(), Key: object.Key! }));
        result.push(JSON.parse(Buffer.from(response.Metadata!.record, "base64").toString("utf8")) as FileRecord);
      }
      token = page.NextContinuationToken;
    } while (token);
  }
  return result.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
export async function fileRecord(id: string): Promise<FileRecord | undefined> {
  if (hasMetadata) return (await dynamo().send(new GetCommand({ TableName: process.env.FILES_TABLE!, Key: { id }, ConsistentRead: true }))).Item as FileRecord | undefined;
  return (await files()).find((item) => item.id === id);
}
export async function addFile(filename: string, title: string, data: Buffer): Promise<FileRecord> {
  const record = { id: randomUUID(), filename, title: title || filename, size: String(data.length), created_at: now() };
  const client = s3();
  await client.send(new PutObjectCommand({ Bucket: bucket(), Key: `files/${record.id}`, Body: data, Metadata: { record: Buffer.from(JSON.stringify(record)).toString("base64") } }));
  if (hasMetadata) {
    try { await dynamo().send(new PutCommand({ TableName: process.env.FILES_TABLE!, Item: record })); }
    catch (error) { await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: `files/${record.id}` })); throw error; }
  }
  return record;
}
export async function readFile(id: string): Promise<Buffer> {
  const response = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: `files/${id}` }));
  return Buffer.from(await response.Body!.transformToByteArray());
}
export async function deleteFile(id: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: `files/${id}` }));
  if (hasMetadata) await dynamo().send(new DeleteCommand({ TableName: process.env.FILES_TABLE!, Key: { id } }));
}
export async function getJob(id: string): Promise<Job | undefined> {
  if (isSQL) return (await pool.query<Job>("SELECT id,status,error FROM jobs WHERE id=$1", [id])).rows[0];
  return (await dynamo().send(new GetCommand({ TableName: process.env.JOBS_TABLE!, Key: { id }, ConsistentRead: true }))).Item as Job | undefined;
}
export async function jobs(): Promise<Job[]> {
  if (isSQL) return (await pool.query<Job>("SELECT id,status,error FROM jobs ORDER BY id")).rows;
  return (await scan<Job>(process.env.JOBS_TABLE!)).sort((a, b) => a.id.localeCompare(b.id));
}
export async function updateJob(id: string, status: Job["status"], error = "", result: Buffer | null = null) {
  if (isSQL) await pool.query("UPDATE jobs SET status=$1,error=$2,result=$3 WHERE id=$4", [status, error, result, id]);
  else await dynamo().send(new PutCommand({ TableName: process.env.JOBS_TABLE!, Item: { id, status, error } }));
}
export async function createJob(): Promise<Job> {
  const id = randomUUID();
  if (isSQL) await pool.query("INSERT INTO jobs(id,status) VALUES ($1,'pending')", [id]); else await updateJob(id, "pending");
  try {
    if (isSQL) await (await redis()).lPush("exports", id);
    else { const { client, url } = await queue(); await client.send(new SendMessageCommand({ QueueUrl: url, MessageBody: JSON.stringify({ job_id: id }) })); }
  } catch (error) { await updateJob(id, "failed", String(error)); throw error; }
  return (await getJob(id))!;
}
function csvCell(value: unknown): string { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
export async function processJob(id: string) {
  const job = await getJob(id);
  if (!job || job.status === "done") return; // 重複配信で完成済みの結果を壊しません。
  await updateJob(id, "running");
  const rows = isSQL ? await notes() : await files();
  const fields = isSQL ? ["id", "content", "created_at"] : ["id", "filename", "title", "size", "created_at"];
  const lines = [fields.map(csvCell).join(","), ...rows.map((row) => fields.map((key) => csvCell((row as unknown as Record<string, unknown>)[key])).join(","))];
  const data = Buffer.from("\ufeff" + lines.join("\r\n") + "\r\n");
  if (isSQL) await updateJob(id, "done", "", data);
  else {
    // 同じジョブは同じS3キーへ保存します。再処理されても結果が増殖しません。
    await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: `exports/${id}.csv`, Body: data }));
    await updateJob(id, "done");
  }
}
export async function jobResult(id: string): Promise<Buffer> {
  if (isSQL) return (await pool.query<{ result: Buffer }>("SELECT result FROM jobs WHERE id=$1", [id])).rows[0].result;
  const response = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: `exports/${id}.csv` }));
  return Buffer.from(await response.Body!.transformToByteArray());
}
