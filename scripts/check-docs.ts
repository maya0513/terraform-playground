import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ROOT, catalog } from "./course.ts";

function documents(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(dir, entry.name);
    if (["node_modules", ".terraform"].includes(entry.name)) return [];
    return entry.isDirectory() ? documents(name) : entry.name.endsWith(".md") ? [name] : [];
  });
}
const errors: string[] = [];
const files = [path.join(ROOT, "README.md"), ...["docs", "lessons", "support", "tests"].flatMap((dir) => documents(path.join(ROOT, dir)))];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if ((text.match(/```/g) || []).length % 2) errors.push(`${file}: コードブロックが閉じていません`);
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1]; if (target.includes("://")) continue;
    const [name, fragment] = target.split("#"); const dest = name ? path.resolve(path.dirname(file), name) : file;
    if (!existsSync(dest)) { errors.push(`${file}: リンク先がありません：${target}`); continue; }
    if (fragment) {
      const headings = [...readFileSync(dest, "utf8").matchAll(/^#{1,6} (.+)$/gm)].map((m) => m[1].toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, "").replace(/ /g, "-"));
      if (!headings.includes(fragment)) errors.push(`${file}: 見出しがありません：${target}`);
    }
  }
}
for (const id of Object.keys(catalog.lessons)) if (!existsSync(path.join(ROOT, "lessons", id, "README.md"))) errors.push(`教材の入口がありません：${id}`);
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log(`文書チェック成功：${files.length}ファイル`);
