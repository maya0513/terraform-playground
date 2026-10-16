/** 教材の準備・片付けをまとめる内部処理。Node.jsの標準機能だけで動きます。 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface Lesson { title: string; code: string; kind: string; port?: number; moto_port?: number }
export interface Catalog { namespace: string; images: Record<string, string>; lessons: Record<string, Lesson> }
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const catalog: Catalog = JSON.parse(readFileSync(path.join(ROOT, "lessons/catalog.json"), "utf8"));
const lessons = catalog.lessons;
const composeFile = path.join(ROOT, "support/moto/compose.yaml");

export function execute(args: string[], capture = false, env: NodeJS.ProcessEnv = process.env): string {
  const result = spawnSync(args[0], args.slice(1), { cwd: ROOT, env, encoding: "utf8", stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`コマンドが失敗しました (${result.status})：${args.join(" ")}`);
  return result.stdout || "";
}
export function project(lesson: Lesson): string { return `${catalog.namespace}-${lesson.code}`; }
function sourceFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en")).flatMap((entry) => {
    if (["node_modules", "__pycache__", ".venv"].includes(entry.name)) return [];
    const name = path.join(folder, entry.name);
    return entry.isDirectory() ? sourceFiles(name) : [name];
  });
}
export function appTag(lesson: Lesson): string {
  const hash = createHash("sha256");
  const files = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".dockerignore"].map((name) => path.join(ROOT, name));
  files.push(...sourceFiles(path.join(ROOT, "support/apps/demo")));
  for (const file of files) hash.update(path.relative(ROOT, file)).update(readFileSync(file));
  return `${project(lesson)}-demo:${hash.digest("hex").slice(0, 12)}`;
}
export function tf(id: string, args: string[], capture = false): string {
  const cache = path.join(ROOT, ".mise/terraform-plugins"); mkdirSync(cache, { recursive: true });
  return execute(["terraform", `-chdir=${path.join(ROOT, "lessons", id)}`, ...args], capture, { ...process.env, TF_PLUGIN_CACHE_DIR: cache });
}
export function variables(lesson: Lesson): string[] {
  if (["local", "aws-basic"].includes(lesson.kind)) return [];
  const args = [`-var=project_prefix=${project(lesson)}`, `-var=web_port=${lesson.port}`];
  if (lesson.kind !== "static") args.push(`-var=app_image=${appTag(lesson)}`);
  if (lesson.moto_port) args.push(`-var=moto_port=${lesson.moto_port}`);
  return args;
}
export function compose(lesson: Lesson, args: string[]): string {
  return execute(["docker", "compose", "-f", composeFile, "-p", `${project(lesson)}-moto`, ...args], false, { ...process.env, MOTO_HOST_PORT: String(lesson.moto_port) });
}
export function resources(id: string): string[] {
  if (!existsSync(path.join(ROOT, "lessons", id, "terraform.tfstate"))) return [];
  return tf(id, ["state", "list"], true).split(/\r?\n/).filter(Boolean);
}
function initialize(id: string): void { tf(id, ["init", "-input=false", "-lockfile=readonly"]); }
function requireMoto(id: string): void {
  const lesson = lessons[id]; if (!lesson.moto_port) return;
  const url = `http://localhost:${lesson.moto_port}/moto-api/`;
  // S3のバケットだけのrefreshでは、接続断を「消失」と扱う場合があるため先に確認します。
  const probe = spawnSync(process.execPath, ["--input-type=module", "-e",
    "try { const r = await fetch(process.argv[1], {signal: AbortSignal.timeout(3000)}); if (!r.ok) process.exit(1); } catch { process.exit(1); }", url],
    { timeout: 5000, stdio: "ignore" });
  if (probe.status !== 0) throw new Error(`Motoに接続できません：${url}\n先に mise run lesson:prepare -- ${id} を実行してください。`);
}
function prepare(id: string): void {
  const lesson = lessons[id]; initialize(id);
  if (lesson.moto_port) compose(lesson, ["up", "-d", "--wait"]);
  if (!["local", "aws-basic", "static"].includes(lesson.kind)) {
    execute(["docker", "build", "--file", path.join(ROOT, "support/apps/demo/Dockerfile"), "--tag", appTag(lesson), ROOT]);
  }
  console.log(`準備完了：${lesson.title}`);
}
export function cleanupOne(id: string, known?: string[]): void {
  const lesson = lessons[id]; const current = known ?? resources(id);
  if (current.length) {
    // エミュレーターのデータが消えていても、APIを起動してstateを整理します。
    if (lesson.moto_port) compose(lesson, ["up", "-d", "--wait"]);
    initialize(id);
    tf(id, ["destroy", "-input=false", "-auto-approve", ...variables(lesson)]);
    if (resources(id).length) throw new Error(`管理対象が残っています：${id}`);
  } else console.log(`管理対象なし：${id}`);
  if (lesson.moto_port) compose(lesson, ["down"]);
}
function cleanupAll(): void {
  // 破損stateがあれば、何も削除し始める前に止めます。
  const states = Object.fromEntries(Object.keys(lessons).map((id) => [id, resources(id)]));
  for (const id of Object.keys(lessons).reverse()) cleanupOne(id, states[id]);
  console.log("片付け完了。設定・入力値・ツール・イメージは残してあります。");
}
function cleanupImages(): void {
  cleanupAll();
  const names = execute(["docker", "image", "ls", "--format", "{{.Repository}}:{{.Tag}}"], true).trim().split(/\r?\n/);
  const fixed = new Set(Object.values(catalog.images));
  const prefixes = Object.values(lessons).map((lesson) => `${project(lesson)}-demo:`);
  for (const name of [...new Set(names)].sort()) {
    if (fixed.has(name) || prefixes.some((prefix) => name.startsWith(prefix))) execute(["docker", "image", "rm", name]);
  }
}
function check(): void {
  execute(["terraform", "fmt", "-check", "-recursive", path.join(ROOT, "lessons")]);
  execute(["docker", "compose", "-f", composeFile, "config", "--quiet"]);
  for (const id of Object.keys(lessons)) { initialize(id); tf(id, ["validate"]); }
  execute(["pnpm", "exec", "tsc", "--noEmit"]);
  execute(["node", path.join(ROOT, "scripts/check-docs.ts")]);
}
function main(): void {
  const [action, id, ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error("引数が多すぎます。教材IDを1つ指定してください。");
  if (id && ["list", "cleanup-all", "cleanup-images", "check", "moto-up", "moto-down", "moto-logs"].includes(action)) {
    throw new Error("この操作は教材IDを受け取りません。個別の片付けは lesson:cleanup -- 教材ID を使ってください。");
  }
  if (action === "list") { for (const [id, lesson] of Object.entries(lessons)) console.log(`${id.padEnd(46)} ${lesson.title}`); return; }
  if (action === "cleanup-all") return cleanupAll();
  if (action === "cleanup-images") return cleanupImages();
  if (action === "check") return check();
  if (action?.startsWith("moto-")) {
    const args = { "moto-up": ["up", "-d", "--wait"], "moto-down": ["down"], "moto-logs": ["logs", "--tail=50", "moto"] }[action];
    if (!args) throw new Error("不明なMoto操作です。");
    compose(lessons["01-basics/02-s3-storage"], args); return;
  }
  if (!id || !Object.hasOwn(lessons, id)) throw new Error("教材IDを指定してください。mise run lesson:list で一覧を表示できます。");
  const lesson = lessons[id];
  if (action === "prepare") prepare(id);
  else if (action === "plan" || action === "apply") { requireMoto(id); tf(id, [action, ...variables(lesson)]); }
  else if (action === "cleanup") { cleanupOne(id); console.log("この教材の片付けが完了しました。"); }
  else if (action === "status") {
    console.log("管理対象：\n" + resources(id).join("\n"));
    execute(["docker", "ps", "-a", "--filter", `label=terraform-playground.project=${project(lesson)}`, "--format", "{{.Names}}\t{{.Status}}\t{{.Ports}}"]);
    if (lesson.moto_port) compose(lesson, ["ps", "-a"]);
  } else throw new Error(`不明な操作です：${action}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`処理が途中で止まりました：${error}\n原因を解消して再実行してください。stateは削除しないでください。`); process.exitCode = 1; }
}
