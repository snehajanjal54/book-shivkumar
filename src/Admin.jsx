import { useEffect, useState } from "react"
import { book } from "./content"

const STATUSES = ["created", "paid", "booked", "shipped", "delivered", "cancelled"]
const PAID = ["paid", "booked", "shipped", "delivered"]
const TABS = [
  ["created", "New"],
  ["paid", "Ready To Ship"],
  ["booked", "Pending Pickup"],
  ["shipped", "In Transit"],
  ["out", "Out For Delivery"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"],
  ["all", "All"],
]

function outForDelivery(order) {
  return order.status === "shipped" && /out for delivery/i.test(order.shipStatus || "")
}

function inTab(order, tab) {
  if (tab === "all") return true
  if (tab === "none") return false
  if (tab === "out") return outForDelivery(order)
  if (tab === "shipped") return order.status === "shipped" && !outForDelivery(order)
  return order.status === tab
}

function csvCell(value) {
  const text = String(value ?? "")
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

async function adminApi(path, options = {}) {
  const token = sessionStorage.getItem("sr-admin")
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const raw = await response.text()
  let data = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error("सर्व्हरने उत्तर दिले नाही.")
  }
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/admin/login") sessionStorage.removeItem("sr-admin")
    throw new Error(data.error || "विनंती अयशस्वी.")
  }
  return data
}

export default function AdminPage() {
  const [email, setEmail] = useState(() => localStorage.getItem("sr-admin-email") || "testing1232@demo.com")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [hint, setHint] = useState("")
  const [authed, setAuthed] = useState(() => Boolean(sessionStorage.getItem("sr-admin")))
  const [account, setAccount] = useState("")
  const [orders, setOrders] = useState([])
  const [summary, setSummary] = useState({ total: 0, paid: 0, amount: 0 })
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState("overview")
  const [query, setQuery] = useState("")
  const [payFilter, setPayFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [seen, setSeen] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sr-admin-seen") || "[]")
    } catch {
      return []
    }
  })
  const [fresh, setFresh] = useState([])
  const [perPage, setPerPage] = useState(25)
  const [page, setPage] = useState(1)
  const [menu, setMenu] = useState("")
  const [couriers, setCouriers] = useState({})
  const [trackInfo, setTrackInfo] = useState({})
  const [selectedCode, setSelectedCode] = useState("")
  const [popupNote, setPopupNote] = useState("")
  const [syncLine, setSyncLine] = useState("")
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncSteps, setSyncSteps] = useState([])

  useEffect(() => {
    if (!selectedCode) return undefined
    const onKey = (event) => {
      if (event.key === "Escape") setSelectedCode("")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedCode])

  useEffect(() => {
    if (!menu) return undefined
    const close = (event) => {
      if (event.target.closest(".desk-menu")) return
      setMenu("")
    }
    document.addEventListener("mousemove", close)
    return () => document.removeEventListener("mousemove", close)
  }, [menu])

  const load = async () => {
    const data = await adminApi("/api/admin/orders")
    setOrders(data.orders || [])
    setSummary(data.summary || { total: 0, paid: 0, amount: 0 })
  }

  useEffect(() => {
    if (!authed) return undefined
    let stop = false
    load().catch(() => {
      if (!stop) setAuthed(false)
    })
    return () => {
      stop = true
    }
  }, [authed])

  const login = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const data = await adminApi("/api/admin/login", { method: "POST", body: { email, password } })
      sessionStorage.setItem("sr-admin", data.token)
      if (remember) localStorage.setItem("sr-admin-email", email)
      else localStorage.removeItem("sr-admin-email")
      setAccount(data.email)
      setPassword("")
      setAuthed(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const logout = () => {
    sessionStorage.removeItem("sr-admin")
    setAuthed(false)
    setOrders([])
  }

  const replaceOrder = (next) => {
    if (!next?.orderCode) return
    setOrders((prev) => prev.map((order) => (order.orderCode === next.orderCode ? next : order)))
  }

  const run = async (work, onDone) => {
    setBusy(true)
    setPopupNote("")
    try {
      const data = await work()
      if (onDone) onDone(data)
      if (data?.order) replaceOrder(data.order)
      if (data?.message) setPopupNote(data.message)
      return data
    } catch (err) {
      setPopupNote(err.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const createOne = (code) => run(() => adminApi(`/api/admin/orders/${code}/ship`, { method: "POST" }))

  const findCouriers = (code) => run(
    () => adminApi(`/api/admin/orders/${code}/couriers`),
    (data) => setCouriers((prev) => ({ ...prev, [code]: data })),
  )

  const bookCourier = (code, carrierId) => run(
    () => adminApi(`/api/admin/orders/${code}/courier`, { method: "POST", body: { carrierId } }),
    () => setCouriers((prev) => ({ ...prev, [code]: null })),
  )

  const trackOrder = (code) => run(
    () => adminApi(`/api/admin/orders/${code}/track`),
    (data) => setTrackInfo((prev) => ({ ...prev, [code]: data.tracking })),
  )

  const openLabel = async (order) => {
    if (order.labelUrl) {
      window.open(order.labelUrl, "_blank", "noopener")
      return
    }
    const data = await run(() => adminApi(`/api/admin/orders/${order.orderCode}/label`, { method: "POST" }))
    if (data?.labelUrl) window.open(data.labelUrl, "_blank", "noopener")
  }

  const cancelShipment = (code) => {
    if (!window.confirm("ही शिपमेंट Shipfigo वर रद्द करायची?")) return
    run(() => adminApi(`/api/admin/orders/${code}/cancel-shipment`, { method: "POST" }))
  }

  const syncPaid = async (orderCode) => {
    setBusy(true)
    setError("")
    setSyncOpen(true)
    setSyncSteps([])
    try {
      const data = await adminApi("/api/admin/shipfigo/sync", {
        method: "POST",
        body: orderCode ? { orderCode } : {},
      })
      const steps = data.steps || []
      setSyncSteps(steps)
      const failed = steps.find((step) => !step.ok)
      const note = failed ? failed.detail : "Shipfigo sync finished."
      setSyncLine(note)
      setPopupNote(note)
      await load()
    } catch (err) {
      setSyncSteps([{
        name: "Sync to Shipfigo",
        link: "https://shipfigo.com/panel/custom/api/v1",
        ok: false,
        detail: err.message,
      }])
      setSyncLine(err.message)
      setPopupNote(err.message)
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (orderCode, status) => {
    setError("")
    try {
      const data = await adminApi(`/api/admin/orders/${orderCode}`, { method: "PATCH", body: { status } })
      setOrders((prev) => prev.map((order) => (order.orderCode === orderCode ? data.order : order)))
    } catch (err) {
      setError(err.message)
    }
  }

  if (!authed) {
    return (
      <main className="gate">
        <section className="gate-card">
          <img className="gate-logo" src="/logo.png" alt="Selfish Readers" />
          <p className="gate-pill">MERCHANT PORTAL</p>
          <h1>Welcome back</h1>
          <p className="gate-lead">Sign in to manage orders for {book.titleHindi}.</p>
          <form onSubmit={login}>
            <label>
              Email address
              <span className="gate-field">
                <span aria-hidden="true">✉</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="username"
                  required
                />
              </span>
            </label>
            <label>
              Password
              <span className="gate-field">
                <span aria-hidden="true">🔒</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((open) => !open)}>
                  {showPassword ? "🙈" : "👁"}
                </button>
              </span>
            </label>
            <div className="gate-row">
              <label className="gate-check">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                Remember me
              </label>
              <button className="gate-forgot" type="button" onClick={() => setHint("या पुस्तकाच्या डेस्कसाठी दिलेला ईमेल आणि पासवर्ड वापरा.")}>
                Forgot password?
              </button>
            </div>
            {hint ? <p className="gate-hint">{hint}</p> : null}
            {error ? <p className="error">{error}</p> : null}
            <button className="gate-go" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to Dashboard →"}
            </button>
          </form>
          <p className="gate-foot">{book.publisher} · {book.titleHindi}</p>
        </section>
        <aside className="gate-aside">
          <p className="gate-kicker">BOOK ORDER DESK</p>
          <h2>{book.titleHindi}</h2>
          <p>{book.subtitle}. {book.author}.</p>
          <article className="gate-sample">
            <img src="/cover-art.png" alt="" />
            <div>
              <strong>{book.code}</strong>
              <span>₹{book.price}</span>
              <span>{book.languageNote}</span>
              <span>ISBN {book.isbn}</span>
            </div>
          </article>
          <ul>
            <li><b>Orders</b><span>Every copy ordered for this book is listed on the desk.</span></li>
            <li><b>Ready to ship</b><span>Paid orders wait here until they are marked shipped.</span></li>
            <li><b>One price</b><span>Printed price ₹{book.price}. Product code {book.code}.</span></li>
            <li><b>{book.publisher}</b><span>{book.ebook}</span></li>
          </ul>
        </aside>
      </main>
    )
  }

  const merchant = (account || email || "merchant").split("@")[0]
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const collected = orders
    .filter((order) => PAID.includes(order.status))
    .reduce((sum, order) => sum + Number(order.amount || 0), 0)
  const counts = Object.fromEntries(STATUSES.map((status) => [status, orders.filter((order) => order.status === status).length]))
  const pct = (count) => (orders.length ? ((count / orders.length) * 100).toFixed(1) : "0.0")
  const waitingSync = orders.filter((order) => order.status === "paid" && !order.shipfigoOrderId).length
  const syncedCount = orders.filter((order) => order.shipfigoOrderId).length
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1)
  const inMonth = orders.filter((order) => new Date(order.createdAt) >= monthStart)
  const monthPaid = inMonth.filter((order) => PAID.includes(order.status))
  const monthAmount = monthPaid.reduce((sum, order) => sum + Number(order.amount || 0), 0)
  const todayOrders = orders.filter((order) => new Date(order.createdAt) >= dayStart)
  const districts = [...orders.reduce((map, order) => {
    const key = order.district || order.city || "—"
    const row = map.get(key) || { orders: 0, delivered: 0, cancelled: 0 }
    row.orders += 1
    if (order.status === "shipped" || order.status === "delivered") row.delivered += 1
    if (order.status === "cancelled") row.cancelled += 1
    map.set(key, row)
    return map
  }, new Map())].sort((left, right) => right[1].orders - left[1].orders)
  const needle = query.trim().toLowerCase()
  const matches = (order) => {
    if (needle && ![order.orderCode, order.shipfigoOrderId, order.awb, order.name, order.city, order.district, order.phone].join(" ").toLowerCase().includes(needle)) return false
    if (payFilter === "prepaid" && order.pay !== "razorpay") return false
    if (payFilter === "unpaid" && order.status !== "created") return false
    return true
  }
  const searched = orders.filter(matches)
  const tabCounts = Object.fromEntries(TABS.map(([key]) => [key, searched.filter((order) => inTab(order, key)).length]))
  const shown = searched.filter((order) => inTab(order, statusFilter))
  const pages = Math.max(1, Math.ceil(shown.length / perPage))
  const current = Math.min(page, pages)
  const pageRows = shown.slice((current - 1) * perPage, current * perPage)
  const openOrders = ({ pay = "all", status = "all", text = "" } = {}) => {
    setPayFilter(pay)
    setStatusFilter(status)
    setQuery(text)
    setPage(1)
    setMenu("")
    setView("orders")
  }
  const exportOrders = () => {
    const head = ["Order ID", "Placed", "Customer", "Phone", "Address", "City", "District", "PIN", "Copies", "Amount", "Status", "Shipfigo order", "Courier", "AWB", "Shipping status"]
    const rows = shown.map((order) => [
      order.orderCode,
      new Date(order.createdAt).toLocaleString("en-IN"),
      order.name,
      order.phone,
      [order.address, order.landmark].filter(Boolean).join(", "),
      order.city,
      order.district,
      order.pin,
      order.qty,
      order.amount,
      order.status,
      order.shipfigoOrderId,
      order.courier,
      order.awb,
      order.shipStatus,
    ])
    const csv = [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")
    const link = document.createElement("a")
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }))
    link.download = `orders-${book.code}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const selected = orders.find((order) => order.orderCode === selectedCode) || null
  const placed = (value) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  }
  const statusLabel = {
    created: "New",
    paid: "Ready to ship",
    booked: "Courier booked",
    shipped: "In transit",
    delivered: "Delivered",
    cancelled: "Cancelled",
  }

  const noteFor = (order) => {
    if (order.status === "created") return ["💳", "Payment pending"]
    if (order.status === "paid") return order.shipfigoOrderId ? ["🧾", "On Shipfigo · book a courier"] : ["📦", "Paid · waiting to sync"]
    if (order.status === "booked") return ["🚚", `Courier booked${order.awb ? ` · ${order.awb}` : ""}`]
    if (order.status === "shipped") return outForDelivery(order) ? ["🛵", "Out for delivery"] : ["🚛", "In transit"]
    if (order.status === "delivered") return ["✅", "Delivered"]
    return ["✖", "Cancelled"]
  }
  const notes = [...orders]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(0, 10)
    .map((order) => {
      const [icon, title] = noteFor(order)
      return { key: `${order.orderCode}:${order.status}:${order.shipStatus}`, code: order.orderCode, name: order.name, icon, title, time: order.createdAt }
    })
  const unseen = notes.filter((note) => !seen.includes(note.key))
  const openBell = () => {
    if (menu === "bell") {
      setMenu("")
      return
    }
    setFresh(unseen.map((note) => note.key))
    const next = [...new Set([...seen, ...notes.map((note) => note.key)])].slice(-200)
    setSeen(next)
    localStorage.setItem("sr-admin-seen", JSON.stringify(next))
    setMenu("bell")
  }

  const tabLabel = (order) => (outForDelivery(order) ? "Out for delivery" : statusLabel[order.status] || order.status)

  const orderList = (
    <div className="order-wrap">
      <table className="desk-table order-grid order-table">
        <thead>
          <tr>
            <th>ORDER ID</th>
            <th>CUSTOMER DETAILS</th>
            <th>SHIPPING DETAILS</th>
            <th>PACKAGE DETAILS</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((order) => (
            <tr key={order.orderCode} onClick={() => { setPopupNote(""); setSelectedCode(order.orderCode) }}>
              <td>
                <strong className="order-id">{order.orderCode}</strong>
                <small>{placed(order.createdAt)}</small>
                {order.shipfigoOrderId ? <small className="order-sync">● {order.shipfigoOrderId}</small> : <small>Not on Shipfigo</small>}
              </td>
              <td>
                <strong>{order.name}</strong>
                <small>{order.phone}</small>
                <small>{order.city}{order.district ? `, ${order.district}` : ""} · {order.pin}</small>
              </td>
              <td>
                <strong>{order.courier || "—"}</strong>
                {order.awb ? <small>AWB <b className="order-awb">{order.awb}</b></small> : <small>{order.shipfigoOrderId ? "Courier not booked" : "—"}</small>}
                {order.shipStatus ? <small>{order.shipStatus}</small> : null}
              </td>
              <td>
                <small>Dead: {order.parcel?.weight ?? "—"} kg · {order.qty} {order.qty > 1 ? "copies" : "copy"}</small>
                {order.parcel ? <small>Size: {order.parcel.length}×{order.parcel.breadth}×{order.parcel.height} cm</small> : null}
                <strong>₹{Number(order.amount).toFixed(2)}</strong>
                <span className={order.status === "created" ? "pay-tag unpaid" : "pay-tag"}>{order.status === "created" ? "Not paid" : "Prepaid"}</span>
              </td>
              <td><span className={`tag tag-${order.status}`}>{tabLabel(order)}</span></td>
            </tr>
          ))}
          {pageRows.length === 0 ? <tr><td colSpan="5" className="order-empty">या टॅबमध्ये ऑर्डर नाही.</td></tr> : null}
        </tbody>
      </table>
    </div>
  )

  return (
    <main className="desk">
      <aside className="desk-side">
        <button className="desk-brand" type="button" onClick={() => setView("overview")}>
          <img src="/logo.png" alt="" />
          <span>
            <strong>Selfish Readers</strong>
            <em>{book.titleHindi}</em>
          </span>
        </button>
        <nav>
          <button className={view === "overview" ? "on" : ""} type="button" onClick={() => setView("overview")}>
            <i aria-hidden="true">▦</i>Dashboard
          </button>
          <button className={view === "orders" ? "on" : ""} type="button" onClick={() => setView("orders")}>
            <i aria-hidden="true">☰</i>Orders
            {waitingSync ? <b className="nav-count">{waitingSync}</b> : null}
          </button>
          <button className="nav-sync" type="button" onClick={() => syncPaid()} disabled={busy}>
            <i aria-hidden="true">⇅</i>{busy ? "Syncing…" : "Sync to Shipfigo"}
          </button>
          <button className="nav-out" type="button" onClick={logout}>
            <i aria-hidden="true">⎋</i>Logout
          </button>
        </nav>
        <div className="desk-menu" onMouseLeave={() => setMenu("")}>
          <button className="desk-user" type="button" onClick={() => setMenu(menu === "account" ? "" : "account")}>
            <b>{merchant.slice(0, 1).toUpperCase()}</b>
            <span>
              <strong>{merchant}</strong>
              <em>Merchant · {book.code}</em>
            </span>
          </button>
          {menu === "account" ? (
            <div className="desk-drop">
              <p>{account || email}</p>
              <button type="button" onClick={() => { setMenu(""); setView("book") }}>Book</button>
              <button type="button" onClick={logout}>Logout</button>
            </div>
          ) : null}
        </div>
        <div className="desk-wallet">
          <span>WALLET BALANCE</span>
          <strong>₹{collected.toLocaleString("en-IN")}</strong>
          <small>Paid copies of {book.titleHindi}</small>
          <small>{syncedCount} synced · {waitingSync} waiting</small>
        </div>
      </aside>

      <section className="desk-main">
        <div className="desk-welcome">
          <div className="welcome-copy">
            <h1>
              <i className="welcome-wave" aria-hidden="true">👋</i>
              Welcome back, {merchant} <span>MERCHANT</span>
            </h1>
            <p>{book.publisher} · {book.titleHindi} · {today}</p>
          </div>
          <img className="welcome-book" src="/cover-art.png" alt="" />
        </div>

        <header className="desk-bar">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
              if (event.target.value) setView("orders")
            }}
            placeholder="Search Order By AWB Number & Order Id"
          />
          <div className="desk-menu" onMouseLeave={() => setMenu("")}>
            <button className="desk-chip" type="button" onClick={() => setMenu(menu === "pay" ? "" : "pay")}>
              {payFilter === "unpaid" ? "Unpaid" : "Prepaid"}
            </button>
            {menu === "pay" ? (
              <div className="desk-drop">
                <button type="button" onClick={() => openOrders()}>All orders</button>
                <button type="button" onClick={() => openOrders({ pay: "prepaid" })}>Prepaid · Razorpay</button>
                <button type="button" onClick={() => openOrders({ pay: "unpaid" })}>Not paid yet</button>
              </div>
            ) : null}
          </div>
          <div className="desk-menu" onMouseLeave={() => setMenu("")}>
            <button className="desk-bell" type="button" aria-label={`Notifications, ${unseen.length} new`} onClick={openBell}>
              <span aria-hidden="true">🔔</span>
              {unseen.length ? <b>{unseen.length > 9 ? "9+" : unseen.length}</b> : null}
            </button>
            {menu === "bell" ? (
              <div className="desk-drop bell-drop">
                <header>
                  <strong>Notifications</strong>
                  <small>{book.titleHindi}</small>
                </header>
                {notes.map((note) => (
                  <button
                    key={note.key}
                    type="button"
                    className={fresh.includes(note.key) ? "bell-item new" : "bell-item"}
                    onClick={() => { setMenu(""); setPopupNote(""); setSelectedCode(note.code) }}
                  >
                    <i aria-hidden="true">{note.icon}</i>
                    <span>
                      <strong>{note.title}</strong>
                      <small>{note.code} · {note.name}</small>
                      <small>{placed(note.time)}</small>
                    </span>
                  </button>
                ))}
                {notes.length === 0 ? <p>अजून सूचना नाहीत.</p> : null}
              </div>
            ) : null}
          </div>
          <div className="desk-menu" onMouseLeave={() => setMenu("")}>
            <button className="desk-who" type="button" onClick={() => setMenu(menu === "who" ? "" : "who")}>
              <i className="desk-avatar" aria-hidden="true">{merchant.slice(0, 1).toUpperCase()}</i>
              <span>
                <strong>{merchant}</strong>
                <small>Admin</small>
              </span>
            </button>
            {menu === "who" ? (
              <div className="desk-drop who-drop">
                <header>
                  <i className="desk-avatar big" aria-hidden="true">{merchant.slice(0, 1).toUpperCase()}</i>
                  <span>
                    <strong>{merchant}</strong>
                    <small>{account || email}</small>
                    <small>Admin · {book.publisher}</small>
                  </span>
                </header>
                <button type="button" onClick={() => { setMenu(""); setView("book") }}>Book details</button>
                <button type="button" onClick={logout}>Logout</button>
              </div>
            ) : null}
          </div>
        </header>

        {error ? <p className="error">{error}</p> : null}

        {view === "overview" ? (
          <>
            <section className="desk-panel ship-sync">
              <div>
                <h2>Shipfigo</h2>
                <p>{waitingSync} paid orders waiting · {syncedCount} already synced</p>
                {syncLine ? <p className="admin-note">{syncLine}</p> : null}
              </div>
            </section>

            <div className="desk-metrics">
              <button type="button" onClick={() => openOrders({ pay: "prepaid" })}>
                <span>COLLECTED</span>
                <strong>₹{collected.toLocaleString("en-IN")}</strong>
                <small>Paid copies of {book.titleHindi}</small>
              </button>
              <button type="button" onClick={() => openOrders()}>
                <span>TOTAL ORDERS</span>
                <strong>{summary.total}</strong>
                <small>{book.code} · ISBN {book.isbn}</small>
              </button>
              <button type="button" onClick={() => openOrders({ status: "paid" })}>
                <span>READY TO SHIP</span>
                <strong>{counts.paid}</strong>
                <small>Prepaid and waiting</small>
              </button>
              <button type="button" onClick={() => openOrders({ status: "paid" })}>
                <span>WAITING TO SYNC</span>
                <strong>{waitingSync}</strong>
                <small>Paid, not on Shipfigo yet</small>
              </button>
            </div>

            <div className="desk-metrics status-row">
              <button type="button" onClick={() => openOrders({ status: "created" })}>
                <span>NEW</span>
                <strong>{counts.created}</strong>
                <small>{pct(counts.created)}%</small>
              </button>
              <button type="button" onClick={() => openOrders({ status: "paid" })}>
                <span>READY TO SHIP</span>
                <strong>{counts.paid}</strong>
                <small>{pct(counts.paid)}%</small>
              </button>
              <button type="button" onClick={() => openOrders({ status: "booked" })}>
                <span>COURIER BOOKED</span>
                <strong>{counts.booked}</strong>
                <small>{pct(counts.booked)}%</small>
              </button>
              <button type="button" onClick={() => openOrders({ status: "shipped" })}>
                <span>IN TRANSIT</span>
                <strong>{counts.shipped}</strong>
                <small>{pct(counts.shipped)}%</small>
              </button>
              <button type="button" onClick={() => openOrders({ status: "delivered" })}>
                <span>DELIVERED</span>
                <strong>{counts.delivered}</strong>
                <small>{pct(counts.delivered)}%</small>
              </button>
              <button type="button" onClick={() => openOrders({ status: "cancelled" })}>
                <span>CANCELLED</span>
                <strong>{counts.cancelled}</strong>
                <small>{pct(counts.cancelled)}%</small>
              </button>
            </div>

            <div className="desk-split">
              <article className="desk-panel">
                <h2>TODAY · {book.code}</h2>
                <p>{todayOrders.length} orders today · ₹{todayOrders.filter((order) => PAID.includes(order.status)).reduce((sum, order) => sum + Number(order.amount || 0), 0).toLocaleString("en-IN")} collected</p>
                <p>This month · {inMonth.length} orders · ₹{monthAmount.toLocaleString("en-IN")}</p>
              </article>
              <article className="desk-panel">
                <h2>TOP DELIVERY DISTRICTS</h2>
                <table className="desk-table">
                  <thead><tr><th>DISTRICT</th><th>ORDERS</th><th>SHIPPED</th></tr></thead>
                  <tbody>
                    {districts.slice(0, 5).map(([name, row]) => (
                      <tr key={name} onClick={() => openOrders({ text: name })}>
                        <td>{name}</td><td>{row.orders}</td><td>{row.delivered}</td>
                      </tr>
                    ))}
                    {districts.length === 0 ? <tr><td colSpan="3">No orders yet</td></tr> : null}
                  </tbody>
                </table>
              </article>
            </div>

            <section className="desk-panel">
              <h2>LATEST ORDERS</h2>
              <p>Open a row for the full details.</p>
              <table className="desk-table order-grid">
                <thead>
                  <tr><th>ORDER</th><th>CUSTOMER</th><th>PLACE</th><th>AMOUNT</th><th>STATUS</th><th>SHIPFIGO</th></tr>
                </thead>
                <tbody>
                  {orders.slice(0, 6).map((order) => (
                    <tr key={order.orderCode} onClick={() => { setPopupNote(""); setSelectedCode(order.orderCode) }}>
                      <td><strong>{order.orderCode}</strong></td>
                      <td>{order.name}</td>
                      <td>{order.city}</td>
                      <td>₹{order.amount}</td>
                      <td><span className={`tag tag-${order.status}`}>{statusLabel[order.status] || order.status}</span></td>
                      <td>{order.shipfigoOrderId ? <>Synced<small>{order.shipStatus}</small></> : "Not synced"}</td>
                    </tr>
                  ))}
                  {orders.length === 0 ? <tr><td colSpan="6">No orders yet</td></tr> : null}
                </tbody>
              </table>
            </section>
          </>
        ) : null}

        {view === "orders" ? (
          <section className="desk-panel orders-page">
            <header className="orders-top">
              <h2>Orders · {book.titleHindi}</h2>
              <div className="orders-tools">
                <button className="add-order" type="button" onClick={() => { window.location.hash = "order" }}>＋ Add Order</button>
                <div className="desk-menu" onMouseLeave={() => setMenu("")}>
                  <button type="button" onClick={() => setMenu(menu === "filter" ? "" : "filter")}>
                    ⛃ Filter{payFilter !== "all" ? " ·1" : ""}
                  </button>
                  {menu === "filter" ? (
                    <div className="desk-drop">
                      <button type="button" onClick={() => { setPayFilter("all"); setPage(1); setMenu("") }}>All payments</button>
                      <button type="button" onClick={() => { setPayFilter("prepaid"); setPage(1); setMenu("") }}>Prepaid · Razorpay</button>
                      <button type="button" onClick={() => { setPayFilter("unpaid"); setPage(1); setMenu("") }}>Not paid yet</button>
                    </div>
                  ) : null}
                </div>
                <button type="button" onClick={exportOrders} disabled={shown.length === 0}>⇩ Export</button>
                <button type="button" onClick={() => openOrders()}>↺ Reset</button>
              </div>
            </header>

            <nav className="order-tabs" aria-label="Order status">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={statusFilter === key ? "on" : ""}
                  onClick={() => { setStatusFilter(key); setPage(1) }}
                >
                  {label}
                  <b>{tabCounts[key]}</b>
                </button>
              ))}
            </nav>

            {syncLine ? <p className="admin-note">{syncLine}</p> : null}

            <div className="order-card">
              <div className="order-controls">
                <label>
                  Show
                  <select value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }}>
                    {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                  entries
                </label>
                <input
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setPage(1) }}
                  placeholder="Search Order ID, Customer, Phone"
                />
              </div>
              {orderList}
              <footer className="order-pager">
                <span>
                  {shown.length === 0 ? "Showing 0 entries" : `Showing ${(current - 1) * perPage + 1} to ${Math.min(current * perPage, shown.length)} of ${shown.length} entries`}
                </span>
                <div>
                  <button type="button" onClick={() => setPage(current - 1)} disabled={current <= 1}>Previous</button>
                  <b>{current} / {pages}</b>
                  <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages}>Next</button>
                </div>
              </footer>
            </div>
          </section>
        ) : null}

        {view === "book" ? (
          <section className="desk-panel admin-book">
            <img src="/cover-art.png" alt={book.titleFull} />
            <div>
              <p className="eyebrow">{book.publisher}</p>
              <h2>{book.titleHindi}</h2>
              <p>{book.subtitle}</p>
              <p>{book.author}</p>
              <p>{book.authorEn} · {book.authorRole}</p>
              <dl className="admin-facts">
                <div><dt>किंमत</dt><dd>₹{book.price}</dd></div>
                <div><dt>ISBN</dt><dd>{book.isbn}</dd></div>
                <div><dt>कोड</dt><dd>{book.code}</dd></div>
                <div><dt>भाषा</dt><dd>{book.language}</dd></div>
                <div><dt>प्रकाशक</dt><dd>{book.publisher}</dd></div>
                <div><dt>ई-बुक</dt><dd>{book.ebook}</dd></div>
              </dl>
            </div>
          </section>
        ) : null}

      </section>
      {syncOpen ? (
        <div className="order-pop sync-pop" onClick={() => setSyncOpen(false)}>
          <section className="order-sheet" role="dialog" aria-modal="true" aria-labelledby="sync-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p>Sync to Shipfigo · {book.titleHindi}</p>
                <h2 id="sync-title">{busy ? "Syncing…" : "Sync result"}</h2>
              </div>
              <button type="button" onClick={() => setSyncOpen(false)}>Close</button>
            </header>
            <ol className="sync-steps">
              {syncSteps.length === 0 ? <li>टोकन, वेअरहाउस, ऑर्डर आणि ट्रॅकिंग तपासत आहे…</li> : null}
              {syncSteps.map((step) => (
                <li key={step.name} className={step.ok ? "ok" : "bad"}>
                  <strong>{step.ok ? "Done" : "Waiting"} · {step.name}</strong>
                  <span>{step.detail}</span>
                  {step.link ? <small>{step.link}</small> : null}
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}
      {selected ? (
        <div className="order-pop" onClick={() => setSelectedCode("")}>
          <section className="order-sheet" role="dialog" aria-modal="true" aria-labelledby="order-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p>Order details · {book.titleHindi}</p>
                <h2 id="order-title">{selected.orderCode}</h2>
              </div>
              <button type="button" onClick={() => setSelectedCode("")}>Close</button>
            </header>
            <div className="order-facts">
              <article>
                <h3>CUSTOMER</h3>
                <dl>
                  <div><dt>Name</dt><dd>{selected.name}</dd></div>
                  <div><dt>Mobile</dt><dd>{selected.phone}</dd></div>
                  <div><dt>Placed</dt><dd>{placed(selected.createdAt)}</dd></div>
                </dl>
              </article>
              <article>
                <h3>DELIVERY</h3>
                <dl>
                  <div><dt>Street</dt><dd>{selected.address}</dd></div>
                  <div><dt>Landmark</dt><dd>{selected.landmark || "—"}</dd></div>
                  <div><dt>City</dt><dd>{selected.city}</dd></div>
                  <div><dt>Taluka</dt><dd>{selected.taluka || "—"}</dd></div>
                  <div><dt>District</dt><dd>{selected.district}</dd></div>
                  <div><dt>PIN</dt><dd>{selected.pin}</dd></div>
                </dl>
              </article>
              <article>
                <h3>BOOK</h3>
                <dl>
                  <div><dt>Title</dt><dd>{book.titleFull}</dd></div>
                  <div><dt>Code</dt><dd>{book.code}</dd></div>
                  <div><dt>ISBN</dt><dd>{book.isbn}</dd></div>
                  <div><dt>Copies</dt><dd>{selected.qty}</dd></div>
                  <div><dt>Price</dt><dd>₹{selected.unitPrice || book.price}</dd></div>
                  <div><dt>Amount</dt><dd>₹{selected.amount}</dd></div>
                </dl>
              </article>
              <article>
                <h3>PAYMENT · SHIPFIGO</h3>
                <dl>
                  <div><dt>Payment</dt><dd>Prepaid · Razorpay</dd></div>
                  <div><dt>Payment id</dt><dd>{selected.paymentId || "—"}</dd></div>
                  <div><dt>Status</dt><dd>{statusLabel[selected.status] || selected.status}</dd></div>
                  <div><dt>Shipfigo</dt><dd>{selected.shipfigoOrderId || "Not synced"}</dd></div>
                  <div><dt>Shipment</dt><dd>{selected.shipmentId || "—"}</dd></div>
                  <div><dt>Courier</dt><dd>{selected.courier || "—"}</dd></div>
                  <div><dt>AWB</dt><dd>{selected.awb || "—"}</dd></div>
                  <div><dt>Shipping</dt><dd>{selected.shipStatus || "—"}</dd></div>
                </dl>
              </article>
            </div>

            <section className="ship-flow">
              <h3>SHIPFIGO</h3>
              <ol>
                <li className={selected.shipfigoOrderId ? "done" : ""}>
                  <strong>6a · Create order</strong>
                  {selected.shipfigoOrderId
                    ? <span>{selected.shipfigoOrderId}</span>
                    : <button type="button" onClick={() => createOne(selected.orderCode)} disabled={busy || !PAID.includes(selected.status)}>Create on Shipfigo</button>}
                </li>
                <li className={selected.awb ? "done" : ""}>
                  <strong>6b · Courier &amp; AWB</strong>
                  {selected.awb
                    ? <span>{selected.courier} · {selected.awb}</span>
                    : <button type="button" onClick={() => findCouriers(selected.orderCode)} disabled={busy || !selected.shipmentId}>Check couriers &amp; rates</button>}
                </li>
                <li className={selected.labelUrl ? "done" : ""}>
                  <strong>10 · Label</strong>
                  <button type="button" onClick={() => openLabel(selected)} disabled={busy || !selected.awb}>Open label</button>
                </li>
                <li>
                  <strong>9b · Tracking</strong>
                  <button type="button" onClick={() => trackOrder(selected.orderCode)} disabled={busy || !selected.shipfigoOrderId}>Refresh tracking</button>
                </li>
              </ol>

              {couriers[selected.orderCode]?.couriers ? (
                <div className="courier-list">
                  <p>PIN {couriers[selected.orderCode].from} → {couriers[selected.orderCode].to} · {couriers[selected.orderCode].weight} kg{couriers[selected.orderCode].zone ? ` · ${couriers[selected.orderCode].zone}` : ""}</p>
                  {couriers[selected.orderCode].couriers.map((item) => (
                    <div key={item.id}>
                      <span>
                        <strong>{item.name}</strong>
                        {item.delivery ? <small>Delivery by {item.delivery}</small> : null}
                      </span>
                      <b>{item.charge === null ? "—" : `₹${item.charge.toFixed(2)} + GST`}</b>
                      <button type="button" onClick={() => bookCourier(selected.orderCode, item.id)} disabled={busy}>Book</button>
                    </div>
                  ))}
                  {couriers[selected.orderCode].couriers.length === 0 ? <p>या पिनकोडसाठी कुरिअर उपलब्ध नाही.</p> : null}
                </div>
              ) : null}

              {trackInfo[selected.orderCode] ? (
                <div className="track-list">
                  <p>
                    <strong>{trackInfo[selected.orderCode].label || trackInfo[selected.orderCode].status}</strong>
                    {trackInfo[selected.orderCode].trackUrl ? <a href={trackInfo[selected.orderCode].trackUrl} target="_blank" rel="noreferrer">Open tracking page</a> : null}
                  </p>
                  <ul>
                    {trackInfo[selected.orderCode].activities.map((step) => (
                      <li key={`${step.date}-${step.activity}`}><b>{step.activity}</b><span>{step.location} · {step.date}</span></li>
                    ))}
                    {trackInfo[selected.orderCode].activities.length === 0 ? <li>अजून हालचाल नोंदलेली नाही.</li> : null}
                  </ul>
                </div>
              ) : null}
            </section>

            <div className="order-actions">
              <label>
                Status
                <select value={selected.status} onChange={(event) => setStatus(selected.orderCode, event.target.value)}>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>{statusLabel[status]}</option>
                  ))}
                </select>
              </label>
              {selected.awb ? (
                <button type="button" className="quiet" onClick={() => cancelShipment(selected.orderCode)} disabled={busy}>
                  Cancel shipment
                </button>
              ) : null}
            </div>
            {popupNote ? <p className="admin-note">{popupNote}</p> : null}
          </section>
        </div>
      ) : null}
    </main>
  )
}
