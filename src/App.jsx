
import { useEffect, useMemo, useRef, useState } from "react";
import AdminPage from "./Admin";
import {
  aboutCards,
  audience,
  book,
  closing,
  experience,
  hook,
  intro,
  marquee,
  observations,
  pillars,
  points,
  questions,
  roles,
  reviews,
  signoff,
  ticker,
  viewpoint,
  who,
} from "./content";

// GitHub Pages compatible image paths
const asset = (name) => `${import.meta.env.BASE_URL}${name}`;

const PAGES = ["order", "privacy", "shipping", "terms", "admin"];
const YEAR = new Date().getFullYear();

function useHashPage() {
  const read = () => {
    const hash = window.location.hash.replace("#", "");
    return PAGES.includes(hash) ? hash : "home";
  };
  const [page, setPage] = useState(read);

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (PAGES.includes(hash)) {
        setPage(hash);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setPage("home");
        if (hash) {
          setTimeout(() => {
            document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 40);
        }
      }
    };
    window.addEventListener("hashchange", onHash);
    const hash = window.location.hash.replace("#", "");
    if (hash && !PAGES.includes(hash)) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (hash) => {
    const same = window.location.hash === `#${hash}`;
    if (!same) window.location.hash = hash;
    if (PAGES.includes(hash)) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, same ? 0 : 40);
  };

  return { page, go };
}

function CoverFace() {
  return (
    <div className="face front">
      <div className="band" />
      <div className="bubble">
        <p className="words">
          <span className="c1">मैं</span>
          <span className="c2">और</span>
          <span className="c3">मेरा</span>
          <span className="c4">धंधा</span>
        </p>
        <p className="mini">{book.subtitle}</p>
      </div>
      <img className="art" src={asset("cover-art.png")} alt="" />
      <p className="byline">{book.author}</p>
      <div className="brandrow">
        <img src={asset("logo.png")} alt="Selfish Readers" />
      </div>
      <div className="band" />
    </div>
  );
}

function Volume() {
  return (
    <div className="volume">
      <div className="pageblock" />
      <CoverFace />
    </div>
  );
}

function BookStack({ tilt }) {
  const stand = `rotateY(${-26 + tilt.x * 8}deg) rotateX(${7 + tilt.y * -5}deg)`;
  return (
    <div className="stack">
      <div className="floor-shadow" />
      <div className="pose lying">
        <Volume />
      </div>
      <div className="pose standing" style={{ transform: stand }}>
        <Volume />
      </div>
    </div>
  );
}

function slotOf(index, active, total) {
  let delta = index - active;
  if (delta > total / 2) delta -= total;
  if (delta < -total / 2) delta += total;
  return delta;
}

const GALLERY = ["front", "back", "angle", "lean", "tilt"];

function ShotScene({ kind }) {
  if (kind === "back") {
    return (
      <div className="scene scene-back">
        <img src={asset("back-cover.png")} alt="मागील मुखपृष्ठ" />
      </div>
    );
  }
  return (
    <div className={`scene scene-${kind}`}>
      <div className="photo-book">
        <Volume />
      </div>
    </div>
  );
}

function BookFlow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return undefined;
    const place = { index: 0, dir: 1 };
    const id = setInterval(() => {
      let next = place.index + place.dir;
      if (next >= GALLERY.length || next < 0) {
        place.dir *= -1;
        next = place.index + place.dir;
      }
      place.index = next;
      setActive(next);
    }, 3400);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="gallery" aria-label="पुस्तकाची छायाचित्रे">
      <div className="flow">
        {GALLERY.map((kind, index) => (
          <div
            key={kind}
            className="shot"
            data-slot={slotOf(index, active, GALLERY.length)}
          >
            <ShotScene kind={kind} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Header({ go, theme, setTheme }) {
  const [menu, setMenu] = useState(false);
  const visit = (hash) => {
    setMenu(false);
    go(hash);
  };
  return (
    <header className="header">
      <button className="brand" onClick={() => visit("top")}>
        <img src={asset("logo.png")} alt="लोगो" />
        <div>
          <strong>{book.titleHindi}</strong>
          <span>{book.publisher}</span>
        </div>
      </button>
      <div className="nav-links">
        <nav className="nav">
          <button onClick={() => visit("about")}>पुस्तक</button>
          <button onClick={() => visit("reviews")}>प्रतिक्रिया</button>
        </nav>
        <button
          className="menu-btn"
          aria-label="मेनू"
          aria-expanded={menu}
          onClick={() => setMenu((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <button
          className="theme-switch"
          aria-label="थीम बदला"
          title="डार्क / लाइट थीम"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <span className="tt-thumb">
            <span className="tt-sun">☀️</span>
            <span className="tt-moon">🌙</span>
          </span>
        </button>
        <button className="cta nav-order" onClick={() => visit("order")}>
          <span className="ic">🛒</span>
          <span className="long">ऑर्डर करा — ₹{book.price}</span>
        </button>
      </div>
      {menu ? (
        <div className="menu-panel">
          <button onClick={() => visit("about")}>पुस्तक</button>
          <button onClick={() => visit("reviews")}>प्रतिक्रिया</button>
          <button onClick={() => visit("order")}>ऑर्डर करा — ₹{book.price}</button>
        </div>
      ) : null}
    </header>
  );
}

function ReviewCard({ item }) {
  return (
    <article className="review-card">
      <div className="stars" aria-label="पाच तारे">★★★★★</div>
      <span className="qmark" aria-hidden="true">”</span>
      <p>{item.text}</p>
      <div className="reviewer">
        <span className="avatar">{item.name.slice(0, 1)}</span>
        <div>
          <strong>{item.name}</strong>
          <em>{item.city}</em>
        </div>
      </div>
    </article>
  );
}

function useInView() {
  const ref = useRef(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (on) return undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let stop = false;
    const tick = () => {
      if (stop) return;
      const el = ref.current;
      if (!el) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const box = el.getBoundingClientRect();
      const visible = box.top < window.innerHeight * 0.92 && box.bottom > 40;
      if (reduce || visible) {
        setOn(true);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      stop = true;
      cancelAnimationFrame(frame);
    };
  }, [on]);

  return [ref, on];
}

function Home({ go }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [aboutRef, aboutOn] = useInView();
  const [detailRef, detailOn] = useInView();
  const [pillarRef, pillarOn] = useInView();

  const onMove = (event) => {
    if (window.matchMedia("(max-width: 980px)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTilt({
      x: (event.clientX - rect.left) / rect.width - 0.5,
      y: (event.clientY - rect.top) / rect.height - 0.5,
    });
  };

  return (
    <main id="top">
      <section className="hero">
        <div className="dust" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              style={{
                left: `${8 + ((i * 17) % 84)}%`,
                top: `${20 + ((i * 13) % 70)}%`,
                animationDelay: `${i * 0.45}s`,
              }}
            />
          ))}
        </div>
        <div className="hero-copy">
          <p className="kicker reveal">{book.publisher} — {book.tagline}</p>
          <p className="hook reveal">
            कधी स्वतःशी बोलून पाहा…
            <span className="accent">कधी आपल्या धंद्याशी!</span>
          </p>
          <h1 className="h-title reveal d2">{book.titleHindi}</h1>
          <p className="subline reveal d2">{book.subtitle}</p>
          <p className="support reveal d3">{hook.support}</p>
          <div className="roles reveal d3">
            {roles.map((role) => (
              <span key={role}>{role}</span>
            ))}
          </div>
          <div className="hero-actions reveal d3">
            <button className="cta big" onClick={() => go("order")}>
              📦 आताच ऑर्डर करा — ₹{book.price}
            </button>
            <button className="cta secondary big" onClick={() => go("about")}>
              अधिक माहिती
            </button>
          </div>
        </div>
        <div
          className="book-col reveal d2"
          onMouseMove={onMove}
          onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        >
          <BookStack tilt={tilt} />
        </div>
      </section>

      <section className={`pillars cards-rise${pillarOn ? " on" : ""}`} ref={pillarRef}>
        {pillars.map((item) => (
          <article className="pillar" key={item.n}>
            <div className="n">{item.n}</div>
            <h3>
              {item.icon} {item.title}
            </h3>
            <p>{item.text}</p>
            <div className="gem">✦ ✦</div>
          </article>
        ))}
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[...ticker, ...ticker].map((item, i) => (
            <span className="chip" key={`${item}-${i}`}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <section className="quote-band">
        <p className="eyebrow">एक विचार, जो सोबत राहतो</p>
        <h2>फक्त धंदा चालवू नका — त्याला समजून घ्या.</h2>
        <blockquote>“{closing[0]}”</blockquote>
        <p className="lead" style={{ marginInline: "auto" }}>
          {book.titleFull} हे पुस्तक वाचा आणि आपल्या व्यवसायाकडे पाहण्याच्या दृष्टिकोनाला नवी दिशा द्या.
        </p>
      </section>

      <BookFlow />

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...marquee, ...marquee, ...marquee].map((item, i) => (
            <span key={`${item}-${i}`}>{item}</span>
          ))}
        </div>
      </div>

      <section className="section" id="about">
        <p className="eyebrow">पुस्तकाविषयी</p>
        <h2>पुस्तक परिचय</h2>
        {intro.map((para, index) => (
          <p className="lead" key={`intro-${index}`}>
            {para}
          </p>
        ))}
        <div className={`grid-3 cards-rise${aboutOn ? " on" : ""}`} ref={aboutRef} style={{ marginTop: 22 }}>
          {aboutCards.map((card) => (
            <article className="card" key={card.title}>
              <div className="icon-lg">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section thought-blocks">
        <article className="prose">
          <p className="eyebrow">लेखकाचा दृष्टिकोन</p>
          <h3>व्यवसाय आणि व्यावसायिक यांच्यातील संवाद</h3>
          {viewpoint.map((para, index) => (
            <p key={`view-${index}`}>{para}</p>
          ))}
        </article>
        <div>
          <p className="eyebrow">या पुस्तकातून विचार</p>
          <h2>कोणत्या मुद्द्यांवर विचार करता येईल?</h2>
          <div className="points">
            {points.map((point) => (
              <div className="point" key={point.title}>
                <div className="check">✓</div>
                <div>
                  <b>{point.title}</b>
                  <span>{point.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="card">
          <p className="eyebrow">हे पुस्तक कोणी वाचावे?</p>
          <h2>ज्यांना धंद्याशी संवाद साधायचा आहे</h2>
          {who.map((para, index) => (
            <p className="lead" key={`who-${index}`}>
              {para}
            </p>
          ))}
          <ul className="audience">
            {audience.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" id="author" style={{ paddingTop: 0 }}>
        <p className="eyebrow">लेखकांचे अनुभव आणि निरीक्षणे</p>
        <div className="author">
          <img className="portrait" src={asset("author.png")} alt={book.author} />
          <div>
            <h2 style={{ marginTop: 0 }}>{book.author}</h2>
            <p className="lead">{book.authorEn} · {book.publisher}</p>
            <p className="mission">{book.tagline}</p>
            {observations.map((para, index) => (
              <p className="lead" key={`obs-${index}`}>
                {para}
              </p>
            ))}
            {experience.map((para, index) => (
              <p className="lead" key={`exp-${index}`}>
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <p className="eyebrow">स्वतःला विचारा</p>
        <h2>धंद्याशी चार प्रश्न</h2>
        <div className="faq">
          {questions.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section reviews" id="reviews">
        <div className="review-head">
          <p className="review-kicker"><span /> प्रतिक्रिया <span /></p>
          <h2>वाचकांनी <em>काय सांगितले</em></h2>
        </div>
        <div className="review-rail">
          <div className="review-track">
            {[...reviews, ...reviews].map((item, index) => (
              <ReviewCard key={`${item.name}-${index}`} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="details" style={{ paddingTop: 0 }}>
        <p className="eyebrow">तपशील</p>
        <h2>पुस्तकाची माहिती</h2>
        <div className={`details cards-rise${detailOn ? " on" : ""}`} ref={detailRef}>
          <article className="detail">
            <em>🏷️ किंमत</em>
            <strong>₹{book.price}</strong>
            <span>मुखपृष्ठावरील किंमत</span>
          </article>
          <article className="detail">
            <em>🔖 ISBN</em>
            <strong>{book.isbn}</strong>
            <span>कोड {book.code}</span>
          </article>
          <article className="detail">
            <em>🗣️ भाषा</em>
            <strong>{book.language}</strong>
            <span>{book.languageNote}</span>
          </article>
          <article className="detail">
            <em>📚 प्रकाशक</em>
            <strong>{book.publisher}</strong>
            <span>{book.website}</span>
          </article>
          <article className="detail">
            <em>✒️ लेखक</em>
            <strong>{book.author}</strong>
            <span>
              {book.authorEn}. {book.authorRole}
            </span>
          </article>
          <article className="detail">
            <em>📱 ई-बुक</em>
            <strong>उपलब्ध</strong>
            <span>{book.ebook}</span>
          </article>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <article className="prose">
          <p className="eyebrow">संपूर्ण ओळख</p>
          <h3>{book.titleFull}</h3>
          <p className="pull">{signoff}</p>
          {intro.map((para, index) => (
            <p key={`i-${index}`}>{para}</p>
          ))}
          <h3>लेखकाचा दृष्टिकोन</h3>
          {viewpoint.map((para, index) => (
            <p key={`v-${index}`}>{para}</p>
          ))}
          <h3>लेखकांचे अनुभव आणि निरीक्षणे</h3>
          {experience.map((para, index) => (
            <p key={`e-${index}`}>{para}</p>
          ))}
          {observations.map((para, index) => (
            <p key={`o-${index}`}>{para}</p>
          ))}
          <h3>हे पुस्तक कोणी वाचावे?</h3>
          {who.map((para, index) => (
            <p key={`w-${index}`}>{para}</p>
          ))}
          <h3>एक विचार, जो सोबत राहतो…</h3>
          {closing.map((para, index) => (
            <p key={`c-${index}`}>{para}</p>
          ))}
          <p>
            <b>लेखकाविषयी:</b> {book.author}. {book.publisher} — {book.tagline}
          </p>
        </article>
      </section>

      <section className="order-band">
        <div className="mini-book" aria-hidden="true">
          <div className="band" />
          <img src={asset("cover-art.png")} alt="" />
          <b>{book.titleHindi}</b>
        </div>
        <div>
          <h2 style={{ margin: 0 }}>{book.titleHindi}</h2>
          <p className="lead" style={{ margin: "6px 0 0" }}>
            {book.subtitle} · {book.author}
          </p>
          <p className="price-note">किंमत ₹{book.price} · कोड {book.code}</p>
          <p className="safe">🏠 घरपोच डिलिव्हरी · 📘 ओरिजिनल प्रत</p>
        </div>
        <button className="cta big" onClick={() => go("order")}>
          📦 आताच ऑर्डर करा
        </button>
      </section>
    </main>
  );
}

const emptyForm = {
  name: "",
  phone: "",
  address: "",
  landmark: "",
  city: "",
  taluka: "",
  district: "",
  pin: "",
  qty: 1,
};

const letters = /^[A-Za-z][A-Za-z .'-]*$/;
const streetOk = /^[A-Za-z0-9][A-Za-z0-9\s.,/'#()-]*$/;

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function OrderPage() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const finish = (order) => {
    setError("");
    setForm(emptyForm);
    setBusy(false);
    setDone(order);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();
    const address = form.address.trim();
    const landmark = form.landmark.trim();
    const city = form.city.trim();
    const taluka = form.taluka.trim();
    const district = form.district.trim();
    const pin = form.pin.trim();

    if (!letters.test(name) || name.length < 2) return setError("कृपया फक्त इंग्रजी (English) अक्षरांचा वापर करा.");
    if (!/^[6-9]\d{9}$/.test(phone)) return setError("कृपया 10-अंकी मोबाईल नंबर प्रविष्ट करा.");
    if (!streetOk.test(address) || address.length < 5) return setError("कृपया पत्ता फक्त इंग्रजी (English) अक्षरे आणि अंकांमध्ये प्रविष्ट करा.");
    if (landmark && !letters.test(landmark)) return setError("कृपया खूण फक्त इंग्रजी (English) अक्षरांमध्ये प्रविष्ट करा.");
    if (!letters.test(city) || city.length < 2) return setError("कृपया शहराचे नाव फक्त इंग्रजीत (English) प्रविष्ट करा.");
    if (taluka && !letters.test(taluka)) return setError("कृपया तालुक्याचे नाव फक्त इंग्रजीत (English) प्रविष्ट करा.");
    if (!letters.test(district) || district.length < 2) return setError("कृपया जिल्ह्याचे नाव फक्त इंग्रजीत (English) प्रविष्ट करा.");
    if (!/^\d{6}$/.test(pin)) return setError("कृपया 6-अंकी पिनकोड प्रविष्ट करा.");

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          address,
          landmark,
          city,
          taluka,
          district,
          pin,
          qty: Number(form.qty),
        }),
      });

      const raw = await response.text();
      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error("ऑर्डर सर्व्हरने उत्तर दिले नाही. पृष्ठ रीफ्रेश करून पुन्हा प्रयत्न करा.");
      }

      if (!response.ok) throw new Error(data.error || "ऑर्डर जतन करता आली नाही.");

      const ready = await loadRazorpay();
      if (!ready) throw new Error("Razorpay उघडता आले नाही.");

      let settled = false;
      let handling = false;

      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: "INR",
        name: "Selfish Readers",
        description: `${book.titleHindi} × ${form.qty}`,
        order_id: data.razorpayOrderId,
        prefill: { name, contact: phone },
        theme: { color: "#c4a265" },

        handler: async (payment) => {
          handling = true;

          try {
            const verify = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderCode: data.order.orderCode,
                razorpayOrderId: payment.razorpay_order_id,
                razorpayPaymentId: payment.razorpay_payment_id,
                razorpaySignature: payment.razorpay_signature,
              }),
            });

            const paidRaw = await verify.text();
            let paid = {};

            try {
              paid = paidRaw ? JSON.parse(paidRaw) : {};
            } catch {
              throw new Error("पेमेंट सर्व्हरने उत्तर दिले नाही.");
            }

            if (!verify.ok) throw new Error(paid.error || "पेमेंट पडताळता आले नाही.");

            settled = true;

            finish({
              orderCode: paid.order?.orderCode || data.order.orderCode,
              name,
              qty: Number(form.qty),
              city,
              district,
              pin,
              address,
              amount: paid.order?.amount || Number(form.qty) * book.price,
            });
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        },

        modal: {
          ondismiss: () => {
            if (settled || handling) return;
            setBusy(false);
            setError("पेमेंट रद्द झाले. ऑर्डर अजून पूर्ण झालेली नाही.");
          },
        },
      });

      checkout.open();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const total = form.qty * book.price;

  if (done) {
    return (
      <main className="order-page checkout">
        <section className="checkout-sheet success-sheet">
          <div className="success-mark" aria-hidden="true">✓</div>
          <p className="eyebrow">Selfish Readers</p>
          <h1>ऑर्डर यशस्वी</h1>
          <p className="success-lead">{done.name}, तुमची ऑर्डर नोंदली गेली आहे आणि पेमेंट पूर्ण झाले आहे.</p>

          <div className="success-book">
            <img src={asset("cover-art.png")} alt="" />
            <div>
              <strong>{book.titleHindi}</strong>
              <span>{book.subtitle}</span>
              <span>{book.author}</span>
            </div>
          </div>

          <dl className="success-facts">
            <div><dt>ऑर्डर क्रमांक</dt><dd>{done.orderCode}</dd></div>
            <div><dt>प्रती</dt><dd>{done.qty}</dd></div>
            <div><dt>रक्कम</dt><dd>₹{done.amount}</dd></div>
            <div><dt>शहर</dt><dd>{done.city}</dd></div>
            <div><dt>पत्ता</dt><dd>{done.address}, {done.city}{done.district ? `, ${done.district}` : ""} — {done.pin}</dd></div>
          </dl>

          <p className="success-note">
            पुस्तक दिलेल्या पत्त्यावर पाठवले जाईल. वितरणाची पुष्टी Selfish Readers कडून केली जाईल.
          </p>

          <div className="success-actions">
            <button className="cta big checkout-go" type="button" onClick={() => { window.location.hash = "top"; }}>
              मुख्य पृष्ठावर जा
            </button>
            <button className="success-again" type="button" onClick={() => setDone(null)}>
              नवीन ऑर्डर
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="order-page checkout">
      <form className="checkout-sheet" onSubmit={submit}>
        <div className="pair">
          <label>
            संपूर्ण नाव <span className="req">*</span>
            <span className="field">
              <span className="field-ic" aria-hidden="true">👤</span>
              <input value={form.name} onChange={set("name")} placeholder="आपले पूर्ण नाव (English Only)" autoComplete="name" />
            </span>
          </label>

          <label>
            मोबाईल नंबर <span className="req">*</span>
            <span className="field">
              <span className="field-ic" aria-hidden="true">📞</span>
              <input value={form.phone} onChange={set("phone")} inputMode="numeric" maxLength={10} placeholder="10-अंकी नंबर" autoComplete="tel" />
            </span>
          </label>
        </div>

        <div className="addr-head">
          <span className="pin" aria-hidden="true">📍</span>
          <div>
            <strong>डिलिव्हरी पत्ता</strong>
            <em>पुस्तक कुठे पाठवायचे?</em>
          </div>
        </div>

        <label>
          रस्ता / गल्ली / घर नंबर <span className="req">*</span>
          <span className="field">
            <span className="field-ic" aria-hidden="true">🏠</span>
            <input value={form.address} onChange={set("address")} placeholder="उदा. Flat No 10, Shivaji Nagar (English Only)" autoComplete="street-address" />
          </span>
        </label>

        <label>
          जवळील खूण (Landmark)
          <span className="field">
            <span className="field-ic" aria-hidden="true">◎</span>
            <input value={form.landmark} onChange={set("landmark")} placeholder="उदा. Near Temple (English Only)" />
          </span>
        </label>

        <div className="pair">
          <label>
            शहर / गाव <span className="req">*</span>
            <span className="field">
              <span className="field-ic" aria-hidden="true">🏙️</span>
              <input value={form.city} onChange={set("city")} placeholder="आपले शहर (English Only)" autoComplete="address-level-2" />
            </span>
          </label>

          <label>
            तालुका
            <span className="field">
              <span className="field-ic" aria-hidden="true">📌</span>
              <input value={form.taluka} onChange={set("taluka")} placeholder="आपला तालुका (English Only)" />
            </span>
          </label>
        </div>

        <div className="pair">
          <label>
            जिल्हा <span className="req">*</span>
            <span className="field">
              <span className="field-ic" aria-hidden="true">🗺️</span>
              <input value={form.district} onChange={set("district")} placeholder="आपला जिल्हा (English Only)" />
            </span>
          </label>

          <label>
            पिनकोड <span className="req">*</span>
            <span className="field">
              <span className="field-ic" aria-hidden="true">#</span>
              <input value={form.pin} onChange={set("pin")} inputMode="numeric" maxLength={6} placeholder="6-अंकी पिनकोड" autoComplete="postal-code" />
            </span>
          </label>
        </div>

        <div className="summary">
          <p className="eyebrow">ऑर्डर सारांश</p>
          <div><span>पुस्तकाची किंमत</span><b>₹{book.price}</b></div>
          <div><span>प्रती</span><b>{form.qty}</b></div>
          <div className="sum-total"><span>एकूण रक्कम</span><b>₹{total}</b></div>
        </div>

        <div className="qty-line">
          <span>प्रती (Quantity)</span>
          <div className="qty">
            <button type="button" onClick={() => setForm((p) => ({ ...p, qty: Math.max(1, p.qty - 1) }))}>−</button>
            <strong>{form.qty}</strong>
            <button type="button" onClick={() => setForm((p) => ({ ...p, qty: Math.min(20, p.qty + 1) }))}>+</button>
          </div>
        </div>

        <div className="pay-card">Pay with Razorpay (UPI, Cards, Wallets, Netbanking)</div>
        {error ? <p className="error">{error}</p> : null}

        <button className="cta big checkout-go" type="submit" disabled={busy}>
          {busy ? "प्रक्रिया सुरू आहे…" : `🛒 ऑर्डर पूर्ण करा — ₹${total}`}
        </button>
      </form>
    </main>
  );
}

function Legal({ title, children }) {
  return (
    <main className="legal">
      <p className="eyebrow">{book.publisher}</p>
      <h1 className="h-title" style={{ fontSize: 40 }}>
        {title}
      </h1>
      <article className="prose">{children}</article>
    </main>
  );
}

export default function App() {
  const { page, go } = useHashPage();
  const [theme, setTheme] = useState(() => localStorage.getItem("sr-theme") || "dark");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("sr-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height > 0 ? (window.scrollY / height) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [page]);

  const pageNode = useMemo(() => {
    if (page === "order") return <OrderPage />;
    if (page === "admin") return <AdminPage />;

    if (page === "privacy") {
      return (
        <Legal title="गोपनीयता">
          <p>
            ऑर्डरमधील नाव, मोबाइल, पत्ता, शहर, तालुका, जिल्हा आणि पिनकोड या पुस्तकाच्या ऑर्डर नोंदीत जतन होतात.
            पेमेंट Razorpay द्वारे पूर्ण होते. थीमची निवड फक्त या ब्राउझरमध्ये ठेवली जाते.
          </p>
        </Legal>
      );
    }

    if (page === "shipping") {
      return (
        <Legal title="वितरण">
          <p>
            ऑर्डर नोंदवल्यानंतर घरपोच पाठवणी, उपलब्धता आणि वितरण वेळ याची पुष्टी Selfish Readers कडून केली जाईल. पत्ता,
            शहर आणि पिनकोड अचूक भरा.
          </p>
          <p>वितरणाची अंतिम माहिती ऑर्डर पुष्टीच्या वेळी दिली जाईल.</p>
        </Legal>
      );
    }

    if (page === "terms") {
      return (
        <Legal title="अटी">
          <p>
            ही वेबसाइट {book.titleFull} या पुस्तकाची ओळख आणि ऑर्डर नोंदण्यासाठी आहे. लेखक {book.author}. प्रकाशक{" "}
            {book.publisher}.
          </p>
          <p>
            मुखपृष्ठावरील किंमत ₹{book.price} आहे. ISBN {book.isbn}. कोड {book.code}. हे पुस्तक प्रीपेड आहे.
            पेमेंट Razorpay द्वारे होते आणि यशस्वी पेमेंटनंतर ऑर्डर नोंद जतन होते.
          </p>
        </Legal>
      );
    }

    return <Home go={go} />;
  }, [page, go]);

  return (
    <>
      {page === "admin" ? null : <div className="progress" style={{ width: `${progress}%` }} />}
      {page === "admin" ? null : <Header go={go} theme={theme} setTheme={setTheme} />}
      {pageNode}

      {page === "admin" ? null : (
        <footer className="footer">
          <nav>
            <button onClick={() => go("privacy")}>Privacy Policy</button>
            <button onClick={() => go("shipping")}>Shipping & Delivery</button>
            <button onClick={() => go("terms")}>Terms & Conditions</button>
            <button onClick={() => go("admin")}>Admin</button>
          </nav>
          <div>© {YEAR} {book.publisher}. {book.tagline}</div>
          <div style={{ marginTop: 6 }}>
            {book.titleFull} · {book.author}
          </div>
        </footer>
      )}

      {page === "admin" ? null : (
        <div className="dock">
          <div className="mini-book">
            <img src={asset("cover-art.png")} alt="" />
            <b>{book.titleHindi}</b>
          </div>
          <div>
            <strong>{book.titleHindi}</strong>
            <div className="price-note">₹{book.price} · {book.author}</div>
          </div>
          <button className="cta" onClick={() => go("order")}>
            ऑर्डर करा
          </button>
        </div>
      )}
    </>
  );
}
