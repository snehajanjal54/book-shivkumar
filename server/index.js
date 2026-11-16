import crypto from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"
import cors from "cors"
import dotenv from "dotenv"
import express from "express"
import mysql from "mysql2/promise"
import Razorpay from "razorpay"
import { book } from "../src/content.js"
import {
  assignCourier,
  cancelShipments,
  courierOptions,
  createShipfigoOrder,
  createWarehouse,
  fetchLabel,
  listWarehouses,
  parcel,
  readShipfigoSettings,
  saveShipfigoSettings,
  shipfigoAuthUrl,
  shipfigoBaseUrl,
  shipfigoConnect,
  startShipfigoTokenRefresh,
  summaryReport,
  trackByOrderIds,
} from "./shipfigo.js"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env") })

const port = Number(process.env.PORT || 4000)
const keyId = process.env.RAZORPAY_KEY_ID
const keySecret = process.env.RAZORPAY_KEY_SECRET

if (!keyId || !keySecret) {
  throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in .env")
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "selfish_readers",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
})

const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })

const app = express()
app.use(cors())
app.use(express.json())

function fail(res, status, error) {
  res.status(status).json({ error })
}

function readOrder(body) {
  const name = String(body.name || "").trim()
  const phone = String(body.phone || "").trim()
  const address = String(body.address || "").trim()
  const landmark = String(body.landmark || "").trim().slice(0, 160)
  const city = String(body.city || "").trim()
  const taluka = String(body.taluka || "").trim().slice(0, 80)
  const district = String(body.district || "").trim()
  const pin = String(body.pin || "").trim()
  const qty = Number(body.qty)
  const letters = /^[A-Za-z][A-Za-z .'-]*$/
  const street = /^[A-Za-z0-9][A-Za-z0-9\s.,/'#()-]*$/
  if (!letters.test(name) || name.length < 2) return { error: "कृपया फक्त इंग्रजी (English) अक्षरांचा वापर करा." }
  if (!/^[6-9]\d{9}$/.test(phone)) return { error: "कृपया 10-अंकी मोबाईल नंबर प्रविष्ट करा." }
  if (!street.test(address) || address.length < 5) return { error: "कृपया पत्ता फक्त इंग्रजी (English) अक्षरे आणि अंकांमध्ये प्रविष्ट करा." }
  if (landmark && !letters.test(landmark)) return { error: "कृपया खूण फक्त इंग्रजी (English) अक्षरांमध्ये प्रविष्ट करा." }
  if (!letters.test(city) || city.length < 2) return { error: "कृपया शहराचे नाव फक्त इंग्रजीत (English) प्रविष्ट करा." }
  if (taluka && !letters.test(taluka)) return { error: "कृपया तालुक्याचे नाव फक्त इंग्रजीत (English) प्रविष्ट करा." }
  if (!letters.test(district) || district.length < 2) return { error: "कृपया जिल्ह्याचे नाव फक्त इंग्रजीत (English) प्रविष्ट करा." }
  if (!/^\d{6}$/.test(pin)) return { error: "कृपया 6-अंकी पिनकोड प्रविष्ट करा." }
  if (!Number.isInteger(qty) || qty < 1 || qty > 20) return { error: "प्रती 1 ते 20 दरम्यान ठेवा." }
  return {
    name,
    phone,
    address,
    landmark,
    city,
    taluka,
    district,
    pin,
    qty,
    pay: "razorpay",
    amount: qty * book.price,
  }
}

function publicOrder(row) {
  return {
    orderCode: row.order_code,
    name: row.customer_name,
    qty: row.quantity,
    city: row.city,
    amount: row.amount,
    pay: row.payment_mode,
    status: row.status,
    paymentId: row.razorpay_payment_id,
  }
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1")
    res.json({ ok: true, database: process.env.DB_NAME, razorpay: "test" })
  } catch (error) {
    fail(res, 500, "MySQL शी जोडता आले नाही. Workbench मधील root पासवर्ड .env मध्ये DB_PASSWORD म्हणून ठेवा आणि sql/schema.sql चालवा.")
  }
})

app.post("/api/orders", async (req, res) => {
  const order = readOrder(req.body || {})
  if (order.error) return fail(res, 400, order.error)
  const orderCode = `SR-${Date.now().toString().slice(-8)}`
  try {
    const razorpayOrder = await razorpay.orders.create({
      amount: order.amount * 100,
      currency: "INR",
      receipt: orderCode,
      notes: { name: order.name, phone: order.phone, city: order.city, district: order.district },
    })
    await pool.query(
      `INSERT INTO orders
        (order_code, customer_name, phone, address, landmark, city, taluka, district, pin_code, quantity, unit_price, amount, payment_mode, status, razorpay_order_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'razorpay', 'created', ?)`,
      [
        orderCode,
        order.name,
        order.phone,
        order.address,
        order.landmark || null,
        order.city,
        order.taluka || null,
        order.district,
        order.pin,
        order.qty,
        book.price,
        order.amount,
        razorpayOrder.id,
      ],
    )
    res.json({
      keyId,
      razorpayOrderId: razorpayOrder.id,
      amount: order.amount * 100,
      order: { orderCode, name: order.name, qty: order.qty, city: order.city, amount: order.amount },
    })
  } catch (error) {
    console.error("order failed:", error.code || "", error.message)
    const message = /access denied|ECONNREFUSED|Unknown database|ER_NO_SUCH_TABLE|doesn't exist/i.test(
      `${error.code || ""} ${error.message || ""}`,
    )
      ? "MySQL शी जोडता आले नाही. Workbench मध्ये sql/schema.sql चालवा आणि .env मध्ये DB_PASSWORD भरा."
      : "ऑर्डर तयार करता आली नाही. पुन्हा प्रयत्न करा."
    fail(res, 500, message)
  }
})

app.post("/api/payments/verify", async (req, res) => {
  const orderCode = String(req.body.orderCode || "")
  const razorpayOrderId = String(req.body.razorpayOrderId || "")
  const razorpayPaymentId = String(req.body.razorpayPaymentId || "")
  const razorpaySignature = String(req.body.razorpaySignature || "")
  if (!orderCode || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return fail(res, 400, "पेमेंट तपशील अपूर्ण आहेत.")
  }
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex")
  const valid =
    expected.length === razorpaySignature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpaySignature))
  if (!valid) return fail(res, 400, "पेमेंट पडताळणी अयशस्वी.")
  try {
    const [result] = await pool.query(
      `UPDATE orders
       SET status = 'paid', razorpay_payment_id = ?
       WHERE order_code = ? AND razorpay_order_id = ? AND status = 'created'`,
      [razorpayPaymentId, orderCode, razorpayOrderId],
    )
    if (result.affectedRows !== 1) {
      const [existing] = await pool.query(
        "SELECT * FROM orders WHERE order_code = ? AND razorpay_order_id = ? AND status = 'paid'",
        [orderCode, razorpayOrderId],
      )
      if (!existing.length) return fail(res, 404, "जुळणारी ऑर्डर सापडली नाही.")
      return res.json({ order: publicOrder(existing[0]) })
    }
    const [rows] = await pool.query("SELECT * FROM orders WHERE order_code = ?", [orderCode])
    res.json({ order: publicOrder(rows[0]) })
  } catch {
    fail(res, 500, "पेमेंट नोंदवता आले नाही.")
  }
})

const sessions = new Map()
const loginAttempts = new Map()

function sameSecret(left, right) {
  const a = crypto.createHash("sha256").update(String(left)).digest()
  const b = crypto.createHash("sha256").update(String(right)).digest()
  return crypto.timingSafeEqual(a, b)
}

function adminAuth(req, res, next) {
  const header = String(req.headers.authorization || "")
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  const session = sessions.get(token)
  if (!session || session.until < Date.now()) {
    sessions.delete(token)
    return fail(res, 401, "अॅडमिन लॉगिन पुन्हा करा.")
  }
  next()
}

function adminOrder(row) {
  return {
    orderCode: row.order_code,
    name: row.customer_name,
    phone: row.phone,
    address: row.address,
    landmark: row.landmark || "",
    city: row.city,
    taluka: row.taluka || "",
    district: row.district,
    pin: row.pin_code,
    qty: row.quantity,
    unitPrice: row.unit_price,
    amount: row.amount,
    pay: row.payment_mode,
    status: row.status,
    paymentId: row.razorpay_payment_id || "",
    shipfigoOrderId: row.shipfigo_order_id || "",
    shipmentId: row.shipfigo_shipment_id || "",
    awb: row.awb_code || "",
    courier: row.courier_name || "",
    labelUrl: row.label_url || "",
    trackUrl: row.track_url || "",
    shipStatus: row.ship_status || "",
    parcel: parcel(row),
    createdAt: row.created_at,
  }
}

async function ensureShippingColumns() {
  const columns = [
    ["shipfigo_order_id", "VARCHAR(64) NULL"],
    ["awb_code", "VARCHAR(64) NULL"],
    ["ship_status", "VARCHAR(80) NULL"],
    ["shipfigo_shipment_id", "VARCHAR(64) NULL"],
    ["courier_name", "VARCHAR(80) NULL"],
    ["label_url", "VARCHAR(600) NULL"],
    ["track_url", "VARCHAR(300) NULL"],
  ]
  for (const [name, type] of columns) {
    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN ${name} ${type}`)
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") console.error("schema", name, error.code || error.message)
    }
  }
}

app.post("/api/admin/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase()
  const password = String(req.body.password || "")
  const ip = req.ip || "local"
  const now = Date.now()
  const bucket = (loginAttempts.get(ip) || []).filter((time) => now - time < 10 * 60 * 1000)
  if (bucket.length >= 8) return fail(res, 429, "खूप वेळा प्रयत्न झाले. थोड्या वेळाने पुन्हा करा.")
  const expectedEmail = String(process.env.SHIPFIGO_EMAIL || "").trim().toLowerCase()
  const expectedPassword = String(process.env.SHIPFIGO_PASSWORD || "")
  if (!sameSecret(email, expectedEmail) || !sameSecret(password, expectedPassword)) {
    bucket.push(now)
    loginAttempts.set(ip, bucket)
    return fail(res, 401, "ईमेल किंवा पासवर्ड चुकीचा आहे.")
  }
  loginAttempts.delete(ip)
  const token = crypto.randomBytes(32).toString("hex")
  sessions.set(token, { until: now + 12 * 60 * 60 * 1000 })
  res.json({ token, email: expectedEmail })
})

app.get("/api/admin/orders", adminAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM orders ORDER BY id DESC LIMIT 200")
    const orders = rows.map(adminOrder)
    const paid = orders.filter((order) => order.status === "paid").length
    res.json({
      orders,
      summary: {
        total: orders.length,
        paid,
        amount: orders.reduce((sum, order) => sum + Number(order.amount || 0), 0),
      },
    })
  } catch (error) {
    console.error("admin orders:", error.code || error.message)
    fail(res, 500, "ऑर्डर यादी वाचता आली नाही.")
  }
})

app.patch("/api/admin/orders/:code", adminAuth, async (req, res) => {
  const status = String(req.body.status || "")
  const allowed = ["created", "paid", "booked", "shipped", "delivered", "cancelled"]
  if (!allowed.includes(status)) return fail(res, 400, "स्थिती बदलता आली नाही.")
  try {
    const [result] = await pool.query("UPDATE orders SET status = ? WHERE order_code = ?", [
      status,
      req.params.code,
    ])
    if (result.affectedRows !== 1) return fail(res, 404, "ऑर्डर सापडली नाही.")
    const [rows] = await pool.query("SELECT * FROM orders WHERE order_code = ?", [req.params.code])
    res.json({ order: adminOrder(rows[0]) })
  } catch {
    fail(res, 500, "स्थिती जतन करता आली नाही.")
  }
})

const SHIP_LABELS = {
  pending: "Order created",
  ready_for_pickup: "Ready for pickup",
  ready_for_dispatch: "Ready for dispatch",
  pickup_scheduled: "Pickup scheduled",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Shipment cancelled",
  rto_in_transit: "Return to origin",
}

function shipKey(status) {
  return String(status || "").trim().toLowerCase().replace(/[\s-]+/g, "_")
}

function shipLabel(status) {
  const key = shipKey(status)
  if (!key) return ""
  return SHIP_LABELS[key] || key.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase())
}

function orderStatusFor(shipStatus, current, hasAwb) {
  if (current === "cancelled" || current === "created") return current
  const key = shipKey(shipStatus)
  if (key === "delivered") return "delivered"
  if (key === "cancelled") return "paid"
  if (/rto|transit|out_for|picked|shipped|dispatched/.test(key)) return "shipped"
  if (/ready|pickup|manifest|booked/.test(key) || hasAwb) return "booked"
  return current
}

async function orderRow(code) {
  const [rows] = await pool.query("SELECT * FROM orders WHERE order_code = ?", [code])
  return rows[0] || null
}

async function freshOrder(code) {
  return adminOrder(await orderRow(code))
}

async function pickWarehouse() {
  const saved = readShipfigoSettings().warehouse
  if (saved?.id) return { ok: true, warehouse: saved }
  const listed = await listWarehouses()
  if (!listed.ok) return listed
  if (listed.warehouses.length === 1) {
    saveShipfigoSettings({ warehouse: listed.warehouses[0] })
    return { ok: true, warehouse: listed.warehouses[0] }
  }
  return {
    ok: false,
    message: listed.warehouses.length ? "Shipping मध्ये पिकअप वेअरहाउस निवडा." : "Shipfigo वर वेअरहाउस नाही. Shipping मध्ये वेअरहाउस तयार करा.",
  }
}

async function createOnShipfigo(row) {
  const place = await pickWarehouse()
  if (!place.ok) return place
  const created = await createShipfigoOrder(row, place.warehouse)
  if (!created.ok) return created
  await pool.query(
    "UPDATE orders SET shipfigo_order_id = ?, shipfigo_shipment_id = ?, ship_status = ? WHERE order_code = ?",
    [created.orderId || row.order_code, created.shipmentId || null, "Order created", row.order_code],
  )
  return created
}

async function saveTracks(tracks) {
  let saved = 0
  for (const [code, track] of Object.entries(tracks)) {
    const row = await orderRow(code)
    if (!row) continue
    const label = shipLabel(track.status).slice(0, 80)
    const hasAwb = Boolean(track.awb || row.awb_code)
    const status = orderStatusFor(track.status, row.status, hasAwb)
    await pool.query(
      `UPDATE orders
       SET ship_status = IF(? = '', ship_status, ?), track_url = IF(? = '', track_url, ?), awb_code = IF(? = '', awb_code, ?),
           courier_name = IF(? = '', courier_name, ?), status = ?
       WHERE order_code = ?`,
      [label, label, track.trackUrl, track.trackUrl, track.awb, track.awb, track.courier, track.courier, status, code],
    )
    saved += 1
  }
  return saved
}

app.get("/api/admin/shipfigo", adminAuth, async (_req, res) => {
  try {
    const session = await shipfigoConnect()
    const settings = readShipfigoSettings()
    if (!session.ok) {
      return res.json({ connected: false, api: shipfigoBaseUrl(), message: session.message, warehouses: [], warehouse: settings.warehouse || null })
    }
    const listed = await listWarehouses()
    res.json({
      connected: true,
      api: shipfigoBaseUrl(),
      until: session.until,
      message: listed.ok ? session.message : listed.message,
      warehouses: listed.ok ? listed.warehouses : [],
      warehouse: settings.warehouse || null,
    })
  } catch (error) {
    fail(res, 500, error.message || "Shipfigo तपासता आले नाही.")
  }
})

app.post("/api/admin/shipfigo/warehouse/select", adminAuth, async (req, res) => {
  try {
    const listed = await listWarehouses()
    if (!listed.ok) return fail(res, 502, listed.message)
    const place = listed.warehouses.find((item) => item.id === String(req.body?.id || ""))
    if (!place) return fail(res, 404, "हे वेअरहाउस Shipfigo वर सापडले नाही.")
    saveShipfigoSettings({ warehouse: place })
    res.json({ warehouse: place, warehouses: listed.warehouses })
  } catch (error) {
    fail(res, 500, error.message || "वेअरहाउस निवडता आले नाही.")
  }
})

app.post("/api/admin/shipfigo/warehouse", adminAuth, async (req, res) => {
  const input = {
    name: String(req.body?.name || "").trim().slice(0, 80),
    phone: String(req.body?.phone || "").trim(),
    email: String(req.body?.email || "").trim(),
    contact: String(req.body?.contact || "").trim().slice(0, 80),
    gst: String(req.body?.gst || "").trim().toUpperCase(),
    street: String(req.body?.street || "").trim().slice(0, 200),
    zip: String(req.body?.zip || "").trim(),
    city: String(req.body?.city || "").trim().slice(0, 80),
    state: String(req.body?.state || "").trim().slice(0, 80),
  }
  if (!input.name || !input.contact || !input.street || !input.city || !input.state) return fail(res, 400, "सर्व * भाग भरा.")
  if (!/^[6-9]\d{9}$/.test(input.phone)) return fail(res, 400, "10-अंकी मोबाईल नंबर द्या.")
  if (!/^\S+@\S+\.\S+$/.test(input.email)) return fail(res, 400, "योग्य ईमेल द्या.")
  if (!/^\d{6}$/.test(input.zip)) return fail(res, 400, "6-अंकी पिनकोड द्या.")
  try {
    const created = await createWarehouse(input)
    if (!created.ok) return fail(res, 502, created.message)
    const listed = await listWarehouses()
    const place = (listed.warehouses || []).find((item) => item.id === created.warehouseId) || {
      id: created.warehouseId,
      name: input.name,
      contact: input.contact,
      street: input.street,
      city: input.city,
      state: input.state,
      zip: input.zip,
    }
    saveShipfigoSettings({ warehouse: place })
    res.json({ warehouse: place, warehouses: listed.warehouses || [place] })
  } catch (error) {
    fail(res, 500, error.message || "वेअरहाउस तयार करता आले नाही.")
  }
})

app.get("/api/admin/shipfigo/report", adminAuth, async (_req, res) => {
  try {
    const end = new Date()
    const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000)
    const report = await summaryReport(start, end)
    if (!report.ok) return fail(res, 502, report.message)
    res.json({ summary: report.summary, start, end })
  } catch (error) {
    fail(res, 500, error.message || "रिपोर्ट मिळाला नाही.")
  }
})

app.post("/api/admin/shipfigo/sync", adminAuth, async (req, res) => {
  const steps = []
  const base = shipfigoBaseUrl()
  try {
    const session = await shipfigoConnect()
    steps.push({ name: "1. Authentication — Get Token", link: shipfigoAuthUrl(), ok: Boolean(session.ok), detail: session.message })
    if (!session.ok) return res.json({ ok: false, steps })

    const place = await pickWarehouse()
    steps.push({
      name: "List Warehouses",
      link: `${base}/warehouses`,
      ok: Boolean(place.ok),
      detail: place.ok ? `${place.warehouse.name} · ${place.warehouse.id} · PIN ${place.warehouse.zip}` : place.message,
    })

    const code = String(req.body?.orderCode || "").trim()
    const [rows] = code
      ? await pool.query("SELECT * FROM orders WHERE order_code = ? AND (shipfigo_order_id IS NULL OR shipfigo_order_id = '')", [code])
      : await pool.query("SELECT * FROM orders WHERE status IN ('paid', 'booked', 'shipped', 'delivered') AND (shipfigo_order_id IS NULL OR shipfigo_order_id = '') ORDER BY id DESC")

    if (!rows.length) steps.push({ name: "6a. Create Order Only", link: `${base}/forward-order`, ok: true, detail: "नवीन पेमेंट ऑर्डर नाही." })
    for (const row of place.ok ? rows : []) {
      const created = await createOnShipfigo(row)
      steps.push({
        name: `6a. Create Order Only · ${row.order_code}`,
        link: `${base}/forward-order`,
        ok: Boolean(created.ok),
        detail: created.message,
      })
    }

    const [synced] = code
      ? await pool.query("SELECT order_code FROM orders WHERE order_code = ? AND shipfigo_order_id IS NOT NULL AND shipfigo_order_id <> ''", [code])
      : await pool.query("SELECT order_code FROM orders WHERE shipfigo_order_id IS NOT NULL AND shipfigo_order_id <> '' AND status <> 'cancelled' ORDER BY id DESC LIMIT 50")
    if (synced.length) {
      const tracked = await trackByOrderIds(synced.map((row) => row.order_code))
      const saved = tracked.ok ? await saveTracks(tracked.tracks) : 0
      steps.push({
        name: "9b. Order Tracking by Order ID",
        link: `${base}/order-tracking-by-order-id`,
        ok: Boolean(tracked.ok),
        detail: tracked.ok ? `${saved} ऑर्डरची स्थिती अद्ययावत.` : tracked.message,
      })
    }
    res.json({ ok: steps.every((step) => step.ok), steps })
  } catch (error) {
    steps.push({ name: "Sync to Shipfigo", link: base, ok: false, detail: error.message || "सिंक पूर्ण झाले नाही." })
    res.status(500).json({ ok: false, steps, error: error.message || "सिंक पूर्ण झाले नाही." })
  }
})

app.post("/api/admin/orders/:code/ship", adminAuth, async (req, res) => {
  try {
    const row = await orderRow(req.params.code)
    if (!row) return fail(res, 404, "ऑर्डर सापडली नाही.")
    if (row.shipfigo_order_id) return res.json({ order: adminOrder(row), message: "ही ऑर्डर आधीच Shipfigo वर आहे." })
    const created = await createOnShipfigo(row)
    if (!created.ok) return fail(res, 502, created.message)
    res.json({ order: await freshOrder(req.params.code), message: created.message })
  } catch (error) {
    fail(res, 500, error.message || "Shipfigo ऑर्डर तयार झाली नाही.")
  }
})

app.get("/api/admin/orders/:code/couriers", adminAuth, async (req, res) => {
  try {
    const row = await orderRow(req.params.code)
    if (!row) return fail(res, 404, "ऑर्डर सापडली नाही.")
    const place = await pickWarehouse()
    if (!place.ok) return fail(res, 400, place.message)
    const options = await courierOptions(row, place.warehouse)
    if (!options.ok) return fail(res, 502, options.message)
    res.json({ ...options, from: place.warehouse.zip, to: row.pin_code })
  } catch (error) {
    fail(res, 500, error.message || "कुरिअर तपासता आले नाहीत.")
  }
})

app.post("/api/admin/orders/:code/courier", adminAuth, async (req, res) => {
  const carrierId = String(req.body?.carrierId || "").trim()
  if (!carrierId) return fail(res, 400, "कुरिअर निवडा.")
  try {
    const row = await orderRow(req.params.code)
    if (!row) return fail(res, 404, "ऑर्डर सापडली नाही.")
    if (!row.shipfigo_shipment_id) return fail(res, 400, "आधी Shipfigo वर ऑर्डर तयार करा.")
    if (row.awb_code) return fail(res, 400, "या ऑर्डरला आधीच AWB आहे.")
    const booked = await assignCourier(row.shipfigo_shipment_id, carrierId)
    if (!booked.ok) return fail(res, 502, booked.message)
    await pool.query(
      `UPDATE orders
       SET awb_code = ?, courier_name = ?, label_url = ?, shipfigo_shipment_id = ?, ship_status = 'Ready for pickup',
           status = IF(status = 'paid', 'booked', status)
       WHERE order_code = ?`,
      [booked.awb, booked.courier || null, booked.labelUrl || null, booked.shipmentId, req.params.code],
    )
    res.json({ order: await freshOrder(req.params.code), message: booked.message })
  } catch (error) {
    fail(res, 500, error.message || "कुरिअर नेमता आला नाही.")
  }
})

app.post("/api/admin/orders/:code/label", adminAuth, async (req, res) => {
  try {
    const row = await orderRow(req.params.code)
    if (!row) return fail(res, 404, "ऑर्डर सापडली नाही.")
    if (!row.awb_code && !row.shipfigo_shipment_id) return fail(res, 400, "AWB नंतरच लेबल मिळते.")
    const label = await fetchLabel({ awb: row.awb_code, shipmentId: row.shipfigo_shipment_id })
    if (!label.ok) return fail(res, 502, label.message)
    await pool.query("UPDATE orders SET label_url = ? WHERE order_code = ?", [label.labelUrl, req.params.code])
    res.json({ labelUrl: label.labelUrl, order: await freshOrder(req.params.code) })
  } catch (error) {
    fail(res, 500, error.message || "लेबल मिळाले नाही.")
  }
})

app.post("/api/admin/orders/:code/cancel-shipment", adminAuth, async (req, res) => {
  try {
    const row = await orderRow(req.params.code)
    if (!row) return fail(res, 404, "ऑर्डर सापडली नाही.")
    if (!row.awb_code) return fail(res, 400, "AWB नसलेली शिपमेंट रद्द करता येत नाही.")
    const cancelled = await cancelShipments([row.awb_code])
    if (!cancelled.ok) return fail(res, 502, cancelled.message)
    await pool.query("UPDATE orders SET ship_status = 'Cancellation requested' WHERE order_code = ?", [req.params.code])
    res.json({ order: await freshOrder(req.params.code), message: cancelled.message })
  } catch (error) {
    fail(res, 500, error.message || "शिपमेंट रद्द करता आली नाही.")
  }
})

app.post("/api/shipfigo/webhook", async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {}
  const code = String(body.order_id || body.order_code || body.orderId || "").trim().slice(0, 64)
  const awb = String(body.awb_code || body.awb || body.tracking_number || "").trim().slice(0, 64)
  const statusText = String(body.current_status || body.shipment_status || body.status || "").trim().slice(0, 80)
  if (!code) return fail(res, 400, "ऑर्डर कोड नाही.")
  try {
    const [rows] = await pool.query(
      "SELECT order_code, status FROM orders WHERE order_code = ? OR shipfigo_order_id = ? LIMIT 1",
      [code, code],
    )
    if (!rows.length) return fail(res, 404, "ऑर्डर सापडली नाही.")
    await saveTracks({ [rows[0].order_code]: { status: statusText, awb, trackUrl: "", courier: "" } })
    res.json({ ok: true, orderCode: rows[0].order_code, book: book.code, status: statusText || "updated" })
  } catch (error) {
    fail(res, 500, error.message || "डिलिव्हरी नोंद जतन करता आली नाही.")
  }
})

app.get("/api/admin/orders/:code/track", adminAuth, async (req, res) => {
  try {
    const row = await orderRow(req.params.code)
    if (!row) return fail(res, 404, "ऑर्डर सापडली नाही.")
    if (!row.shipfigo_order_id) return fail(res, 400, "ही ऑर्डर अजून Shipfigo वर नाही.")
    const tracked = await trackByOrderIds([row.order_code])
    if (!tracked.ok) return fail(res, 502, tracked.message || "ट्रॅकिंग मिळाली नाही.")
    const track = tracked.tracks[row.order_code]
    if (!track) return fail(res, 404, "Shipfigo वर या ऑर्डरची ट्रॅकिंग अजून नाही.")
    await saveTracks({ [row.order_code]: track })
    res.json({ tracking: { ...track, label: shipLabel(track.status) }, order: await freshOrder(req.params.code) })
  } catch (error) {
    fail(res, 500, error.message || "ट्रॅकिंग तपासता आली नाही.")
  }
})

app.use((error, _req, res, _next) => {
  if (res.headersSent) return
  fail(res, error.status || 500, "ऑर्डर विनंती वाचता आली नाही. पुन्हा प्रयत्न करा.")
})

ensureShippingColumns()
  .catch((error) => console.error("schema:", error.code || error.message))
  .finally(() => {
    app.listen(port, "127.0.0.1", () => {
      console.log(`Order API on http://127.0.0.1:${port}`)
      startShipfigoTokenRefresh()
    })
  })
