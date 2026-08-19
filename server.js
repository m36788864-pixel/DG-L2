const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const JsonDb = require("./lib/jsonDb");
const { verifyLogin, createSession, destroySession, requireAuth } = require("./lib/auth");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// Load the project's .env without requiring an extra npm package.
// Node does not automatically read .env when running `node server.js`.
function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadLocalEnv(path.join(ROOT, ".env"));

const UPLOAD_DIR = path.join(ROOT, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const eventsDb = new JsonDb(path.join(ROOT, "data", "events.json"), []);
const ordersDb = new JsonDb(path.join(ROOT, "data", "orders.json"), []);
const queuesDb = new JsonDb(path.join(ROOT, "data", "queues.json"), []);

// ---------- Google Sheets export (orders -> Google Apps Script Web App) ----------
// Google Sheets Web App configuration.
// Render does not automatically load .env files from GitHub, so these fallbacks
// keep the current deployment working even when Render environment variables
// have not been added yet. For production, prefer setting the two values in
// Render Environment Variables.
const GOOGLE_SHEET_WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL ||
  "https://script.google.com/macros/s/AKfycbzuDmAAYtU8UMo4YnbT0J5L7nwFJRooaJG-SRIzygle9IR5S4e7T6ybWL9P3-wOJJu5/exec";
const GOOGLE_SHEET_SECRET = process.env.GOOGLE_SHEET_SECRET || "DELEFFGOPASS2026!";

// Send the completed order to Google Apps Script.
// The order itself is already saved locally before this function is called.
async function sendOrderToGoogleSheet(order) {
  if (!GOOGLE_SHEET_WEBHOOK_URL) {
    console.warn("[google-sheet] ยังไม่ได้ตั้งค่า GOOGLE_SHEET_WEBHOOK_URL");
    return { ok: false, error: "missing_webhook_url" };
  }

  const payload = {
    secret: GOOGLE_SHEET_SECRET,
    id: order.id,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    queueCode: order.queueCode,
    eventName: order.eventName,
    ticketName: order.ticketName,
    qty: order.qty,
    unitPrice: order.unitPrice,
    total: order.total,
    email: order.buyer?.email || "",
    discord: order.buyer?.discord || "",
    roblox: order.buyer?.roblox || "",
  };
  try {
    const response = await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let result = null;
    try { result = JSON.parse(text); } catch {}

    if (!response.ok || !result?.ok) {
      console.error("[google-sheet] Google Apps Script ตอบกลับผิดพลาด:", response.status, text);
      return { ok: false, status: response.status, response: text };
    }

    console.log("[google-sheet] ส่งสำเร็จ:", order.id, result);
    return { ok: true, result };
  } catch (err) {
    console.error("[google-sheet] ส่งข้อมูลไป Google Sheet ไม่สำเร็จ:", err.message);
    return { ok: false, error: err.message };
  }
}

const app = express();

// Quick diagnostic endpoint. Open /api/google-sheet/health in the browser
// to verify that the deployed server can reach the Google Apps Script URL.
app.get("/api/google-sheet/health", async (req, res) => {
  try {
    const response = await fetch(GOOGLE_SHEET_WEBHOOK_URL, { method: "GET" });
    const text = await response.text();
    let result = null;
    try { result = JSON.parse(text); } catch {}
    res.status(response.ok && result?.ok !== false ? 200 : 502).json({
      ok: response.ok && result?.ok !== false,
      status: response.status,
      google: result || text.slice(0, 500)
    });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});
app.use(express.json({ limit: "2mb" }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase() || ".jpg"}`),
});
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => ALLOWED_TYPES.has(file.mimetype)
    ? cb(null, true)
    : cb(new Error("รองรับเฉพาะ JPG, PNG, WEBP, GIF เท่านั้น")),
});
app.post("/api/upload", requireAuth, (req, res) => {
  upload.single("poster")(req, res, err => {
    if (err) return res.status(400).json({ error: "upload_failed", message: err.message });
    if (!req.file) return res.status(400).json({ error: "no_file", message: "ไม่พบไฟล์รูปภาพ" });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

// ---------- Admin auth ----------
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!verifyLogin(username, password)) return res.status(401).json({ error: "invalid_credentials", message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
  const token = createSession(username);
  res.json({ token, username });
});
app.post("/api/admin/logout", requireAuth, (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  destroySession(token);
  res.json({ ok: true });
});
app.get("/api/admin/me", requireAuth, (req, res) => res.json({ username: req.admin.username }));

// ---------- Event validation ----------
const defaultTicketTypes = e => [
  { id: "regular", name: "บัตรธรรมดา", description: "สิทธิ์เข้างานตามมาตรฐาน", price: Number(e.regular || 0) },
  { id: "vip", name: "บัตร VIP", description: "สิทธิ์พิเศษสำหรับผู้ถือบัตร VIP", price: Number(e.vip || 0) },
];

function normalizeTicketTypes(body) {
  if (!Array.isArray(body.ticketTypes)) return null;
  return body.ticketTypes.map((t, i) => ({
    id: String(t.id || `type-${i + 1}`).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") || `type-${i + 1}`,
    name: String(t.name || "").trim(),
    description: String(t.description || "").trim(),
    price: Number(t.price),
  }));
}

function validateEventPayload(body, { partial = false } = {}) {
  const errors = [], clean = {}, str = v => typeof v === "string" ? v.trim() : "";
  if (!partial || body.name !== undefined) { clean.name = str(body.name); if (!clean.name) errors.push("กรุณาระบุชื่อคอนเสิร์ต"); }
  if (!partial || body.date !== undefined) { clean.date = str(body.date); if (!/^\d{4}-\d{2}-\d{2}$/.test(clean.date)) errors.push("รูปแบบวันที่ไม่ถูกต้อง"); }
  if (!partial || body.time !== undefined) { clean.time = str(body.time); if (!/^\d{2}:\d{2}$/.test(clean.time)) errors.push("รูปแบบเวลาไม่ถูกต้อง"); }
  if (!partial || body.venue !== undefined) { clean.venue = str(body.venue); if (!clean.venue) errors.push("กรุณาระบุสถานที่จัดงาน"); }
  if (!partial || body.regular !== undefined) { clean.regular = Number(body.regular); if (!Number.isFinite(clean.regular) || clean.regular < 0) errors.push("ราคาบัตรธรรมดาไม่ถูกต้อง"); }
  if (!partial || body.vip !== undefined) { clean.vip = Number(body.vip); if (!Number.isFinite(clean.vip) || clean.vip < 0) errors.push("ราคา VIP ไม่ถูกต้อง"); }
  if (!partial || body.status !== undefined) { clean.status = str(body.status); if (!["เปิดขาย", "เร็ว ๆ นี้", "ปิดการขาย"].includes(clean.status)) errors.push("สถานะไม่ถูกต้อง"); }
  if (body.image !== undefined) clean.image = str(body.image);
  if (body.limitPerOrder !== undefined || !partial) {
    clean.limitPerOrder = Math.max(1, Math.min(100, Number(body.limitPerOrder) || 10));
  }
  if (body.ticketTypes !== undefined) {
    const types = normalizeTicketTypes(body);
    if (!types || !types.length) errors.push("ต้องมีประเภทบัตรอย่างน้อย 1 ประเภท");
    else if (types.some(t => !t.name || !Number.isFinite(t.price) || t.price < 0)) errors.push("ข้อมูลประเภทบัตรไม่ครบหรือราคาไม่ถูกต้อง");
    else if (new Set(types.map(t => t.id)).size !== types.length) errors.push("รหัสประเภทบัตรซ้ำกัน");
    else clean.ticketTypes = types;
  }
  return { errors, clean };
}

function publicEvent(e) {
  const ticketTypes = Array.isArray(e.ticketTypes) && e.ticketTypes.length ? e.ticketTypes : defaultTicketTypes(e);
  return { ...e, ticketTypes, limitPerOrder: Math.max(1, Number(e.limitPerOrder || 10)) };
}

app.get("/api/events", (req, res) => res.json(eventsDb.read().sort((a,b) => a.date > b.date ? 1 : -1).map(publicEvent)));
app.get("/api/events/:id", (req, res) => {
  const item = eventsDb.read().find(e => e.id === req.params.id);
  if (!item) return res.status(404).json({ error: "not_found", message: "ไม่พบงานนี้" });
  res.json(publicEvent(item));
});

app.post("/api/events", requireAuth, (req, res) => {
  const { errors, clean } = validateEventPayload(req.body);
  if (errors.length) return res.status(400).json({ error: "validation_error", message: errors.join(", ") });
  const now = new Date().toISOString();
  const item = {
    id: `event-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    ...clean, image: clean.image || "", createdAt: now, updatedAt: now
  };
  if (!item.ticketTypes) item.ticketTypes = defaultTicketTypes(item);
  eventsDb.update(list => list.push(item));
  res.status(201).json(publicEvent(item));
});

app.put("/api/events/:id", requireAuth, (req, res) => {
  const { errors, clean } = validateEventPayload(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ error: "validation_error", message: errors.join(", ") });
  let updated = null;
  eventsDb.update(list => {
    const idx = list.findIndex(e => e.id === req.params.id);
    if (idx === -1) return;
    const merged = { ...list[idx], ...clean, updatedAt: new Date().toISOString() };
    if (!merged.ticketTypes) merged.ticketTypes = defaultTicketTypes(merged);
    updated = merged; list[idx] = merged;
  });
  if (!updated) return res.status(404).json({ error: "not_found", message: "ไม่พบงานนี้" });
  res.json(publicEvent(updated));
});

app.delete("/api/events/:id", requireAuth, (req, res) => {
  let deleted = false;
  eventsDb.update(list => {
    const idx = list.findIndex(e => e.id === req.params.id);
    if (idx !== -1) { list.splice(idx, 1); deleted = true; }
  });
  if (!deleted) return res.status(404).json({ error: "not_found", message: "ไม่พบงานนี้" });
  res.json({ ok: true });
});

// ---------- Waiting queue ----------
function cleanupQueues() {
  const cutoff = Date.now() - 15 * 60 * 1000;
  queuesDb.update(list => {
    for (let i = list.length - 1; i >= 0; i--) if (new Date(list[i].createdAt).getTime() < cutoff) list.splice(i, 1);
  });
}
app.get("/api/queue/:eventId", (req, res) => {
  const event = eventsDb.read().find(e => e.id === req.params.eventId);
  if (!event) return res.status(404).json({ error: "not_found", message: "ไม่พบงานนี้" });
  if (event.status !== "เปิดขาย") return res.status(400).json({ error: "not_on_sale", message: "งานนี้ยังไม่เปิดขาย" });
  cleanupQueues();
  const existingToken = String(req.query.token || "");
  let result = null;
  queuesDb.update(list => {
    if (existingToken) {
      const found = list.find(q => q.token === existingToken && q.eventId === event.id);
      if (found) { result = found; return; }
    }
    const max = list.filter(q => q.eventId === event.id).reduce((m, q) => Math.max(m, Number(q.queueNumber || 0)), 0);
    const queueNumber = max + 1;
    result = { token: crypto.randomBytes(18).toString("hex"), eventId: event.id, queueNumber, queueCode: `#${String(queueNumber).padStart(4,"0")}`, createdAt: new Date().toISOString() };
    list.push(result);
  });
  const ahead = Math.max(0, result.queueNumber - 1);
  res.json({ queueCode: result.queueCode, queueNumber: result.queueNumber, ahead, token: result.token });
});

// ---------- Orders / queue ----------
function validAscii(value, regex, label) {
  const v = String(value || "").trim();
  return regex.test(v) ? v : null;
}

app.post("/api/orders", (req, res) => {
  const { eventId, ticketType, qty, price } = req.body || {};
  const events = eventsDb.read();
  const event = events.find(e => e.id === eventId);
  if (!event) return res.status(404).json({ error: "not_found", message: "ไม่พบงานนี้" });
  if (event.status !== "เปิดขาย") return res.status(400).json({ error: "not_on_sale", message: "งานนี้ยังไม่เปิดขายหรือปิดการขายแล้ว" });

  const types = Array.isArray(event.ticketTypes) && event.ticketTypes.length ? event.ticketTypes : defaultTicketTypes(event);
  const type = types.find(t => t.id === ticketType);
  if (!type) return res.status(400).json({ error: "invalid_ticket_type", message: "ไม่พบประเภทบัตรนี้" });

  const limit = Math.max(1, Math.min(100, Number(event.limitPerOrder || 10)));
  const cleanQty = Math.max(1, Math.min(limit, Number(qty) || 1));
  const expectedPrice = Number(type.price || 0);
  const requestedPrice = Number(price);
  if (Number.isFinite(requestedPrice) && requestedPrice !== expectedPrice) return res.status(400).json({ error: "price_mismatch", message: "ราคาบัตรเปลี่ยนแปลง กรุณาโหลดรายการใหม่" });

  let queueNumber = 0;
  const queueToken = String(req.body?.queueToken || "");
  if (queueToken) {
    cleanupQueues();
    const q = queuesDb.read().find(x => x.token === queueToken && x.eventId === eventId);
    if (q) queueNumber = Number(q.queueNumber);
  }
  let order;
  ordersDb.update(list => {
    if (!queueNumber) {
      const sameEvent = list.filter(o => o.eventId === eventId);
      const maxQueue = sameEvent.reduce((m, o) => Math.max(m, Number(o.queueNumber || 0)), 0);
      queueNumber = maxQueue + 1;
    }
    order = {
      id: `order-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      queueNumber,
      queueCode: `#${String(queueNumber).padStart(4, "0")}`,
      eventId, eventName: event.name,
      ticketType: type.id, ticketName: type.name, ticketDescription: type.description,
      qty: cleanQty, unitPrice: expectedPrice, total: cleanQty * expectedPrice,
      buyer: { email: "", discord: "", roblox: "" },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    list.push(order);
  });
  res.status(201).json(order);
});

app.put("/api/orders/:id", async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const discord = String(req.body?.discord || "").trim();
  const roblox = String(req.body?.roblox || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "validation_error", message: "กรุณาระบุอีเมลที่ถูกต้อง" });
  if (!/^[A-Za-z0-9._-]{2,50}$/.test(discord)) return res.status(400).json({ error: "validation_error", message: "Discord ต้องใช้ภาษาอังกฤษ ตัวเลข และ . _ - เท่านั้น" });
  if (!/^[A-Za-z0-9_]{3,30}$/.test(roblox)) return res.status(400).json({ error: "validation_error", message: "Roblox ต้องใช้ภาษาอังกฤษ ตัวเลข และ _ เท่านั้น" });

  let updated = null;
  ordersDb.update(list => {
    const idx = list.findIndex(o => o.id === req.params.id);
    if (idx === -1) return;
    list[idx] = { ...list[idx], buyer: { email, discord, roblox }, updatedAt: new Date().toISOString() };
    updated = list[idx];
  });
  if (!updated) return res.status(404).json({ error: "not_found", message: "ไม่พบคำสั่งซื้อนี้" });
  // Wait for the webhook so the browser/admin console can know if Sheets accepted it.
  const sheetResult = await sendOrderToGoogleSheet(updated);
  res.json({ ...updated, googleSheet: sheetResult });
});


// Retry Google Sheets sync for an existing completed order.
// This makes the receipt page self-healing if the first webhook request failed
// because Render, Google Apps Script, or the network was temporarily unavailable.
app.post("/api/orders/:id/sync-sheet", async (req, res) => {
  try {
    const order = ordersDb.read().find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: "not_found", message: "ไม่พบคำสั่งซื้อ" });
    if (!order.buyer?.email) {
      return res.status(400).json({ ok: false, error: "buyer_incomplete", message: "ยังไม่มีข้อมูลผู้ซื้อ" });
    }

    const result = await sendOrderToGoogleSheet(order);
    if (!result.ok) {
      return res.status(502).json({ ok: false, googleSheet: result });
    }
    res.json({ ok: true, googleSheet: result });
  } catch (err) {
    console.error("[google-sheet] sync endpoint error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/orders/:id", (req, res) => {
  const item = ordersDb.read().find(o => o.id === req.params.id);
  if (!item) return res.status(404).json({ error: "not_found", message: "ไม่พบคำสั่งซื้อ" });
  res.json(item);
});

app.get("/api/admin/orders", requireAuth, (req, res) => {
  const orders = ordersDb.read().slice().reverse();
  const events = new Map(eventsDb.read().map(e => [e.id, e.name]));
  res.json(orders.map(o => ({ ...o, eventName: events.get(o.eventId) || o.eventName })));
});

app.get("/api/admin/customers", requireAuth, (req, res) => {
  const orders = ordersDb.read();
  const map = new Map();
  orders.forEach(o => {
    const b = o.buyer || {};
    const key = b.email || b.discord || b.roblox || o.id;
    const current = map.get(key) || { email: b.email || "-", discord: b.discord || "-", roblox: b.roblox || "-", orders: 0, tickets: 0, total: 0, lastOrderAt: o.createdAt };
    current.orders++; current.tickets += Number(o.qty || 0); current.total += Number(o.total || 0);
    if (o.createdAt > current.lastOrderAt) current.lastOrderAt = o.createdAt;
    map.set(key, current);
  });
  res.json([...map.values()].sort((a,b) => new Date(b.lastOrderAt) - new Date(a.lastOrderAt)));
});

app.get("/api/admin/stats", requireAuth, (req, res) => {
  const events = eventsDb.read().map(publicEvent), orders = ordersDb.read();
  const totalRevenue = orders.reduce((sum,o) => sum + Number(o.total || 0), 0);
  const totalTickets = orders.reduce((sum,o) => sum + Number(o.qty || 0), 0);
  const perEvent = events.map(e => {
    const eo = orders.filter(o => o.eventId === e.id);
    return { id:e.id, name:e.name, image:e.image, status:e.status, ticketsSold:eo.reduce((s,o)=>s+Number(o.qty||0),0), revenue:eo.reduce((s,o)=>s+Number(o.total||0),0), orders:eo.length };
  }).sort((a,b)=>b.revenue-a.revenue);
  res.json({
    totalEvents: events.length, onSale: events.filter(e=>e.status==="เปิดขาย").length,
    upcoming: events.filter(e=>e.status==="เร็ว ๆ นี้").length, totalOrders: orders.length,
    totalTickets, totalRevenue, perEvent, recentOrders: orders.slice(-8).reverse()
  });
});

app.use(express.static(ROOT, { extensions: ["html"] }));
app.use((req,res)=>res.status(404).json({error:"not_found",message:"ไม่พบหน้าหรือ endpoint นี้"}));
app.listen(PORT,()=>console.log(`\nDELEF FEST GOPASS server พร้อมทำงานที่ http://localhost:${PORT}\n`));
