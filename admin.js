// لوحة تحكم شركة التوصيل
(function () {
  const { esc, money, num, toast, sheet, closeSheet, fmtDate, LOGO, DST, AREAS, ask, makeMap, ago } = UI;
  const $ = (id) => document.getElementById(id);
  const ZONES = Object.keys(AREAS);
  const A = { tab: "dash", list: [], profiles: [], setl: [], prices: [], locs: [], settings: {}, filter: "open", known: null, q: "" };
  const collectOf = (d) => num(d.cod_amount) + (d.fee_payer === "receiver" ? num(d.fee) : 0);
  const today = (d) => d && new Date(d).toDateString() === new Date().toDateString();
  const drivers = () => A.profiles.filter((p) => p.role === "driver");
  const merchants = () => A.profiles.filter((p) => p.role === "merchant");
  const pname = (id) => { const p = A.profiles.find((x) => x.id === id); return p ? p.business_name || p.full_name || p.phone || "—" : "—"; };
  const ROLES = { pending: "⏳ قيد المراجعة", merchant: "🏪 محل", driver: "🛵 مندوب", admin: "👑 أدمن", blocked: "⛔ محظور" };

  function merchantSt(id) {
    const done = A.list.filter((d) => d.merchant_id === id && d.status === "delivered");
    const owe = done.reduce((s, d) => s + num(d.cod_amount) - (d.fee_payer === "sender" ? num(d.fee) : 0), 0);
    const paid = A.setl.filter((x) => x.kind === "merchant_payout" && x.party === id).reduce((s, x) => s + num(x.amount), 0);
    return { count: A.list.filter((d) => d.merchant_id === id).length, done: done.length, owe, paid, bal: owe - paid };
  }
  function driverSt(id) {
    const done = A.list.filter((d) => d.driver_id === id && d.status === "delivered");
    const col = done.reduce((s, d) => s + collectOf(d), 0);
    const hand = A.setl.filter((x) => x.kind === "driver_handover" && x.party === id).reduce((s, x) => s + num(x.amount), 0);
    return { done: done.length, today: done.filter((d) => today(d.delivered_at)).length, active: A.list.filter((d) => d.driver_id === id && ["assigned", "picked_up"].includes(d.status)).length, col, hand, cash: col - hand };
  }

  // ---------- الدخول ----------
  function loginView(msg) {
    $("app").innerHTML = `<div class="login"><div class="brand" style="justify-content:center;color:var(--navy);font-size:22px;margin-bottom:6px">${LOGO}<span>لوحة التحكم</span></div>${msg ? `<div class="notice">${msg}</div>` : ""}
      ${Store.live ? `<div class="card"><label class="f"><span>البريد الإلكتروني</span><input class="in" id="em" type="email" autocomplete="username"></label><label class="f"><span>كلمة المرور</span><input class="in" id="pw" type="password" autocomplete="current-password"></label><button class="btn block" id="inBtn">دخول</button><button class="btn ghost block" style="margin-top:8px" data-forgot="1">نسيت كلمة السر؟</button></div>
        <details class="card"><summary><b>أول مرة؟ اعمل حساب الأدمن</b></summary><p class="mut">اكتب الإيميل وكلمة السر فوق واضغط، وبعدها شغّل سطر الأدمن في Supabase.</p><button class="btn tq block" id="upBtn">إنشاء حساب</button></details>`
        : `<div class="card"><span class="demo-tag">وضع تجريبي</span><label class="f"><span>الرقم السري (1234)</span><input class="in" id="pin" type="password" inputmode="numeric"></label><button class="btn block" id="pinBtn">دخول</button></div>`}
      ${msg ? `<button class="btn ghost block" id="outBtn">خروج</button>` : ""}</div>`;
    const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
    on("inBtn", async () => { try { await Store.signIn($("em").value.trim(), $("pw").value); boot(); } catch (e) { toast(e.message.includes("Invalid") ? "الإيميل أو كلمة السر غلط" : e.message, "err"); } });
    on("upBtn", async () => { if ($("pw").value.length < 6) return toast("كلمة السر 6 حروف على الأقل", "err"); try { await Store.signUp($("em").value.trim(), $("pw").value, { full_name: "Admin", wants: "admin" }); boot(); } catch (e) { toast(e.message, "err"); } });
    on("pinBtn", () => { if ($("pin").value !== String((window.APP_CONFIG || {}).DEMO_ADMIN_PIN || "1234")) return toast("الرقم غلط", "err"); Store.demoLogin({ id: "admin", role: "admin", full_name: "الأدمن" }); boot(); });
    on("outBtn", async () => { await Store.signOut(); loginView(); });
  }

  // ---------- التبويبات ----------
  const TABS = [["dash", "📊 الرئيسية"], ["dels", "📦 الشحنات"], ["map", "🗺️ الخريطة"], ["merch", "🏪 المحلات"], ["drv", "🛵 المناديب"], ["prices", "💰 الأسعار"], ["set", "⚙️ الإعدادات"]];
  function render() {
    const newCount = A.list.filter((d) => d.status === "new").length;
    $("app").innerHTML = `<header class="top"><div class="wrap"><div class="row"><div class="brand">${LOGO}<div>${esc(A.settings.company_name || "Goten Delivery")}<small>لوحة التحكم</small></div></div><div class="sp"></div><button class="chip-btn" id="pushBtn">${UI.pushState() === "granted" ? "🔔" : "🔕 فعّل"}</button><button class="chip-btn" id="refBtn">🔄</button><button class="chip-btn" id="outBtn">خروج</button></div>
      <div class="tabs">${TABS.map(([k, l]) => `<button class="${A.tab === k ? "on" : ""}" data-tab="${k}">${l}${k === "dels" && newCount ? ` (${newCount})` : ""}</button>`).join("")}</div></div></header>
      <main><div class="wrap" id="body">${({ dash, dels, map: mapV, merch, drv, prices, set })[A.tab]()}</div></main>`;
    $("outBtn").onclick = async () => { await Store.signOut(); loginView(); };
    $("pushBtn").onclick = async () => { try { await UI.enablePush((x) => Store.savePush(x)); toast("✅ الإشعارات اتفعّلت – هيجيلك إشعار مع كل شحنة جديدة"); render(); } catch (e) { toast(/save_push/.test(e.message) ? "شغّل كود الإشعارات SQL الأول" : e.message, "err"); } };
    $("refBtn").onclick = () => load().then(() => toast("اتحدّث ✓"));
    if (A.tab === "map") drawMap();
    if (A.tab === "dels") { const q = $("q"); if (q) q.oninput = () => { A.q = q.value; const p = q.selectionStart; render(); const n = $("q"); n.focus(); n.setSelectionRange(p, p); }; }
  }

  function dash() {
    const td = A.list.filter((d) => today(d.created_at)), del = A.list.filter((d) => d.status === "delivered" && today(d.delivered_at));
    const fees = del.reduce((s, d) => s + num(d.fee), 0), allFees = A.list.filter((d) => d.status === "delivered").reduce((s, d) => s + num(d.fee), 0);
    const cash = drivers().reduce((s, p) => s + driverSt(p.id).cash, 0), owe = merchants().reduce((s, p) => s + Math.max(0, merchantSt(p.id).bal), 0);
    const pend = A.profiles.filter((p) => p.role === "pending").length;
    const cnt = (s) => A.list.filter((d) => d.status === s).length;
    return `<div class="stats" style="margin-top:12px">
      <div class="stat"><span class="mut">طلبات النهارده</span><b>${td.length}</b></div><div class="stat"><span class="mut">اتسلمت النهارده</span><b>${del.length}</b></div>
      <div class="stat"><span class="mut">إيراد التوصيل النهارده</span><b>${money(fees)}</b></div><div class="stat"><span class="mut">إجمالي إيراد التوصيل</span><b>${money(allFees)}</b></div>
      <div class="stat"><span class="mut">كاش مع المناديب</span><b style="color:#b45309">${money(cash)}</b></div><div class="stat"><span class="mut">مستحق للمحلات</span><b style="color:#dc2626">${money(owe)}</b></div></div>
      ${pend ? `<div class="notice" data-tab="drv" style="cursor:pointer">⏳ فيه ${pend} حساب مستني موافقتك – اضغط هنا</div>` : ""}
      <div class="card"><b>حالة الشحنات</b>${Object.keys(DST).map((s) => `<div class="line"><span><span class="st" style="background:${DST[s].c}">${DST[s].ar}</span></span><b>${cnt(s)}</b></div>`).join("")}</div>
      <div class="card"><b>🔗 روابط التطبيق</b><p class="mut" style="font-size:13px">صفحة الطلب للزباين والمحلات: <b>index.html</b><br>صفحة المناديب: <b>driver.html</b></p></div>`;
  }

  // ---------- الشحنات ----------
  const FILTERS = { open: ["new", "assigned", "picked_up"], new: ["new"], done: ["delivered"], bad: ["failed", "cancelled"], all: null };
  const FL = { open: "شغالة", new: "جديدة", done: "اتسلمت", bad: "فشلت/ملغية", all: "الكل" };
  function dels() {
    const q = A.q.trim();
    const rows = A.list.filter((d) => (!FILTERS[A.filter] || FILTERS[A.filter].includes(d.status)) && (!q || [d.no, d.sender_name, d.receiver_name, d.sender_phone, d.receiver_phone, d.drop_area, d.pickup_area].join(" ").includes(q)));
    return `<div style="margin-top:10px"><button class="btn tq block" data-newd="1">➕ شحنة جديدة (تليفون / واتساب)</button></div>
      <div class="chips">${Object.keys(FL).map((k) => `<button class="${A.filter === k ? "on" : ""}" data-filter="${k}">${FL[k]}</button>`).join("")}</div>
      <input class="in" id="q" placeholder="🔍 بحث برقم الشحنة أو الاسم أو الهاتف أو المنطقة" value="${esc(A.q)}">
      ${rows.length ? rows.map(dcard).join("") : `<div class="empty"><div class="e">📭</div>مفيش شحنات</div>`}`;
  }
  function dcard(d) {
    const st = DST[d.status], c = collectOf(d);
    return `<div class="dcard" style="border-color:${st.c}"><div class="hd"><b>#${d.no} ${d.merchant_id ? `<span class="pill">🏪 ${esc(pname(d.merchant_id))}</span>` : ""}</b><span class="st" style="background:${st.c}">${st.ar}</span></div>
      <div class="ad">🟦 ${esc(d.sender_name)} · <a href="tel:+${esc(d.sender_phone)}">${esc(d.sender_phone)}</a> – <b>${esc(d.pickup_area)}</b>${d.pickup_address ? "، " + esc(d.pickup_address) : ""}<br>
      🟩 ${esc(d.receiver_name)} · <a href="tel:+${esc(d.receiver_phone)}">${esc(d.receiver_phone)}</a> – <b>${esc(d.drop_area)}</b>${d.drop_address ? "، " + esc(d.drop_address) : ""}</div>
      ${d.package ? `<div class="mut">📦 ${esc(d.package)}</div>` : ""}${d.schedule ? `<div class="mut">⏰ ${esc(d.schedule)}</div>` : ""}${d.notes ? `<div class="mut">📝 ${esc(d.notes)}</div>` : ""}${d.failed_reason ? `<div style="color:var(--red)">❌ ${esc(d.failed_reason)}</div>` : ""}
      <div style="margin:6px 0"><span class="pill">توصيل ${money(d.fee)} على ${d.fee_payer === "receiver" ? "المستلم" : "المرسل"}</span> ${c ? `<span class="pill cod">💵 تحصيل ${money(c)}</span>` : ""} <span class="mut" style="font-size:12px">${fmtDate(d.created_at)}</span></div>
      <div class="row2"><select class="in" data-assign="${d.id}"><option value="">— اختار مندوب —</option>${drivers().map((p) => `<option value="${p.id}" ${d.driver_id === p.id ? "selected" : ""}>🛵 ${esc(p.full_name || p.phone)} (${driverSt(p.id).active})</option>`).join("")}</select>
        <select class="in" data-status="${d.id}">${Object.keys(DST).map((s) => `<option value="${s}" ${d.status === s ? "selected" : ""}>${DST[s].ar}</option>`).join("")}</select></div>
      <div class="acts">${d.proof_url ? `<button class="btn sm ghost" data-proof="${esc(d.proof_url)}">📸 الإثبات</button>` : ""}<button class="btn sm ghost" data-fee="${d.id}">✏️ السعر</button><button class="btn sm ghost" data-wa="${d.id}">💬 رابط للمستلم</button><button class="btn sm ghost" style="color:var(--red)" data-del="${d.id}">🗑️ حذف</button></div></div>`;
  }
  function newDeliverySheet() {
    const opts = `<option value="">اختر المنطقة</option>` + Object.entries(AREAS).map(([g, arr]) => `<optgroup label="${g}">${arr.map((x) => `<option>${x}</option>`).join("")}</optgroup>`).join("");
    const mopts = `<option value="">— فرد (مش محل) —</option>` + merchants().map((m) => `<option value="${m.id}">🏪 ${esc(m.business_name || m.full_name)}</option>`).join("");
    const f = (id, l, t = "text", x = "") => `<label class="f"><span>${l}</span><input class="in" id="${id}" type="${t}" ${x}></label>`;
    sheet(`<h3>شحنة جديدة</h3><label class="f"><span>المحل</span><select class="in" id="nm">${mopts}</select></label>
      <b>🟦 المرسل</b><div class="row2">${f("ns", "الاسم")}${f("nsp", "الهاتف", "tel", 'inputmode="numeric" maxlength="8"')}</div><label class="f"><span>المنطقة</span><select class="in" id="nsa">${opts}</select></label>${f("nsd", "العنوان")}
      <b>🟩 المستلم</b><div class="row2">${f("nr", "الاسم")}${f("nrp", "الهاتف", "tel", 'inputmode="numeric" maxlength="8"')}</div><label class="f"><span>المنطقة</span><select class="in" id="nra">${opts}</select></label>${f("nrd", "العنوان")}
      ${f("npk", "الشحنة")}${f("ncod", "مبلغ التحصيل (د.ك)", "number", 'step="0.005" inputmode="decimal"')}
      <label class="f"><span>التوصيل يدفعه</span><select class="in" id="npay"><option value="sender">المرسل</option><option value="receiver">المستلم</option></select></label>
      <button class="btn tq block" id="nsave">حفظ الشحنة</button>`, () => {
      $("nm").onchange = () => { const m = A.profiles.find((p) => p.id === $("nm").value); if (!m) return; $("ns").value = m.business_name || m.full_name || ""; $("nsp").value = String(m.phone || "").replace(/^965/, ""); $("nsa").value = m.pickup_area || ""; $("nsd").value = m.pickup_address || ""; };
      $("nsave").onclick = async () => {
        const v = (id) => $(id).value.trim(), p8 = (x) => x.replace(/\D/g, "").replace(/^965(?=\d{8}$)/, "");
        const p = { sender_name: v("ns"), sender_phone: "965" + p8(v("nsp")), pickup_area: v("nsa"), pickup_address: v("nsd"), receiver_name: v("nr"), receiver_phone: "965" + p8(v("nrp")), drop_area: v("nra"), drop_address: v("nrd"), package: v("npk"), cod_amount: num(v("ncod")), fee_payer: v("npay") };
        if (p.sender_name.length < 2 || p.receiver_name.length < 2 || !p.pickup_area || !p.drop_area || p.sender_phone.length !== 11 || p.receiver_phone.length !== 11) return toast("كمّل الأسماء والأرقام (8 أرقام) والمناطق", "err");
        try { const r = await Store.createDelivery(p); if (v("nm")) await Store.updateDelivery(r.id, { merchant_id: v("nm") }); closeSheet(); toast("اتسجّلت #" + r.no); await load(); } catch (e) { toast(e.message, "err"); }
      };
    });
  }

  // ---------- الخريطة ----------
  function mapV() {
    const fresh = A.locs.filter((l) => Date.now() - new Date(l.updated_at) < 3 * 3600e3);
    return `<div class="card" style="margin-top:12px"><b>🗺️ أماكن المناديب</b><div class="mut" style="font-size:13px">بتظهر لما المندوب يشغّل «مشاركة موقعي» (آخر 3 ساعات)</div><div id="bigmap" class="mapbox big"></div>
      ${fresh.length ? fresh.map((l) => `<div class="line"><span>🛵 ${esc(pname(l.driver_id))}</span><span class="mut">${ago(l.updated_at)}</span></div>`).join("") : `<p class="mut">مفيش مناديب مشاركين موقعهم دلوقتي</p>`}</div>`;
  }
  function drawMap() { const fresh = A.locs.filter((l) => Date.now() - new Date(l.updated_at) < 3 * 3600e3); makeMap($("bigmap"), fresh.map((l) => ({ lat: l.lat, lng: l.lng, label: "🛵 " + pname(l.driver_id) + " · " + ago(l.updated_at) }))).catch((e) => toast("تعذر تحميل الخريطة", "err")); }

  // ---------- المحلات والمناديب ----------
  function userRow(p, extra) {
    return `<div class="dcard"><div class="hd"><b>${esc(p.business_name || p.full_name || "بدون اسم")}</b><select class="in" style="width:auto;padding:6px" data-role="${p.id}">${Object.keys(ROLES).map((r) => `<option value="${r}" ${p.role === r ? "selected" : ""}>${ROLES[r]}</option>`).join("")}</select></div>
      <div class="mut">${p.full_name && p.business_name ? esc(p.full_name) + " · " : ""}${p.phone ? `<a href="tel:+${esc(p.phone)}">${esc(p.phone)}</a>` : ""}${p.pickup_area ? " · 📍 " + esc(p.pickup_area) : ""}${p.role === "pending" ? ` · طالب يبقى: <b>${p.wants === "driver" ? "مندوب" : "محل"}</b>` : ""}</div>${extra || ""}</div>`;
  }
  function merch() {
    const pend = A.profiles.filter((p) => p.role === "pending" && p.wants !== "driver");
    return `${pend.length ? `<div class="h2">⏳ محلات مستنية الموافقة</div>${pend.map((p) => userRow(p)).join("")}` : ""}
      <div class="h2">🏪 المحلات (${merchants().length})</div>
      ${merchants().map((p) => { const s = merchantSt(p.id); return userRow(p, `<div class="line"><span>شحنات: ${s.count} · اتسلمت: ${s.done}</span></div><div class="line"><span>اتحصّل ليه (بعد خصم التوصيل)</span><b>${money(s.owe)}</b></div><div class="line"><span>اتحوّله</span><b>${money(s.paid)}</b></div><div class="line total"><span>${s.bal >= 0 ? "ليه عندنا" : "عليه لينا"}</span><span>${money(Math.abs(s.bal))}</span></div><div class="acts"><button class="btn sm green" data-pay="${p.id}">💸 سجّل تحويل</button><button class="btn sm ghost" data-stmt="${p.id}">📒 كشف حساب</button></div>`); }).join("") || `<p class="mut">لسه مفيش محلات. المحلات بتسجّل من «حسابي» في صفحة الطلب.</p>`}`;
  }
  function drv() {
    const pend = A.profiles.filter((p) => p.role === "pending" && p.wants === "driver");
    const others = A.profiles.filter((p) => ["admin", "blocked"].includes(p.role));
    return `${pend.length ? `<div class="h2">⏳ مناديب مستنيين الموافقة</div>${pend.map((p) => userRow(p)).join("")}` : ""}
      <div class="h2">🛵 المناديب (${drivers().length})</div>
      ${drivers().map((p) => { const s = driverSt(p.id); return userRow(p, `<div class="line"><span>شغّال عليه: ${s.active} · النهارده: ${s.today} · الكل: ${s.done}</span></div><div class="line"><span>حصّل</span><b>${money(s.col)}</b></div><div class="line"><span>سلّم للشركة</span><b>${money(s.hand)}</b></div><div class="line total"><span>الكاش اللي معاه</span><span>${money(s.cash)}</span></div><div class="acts"><button class="btn sm green" data-hand="${p.id}">💵 استلمت منه كاش</button></div>`); }).join("") || `<p class="mut">المناديب بيسجّلوا من صفحة driver.html وبعدين توافق عليهم هنا.</p>`}
      ${others.length ? `<div class="h2">👑 الإدارة والمحظورين</div>${others.map((p) => userRow(p)).join("")}` : ""}
      ${!Store.live ? `<button class="btn ghost block" data-adddrv="1">➕ مندوب تجريبي</button>` : ""}`;
  }
  function moneySheet(kind, id) {
    const isPay = kind === "merchant_payout", s = isPay ? merchantSt(id) : driverSt(id), def = Math.max(0, isPay ? s.bal : s.cash);
    sheet(`<h3>${isPay ? "💸 تحويل فلوس لـ" : "💵 استلام كاش من"} ${esc(pname(id))}</h3><p class="mut">${isPay ? "المستحق ليه" : "الكاش اللي معاه"}: <b>${money(def)}</b></p>
      <label class="f"><span>المبلغ (د.ك)</span><input class="in" id="amt" type="number" step="0.005" inputmode="decimal" value="${def.toFixed(3)}"></label>
      <label class="f"><span>ملاحظة</span><input class="in" id="nt" placeholder="${isPay ? "مثال: تحويل بنكي / كاش" : ""}"></label><button class="btn green block" id="okAmt">حفظ</button>`, () => {
      $("okAmt").onclick = async () => { const a = num($("amt").value); if (a <= 0) return toast("اكتب مبلغ", "err"); try { await Store.saveSettlement({ kind, party: id, amount: a, note: $("nt").value.trim() || null }); closeSheet(); toast("اتسجّل ✓"); await load(); } catch (e) { toast(e.message, "err"); } };
    });
  }
  function stmtSheet(id) {
    const rows = A.list.filter((d) => d.merchant_id === id && d.status === "delivered"), pays = A.setl.filter((x) => x.kind === "merchant_payout" && x.party === id), s = merchantSt(id);
    const csv = () => { const L = [["رقم", "التاريخ", "المستلم", "المنطقة", "التحصيل", "التوصيل على المحل", "الصافي"]]; rows.forEach((d) => { const fee = d.fee_payer === "sender" ? num(d.fee) : 0; L.push([d.no, fmtDate(d.delivered_at), d.receiver_name, d.drop_area, num(d.cod_amount).toFixed(3), fee.toFixed(3), (num(d.cod_amount) - fee).toFixed(3)]); }); pays.forEach((x) => L.push(["تحويل", fmtDate(x.created_at), x.note || "", "", "", "", (-num(x.amount)).toFixed(3)])); L.push(["الرصيد", "", "", "", "", "", s.bal.toFixed(3)]); return "﻿" + L.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"); };
    sheet(`<h3>📒 كشف حساب ${esc(pname(id))}</h3>
      ${rows.map((d) => { const fee = d.fee_payer === "sender" ? num(d.fee) : 0; return `<div class="line"><span>#${d.no} · ${esc(d.drop_area)} · ${fmtDate(d.delivered_at)}</span><b>${money(num(d.cod_amount) - fee)}</b></div>`; }).join("") || `<p class="mut">مفيش شحنات اتسلمت</p>`}
      ${pays.map((x) => `<div class="line" style="color:#16a34a"><span>✅ تحويل ${fmtDate(x.created_at)} ${x.note ? esc(x.note) : ""} <button class="btn sm ghost" data-unset="${x.id}">🗑️</button></span><b>−${money(x.amount)}</b></div>`).join("")}
      <div class="line total"><span>الرصيد</span><span>${money(s.bal)}</span></div><button class="btn ghost block" id="csvBtn">⬇️ تصدير Excel</button>`, () => {
      $("csvBtn").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv()], { type: "text/csv;charset=utf-8" })); a.download = "statement-" + pname(id) + ".csv"; a.click(); };
    });
  }

  // ---------- الأسعار ----------
  function prices() {
    const get = (a, b) => { const p = A.prices.find((x) => x.from_zone === a && x.to_zone === b) || A.prices.find((x) => x.from_zone === b && x.to_zone === a); return p ? num(p.price) : ""; };
    return `<div class="card" style="margin-top:12px"><b>💰 سعر التوصيل بين المحافظات (د.ك)</b><p class="mut" style="font-size:13px">من (يمين) ← إلى (فوق). السعر بيتطبق في الاتجاهين.</p>
      <div style="overflow-x:auto"><table class="grid-p"><tr><th></th>${ZONES.map((z) => `<th>${z}</th>`).join("")}</tr>
      ${ZONES.map((a, i) => `<tr><th>${a}</th>${ZONES.map((b, j) => `<td>${j < i ? `<span class="mut">↖</span>` : `<input type="number" step="0.25" inputmode="decimal" data-pa="${a}" data-pb="${b}" value="${get(a, b)}">`}</td>`).join("")}</tr>`).join("")}</table></div>
      <div class="row2" style="margin-top:10px"><input class="in" id="allP" type="number" step="0.25" inputmode="decimal" placeholder="سعر موحّد للكل"><button class="btn ghost" id="allBtn">طبّق على الكل</button></div>
      <button class="btn tq block" style="margin-top:10px" id="saveP">💾 حفظ الأسعار</button></div>
      <div class="card"><b>📍 المناطق</b>${ZONES.map((z) => `<details><summary>${z} (${AREAS[z].length})</summary><p class="mut" style="font-size:13px">${AREAS[z].join("، ")}</p></details>`).join("")}</div>`;
  }
  // ---------- الإعدادات ----------
  function set() {
    const s = A.settings, f = (k, l, x = "") => `<label class="f"><span>${l}</span><input class="in" data-set="${k}" value="${esc(s[k] || "")}" ${x}></label>`;
    return `<div class="card" style="margin-top:12px">${f("company_name", "اسم الشركة")}${f("tagline", "جملة تحت الاسم")}${f("whatsapp", "واتساب الشركة (965xxxxxxxx)", 'inputmode="numeric"')}${f("notice", "إعلان يظهر للزباين")}
      <label class="f"><span>اللون الأساسي</span><input class="in" type="color" data-set="accent" value="${esc(s.accent || "#0B5CAD")}" style="height:46px"></label>
      <label class="radio"><input type="checkbox" data-set="is_open" ${s.is_open !== false ? "checked" : ""}> بنستقبل طلبات دلوقتي</label>
      <label class="f"><span>اللوجو</span><input type="file" accept="image/*" id="logoF"></label>${s.logo ? `<img src="${esc(s.logo)}" style="height:60px;border-radius:12px" alt="">` : ""}
      <button class="btn tq block" id="saveS">💾 حفظ</button></div>
      ${!Store.live ? `<button class="btn ghost block" id="resetDemo">♻️ مسح البيانات التجريبية</button>` : ""}`;
  }

  // ---------- الأحداث ----------
  document.addEventListener("change", async (e) => {
    const t = e.target;
    try {
      if (t.dataset.assign !== undefined) { const id = t.dataset.assign, d = A.list.find((x) => x.id === id); await Store.updateDelivery(id, { driver_id: t.value || null, status: t.value ? (d.status === "new" ? "assigned" : d.status) : "new" }); toast(t.value ? "اتعيّن المندوب ✓" : "اتشال المندوب"); await load(); }
      else if (t.dataset.status !== undefined) { await Store.updateDelivery(t.dataset.status, { status: t.value }); toast("اتغيّرت الحالة ✓"); await load(); }
      else if (t.dataset.role !== undefined) { await Store.saveProfile({ id: t.dataset.role, role: t.value }); toast("اتحفظ ✓"); await load(); }
      else if (t.id === "logoF" && t.files[0]) { A.settings.logo = await Store.uploadFile(t.files[0], "logo"); toast("اترفع – اضغط حفظ"); render(); }
    } catch (err) { toast(err.message, "err"); }
  });
  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-tab],[data-filter],[data-newd],[data-proof],[data-fee],[data-wa],[data-del],[data-pay],[data-hand],[data-stmt],[data-unset],[data-adddrv],#saveP,#allBtn,#saveS,#resetDemo"); if (!el) return;
    const ds = el.dataset;
    try {
      if (ds.tab) { closeSheet(); A.tab = ds.tab; render(); scrollTo(0, 0); }
      else if (ds.filter) { A.filter = ds.filter; render(); }
      else if (ds.newd) newDeliverySheet();
      else if (ds.proof) sheet(`<h3>📸 إثبات التسليم</h3><img src="${esc(ds.proof)}" class="proof" style="max-height:none" alt="">`);
      else if (ds.fee) { const d = A.list.find((x) => x.id === ds.fee); sheet(`<h3>سعر توصيل #${d.no}</h3><input class="in" id="nf" type="number" step="0.25" inputmode="decimal" value="${num(d.fee)}"><button class="btn tq block" style="margin-top:10px" id="okF">حفظ</button>`, () => { $("okF").onclick = async () => { await Store.updateDelivery(d.id, { fee: num($("nf").value) }); closeSheet(); toast("اتحفظ ✓"); load(); }; }); }
      else if (ds.wa) { const d = A.list.find((x) => x.id === ds.wa), link = new URL("index.html", location.href).href + "?track=" + d.id; open(`https://wa.me/${d.receiver_phone}?text=${encodeURIComponent(`مرحباً ${d.receiver_name}، شحنتك رقم #${d.no} من ${A.settings.company_name || ""} 🛵\nتابعها من هنا: ${link}`)}`, "_blank"); }
      else if (ds.del) { if (!(await ask("حذف الشحنة نهائياً؟"))) return; await Store.deleteDelivery(ds.del); toast("اتحذفت"); await load(); }
      else if (ds.pay) moneySheet("merchant_payout", ds.pay);
      else if (ds.hand) moneySheet("driver_handover", ds.hand);
      else if (ds.stmt) stmtSheet(ds.stmt);
      else if (ds.unset) { if (!(await ask("حذف التحويل ده؟"))) return; await Store.deleteSettlement(ds.unset); closeSheet(); await load(); }
      else if (ds.adddrv) { await Store.saveProfile({ full_name: "مندوب " + (drivers().length + 1), phone: "9659999000" + (drivers().length + 3), role: "driver" }); await load(); }
      else if (el.id === "allBtn") { const v = $("allP").value; document.querySelectorAll("[data-pa]").forEach((i) => (i.value = v)); }
      else if (el.id === "saveP") { const rows = [...document.querySelectorAll("[data-pa]")].filter((i) => i.value !== "").map((i) => ({ from_zone: i.dataset.pa, to_zone: i.dataset.pb, price: num(i.value) })); const both = rows.concat(rows.filter((r) => r.from_zone !== r.to_zone).map((r) => ({ from_zone: r.to_zone, to_zone: r.from_zone, price: r.price }))); await Store.savePrices(both); toast("اتحفظت الأسعار ✓"); await load(); }
      else if (el.id === "saveS") { const s = { logo: A.settings.logo || null }; document.querySelectorAll("[data-set]").forEach((i) => (s[i.dataset.set] = i.type === "checkbox" ? i.checked : i.value.trim() || null)); await Store.saveSettings(s); toast("اتحفظ ✓"); await load(); }
      else if (el.id === "resetDemo") { if (!(await ask("مسح كل البيانات التجريبية؟"))) return; await Store.resetDemo(); await load(); }
    } catch (err) { toast(err.message, "err"); }
  });

  function beep() { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = 0.2; o.start(); setTimeout(() => { o.frequency.value = 1320; }, 150); setTimeout(() => { o.stop(); c.close(); }, 400); } catch (e) {} }
  async function load() {
    [A.list, A.profiles, A.setl, A.prices, A.locs, A.settings] = await Promise.all([Store.deliveries(), Store.profiles(), Store.settlements(), Store.prices(), Store.driverLocations(), Store.settings()]);
    const ids = new Set(A.list.filter((d) => d.status === "new").map((d) => d.id));
    if (A.known && [...ids].some((i) => !A.known.has(i))) { toast("🔔 شحنة جديدة وصلت!"); beep(); try { navigator.vibrate && navigator.vibrate([300, 100, 300]); } catch (e) {} }
    A.known = ids; document.title = (ids.size ? `(${ids.size}) ` : "") + "لوحة " + (A.settings.company_name || "");
    if (!document.getElementById("sheet") && !(document.activeElement && ["INPUT", "SELECT"].includes(document.activeElement.tagName) && A.tab !== "dels")) render();
  }
  async function boot() {
    const me = await Store.me();
    if (!me) return loginView();
    if (me.role !== "admin") return loginView("الحساب ده مش أدمن. لو ده حسابك، شغّل سطر الأدمن في Supabase (موجود آخر ملف schema.sql).");
    await load();
  }
  (async () => { try { await Store.init(); await boot(); Store._onRecovery = () => UI.recover(() => boot()); if (Store.recovery) Store._onRecovery(); } catch (e) { toast(e.message, "err"); } Store.onChange(async () => { const me = await Store.me().catch(() => null); if (me && me.role === "admin") load().catch(() => {}); }, 15000); })();
})();
