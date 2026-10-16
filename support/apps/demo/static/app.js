let config;
const $ = (id) => document.getElementById(id);
const labels = {pending: "受付済み", running: "処理中", done: "完了", failed: "失敗"};
async function request(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    let message = `接続に失敗しました (${response.status})`;
    try { const body = await response.json(); if (typeof body.detail === "string") message = body.detail; } catch {}
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}
function message(text, error = false) { $("message").textContent = text; $("message").classList.toggle("error", error); }
async function action(fn) { try { await fn(); } catch (error) { message(error.message, true); } }
function button(text, fn) { const element = document.createElement("button"); element.type = "button"; element.textContent = text; element.className = "delete"; element.onclick = () => action(fn); return element; }
function link(text, href) { const element = document.createElement("a"); element.textContent = text; element.href = href; element.className = "download"; return element; }
async function refresh() {
  const isNotes = config.mode.startsWith("notes");
  const path = isNotes ? "/api/notes" : "/api/files";
  const items = await request(path);
  $("items").replaceChildren();
  $("empty").hidden = items.length > 0;
  for (const item of items) {
    const row = document.createElement("li");
    const label = document.createElement("div"); label.className = "item-label";
    const name = document.createElement("div"); name.textContent = isNotes ? item.content : item.title; label.append(name);
    const meta = document.createElement("div"); meta.className = "item-meta"; meta.textContent = isNotes ? new Date(item.created_at).toLocaleString("ja-JP") : `${item.filename} · ${item.size} bytes`; label.append(meta);
    const actions = document.createElement("div"); actions.className = "actions";
    if (!isNotes) actions.append(link("取得", `/api/files/${encodeURIComponent(item.id)}`));
    actions.append(button("削除", async () => { await request(`${path}/${encodeURIComponent(item.id)}`, {method: "DELETE"}); await refresh(); message("削除しました。"); }));
    row.append(label, actions); $("items").append(row);
  }
  if (config.jobs) {
    const jobs = await request("/api/jobs"); $("jobs").replaceChildren();
    for (const job of jobs) {
      const row = document.createElement("li");
      const label = document.createElement("span"); label.className = "item-label"; label.textContent = `CSV出力 ${job.id.slice(0, 8)}`;
      const actions = document.createElement("div"); actions.className = "actions";
      const status = document.createElement("span"); status.className = "status"; status.textContent = labels[job.status] || job.status; actions.append(status);
      if (job.status === "done") actions.append(link("CSVを取得", `/api/jobs/${encodeURIComponent(job.id)}/result`));
      if (job.status === "failed") label.textContent += "：処理に失敗しました。ログを確認してください。";
      row.append(label, actions); $("jobs").append(row);
    }
  }
}
$("notes-form").onsubmit = (event) => { event.preventDefault(); action(async () => { await request("/api/notes", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({content: $("content").value})}); event.target.reset(); await refresh(); message("メモを保存しました。"); }); };
$("files-form").onsubmit = (event) => { event.preventDefault(); action(async () => { await request("/api/files", {method: "POST", body: new FormData(event.target)}); event.target.reset(); await refresh(); message("ファイルを保存しました。"); }); };
$("refresh").onclick = () => action(async () => { await refresh(); message("一覧を更新しました。"); });
$("export").onclick = () => action(async () => { $("export").disabled = true; try { await request("/api/jobs", {method: "POST"}); await refresh(); message("処理を受け付けました。完了するとCSVを取得できます。"); } finally { $("export").disabled = false; } });
action(async () => {
  config = await request("/api/config"); document.title = config.title; $("title").textContent = config.title;
  const notes = config.mode.startsWith("notes");
  $("notes-form").hidden = !notes; $("files-form").hidden = notes;
  $("title-field").hidden = !config.metadata; $("jobs-section").hidden = !config.jobs;
  $("items-heading").textContent = notes ? "保存したメモ" : "保存したファイル";
  $("description").textContent = notes ? "メモを保存して、データベースとのつながりを確かめてみましょう。" : config.metadata ? "ファイルはS3へ、表示名などの情報はDynamoDBへ保存します。" : "ファイルをS3に保存して、取り出してみましょう。";
  await refresh(); message("接続できました。データを保存してみましょう。");
  if (config.jobs) setInterval(() => action(refresh), 2000);
});
