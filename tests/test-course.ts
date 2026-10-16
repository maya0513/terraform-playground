/** 専用namespace・ポート・stateを持つ一時コピーで、教材をHTTP経由で検証する。 */
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import type { Catalog, Lesson } from "../scripts/course.ts";

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(path.join(source, ".mise"), { recursive: true });
const root = mkdtempSync(path.join(source, ".mise/test-course-"));
const namespace = `tf-test-${path.basename(root).slice(-6).toLowerCase()}`;
const logDir = path.join(root, "logs"); mkdirSync(logDir);
let commandNumber = 0;
function copyFilter(file: string): boolean {
  return !file.split(path.sep).some((part) => ["node_modules", ".terraform", "generated", "__pycache__"].includes(part)) && !/\.tfstate(?:\.|$)|\.auto\.tfvars$|\.tfplan$/.test(file);
}
for (const folder of ["scripts", "support", "lessons"]) cpSync(path.join(source, folder), path.join(root, folder), { recursive: true, filter: copyFilter });
for (const file of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".dockerignore"]) cpSync(path.join(source, file), path.join(root, file));
const catalog: Catalog = JSON.parse(readFileSync(path.join(root, "lessons/catalog.json"), "utf8"));
catalog.namespace = namespace;
// イメージ削除の試験も、既存の学習用キャッシュには触れません。
const imageAlias = `${namespace}-cleanup-test:1`;
catalog.images = { test: imageAlias };
for (const [id, lesson] of Object.entries(catalog.lessons)) {
  if (lesson.port) lesson.port += 10000;
  if (lesson.moto_port) lesson.moto_port += 10000;
  const provider = path.join(source, "lessons", id, ".terraform/providers");
  assert(existsSync(provider), `先に mise run check を実行してください：${id}`);
  mkdirSync(path.join(root, "lessons", id, ".terraform"), { recursive: true });
  symlinkSync(provider, path.join(root, "lessons", id, ".terraform/providers"), "dir");
}
const basicS3 = path.join(root, "lessons/01-basics/02-s3-storage/providers.tf");
writeFileSync(basicS3, readFileSync(basicS3, "utf8").replaceAll("localhost:5000", "localhost:15000"));
writeFileSync(path.join(root, "lessons/catalog.json"), JSON.stringify(catalog, null, 2));
const course = await import(pathToFileURL(path.join(root, "scripts/course.ts")).href) as typeof import("../scripts/course.ts");
const selected = process.argv.slice(2);
for (const id of selected) assert(Object.hasOwn(catalog.lessons, id), `不明な教材ID：${id}`);
const all = selected.length === 0;
const ids = selected.length ? selected : Object.keys(catalog.lessons);

function run(args: string[], allowFailure = false, input?: string) {
  const result = spawnSync(args[0], args.slice(1), { cwd: root, env: process.env, encoding: "utf8", input, timeout: 600_000 });
  const output = (result.stdout || "") + (result.stderr || "");
  writeFileSync(path.join(logDir, `${String(++commandNumber).padStart(3, "0")}.log`), `${args.join(" ")}\n${output}`);
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) throw new Error(`${args.join(" ")}\n${output.split("\n").slice(-70).join("\n")}`);
  return { status: result.status, output, stdout: result.stdout || "" };
}
function task(action: string, id?: string, allowFailure = false) { return run(["node", path.join(root, "scripts/course.ts"), action, ...(id ? [id] : [])], allowFailure); }
function terraform(id: string, args: string[], allowFailure = false) {
  return run(["terraform", `-chdir=${path.join(root, "lessons", id)}`, ...args, ...course.variables(catalog.lessons[id])], allowFailure);
}
function apply(id: string) { run(["node", path.join(root, "scripts/course.ts"), "apply", id], false, "yes\n"); }
function unchanged(id: string) {
  const result = terraform(id, ["plan", "-input=false", "-no-color", "-detailed-exitcode"]);
  assert.equal(result.status, 0); assert.match(result.output, /No changes/);
}
function aws(lesson: Lesson, args: string[]) { return JSON.parse(run(["aws", `--endpoint-url=http://localhost:${lesson.moto_port}`, ...args, "--output", "json"]).stdout); }
async function request(lesson: Lesson, endpoint: string, init: RequestInit = {}, status = 200): Promise<Response> {
  // 同期Docker操作中に閉じたHTTP接続を再利用しないよう、試験では毎回閉じます。
  const headers = new Headers(init.headers); headers.set("Connection", "close");
  const response = await fetch(`http://127.0.0.1:${lesson.port}${endpoint}`, { ...init, headers, signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, status, `${endpoint}: ${response.status} ${response.status === status ? "" : await response.text()}`);
  return response;
}
async function waitUntil(check: () => Promise<boolean>, label: string) {
  for (let attempt = 0; attempt < 90; attempt++) { try { if (await check()) return; } catch {} await delay(1000); }
  throw new Error(`待機がタイムアウトしました：${label}`);
}
async function health(lesson: Lesson) { await waitUntil(async () => (await fetch(`http://127.0.0.1:${lesson.port}/health`, { headers: { Connection: "close" }, signal: AbortSignal.timeout(2000) })).ok, "Webの正常性"); }
async function note(lesson: Lesson, content: string) {
  return (await request(lesson, "/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }, 201)).json() as Promise<{ id: string; content: string }>;
}
async function upload(lesson: Lesson, filename: string, data: string, title = "実習の記録") {
  const form = new FormData(); form.set("title", title); form.set("file", new Blob([data]), filename);
  return (await request(lesson, "/api/files", { method: "POST", body: form }, 201)).json() as Promise<{ id: string; title: string; filename: string }>;
}
function cleaned(id: string) {
  assert.equal(course.resources(id).length, 0);
  const project = course.project(catalog.lessons[id]);
  assert.equal(run(["docker", "ps", "-a", "-q", "--filter", `label=terraform-playground.project=${project}`]).stdout.trim(), "");
  assert.equal(run(["docker", "volume", "ls", "-q", "--filter", `label=terraform-playground.project=${project}`]).stdout.trim(), "");
  assert.equal(run(["docker", "ps", "-a", "-q", "--filter", `label=com.docker.compose.project=${project}-moto`]).stdout.trim(), "");
}

async function basics(id: string) {
  console.log(`基礎の検証：${id}`);
  if (catalog.lessons[id].kind === "local") {
    // 旧配置で作ったファイル・state・バックアップを丸ごと移動して引き継ぎます。
    const folder = path.join(root, "lessons", id); const old = path.join(root, "examples/local"); mkdirSync(path.dirname(old), { recursive: true }); renameSync(folder, old);
    run(["terraform", `-chdir=${old}`, "apply", "-input=false", "-auto-approve"]);
    const main = path.join(old, "main.tf"); writeFileSync(main, readFileSync(main, "utf8").replace("Hello, Terraform!", "こんにちは、Terraform!"));
    run(["terraform", `-chdir=${old}`, "apply", "-input=false", "-auto-approve"]);
    assert.equal(readFileSync(path.join(old, "generated/hello.txt"), "utf8"), "こんにちは、Terraform!\n");
    renameSync(old, folder); unchanged(id);
    assert(existsSync(path.join(folder, "terraform.tfstate.backup")));
  } else {
    task("prepare", id);
    const folder = path.join(root, "lessons", id);
    cpSync(path.join(folder, "lesson4.tfvars.example"), path.join(folder, "lesson4.auto.tfvars"));
    apply(id); unchanged(id);
    const keys = JSON.parse(run(["terraform", `-chdir=${folder}`, "output", "-json", "object_keys"]).stdout);
    assert.deepEqual(keys, ["hello.txt", "links.txt", "notes.txt"]);
    const old = path.join(root, "examples/s3"); mkdirSync(path.dirname(old), { recursive: true }); renameSync(folder, old); renameSync(old, folder);
    assert(existsSync(path.join(folder, "lesson4.auto.tfvars"))); unchanged(id);
  }
  task("cleanup", id); cleaned(id);
  // 実習5：設計図と入力値から作り直し、再び片付けます。
  task("prepare", id); apply(id); unchanged(id); task("cleanup", id); cleaned(id);
  task("cleanup", id);
}

async function system(id: string) {
  const lesson = catalog.lessons[id]; const project = course.project(lesson);
  console.log(`構築・HTTP検証：${id}`);
  task("prepare", id); task("plan", id); apply(id);
  const web = JSON.parse(run(["docker", "inspect", `${project}-web`]).stdout)[0];
  for (const bindings of Object.values(web.NetworkSettings.Ports) as ({ HostIp: string }[] | null)[]) {
    if (bindings) assert(bindings.every((binding) => binding.HostIp === "127.0.0.1"), "Web公開先をループバックに限定");
  }
  for (const role of lesson.kind.startsWith("notes") ? ["db", ...(lesson.kind === "notes-jobs" ? ["redis"] : [])] : []) {
    const container = JSON.parse(run(["docker", "inspect", `${project}-${role}`]).stdout)[0];
    assert(Object.values(container.NetworkSettings.Ports).every((bindings) => bindings === null), "DBとRedisをPC側へ公開しない");
  }
  if (lesson.kind === "static") {
    const page = await (await request(lesson, "/")).text(); assert.match(page, /Webサーバーが動きました/);
    const vars = path.join(root, "lessons", id, "practice.auto.tfvars"); writeFileSync(vars, 'welcome = "番号順に進めます。"\n');
    assert.equal(terraform(id, ["plan", "-input=false", "-detailed-exitcode"], true).status, 2); apply(id);
    assert.match(await (await request(lesson, "/")).text(), /番号順に進めます/);
  } else {
    await health(lesson);
    assert.match(await (await request(lesson, "/")).text(), /保存したデータ/);
    if (lesson.kind.startsWith("notes")) {
      const kept = await note(lesson, "日本語のメモ：保存の確認"); const removed = await note(lesson, "削除するメモ");
      await request(lesson, `/api/notes/${removed.id}`, { method: "DELETE" }, 204);
      await request(lesson, `/api/notes/${removed.id}`, { method: "DELETE" }, 404);
      run(["docker", "restart", `${project}-db`]); await health(lesson);
      const data = await (await request(lesson, "/api/notes")).json() as { id: string }[]; assert.deepEqual(data.map((item) => item.id), [kept.id]);
    } else {
      const file = await upload(lesson, "学習メモ.txt", "ローカルで保存できました。\n");
      assert.equal(file.filename, "学習メモ.txt");
      assert.equal(await (await request(lesson, `/api/files/${file.id}`)).text(), "ローカルで保存できました。\n");
      const removed = await upload(lesson, "delete.txt", "remove"); await request(lesson, `/api/files/${removed.id}`, { method: "DELETE" }, 204);
      await request(lesson, `/api/files/${removed.id}`, {}, 404);
      if (lesson.kind !== "files") {
        const table = aws(lesson, ["dynamodb", "scan", "--table-name", `${project}-files`]); assert.equal(table.Items.length, 1); assert.equal(table.Items[0].title.S, "実習の記録");
      } else {
        const large = new FormData(); large.set("file", new Blob(["x".repeat(1024 * 1024 + 1)]), "large.txt");
        await request(lesson, "/api/files", { method: "POST", body: large }, 413);
      }
    }
    if (lesson.kind.endsWith("jobs")) {
      run(["docker", "stop", `${project}-worker`]);
      const job = await (await request(lesson, "/api/jobs", { method: "POST" }, 202)).json() as { id: string };
      await delay(1000); assert.equal((await (await request(lesson, `/api/jobs/${job.id}`)).json() as { status: string }).status, "pending");
      await request(lesson, `/api/jobs/${job.id}/result`, {}, 409);
      run(["docker", "start", `${project}-worker`]);
      await waitUntil(async () => (await (await request(lesson, `/api/jobs/${job.id}`)).json() as { status: string }).status === "done", "ジョブの完了");
      const csv = await (await request(lesson, `/api/jobs/${job.id}/result`)).text(); assert.match(csv, lesson.kind === "notes-jobs" ? /日本語のメモ/ : /学習メモ.txt/);
      if (lesson.kind === "files-jobs") {
        const queue = aws(lesson, ["sqs", "get-queue-url", "--queue-name", `${project}-exports`]).QueueUrl as string;
        aws(lesson, ["sqs", "send-message", "--queue-url", queue, "--message-body", JSON.stringify({ job_id: job.id })]);
        await waitUntil(async () => {
          const attrs = aws(lesson, ["sqs", "get-queue-attributes", "--queue-url", queue, "--attribute-names", "ApproximateNumberOfMessages", "ApproximateNumberOfMessagesNotVisible"]).Attributes;
          return attrs.ApproximateNumberOfMessages === "0" && attrs.ApproximateNumberOfMessagesNotVisible === "0";
        }, "重複メッセージの処理");
        assert.equal(await (await request(lesson, `/api/jobs/${job.id}/result`)).text(), csv);
        const objects = aws(lesson, ["s3api", "list-objects-v2", "--bucket", `${project}-files`, "--prefix", "exports/"]);
        assert.deepEqual(objects.Contents.map((item: { Key: string }) => item.Key), [`exports/${job.id}.csv`]);
      }
    }
    if (lesson.kind === "files") {
      course.compose(lesson, ["stop", "moto"]);
      const failure = task("plan", id, true); assert.notEqual(failure.status, 0); assert.match(failure.output, new RegExp(`localhost:${lesson.moto_port}`));
      assert.notEqual(task("apply", id, true).status, 0, "Moto停止中はapplyも開始しない");
      await request(lesson, "/health", {}, 503);
      course.compose(lesson, ["up", "-d", "--wait"]); apply(id); await health(lesson);
      assert.deepEqual(await (await request(lesson, "/api/files")).json(), []);
    }
    const vars = path.join(root, "lessons", id, "practice.auto.tfvars"); writeFileSync(vars, 'app_title = "設定を一か所変えました"\n');
    assert.equal(terraform(id, ["plan", "-input=false", "-detailed-exitcode"], true).status, 2); apply(id); await health(lesson);
    assert.equal((await (await request(lesson, "/api/config")).json() as { title: string }).title, "設定を一か所変えました");
  }
  unchanged(id); task("cleanup", id); cleaned(id); task("cleanup", id);
  assert(existsSync(path.join(root, "lessons", id, "practice.auto.tfvars")), "編集した入力値を残す");
  console.log(`成功：${id}`);
}

let sentinelCreated = false;
let passed = false;
try {
  // 試験中に他のコンテナを止めないことを、専用の番兵コンテナで確かめます。
  run(["docker", "pull", "nginx:1.30.0-alpine"]);
  run(["docker", "run", "-d", "--name", `${namespace}-unrelated`, "--entrypoint", "sleep", "nginx:1.30.0-alpine", "3600"]); sentinelCreated = true;
  task("cleanup-all");
  assert.notEqual(task("plan", "../../", true).status, 0);
  assert.notEqual(task("cleanup-all", "unknown", true).status, 0);
  for (const id of ids) if (id.startsWith("01-basics/")) await basics(id); else await system(id);
  if (all) {
    console.log("途中失敗の検証：破損stateがあれば、全体の片付けを始めない");
    const basic = "01-basics/01-local-files", state = path.join(root, "lessons", basic, "terraform.tfstate");
    const saved = readFileSync(state, "utf8"); const staticId = "02-docker-systems/01-static-site"; apply(staticId);
    try { writeFileSync(state, "not valid state"); assert.notEqual(task("cleanup-all", undefined, true).status, 0); await request(catalog.lessons[staticId], "/"); }
    finally { writeFileSync(state, saved); }
  }
  task("cleanup-all"); task("cleanup-all");
  run(["docker", "tag", "nginx:1.30.0-alpine", imageAlias]); task("cleanup-images");
  assert.notEqual(run(["docker", "image", "inspect", imageAlias], true).status, 0);
  assert.equal(run(["docker", "inspect", "--format", "{{.State.Running}}", `${namespace}-unrelated`]).stdout.trim(), "true");
  for (const id of ids) cleaned(id);
  console.log("PASS：基礎・構築・HTTP操作・再起動・ワーカー再開・片付けを検証しました");
  passed = true;
} finally {
  if (!passed) {
    const names = run(["docker", "ps", "-a", "--format", "{{.Names}}"], true).stdout.split(/\r?\n/).filter((name) => name.startsWith(`${namespace}-`));
    for (const name of names) run(["docker", "logs", "--tail", "100", name], true);
  }
  try { task("cleanup-all"); } catch (error) { console.error("テスト環境の片付けでエラー。ログを確認してください。", error); }
  if (sentinelCreated) run(["docker", "rm", "-f", `${namespace}-unrelated`], true);
  const ownPrefixes = Object.values(catalog.lessons).map((lesson) => `${course.project(lesson)}-demo:`);
  const imageNames = run(["docker", "image", "ls", "--format", "{{.Repository}}:{{.Tag}}"], true).stdout.split(/\r?\n/);
  for (const image of new Set(imageNames)) {
    if (image === imageAlias || ownPrefixes.some((prefix) => image.startsWith(prefix))) run(["docker", "image", "rm", image], true);
  }
  console.log(`テストのログ：${logDir}`);
}
