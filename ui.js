// أدوات مشتركة للواجهة
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => Number(n || 0);
  const money = (n, lang) => num(n).toFixed(3) + (lang === "en" ? " KWD" : " د.ك");

  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  function toast(msg, type) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.className = "show " + (type || "");
    clearTimeout(t._h); t._h = setTimeout(() => (t.className = ""), 2600);
  }

  // نافذة سفلية (Bottom sheet)
  function sheet(html, onMount) {
    closeSheet();
    const w = document.createElement("div");
    w.id = "sheet";
    w.innerHTML = `<div class="sheet-bg" data-close></div><div class="sheet-box"><button class="sheet-x" data-close aria-label="إغلاق">✕</button>${html}</div>`;
    w.addEventListener("click", (e) => { if (e.target.hasAttribute("data-close")) closeSheet(); });
    document.body.appendChild(w);
    requestAnimationFrame(() => w.classList.add("open"));
    if (onMount) onMount(w);
    return w;
  }
  // نافذة تأكيد داخل الصفحة (بدل confirm)
  function ask(msg) {
    return new Promise((res) => {
      const w = document.createElement("div"); w.id = "askbox";
      w.style.cssText = "position:fixed;inset:0;z-index:300;background:rgba(8,20,38,.55);display:flex;align-items:center;justify-content:center;padding:20px";
      w.innerHTML = `<div style="background:#fff;border-radius:18px;padding:18px;max-width:340px;width:100%;text-align:center"><p style="font-weight:700;margin:6px 0 16px">${esc(msg)}</p><div class="row2"><button class="btn ghost" data-a="0">إلغاء</button><button class="btn" data-a="1">تأكيد</button></div></div>`;
      w.addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b || e.target === w) { w.remove(); res(!!(b && b.dataset.a === "1")); } });
      document.body.appendChild(w);
    });
  }
  function closeSheet() { const s = document.getElementById("sheet"); if (s) s.remove(); }

  const STATUS = {
    new: { ar: "جديد", en: "New", c: "#2563eb" },
    confirmed: { ar: "تم التأكيد", en: "Confirmed", c: "#7c3aed" },
    preparing: { ar: "قيد التجهيز", en: "Preparing", c: "#d97706" },
    out_for_delivery: { ar: "في الطريق", en: "On the way", c: "#0891b2" },
    delivered: { ar: "تم التوصيل", en: "Delivered", c: "#16a34a" },
    cancelled: { ar: "ملغي", en: "Cancelled", c: "#dc2626" }
  };
  const STATUS_FLOW = ["new", "confirmed", "preparing", "out_for_delivery", "delivered"];

  const AREAS = {
    "العاصمة": ["مدينة الكويت", "الشرق", "المرقاب", "الدسمة", "الدعية", "الشامية", "الشويخ", "الصليبيخات", "الدوحة", "الروضة", "العديلية", "الفيحاء", "القادسية", "كيفان", "المنصورية", "النزهة", "اليرموك", "قرطبة", "السرة", "الخالدية", "غرناطة", "النهضة", "جابر الأحمد"],
    "حولي": ["حولي", "السالمية", "الجابرية", "الرميثية", "بيان", "مشرف", "سلوى", "الشعب", "ميدان حولي", "حطين", "الشهداء", "الصديق", "السلام", "الزهراء", "البدع"],
    "الفروانية": ["الفروانية", "خيطان", "جليب الشيوخ", "العارضية", "الرابية", "الرحاب", "الأندلس", "العمرية", "اشبيلية", "الرقعي", "عبدالله المبارك", "صباح الناصر", "الفردوس", "العباسية"],
    "مبارك الكبير": ["مبارك الكبير", "صباح السالم", "العدان", "القرين", "القصور", "المسيلة", "أبو فطيرة", "الفنيطيس", "صبحان", "المسايل", "أبو الحصانية"],
    "الأحمدي": ["الأحمدي", "الفحيحيل", "المنقف", "أبو حليفة", "الفنطاس", "المهبولة", "الصباحية", "الرقة", "هدية", "العقيلة", "الظهر", "صباح الأحمد", "الخيران", "الوفرة", "جابر العلي", "فهد الأحمد", "علي صباح السالم"],
    "الجهراء": ["الجهراء", "سعد العبدالله", "القصر", "العيون", "النسيم", "الواحة", "تيماء", "الصليبية", "النعيم", "القيروان"]
  };

  const fmtDate = (d) => { try { return new Date(d).toLocaleString("ar-KW", { dateStyle: "short", timeStyle: "short" }); } catch (e) { return d; } };

  const LOGO = '<img src="icon-192.png" alt="" style="width:38px;height:38px;border-radius:10px;object-fit:cover">';

  // تفعيل إشعارات الطلبات (آيفون: لازم التطبيق يكون متضاف للشاشة الرئيسية)
  const VAPID = (window.ISLAMKO_CONFIG || {}).VAPID_PUBLIC || "BLJPBQpfAO6iyV7bK8dWMAxjR_b68wlAK5upO5n4eJYoCGibkVNRfBT_Bv1cSADD_ltb4U9PacaINZW9zuOn_Gw";
  function b64ToU8(b) { const p = "=".repeat((4 - (b.length % 4)) % 4); const s = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...s].map((c) => c.charCodeAt(0))); }
  const pushState = () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      const ios = /iPhone|iPad/.test(navigator.userAgent), standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
      return ios && !standalone ? "need_home" : "unsupported";
    }
    return Notification.permission;
  };
  async function enablePush(saveFn) {
    const st = pushState();
    if (st === "need_home") throw new Error("ضيف الصفحة دي للشاشة الرئيسية الأول (مشاركة ← إضافة إلى الشاشة الرئيسية)، وافتحها من الأيقونة، وبعدين فعّل الإشعارات");
    if (st === "unsupported") throw new Error("الجهاز ده مش بيدعم الإشعارات – حدّث الآيفون لـ iOS 16.4 أو أحدث");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("الإشعارات مقفولة – فعّلها من إعدادات الآيفون ← الإشعارات ← Goten");
    const reg = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID) });
    await saveFn(sub);
  }

  const DST = {
    new: { ar: "طلب جديد", en: "New", c: "#2563eb" },
    assigned: { ar: "تم تعيين مندوب", en: "Driver assigned", c: "#7c3aed" },
    picked_up: { ar: "المندوب استلم الشحنة", en: "Picked up", c: "#0891b2" },
    delivered: { ar: "تم التسليم", en: "Delivered", c: "#16a34a" },
    failed: { ar: "فشل التوصيل", en: "Failed", c: "#dc2626" },
    cancelled: { ar: "ملغي", en: "Cancelled", c: "#64748b" }
  };
  const DFLOW = ["new", "assigned", "picked_up", "delivered"];
  const zoneOf = (area) => { for (const [g, arr] of Object.entries(AREAS)) if (arr.includes(area)) return g; return null; };
  const ago = (d) => { const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? "الآن" : m < 60 ? `من ${m} دقيقة` : m < 1440 ? `من ${Math.round(m / 60)} ساعة` : fmtDate(d); };
  // خرائط Leaflet (بتتحمّل وقت الحاجة)
  let leafletP = null;
  function leaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (!leafletP) leafletP = new Promise((res, rej) => {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css);
      const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = () => res(window.L); s.onerror = () => rej(new Error("تعذر تحميل الخريطة")); document.head.appendChild(s);
    });
    return leafletP;
  }
  async function makeMap(el, points) {
    const L = await leaflet();
    if (el._map) { el._map.remove(); }
    const map = L.map(el, { zoomControl: true, attributionControl: true }).setView([29.3375, 47.9744], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
    const ms = (points || []).filter((p) => p.lat && p.lng).map((p) => L.marker([p.lat, p.lng]).addTo(map).bindPopup(p.label || ""));
    if (ms.length === 1) map.setView(ms[0].getLatLng(), 14); else if (ms.length > 1) map.fitBounds(L.featureGroup(ms).getBounds().pad(0.2));
    el._map = map; setTimeout(() => map.invalidateSize(), 200);
    return map;
  }
  window.UI = { DST, DFLOW, zoneOf, ago, leaflet, makeMap, pushState, enablePush, LOGO, ask, esc, money, num, ls, toast, sheet, closeSheet, STATUS, STATUS_FLOW, AREAS, fmtDate };
})();
