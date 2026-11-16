import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const baseUrl = (process.env.SHIPFIGO_BASE_URL || "https://shipfigo.com/panel/custom/api/v1").replace(/\/$/, "")
const authUrl = process.env.SHIPFIGO_AUTH_URL || `${baseUrl}/auth-token`
const here = path.dirname(fileURLToPath(import.meta.url))
const tokenFile = path.join(here, ".shipfigo-token.json")
const settingsFile = path.join(here, ".shipfigo-settings.json")
const SIX_HOURS = 6 * 60 * 60 * 1000

const BOOK = {
  name: "Main Aur Mera Dhanda",
  title: "मैं और मेरा धंधा",
  sku: "SR-PM03",
  price: 500,
}

let cache = null

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

function readSavedToken() {
  const saved = readJson(tokenFile)
  return saved?.token && saved.until > Date.now() ? saved : null
}

function keepToken(token, expiresAt) {
  const now = Date.now()
  let until = now + SIX_HOURS
  const ends = Date.parse(String(expiresAt || ""))
  if (Number.isFinite(ends) && ends - 60 * 1000 > now) until = Math.min(until, ends - 60 * 1000)
  cache = { token, until, expiresAt: expiresAt || "" }
  fs.writeFileSync(tokenFile, JSON.stringify(cache))
  return cache
}

function clearToken() {
  cache = null
  fs.rmSync(tokenFile, { force: true })
}

function untilText(until) {
  return new Date(until).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

async function readBody(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { message: text.slice(0, 240) }
  }
}

function errorText(data, status) {
  const parts = []
  const main = data?.meta?.message || data?.message || data?.error
  if (main) parts.push(String(main))
  if (data?.errors && typeof data.errors === "object") {
    for (const list of Object.values(data.errors)) parts.push(...[].concat(list).map(String))
  }
  return parts.join(" ") || `Shipfigo ${status}`
}

function bookMessage(raw) {
  const text = String(raw || "")
  if (/authorization failed/i.test(text)) {
    return "Shipfigo ने टोकन नाकारला (Authorization failed). .env मधील username आणि पासवर्ड तपासा."
  }
  return text
}

export function shipfigoBaseUrl() {
  return baseUrl
}

export function shipfigoAuthUrl() {
  return authUrl
}

export function readShipfigoSettings() {
  return readJson(settingsFile) || {}
}

export function saveShipfigoSettings(next) {
  const settings = { ...readShipfigoSettings(), ...next }
  fs.writeFileSync(settingsFile, JSON.stringify(settings))
  return settings
}

export async function shipfigoConnect({ force = false } = {}) {
  const username = process.env.SHIPFIGO_USERNAME || process.env.SHIPFIGO_EMAIL || ""
  const password = process.env.SHIPFIGO_PASSWORD || ""
  if (!username || !password) {
    return { ok: false, message: "Shipfigo username आणि पासवर्ड .env मध्ये नाहीत." }
  }
  if (!force) {
    if (!cache) cache = readSavedToken()
    if (cache?.token && cache.until > Date.now()) {
      return { ok: true, email: username, until: cache.until, message: `टोकन तयार आहे. नवीन टोकन ${untilText(cache.until)} ला.` }
    }
  }

  const response = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, password }),
  })
  const data = await readBody(response)
  if (!response.ok || !data.token) {
    clearToken()
    return { ok: false, email: username, status: response.status, message: bookMessage(errorText(data, response.status)) }
  }
  keepToken(data.token, data.expires_at)
  return { ok: true, email: username, until: cache.until, message: `टोकन मिळाला. नवीन टोकन ${untilText(cache.until)} ला.` }
}

export function startShipfigoTokenRefresh() {
  const renew = async () => {
    try {
      const session = await shipfigoConnect({ force: true })
      console.log(session.ok ? `Shipfigo token renewed until ${new Date(session.until).toISOString()}` : `Shipfigo token: ${session.status || ""} ${session.message}`)
    } catch (error) {
      console.error("Shipfigo token:", error.message)
    }
  }
  cache = readSavedToken()
  if (!cache) renew()
  return setInterval(renew, SIX_HOURS)
}

async function call(pathName, body = {}) {
  const url = `${baseUrl}${pathName}`
  const session = await shipfigoConnect()
  if (!session.ok) return { ok: false, url, message: session.message }
  const send = () => fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: cache.token },
    body: JSON.stringify(body),
  })
  let response = await send()
  let data = await readBody(response)
  if (response.status === 401) {
    const again = await shipfigoConnect({ force: true })
    if (!again.ok) return { ok: false, url, message: again.message }
    response = await send()
    data = await readBody(response)
  }
  const refused = data?.status === 0 || data?.status === "0" || /^fail/i.test(String(data?.status || ""))
  if (!response.ok || refused) {
    return { ok: false, url, status: response.status, message: bookMessage(errorText(data, response.status)), data }
  }
  return { ok: true, url, status: response.status, data }
}

export function parcel(order) {
  const copies = Math.max(1, Number(order.quantity || 1))
  const weight = Number(process.env.SHIPFIGO_BOOK_WEIGHT_KG || 0.4) * copies
  return {
    length: Number(process.env.SHIPFIGO_LENGTH || 22),
    breadth: Number(process.env.SHIPFIGO_BREADTH || 15),
    height: Number(process.env.SHIPFIGO_HEIGHT || 3) * copies,
    weight: Math.round(weight * 1000) / 1000,
  }
}

function orderDate(value) {
  const date = new Date(value || Date.now())
  const safe = Number.isNaN(date.getTime()) ? new Date() : date
  const pad = (number) => String(number).padStart(2, "0")
  return `${safe.getFullYear()}-${pad(safe.getMonth() + 1)}-${pad(safe.getDate())} ${pad(safe.getHours())}:${pad(safe.getMinutes())}`
}

function warehouseRow(place) {
  const address = place.address_attributes || {}
  return {
    id: String(place.warehouse_id || ""),
    name: String(place.name || place.warehouse_id || "Warehouse"),
    contact: String(place.contact_person || ""),
    street: String(address.street_address || ""),
    city: String(address.city || ""),
    state: String(address.state || ""),
    zip: String(address.zip || ""),
  }
}

export async function listWarehouses() {
  const result = await call("/warehouses", {})
  if (!result.ok) return result
  const list = result.data?.payload?.warehouses || []
  return { ...result, warehouses: list.map(warehouseRow).filter((place) => place.id) }
}

export async function createWarehouse(input) {
  const body = {
    name: input.name,
    phone_number: input.phone,
    email: input.email,
    contact_person: input.contact,
    address_attributes: {
      street_address: input.street,
      zip: input.zip,
      city: input.city,
      state: input.state,
      country: "India",
    },
  }
  if (input.gst) body.gst_no = input.gst
  const result = await call("/warehouse", body)
  if (!result.ok) return result
  return { ...result, warehouseId: String(result.data?.payload?.warehouse_id || "") }
}

export async function courierOptions(order, warehouse) {
  const from = String(warehouse.zip || "")
  const to = String(order.pin_code || "")
  const box = parcel(order)
  const [service, rated] = await Promise.all([
    call("/serviceability", { from, to, payment_mode: "prepaid", shipment_type: "forward" }),
    call("/rates", {
      journey_type: "forward",
      origin_pincode: from,
      destination_pincode: to,
      dead_weight: Math.round(box.weight * 1000),
      length: box.length,
      width: box.breadth,
      height: box.height,
      payment_method: "prepaid",
    }),
  ])
  if (!service.ok && !rated.ok) return service
  const rates = new Map()
  for (const item of rated.ok ? rated.data?.result?.serviceable_couriers || [] : []) {
    rates.set(String(item.carrier_id), item)
  }
  const base = service.ok ? service.data?.result?.serviceability_results || [] : [...rates.values()]
  const couriers = base.map((item) => {
    const rate = rates.get(String(item.carrier_id)) || {}
    const total = rate.charges?.total_forward_charges ?? rate.charges?.forward_freight_charges
    return {
      id: String(item.carrier_id),
      name: String(item.carrier_name || rate.carrier_name || item.carrier_id),
      charge: total === undefined ? null : Number(total) + Number(rate.platform_fee || 0),
      pickup: rate.expected_delivery?.pickup || "",
      delivery: rate.expected_delivery?.delivery || "",
    }
  })
  couriers.sort((left, right) => (left.charge ?? Infinity) - (right.charge ?? Infinity))
  return {
    ok: true,
    couriers,
    zone: service.data?.result?.zone || rated.data?.result?.shipment_details?.zone || "",
    weight: box.weight,
    message: couriers.length ? `${couriers.length} कुरिअर उपलब्ध.` : "या पिनकोडसाठी कुरिअर उपलब्ध नाही.",
  }
}

export async function createShipfigoOrder(order, warehouse) {
  if (!["paid", "booked", "shipped", "delivered"].includes(order.status)) {
    return { ok: false, message: `${BOOK.title} प्रीपेड आहे. पेमेंट झाल्यावरच Shipfigo वर ऑर्डर नोंद होते.` }
  }
  if (!warehouse?.id) return { ok: false, message: "आधी Shipping मध्ये पिकअप वेअरहाउस निवडा." }
  const parts = String(order.customer_name || "").trim().split(/\s+/)
  const first = parts.shift() || ""
  const unitPrice = Number(order.unit_price || BOOK.price)
  const units = Number(order.quantity || 1)
  const result = await call("/forward-order", {
    order_id: order.order_code,
    order_date: orderDate(order.created_at),
    billing_customer_name: first,
    billing_last_name: parts.join(" "),
    billing_address: [order.address, order.landmark].filter(Boolean).join(", "),
    billing_city: order.city,
    billing_pincode: String(order.pin_code || ""),
    billing_state: process.env.SHIPFIGO_STATE || "Maharashtra",
    billing_country: "India",
    billing_phone: String(order.phone || ""),
    shipping_is_billing: true,
    print_label: true,
    order_items: [{ name: BOOK.name, sku: BOOK.sku, units, selling_price: unitPrice, discount: 0, tax: 0 }],
    payment_method: "PREPAID",
    sub_total: Number(order.amount || units * unitPrice),
    cod_collectible: 0,
    ...parcel(order),
    pickup_location: warehouse.name,
    warehouse_id: warehouse.id,
  })
  if (!result.ok) return result
  const payload = result.data?.payload || {}
  if (Number(payload.order_created) !== 1) {
    return { ok: false, message: "Shipfigo ने ऑर्डर नोंदली नाही.", data: result.data }
  }
  return {
    ok: true,
    orderId: String(payload.order_id || ""),
    shipmentId: String(payload.shipment_id || ""),
    message: `Shipfigo वर ऑर्डर नोंदली · shipment ${payload.shipment_id || ""}`,
  }
}

export async function assignCourier(shipmentId, carrierId) {
  const result = await call("/forward-order-shipment", { shipment_id: shipmentId, carrier_id: carrierId })
  if (!result.ok) return result
  const payload = result.data?.payload || {}
  if (!payload.awb_code) return { ok: false, message: "कुरिअर नेमला नाही, AWB मिळाला नाही.", data: result.data }
  return {
    ok: true,
    awb: String(payload.awb_code),
    shipmentId: String(payload.shipment_id || shipmentId),
    courier: String(payload.courier_name || ""),
    labelUrl: String(payload.label_url || ""),
    message: `${payload.courier_name || "कुरिअर"} · AWB ${payload.awb_code}`,
  }
}

export async function trackByOrderIds(orderIds) {
  const result = await call("/order-tracking-by-order-id", { order_ids: orderIds })
  if (!result.ok) return result
  const tracks = {}
  for (const [orderId, entry] of Object.entries(result.data?.result || {})) {
    const data = entry?.tracking_data || {}
    const first = (data.shipment_track || [])[0] || {}
    tracks[orderId] = {
      status: String(data.shipment_status || first.current_status || ""),
      awb: String(first.awb_code || ""),
      courier: String(first.courier_display_name || first.courier_name || ""),
      shipmentId: String(first.shipment_id || ""),
      trackUrl: String(data.track_url || ""),
      activities: (data.shipment_track_activities || []).map((step) => ({
        date: String(step.date || ""),
        activity: String(step.activity || ""),
        location: String(step.location || ""),
      })),
    }
  }
  return { ok: true, tracks }
}

export async function fetchLabel({ awb, shipmentId }) {
  const result = await call("/label", awb ? { awb } : { shipment_id: shipmentId })
  if (!result.ok) return result
  const labelUrl = String(result.data?.payload?.label_url || "")
  if (!labelUrl) return { ok: false, message: "लेबल मिळाले नाही." }
  return { ok: true, labelUrl }
}

export async function cancelShipments(awbs) {
  const result = await call("/cancel-order", { awbs: awbs.slice(0, 50) })
  if (!result.ok) return result
  return { ok: true, message: String(result.data?.message || "रद्द करण्याची विनंती पाठवली.") }
}

export async function summaryReport(start, end) {
  const result = await call("/reports", {
    start_date_time: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
    end_date_time: end.toISOString().replace(/\.\d{3}Z$/, "Z"),
    shipment_type: "forward",
  })
  if (!result.ok) return result
  return { ok: true, summary: result.data?.payload?.summary || {} }
}
