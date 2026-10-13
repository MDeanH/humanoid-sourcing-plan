// Wi-Fi Lab dashboard: channels, networks and track views from the Mac's scan log, and the phone's link test.
"use strict";

const $ = (s) => document.querySelector(s);
const GOOD_DBM = -67, POOR_DBM = -75, GOOD_MS = 50, POOR_MS = 250;
const dbmGrade = (d) => (d >= GOOD_DBM ? "good" : d < POOR_DBM ? "poor" : "fair");
const msGrade = (m) => (m == null ? "lost" : m < GOOD_MS ? "good" : m >= POOR_MS ? "poor" : "fair");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ago = (s) => (s == null ? "" : s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${(s / 3600).toFixed(1)} h ago`);

let view = "channels", state = null, tracked = null;
// device name in iphone-probe.tsv; ?label=ipad (letters, digits, . _ -) for another device
const LABEL = (new URLSearchParams(location.search).get("label") || "iphone").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 32) || "iphone";
try { tracked = localStorage.getItem("tracked"); } catch (e) {}

// ---- views ---------------------------------------------------------------------------------------------------
function show(v) {
  view = v;
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
  document.querySelectorAll(".view").forEach((s) => s.classList.toggle("on", s.id === v));
  if (v === "track") refreshTrack();
}
document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));

async function getJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

async function refreshState() {
  try {
    state = await getJSON("/api/state");
    $("#run").textContent = state.run;
    $("#status").textContent = `${state.networks.length} networks · ${state.scans} cache updates`;
    document.querySelectorAll(".win").forEach((e) => (e.textContent = `${Math.round(state.window_s / 60)} min`));
    renderChannels();
    renderNetworks();
    renderGroup();
  } catch (e) {
    $("#status").textContent = "Scanner not reachable";
  }
}

function renderChannels() {
  const bands = { 2: "2.4 GHz", 5: "5 GHz", 6: "6 GHz" };
  let html = "";
  for (const b of [2, 5, 6]) {
    const rows = state.channels.filter((c) => c.band === b);
    if (!rows.length) continue;
    const max = Math.max(4, ...rows.map((r) => r.networks));
    html += `<div class="band"><h3>${bands[b]}</h3><div class="bars">`;
    for (const r of rows) {
      const h = Math.round((r.networks / max) * 100);
      const col = r.strongest == null ? "transparent" : `var(--${dbmGrade(r.strongest)})`;
      const tip = `channel ${r.num}: ${r.networks} networks, ${r.strong} at -75 dBm or stronger` +
        (r.strongest == null ? "" : `, strongest ${r.strongest} dBm`) + (r.dfs ? ", DFS" : "");
      html += `<div class="bar${r.main ? " main" : ""}" title="${esc(tip)}"><span class="n">${r.networks || ""}</span>` +
        `<div class="fill" style="height:${h}%;background:${col}"></div></div>`;
    }
    html += `</div><div class="labels">` +
      rows.map((r) => `<span class="${r.main ? "main" : ""}${r.dfs ? " dfs" : ""}">${r.num}</span>`).join("") + `</div></div>`;
  }
  $("#chanbands").innerHTML = html;
  const l = state.link;
  $("#maclink").innerHTML = !l ? "This computer's link: not logged (on a Pi, only when it is joined to a network)" : !l.connected ? "This computer's link: not connected" :
    `This computer's own link (${esc(l.device)}): <b class="${dbmGrade(l.dbm)}">${l.dbm} dBm</b>, noise ${l.noise ?? "–"} dBm, ` +
    `channel ${esc(l.ch || "–")}, ${l.rate ?? "–"} Mbit/s <span class="dim">at ${esc(l.t)}</span>`;
}

function renderNetworks() {
  $("#netlist").innerHTML = state.networks.map((n) =>
    `<li data-bssid="${n.bssid}"><b class="${n.grade}">${n.dbm}</b><span class="dim">${esc(n.ch)}</span>` +
    `<span class="name">${esc(n.name || "(hidden)")}</span><span class="sub">${n.bssid} · ${ago(n.age_s)}</span></li>`).join("") ||
    `<li class="dim">Nothing heard yet. Is the scanner running (the Mac app with Location Services allowed, or the Pi)?</li>`;
}
function renderGroup() {
  const g = state.group || [];
  $("#groupbtn").hidden = g.length === 0;
  $("#grouplist").innerHTML = g.map((m) => {
    const stale = m.age_s == null || m.age_s > 15;
    let what = m.flags & 16 ? `<b>${m.pax}</b> Wi-Fi devices counted (last minute)`
      : m.flags & 1 ? `<b>${m.nets}</b> networks, strongest ch ${m.best_ch} <b class="${dbmGrade(m.best_dbm)}">${m.best_dbm} dBm</b>`
      : "no data yet";
    if (m.flags & 8) what += `<br>tracking ch ${m.track_ch}: <b class="${dbmGrade(m.track_dbm)}">${m.track_dbm} dBm</b>`;
    const busiest = m.chcount.map((n, i) => [n, i + 1]).filter((x) => x[0]).sort((a, b) => b[0] - a[0]).slice(0, 3)
      .map((x) => `ch ${x[1]}: ${x[0]}`).join(", ");
    return `<div class="card"><div><b>${esc(m.kind)} ${esc(m.id)}</b> <span class="dim small">${stale ? "not heard for " : "heard "}` +
      `${ago(m.age_s)} · advert ${m.advert_rssi} dBm</span></div><div class="small">${what}</div>` +
      (busiest ? `<div class="dim small">busiest: ${busiest}${m.flags & 4 ? " · logging to SD" : ""}${m.flags & 2 ? " · paused" : ""}</div>` : "") + `</div>`;
  }).join("");
}

$("#netlist").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-bssid]");
  if (!li) return;
  tracked = li.dataset.bssid;
  try { localStorage.setItem("tracked", tracked); } catch (err) {}
  show("track");
});

async function refreshTrack() {
  if (!tracked) return;
  let d;
  try { d = await getJSON(`/api/track?bssid=${encodeURIComponent(tracked)}`); } catch (e) { return; }
  const pts = d.points, last = d.latest;
  if (!pts.length) {
    $("#trackhead").innerHTML = `<p class="dim">${esc(tracked)}: not heard in this run.</p>`;
    $("#trackchart").innerHTML = "";
    return;
  }
  const v = pts.map((p) => p.dbm), mn = Math.min(...v), mx = Math.max(...v);
  const avg = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
  const g = dbmGrade(last.dbm);
  const warn = g === "poor" ? "POOR: below -75 dBm" : g === "fair" ? "FAIR: below -67 dBm" : "GOOD: -67 dBm or better";
  $("#trackhead").innerHTML = `<div><b>${esc(last.name || "(hidden)")}</b> <span class="dim">${esc(last.ch)} · ${last.bssid}</span></div>` +
    `<div class="big ${g}">${last.dbm}<span class="unit">dBm</span></div><div class="grade ${g}">${warn}</div>` +
    `<div class="stats small"><span>min <b>${mn}</b></span><span>avg <b>${avg}</b></span><span>max <b>${mx}</b></span>` +
    `<span>points <b>${pts.length}</b></span><span>last <b>${esc(last.t.slice(11, 19))}</b></span></div>`;
  const W = 360, H = 200, lo = -95, hi = -30;
  const y = (d) => ((hi - Math.max(lo, Math.min(hi, d))) / (hi - lo)) * (H - 10) + 5;
  const x = (i) => (pts.length === 1 ? W / 2 : 6 + (i * (W - 12)) / (pts.length - 1));
  let svg = `<line x1="0" x2="${W}" y1="${y(GOOD_DBM)}" y2="${y(GOOD_DBM)}" stroke="var(--good)" stroke-dasharray="4 4"/>` +
    `<line x1="0" x2="${W}" y1="${y(POOR_DBM)}" y2="${y(POOR_DBM)}" stroke="var(--poor)" stroke-dasharray="4 4"/>`;
  svg += `<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts.map((p, i) => `${x(i)},${y(p.dbm)}`).join(" ")}"/>`;
  svg += pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.dbm)}" r="2.5" fill="var(--${dbmGrade(p.dbm)})"/>`).join("");
  $("#trackchart").innerHTML = svg;
}

// ---- link test -----------------------------------------------------------------------------------------------
const recent = [];            // last 240 results for the chart and stats
let pending = [];             // results not yet stored on the Mac
let running = false, timer = null, flushing = false, wakeLock = null, seq = 0;
try { pending = JSON.parse(localStorage.getItem("pending") || "[]"); } catch (e) { pending = []; }
const savePending = () => { try { localStorage.setItem("pending", JSON.stringify(pending.slice(-20000))); } catch (e) {} };

async function ping() {
  const t = Date.now(), start = performance.now(), ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 2000);
  let rtt = null;
  try {
    const r = await fetch(`/api/ping?s=${seq++}`, { cache: "no-store", signal: ctl.signal });
    await r.text();
    if (r.ok) rtt = Math.round((performance.now() - start) * 10) / 10;
  } catch (e) { /* timeout or no route: lost */ }
  clearTimeout(to);
  const res = { t, rtt };
  recent.push(res);
  if (recent.length > 240) recent.shift();
  pending.push(res);
  renderLink(res);
}

async function flush() {
  if (flushing || !pending.length) return;
  flushing = true;
  const batch = pending.slice(0, 2000);
  try {
    const r = await fetch("/api/probe", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: LABEL, results: batch }) });
    if (r.ok) { pending = pending.slice(batch.length); }
  } catch (e) { /* link down: keep them for later */ }
  savePending();
  $("#pending").textContent = pending.length;
  flushing = false;
}

function renderLink(last) {
  const ok = recent.filter((r) => r.rtt != null).map((r) => r.rtt);
  const lost = recent.length - ok.length;
  const g = msGrade(last.rtt);
  $("#rtt").textContent = last.rtt == null ? "lost" : Math.round(last.rtt);
  $("#rtt").className = g;
  $("#rttgrade").className = `grade ${g}`;
  $("#rttgrade").textContent = { good: "GOOD: under 50 ms", fair: "FAIR: 50-249 ms", poor: "POOR: 250 ms or more", lost: "LOST: no reply in 2 s" }[g];
  const avg = ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : 0;
  $("#pingstats").innerHTML = `<span>last ${recent.length}: avg <b>${avg.toFixed(0)}</b> ms</span>` +
    `<span>worst <b>${ok.length ? Math.max(...ok).toFixed(0) : "–"}</b> ms</span>` +
    `<span>lost <b>${lost}</b> (${recent.length ? ((100 * lost) / recent.length).toFixed(1) : 0}%)</span>` +
    `<span>≥250 ms <b>${ok.filter((v) => v >= POOR_MS).length}</b></span>`;
  $("#pending").textContent = pending.length;
  const W = 360, H = 120, top = 400;
  const y = (v) => H - 4 - (Math.min(v, top) / top) * (H - 8);
  const x = (i) => 2 + (i * (W - 4)) / 239;
  let svg = `<line x1="0" x2="${W}" y1="${y(GOOD_MS)}" y2="${y(GOOD_MS)}" stroke="var(--good)" stroke-dasharray="4 4"/>` +
    `<line x1="0" x2="${W}" y1="${y(POOR_MS)}" y2="${y(POOR_MS)}" stroke="var(--poor)" stroke-dasharray="4 4"/>`;
  recent.forEach((r, i) => {
    svg += r.rtt == null ? `<line x1="${x(i)}" x2="${x(i)}" y1="0" y2="${H}" stroke="var(--poor)" stroke-opacity="0.5"/>`
      : `<circle cx="${x(i)}" cy="${y(r.rtt)}" r="1.8" fill="var(--${msGrade(r.rtt)})"/>`;
  });
  $("#pingchart").innerHTML = svg;
}

async function setRunning(on) {
  running = on;
  $("#pingtoggle").textContent = on ? "Stop link test" : "Start link test";
  clearInterval(timer);
  if (on) {
    timer = setInterval(ping, 500);
    try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (e) { wakeLock = null; }
  } else {
    try { await wakeLock?.release(); } catch (e) {}
    wakeLock = null;
    flush();
  }
}
$("#pingtoggle").addEventListener("click", () => setRunning(!running));
document.addEventListener("visibilitychange", async () => {   // iOS drops the wake lock when the page hides
  if (running && document.visibilityState === "visible") {
    try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (e) {}
  }
});

$("#notebtn").addEventListener("click", async () => {
  const text = prompt("Note for runlog.tsv (where the robot is, what it is doing):", "iPhone mark");
  if (!text) return;
  try {
    const r = await fetch("/api/note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const d = await r.json();
    $("#notestatus").textContent = r.ok ? `Saved: ${d.line}` : `Not saved: ${d.error}`;
  } catch (e) {
    $("#notestatus").textContent = "Not saved: the server is not reachable. Try again when the link is back.";
  }
});

// ---- loops ---------------------------------------------------------------------------------------------------
refreshState();
setInterval(() => { if (view === "channels" || view === "networks" || view === "group") refreshState(); }, 3000);
setInterval(() => { if (view === "track") refreshTrack(); }, 5000);
setInterval(flush, 2000);
$("#pending").textContent = pending.length;
// ?autostart=1 opens the link test and starts it (for a phone set up on a stand, or for testing)
if (new URLSearchParams(location.search).get("autostart") === "1") { show("link"); setRunning(true); }
