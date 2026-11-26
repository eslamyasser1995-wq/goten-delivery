// لوحة تحكم شركة التوصيل
(function () {
  const { esc, money, num, toast, sheet, closeSheet, fmtDate, LOGO, DST, AREAS, ask, makeMap, ago } = UI;
  const $ = (id) => document.getElementById(id);
  const ZONES = Object.keys(AREAS);
  const A = { rp: "month", rd: new Date().toISOString().slice(0, 10), tab: "dash", list: [], profiles: [], setl: [], prices: [], locs: [], settings: {}, filter: "open", known: null, q: "" };
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
    const earn = done.reduce((s, d) => s + num(d.driver_earning), 0), paid = A.setl.filter((x) => x.kind === "driver_payout" && x.party === id).reduce((s, x) => s + num(x.amount), 0);
    const rated = A.list.filter((d) => d.driver_id === id && d.rating), loc = A.locs.find((l) => l.driver_id === id);
    return { done: done.length, today: done.filter((d) => today(d.delivered_at)).length, active: A.list.filter((d) => d.driver_id === id && ["assigned", "picked_up"].includes(d.status)).length, col, hand, cash: col - hand,
      earn, paid, bal: col - hand - earn + paid, todayEarn: done.filter((d) => today(d.delivered_at)).reduce((s, d) => s + num(d.driver_earning), 0),
      avg: rated.length ? Math.round((rated.reduce((s, d) => s + d.rating, 0) / rated.length) * 10) / 10 : null, rates: rated.length, online: !!(loc && Date.now() - new Date(loc.updated_at) < 15 * 60e3) };
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
  const TABS = [["dash", "📊 الرئيسية"], ["rep", "📑 التقارير"], ["dels", "📦 الشحنات"], ["map", "🗺️ الخريطة"], ["merch", "🏪 المحلات"], ["drv", "🛵 المناديب"], ["prices", "💰 الأسعار"], ["set", "⚙️ الإعدادات"]];
  function render() {
    const newCount = A.list.filter((d) => d.status === "new").length;
    $("app").innerHTML = `<header class="top"><div class="wrap"><div class="row"><div class="brand">${LOGO}<div>${esc(A.settings.company_name || "Guten Delivery")}<small>لوحة التحكم</small></div></div><div class="sp"></div><button class="chip-btn" id="pushBtn">${UI.pushState() === "granted" ? "🔔" : "🔕 فعّل"}</button><button class="chip-btn" id="refBtn">🔄</button><button class="chip-btn" id="outBtn">خروج</button></div>
      <div class="tabs">${TABS.map(([k, l]) => `<button class="${A.tab === k ? "on" : ""}" data-tab="${k}">${l}${k === "dels" && newCount ? ` (${newCount})` : ""}</button>`).join("")}</div></div></header>
      <main><div class="wrap" id="body">${({ dash, rep: reports, dels, map: mapV, merch, drv, prices, set })[A.tab]()}</div></main>`;
    $("outBtn").onclick = async () => { await Store.signOut(); loginView(); };
    $("pushBtn").onclick = async () => { try { await UI.enablePush((x) => Store.savePush(x)); toast("✅ الإشعارات اتفعّلت – هيجيلك إشعار مع كل شحنة جديدة"); render(); } catch (e) { toast(/save_push/.test(e.message) ? "شغّل كود الإشعارات SQL الأول" : e.message, "err"); } };
    $("refBtn").onclick = () => load().then(() => toast("اتحدّث ✓"));
    if (A.tab === "map") drawMap();
    if (A.tab === "rep") { $("rp").onchange = () => { A.rp = $("rp").value; render(); }; $("rd").onchange = () => { A.rd = $("rd").value || A.rd; render(); }; $("repX").onclick = () => repXlsx().catch((e) => toast(e.message, "err")); $("repP").onclick = repPrint; }
    if (A.tab === "dels") { const q = $("q"); if (q) q.oninput = () => { A.q = q.value; const p = q.selectionStart; render(); const n = $("q"); n.focus(); n.setSelectionRange(p, p); }; }
  }

  function dash() {
    const td = A.list.filter((d) => today(d.created_at)), del = A.list.filter((d) => d.status === "delivered" && today(d.delivered_at));
    const fees = del.reduce((s, d) => s + num(d.fee), 0), allFees = A.list.filter((d) => d.status === "delivered").reduce((s, d) => s + num(d.fee), 0);
    const cash = drivers().reduce((s, p) => s + Math.max(0, driverSt(p.id).bal), 0), owe = merchants().reduce((s, p) => s + Math.max(0, merchantSt(p.id).bal), 0);
    const pend = A.profiles.filter((p) => p.role === "pending").length;
    const rated = A.list.filter((d) => d.rating), avg = rated.length ? (rated.reduce((a, d) => a + d.rating, 0) / rated.length).toFixed(1) : null, online = drivers().filter((p) => driverSt(p.id).online).length;
    const cnt = (s) => A.list.filter((d) => d.status === s).length;
    return `<div class="stats" style="margin-top:12px">
      <div class="stat"><span class="mut">طلبات النهارده</span><b>${td.length}</b></div><div class="stat"><span class="mut">اتسلمت النهارده</span><b>${del.length}</b></div>
      <div class="stat"><span class="mut">إيراد التوصيل النهارده</span><b>${money(fees)}</b></div><div class="stat"><span class="mut">إجمالي إيراد التوصيل</span><b>${money(allFees)}</b></div>
      <div class="stat"><span class="mut">مناديب متاحين دلوقتي</span><b style="color:#16a34a">${online} / ${drivers().length}</b></div><div class="stat"><span class="mut">متوسط التقييم</span><b>${avg ? "⭐ " + avg : "—"}</b><small class="mut">${rated.length} تقييم</small></div>
      <div class="stat"><span class="mut">كاش مع المناديب</span><b style="color:#b45309">${money(cash)}</b></div><div class="stat"><span class="mut">مستحق للمحلات</span><b style="color:#dc2626">${money(owe)}</b></div></div>
      ${pend ? `<div class="notice" data-tab="drv" style="cursor:pointer">⏳ فيه ${pend} حساب مستني موافقتك – اضغط هنا</div>` : ""}
      <div class="card"><b>حالة الشحنات</b>${Object.keys(DST).map((s) => `<div class="line"><span><span class="st" style="background:${DST[s].c}">${DST[s].ar}</span></span><b>${cnt(s)}</b></div>`).join("")}</div>
      <div class="card"><b>🔗 روابط التطبيق</b><p class="mut" style="font-size:13px">صفحة الطلب للزباين والمحلات: <b>index.html</b><br>صفحة المناديب: <b>driver.html</b></p></div>`;
  }

  // ---------- التقارير ----------
  const RP = { day: "يومي", month: "شهري", year: "سنوي" };
  function repData() {
    const d0 = new Date(A.rd + "T00:00:00"), key = (x) => { const t = new Date(x); return A.rp === "day" ? t.toDateString() === d0.toDateString() : A.rp === "month" ? t.getFullYear() === d0.getFullYear() && t.getMonth() === d0.getMonth() : t.getFullYear() === d0.getFullYear(); };
    const created = A.list.filter((d) => key(d.created_at)), done = A.list.filter((d) => d.status === "delivered" && key(d.delivered_at || d.updated_at));
    const failed = created.filter((d) => d.status === "failed"), canc = created.filter((d) => d.status === "cancelled");
    const fees = done.reduce((a, d) => a + num(d.fee), 0), earn = done.reduce((a, d) => a + num(d.driver_earning), 0), cod = done.reduce((a, d) => a + num(d.cod_amount), 0);
    const setl = A.setl.filter((x) => key(x.created_at)), sum = (k) => setl.filter((x) => x.kind === k).reduce((a, x) => a + num(x.amount), 0);
    const group = (f, lab) => { const m = {}; done.forEach((d) => { const k = f(d) || "—"; (m[k] = m[k] || { n: 0, fee: 0, cod: 0, earn: 0, r: [] }); m[k].n++; m[k].fee += num(d.fee); m[k].cod += num(d.cod_amount); m[k].earn += num(d.driver_earning); if (d.rating) m[k].r.push(d.rating); }); return Object.entries(m).map(([k, v]) => ({ k: lab(k), ...v, avg: v.r.length ? (v.r.reduce((a, b) => a + b, 0) / v.r.length).toFixed(1) : "" })).sort((a, b) => b.n - a.n); };
    const byTime = {}; done.forEach((d) => { const t = new Date(d.delivered_at || d.updated_at), k = A.rp === "day" ? String(t.getHours()).padStart(2, "0") + ":00" : A.rp === "month" ? t.toISOString().slice(0, 10) : t.toISOString().slice(0, 7); (byTime[k] = byTime[k] || { n: 0, fee: 0 }); byTime[k].n++; byTime[k].fee += num(d.fee); });
    const label = A.rp === "day" ? d0.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : A.rp === "month" ? d0.toLocaleDateString("ar-EG", { month: "long", year: "numeric" }) : String(d0.getFullYear());
    return { label, created, done, failed, canc, fees, earn, cod, net: fees - earn, hand: sum("driver_handover"), dpay: sum("driver_payout"), mpay: sum("merchant_payout"),
      byDrv: group((d) => d.driver_id, pname), byMer: group((d) => d.merchant_id, (k) => (k === "—" ? "أفراد" : pname(k))), byZone: group((d) => d.drop_zone, (k) => k), byTime: Object.entries(byTime).sort(), done };
  }
  function reports() {
    const r = repData(), rate = r.created.length ? Math.round((r.done.length / r.created.length) * 100) : 0;
    const gt = (t, g) => `<div class="card"><b>${t}</b>${g.length ? g.map((x) => `<div class="line"><span>${esc(x.k)} · ${x.n} شحنة${x.avg ? ` · ⭐ ${x.avg}` : ""}</span><b>${money(x.fee)}</b></div>`).join("") : `<p class="mut">مفيش</p>`}</div>`;
    return `<div class="card" style="margin-top:12px"><div class="row2"><select class="in" id="rp">${Object.entries(RP).map(([k, l]) => `<option value="${k}" ${A.rp === k ? "selected" : ""}>${l}</option>`).join("")}</select><input class="in" type="date" id="rd" value="${A.rd}"></div>
      <div class="mut" style="margin-top:6px">📅 ${esc(r.label)}</div><div class="acts" style="margin-top:8px"><button class="btn sm green" id="repX">📊 Excel</button><button class="btn sm tq" id="repP">🖨️ PDF</button></div></div>
      <div class="stats"><div class="stat"><span class="mut">طلبات</span><b>${r.created.length}</b></div><div class="stat"><span class="mut">اتسلمت</span><b style="color:#16a34a">${r.done.length}</b><small class="mut">${rate}%</small></div>
      <div class="stat"><span class="mut">فشلت / ملغية</span><b style="color:#dc2626">${r.failed.length} / ${r.canc.length}</b></div><div class="stat"><span class="mut">إيراد التوصيل</span><b>${money(r.fees)}</b></div>
      <div class="stat"><span class="mut">أرباح المناديب</span><b style="color:#b45309">${money(r.earn)}</b></div><div class="stat"><span class="mut">صافي الشركة</span><b style="color:${r.net >= 0 ? "#16a34a" : "#dc2626"}">${money(r.net)}</b></div>
      <div class="stat"><span class="mut">تحصيل من الزباين</span><b>${money(r.cod)}</b></div><div class="stat"><span class="mut">اتحوّل للمحلات</span><b>${money(r.mpay)}</b></div></div>
      <div class="card"><b>💵 حركة الفلوس</b><div class="line"><span>كاش استلمته من المناديب</span><b>${money(r.hand)}</b></div><div class="line"><span>أرباح صرفتها للمناديب</span><b>${money(r.dpay)}</b></div><div class="line"><span>تحويلات للمحلات</span><b>${money(r.mpay)}</b></div></div>
      ${gt("🛵 حسب المندوب", r.byDrv)}${gt("🏪 حسب المحل", r.byMer)}${gt("📍 حسب المحافظة", r.byZone)}
      <div class="card"><b>📈 ${A.rp === "day" ? "حسب الساعة" : A.rp === "month" ? "حسب اليوم" : "حسب الشهر"}</b>${r.byTime.length ? r.byTime.map(([k, v]) => `<div class="line"><span>${k} · ${v.n} شحنة</span><b>${money(v.fee)}</b></div>`).join("") : `<p class="mut">مفيش شحنات اتسلمت في الفترة دي</p>`}</div>`;
  }
  const f3 = (x) => +num(x).toFixed(3);
  async function repXlsx() {
    const r = repData(), G = (g) => [["الاسم", "شحنات", "إيراد التوصيل", "التحصيل", "أرباح المندوب", "متوسط التقييم"], ...g.map((x) => [x.k, x.n, f3(x.fee), f3(x.cod), f3(x.earn), x.avg])];
    await UI.xlsx(`تقرير-${RP[A.rp]}-${A.rd}`, [
      ["الملخص", [["البند", "القيمة"], ["الفترة", r.label], ["طلبات", r.created.length], ["اتسلمت", r.done.length], ["فشلت", r.failed.length], ["ملغية", r.canc.length], ["إيراد التوصيل", f3(r.fees)], ["أرباح المناديب", f3(r.earn)], ["صافي الشركة", f3(r.net)], ["تحصيل من الزباين", f3(r.cod)], ["كاش من المناديب", f3(r.hand)], ["أرباح اتصرفت", f3(r.dpay)], ["تحويلات للمحلات", f3(r.mpay)]]],
      ["الشحنات", [["رقم", "تاريخ التسليم", "المحل", "المرسل", "المستلم", "من", "إلى", "المندوب", "التوصيل", "على", "التحصيل", "ربح المندوب", "التقييم"], ...r.done.map((d) => [d.no, fmtDate(d.delivered_at), d.merchant_id ? pname(d.merchant_id) : "فرد", d.sender_name, d.receiver_name, d.pickup_area, d.drop_area, d.driver_id ? pname(d.driver_id) : "", f3(d.fee), d.fee_payer === "receiver" ? "المستلم" : "المرسل", f3(d.cod_amount), f3(d.driver_earning), d.rating || ""])]],
      ["المناديب", G(r.byDrv)], ["المحلات", G(r.byMer)], ["المحافظات", G(r.byZone)], ["حسب الوقت", [["الوقت", "شحنات", "إيراد"], ...r.byTime.map(([k, v]) => [k, v.n, f3(v.fee)])]]]);
  }
  function repPrint() {
    const r = repData(), G = (t, g) => `<h2>${t}</h2>` + UI.tbl(["الاسم", "شحنات", "إيراد التوصيل", "التحصيل", "أرباح المندوب", "التقييم"], g.map((x) => [x.k, x.n, x.fee.toFixed(3), x.cod.toFixed(3), x.earn.toFixed(3), x.avg]));
    UI.printDoc("تقرير " + r.label, `<h1>📑 ${esc(A.settings.company_name || "Guten Delivery")} – تقرير ${RP[A.rp]}</h1><div class="m">${esc(r.label)}</div>
      <div class="k"><div>طلبات<b>${r.created.length}</b></div><div>اتسلمت<b>${r.done.length}</b></div><div>فشلت/ملغية<b>${r.failed.length}/${r.canc.length}</b></div><div>إيراد التوصيل<b>${money(r.fees)}</b></div><div>أرباح المناديب<b>${money(r.earn)}</b></div><div>صافي الشركة<b>${money(r.net)}</b></div><div>تحصيل<b>${money(r.cod)}</b></div></div>
      ${G("حسب المندوب", r.byDrv)}${G("حسب المحل", r.byMer)}${G("حسب المحافظة", r.byZone)}
      <h2>الشحنات المسلّمة</h2>${UI.tbl(["رقم", "التاريخ", "المستلم", "إلى", "المندوب", "التوصيل", "التحصيل"], r.done.map((d) => [d.no, fmtDate(d.delivered_at), d.receiver_name, d.drop_area, d.driver_id ? pname(d.driver_id) : "", num(d.fee).toFixed(3), num(d.cod_amount).toFixed(3)]), ["الإجمالي", "", "", "", "", r.fees.toFixed(3), r.cod.toFixed(3)])}`);
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
      ${d.status === "new" && d.offered_to ? `<div class="pill" style="background:#fef3c7;color:#92400e">⏳ معروضة على ${esc(pname(d.offered_to))}</div>` : d.status === "new" && A.settings.auto_dispatch !== false ? `<div class="pill">🤖 مستنية مندوب متاح</div>` : ""}
      ${d.rating ? `<div>${UI.stars(d.rating, 14)}${d.rating_note ? ` <span class="mut">«${esc(d.rating_note)}»</span>` : ""}</div>` : ""}
      <div style="margin:6px 0"><span class="pill">توصيل ${money(d.fee)} على ${d.fee_payer === "receiver" ? "المستلم" : "المرسل"}</span>${d.driver_earning != null ? ` <span class="pill">ربح المندوب ${money(d.driver_earning)}</span>` : ""} ${c ? `<span class="pill cod">💵 تحصيل ${money(c)}</span>` : ""} <span class="mut" style="font-size:12px">${fmtDate(d.created_at)}</span></div>
      <div class="row2"><select class="in" data-assign="${d.id}"><option value="">— اختار مندوب —</option>${drivers().map((p) => `<option value="${p.id}" ${d.driver_id === p.id ? "selected" : ""}>🛵 ${esc(p.full_name || p.phone)} (${driverSt(p.id).active})</option>`).join("")}</select>
        <select class="in" data-status="${d.id}">${Object.keys(DST).map((s) => `<option value="${s}" ${d.status === s ? "selected" : ""}>${DST[s].ar}</option>`).join("")}</select></div>
      <div class="acts">${d.proof_url ? `<button class="btn sm ghost" data-proof="${esc(d.proof_url)}">📸 الإثبات</button>` : ""}<button class="btn sm ghost" data-fee="${d.id}">✏️ السعر</button><button class="btn sm ghost" data-wa="${d.id}">💬 رابط للمستلم</button><button class="btn sm ghost" style="color:var(--red)" data-del="${d.id}">🗑️ حذف</button></div></div>`;
  }
  function newDeliverySheet() {
    const opts = `<option value="">اختر المنطقة</option>` + Object.entries(AREAS).map(([g, arr]) => `<optgroup label="${g}">${arr.map((x) => `<option>${x}</option>`).join("")}</optgroup>`).join("");
    const mopts = `<option value="">— فرد (مش محل) —</option>` + merchants().map((m) => `<option value="${m.id}">🏪 ${esc(m.business_name || m.full_name)}</option>`).join("");
    const dopts = `<option value="">🤖 وزّع تلقائي / بعدين</option>` + drivers().map((p) => { const s = driverSt(p.id); return `<option value="${p.id}">${s.online ? "🟢" : "⚪"} ${esc(p.full_name || p.phone)} (معاه ${s.active})</option>`; }).join("");
    const f = (id, l, t = "text", x = "") => `<label class="f"><span>${l}</span><input class="in" id="${id}" type="${t}" ${x}></label>`;
    const drop = (i) => `<div class="card" data-nd="${i}" style="padding:10px"><b>🟩 المستلم ${i + 1}</b>${i ? ` <button class="btn sm ghost" data-rmnd="${i}">✕</button>` : ""}<div class="row2">${f("nr" + i, "الاسم")}${f("nrp" + i, "الهاتف", "tel", 'inputmode="numeric" maxlength="8"')}</div><label class="f"><span>المنطقة</span><select class="in" id="nra${i}">${opts}</select></label>${f("nrd" + i, "العنوان")}${f("ncod" + i, "مبلغ التحصيل (د.ك)", "number", 'step="0.005" inputmode="decimal"')}</div>`;
    sheet(`<h3>➕ طلب جديد (واتساب / تليفون)</h3><label class="f"><span>المحل</span><select class="in" id="nm">${mopts}</select></label>
      <b>🟦 المرسل</b><div class="row2">${f("ns", "الاسم")}${f("nsp", "الهاتف", "tel", 'inputmode="numeric" maxlength="8"')}</div><label class="f"><span>المنطقة</span><select class="in" id="nsa">${opts}</select></label>${f("nsd", "العنوان")}
      <div id="nds">${drop(0)}</div><button class="btn ghost block" id="addNd" style="margin-bottom:10px">➕ عنوان تسليم تاني</button>
      ${f("npk", "الشحنة")}
      <div class="row2"><label class="f"><span>التوصيل يدفعه</span><select class="in" id="npay"><option value="sender">المرسل</option><option value="receiver">المستلم</option></select></label>${f("nfee", "سعر خاص (اختياري)", "number", 'step="0.25" inputmode="decimal" placeholder="حسب الأسعار"')}</div>
      <label class="f"><span>🛵 ابعتها لمندوب على طول</span><select class="in" id="ndrv">${dopts}</select></label>
      <button class="btn tq block" id="nsave">حفظ الطلب</button>`, () => {
      let n = 1;
      $("nm").onchange = () => { const m = A.profiles.find((p) => p.id === $("nm").value); if (!m) return; $("ns").value = m.business_name || m.full_name || ""; $("nsp").value = String(m.phone || "").replace(/^965/, ""); $("nsa").value = m.pickup_area || ""; $("nsd").value = m.pickup_address || ""; };
      $("addNd").onclick = () => { if (document.querySelectorAll("[data-nd]").length >= 10) return toast("أقصى 10 عناوين", "err"); $("nds").insertAdjacentHTML("beforeend", drop(n++)); };
      $("nds").onclick = (e) => { const b = e.target.closest("[data-rmnd]"); if (b) document.querySelector(`[data-nd="${b.dataset.rmnd}"]`).remove(); };
      $("nsave").onclick = async () => {
        const v = (id) => ($(id) ? $(id).value.trim() : ""), p8 = (x) => x.replace(/\D/g, "").replace(/^965(?=\d{8}$)/, "");
        const base = { merchant_id: v("nm") || null, sender_name: v("ns"), sender_phone: "965" + p8(v("nsp")), pickup_area: v("nsa"), pickup_address: v("nsd"), package: v("npk"), fee_payer: v("npay"), fee_override: v("nfee") === "" ? null : num(v("nfee")) };
        const ids = [...document.querySelectorAll("[data-nd]")].map((x) => x.dataset.nd);
        const list = ids.map((i) => ({ ...base, receiver_name: v("nr" + i), receiver_phone: "965" + p8(v("nrp" + i)), drop_area: v("nra" + i), drop_address: v("nrd" + i), cod_amount: num(v("ncod" + i)) }));
        if (base.sender_name.length < 2 || !base.pickup_area || base.sender_phone.length !== 11) return toast("كمّل اسم المرسل ورقمه (8 أرقام) ومنطقته", "err");
        if (list.some((p) => p.receiver_name.length < 2 || !p.drop_area || p.receiver_phone.length !== 11)) return toast("كمّل أسماء وأرقام ومناطق المستلمين", "err");
        $("nsave").disabled = true; const drv = v("ndrv"), ok = [], bad = [];
        for (const p of list) { try { const r = await Store.createDelivery(p); if (drv) await Store.updateDelivery(r.id, { driver_id: drv, status: "assigned", offered_to: null }); ok.push(r.no); } catch (e) { bad.push(p.receiver_name + ": " + e.message); } }
        closeSheet(); if (ok.length) toast(`اتسجّل ${ok.length > 1 ? ok.length + " شحنات" : "#" + ok[0]}${drv ? " واتبعت لـ " + pname(drv) : ""} ✓`); if (bad.length) toast("⚠️ " + bad.join(" · "), "err"); await load();
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
      ${drivers().map((p) => { const s = driverSt(p.id); return userRow(p, `<div class="line"><span>${s.online ? "🟢 متاح دلوقتي" : "⚪ مش متاح"} · ${s.avg ? `${UI.stars(s.avg, 13)} ${s.avg} (${s.rates})` : "لسه مفيش تقييم"}</span></div>
        <div class="line"><span>شغّال عليه: ${s.active} · النهارده: ${s.today} · الكل: ${s.done}</span></div>
        <div class="line"><span>💵 حصّل من الزباين</span><b>${money(s.col)}</b></div><div class="line"><span>− سلّم للشركة</span><b>${money(s.hand)}</b></div>
        <div class="line"><span>− أرباحه (النهارده ${money(s.todayEarn)})</span><b>${money(s.earn)}</b></div><div class="line"><span>+ اتصرفله</span><b>${money(s.paid)}</b></div>
        <div class="line total"><span>${s.bal >= 0 ? "عليه للشركة" : "ليه عند الشركة"}</span><span style="color:${s.bal > 0.0005 ? "#b45309" : "#16a34a"}">${money(Math.abs(s.bal))}</span></div>
        <div class="acts"><button class="btn sm green" data-hand="${p.id}">💵 استلمت منه كاش</button><button class="btn sm tq" data-dpay="${p.id}">💸 صرفت له أرباح</button><button class="btn sm ghost" data-revs="${p.id}">⭐ التقييمات</button><button class="btn sm ghost" data-dstmt="${p.id}">📊 Excel</button></div>`); }).join("") || `<p class="mut">المناديب بيسجّلوا من صفحة driver.html وبعدين توافق عليهم هنا.</p>`}
      ${others.length ? `<div class="h2">👑 الإدارة والمحظورين</div>${others.map((p) => userRow(p)).join("")}` : ""}
      ${!Store.live ? `<button class="btn ghost block" data-adddrv="1">➕ مندوب تجريبي</button>` : ""}`;
  }
  function moneySheet(kind, id) {
    const isPay = kind === "merchant_payout", isDP = kind === "driver_payout", s = isPay ? merchantSt(id) : driverSt(id), def = Math.max(0, isPay ? s.bal : isDP ? -s.bal : s.bal);
    sheet(`<h3>${isPay ? "💸 تحويل فلوس لـ" : isDP ? "💸 صرف أرباح لـ" : "💵 استلام كاش من"} ${esc(pname(id))}</h3><p class="mut">${isPay ? "المستحق ليه" : isDP ? "ليه عند الشركة" : "عليه للشركة (الكاش ناقص أرباحه)"}: <b>${money(def)}</b></p>
      <label class="f"><span>المبلغ (د.ك)</span><input class="in" id="amt" type="number" step="0.005" inputmode="decimal" value="${def.toFixed(3)}"></label>
      <label class="f"><span>ملاحظة</span><input class="in" id="nt" placeholder="${isPay ? "مثال: تحويل بنكي / كاش" : ""}"></label><button class="btn green block" id="okAmt">حفظ</button>`, () => {
      $("okAmt").onclick = async () => { const a = num($("amt").value); if (a <= 0) return toast("اكتب مبلغ", "err"); try { await Store.saveSettlement({ kind, party: id, amount: a, note: $("nt").value.trim() || null }); closeSheet(); toast("اتسجّل ✓"); await load(); } catch (e) { toast(e.message, "err"); } };
    });
  }
  function stmtSheet(id) {
    const rows = A.list.filter((d) => d.merchant_id === id && d.status === "delivered"), pays = A.setl.filter((x) => x.kind === "merchant_payout" && x.party === id), s = merchantSt(id), m = A.profiles.find((p) => p.id === id) || {};
    const fee = (d) => (d.fee_payer === "sender" ? num(d.fee) : 0), cod = rows.reduce((a, d) => a + num(d.cod_amount), 0), fees = rows.reduce((a, d) => a + fee(d), 0);
    const H = ["رقم", "تاريخ التسليم", "المستلم", "المنطقة", "التحصيل", "التوصيل على المحل", "الصافي"], R = rows.map((d) => [d.no, fmtDate(d.delivered_at), d.receiver_name, d.drop_area, f3(d.cod_amount), f3(fee(d)), f3(num(d.cod_amount) - fee(d))]);
    sheet(`<h3>📒 كشف حساب ${esc(pname(id))}</h3>
      ${rows.map((d) => `<div class="line"><span>#${d.no} · ${esc(d.drop_area)} · ${fmtDate(d.delivered_at)}</span><b>${money(num(d.cod_amount) - fee(d))}</b></div>`).join("") || `<p class="mut">مفيش شحنات اتسلمت</p>`}
      ${pays.map((x) => `<div class="line" style="color:#16a34a"><span>✅ تحويل ${fmtDate(x.created_at)} ${x.note ? esc(x.note) : ""} <button class="btn sm ghost" data-unset="${x.id}">🗑️</button></span><b>−${money(x.amount)}</b></div>`).join("")}
      <div class="line total"><span>الرصيد</span><span>${money(s.bal)}</span></div><div class="acts"><button class="btn sm green" id="csvBtn">📊 Excel</button><button class="btn sm tq" id="pdfBtn">🧾 فاتورة PDF</button>${m.phone ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/${esc(m.phone)}?text=${encodeURIComponent(`كشف حساب ${pname(id)}\nشحنات اتسلمت: ${rows.length}\nاتحصّل: ${cod.toFixed(3)} د.ك\nالتوصيل: ${fees.toFixed(3)} د.ك\nاتحوّل: ${s.paid.toFixed(3)} د.ك\nالرصيد: ${s.bal.toFixed(3)} د.ك`)}">💬 واتساب</a>` : ""}</div>`, () => {
      $("csvBtn").onclick = () => UI.xlsx("كشف-" + pname(id), [["الشحنات", [H, ...R, ["الإجمالي", "", "", "", f3(cod), f3(fees), f3(cod - fees)]]], ["التحويلات", [["التاريخ", "ملاحظة", "المبلغ"], ...pays.map((x) => [fmtDate(x.created_at), x.note || "", f3(x.amount)])]], ["الملخص", [["البند", "المبلغ"], ["اتحصّل", f3(cod)], ["التوصيل", f3(fees)], ["اتحوّل", f3(s.paid)], ["الرصيد", f3(s.bal)]]]]).catch((e) => toast(e.message, "err"));
      $("pdfBtn").onclick = () => UI.printDoc("كشف " + pname(id), `<h1>🧾 ${esc(A.settings.company_name || "Guten Delivery")} – كشف حساب</h1><div class="m">${esc(pname(id))}${m.phone ? " · " + esc(m.phone) : ""}</div>
        <div class="k"><div>شحنات<b>${rows.length}</b></div><div>اتحصّل<b>${money(cod)}</b></div><div>التوصيل<b>${money(fees)}</b></div><div>اتحوّل<b>${money(s.paid)}</b></div><div>${s.bal >= 0 ? "ليه عندنا" : "عليه"}<b>${money(Math.abs(s.bal))}</b></div></div>
        <h2>الشحنات</h2>${UI.tbl(H, R.map((r) => r.map((c, i) => (i >= 4 ? Number(c).toFixed(3) : c))), ["الإجمالي", "", "", "", cod.toFixed(3), fees.toFixed(3), (cod - fees).toFixed(3)])}${pays.length ? `<h2>التحويلات</h2>${UI.tbl(["التاريخ", "ملاحظة", "المبلغ"], pays.map((x) => [fmtDate(x.created_at), x.note || "", num(x.amount).toFixed(3)]))}` : ""}`);
    });
  }
  function revsSheet(id) {
    const r = A.list.filter((d) => d.driver_id === id && d.rating).sort((a, b) => new Date(b.delivered_at || b.updated_at) - new Date(a.delivered_at || a.updated_at)), s = driverSt(id);
    const dist = [5, 4, 3, 2, 1].map((n) => [n, r.filter((d) => d.rating === n).length]);
    sheet(`<h3>⭐ تقييمات ${esc(pname(id))}</h3><div class="line total"><span>${s.avg ? UI.stars(s.avg, 16) + " " + s.avg : "لسه مفيش"}</span><span>${r.length} تقييم</span></div>
      ${dist.map(([n, c]) => `<div class="line"><span>${"★".repeat(n)}</span><span style="flex:1;margin:0 8px;background:#e2e8f0;border-radius:6px;height:8px;overflow:hidden"><i style="display:block;height:100%;width:${r.length ? (c / r.length) * 100 : 0}%;background:#f59e0b"></i></span><b>${c}</b></div>`).join("")}
      ${r.map((d) => `<div class="card" style="padding:8px"><div class="line"><span>${UI.stars(d.rating, 13)} #${d.no}</span><span class="mut">${fmtDate(d.delivered_at)}</span></div>${d.rating_note ? `<div>«${esc(d.rating_note)}»</div>` : ""}<div class="mut">${esc(d.receiver_name)} · ${esc(d.drop_area)}</div></div>`).join("")}`);
  }
  function dstmtSheet(id) {
    const s = driverSt(id), rows = A.list.filter((d) => d.driver_id === id && d.status === "delivered"), mv = A.setl.filter((x) => x.party === id && ["driver_handover", "driver_payout"].includes(x.kind));
    const H = ["رقم", "التاريخ", "المستلم", "المنطقة", "حصّل", "ربحه"], R = rows.map((d) => [d.no, fmtDate(d.delivered_at), d.receiver_name, d.drop_area, f3(collectOf(d)), f3(d.driver_earning)]);
    UI.xlsx("محفظة-" + pname(id), [["الشحنات", [H, ...R, ["الإجمالي", "", "", "", f3(s.col), f3(s.earn)]]], ["الحركات", [["التاريخ", "النوع", "ملاحظة", "المبلغ"], ...mv.map((x) => [fmtDate(x.created_at), x.kind === "driver_handover" ? "سلّم كاش" : "اتصرفله أرباح", x.note || "", f3(x.amount)])]], ["الملخص", [["البند", "المبلغ"], ["حصّل", f3(s.col)], ["سلّم", f3(s.hand)], ["أرباحه", f3(s.earn)], ["اتصرفله", f3(s.paid)], [s.bal >= 0 ? "عليه" : "ليه", f3(Math.abs(s.bal))]]]]).catch((e) => toast(e.message, "err"));
  }

  // ---------- الأسعار ----------
  function prices() {
    const get = (a, b) => { const p = A.prices.find((x) => x.from_zone === a && x.to_zone === b) || A.prices.find((x) => x.from_zone === b && x.to_zone === a); return p ? num(p.price) : ""; };
    const st = A.settings, km = st.price_mode === "km", pf = (k, l, v) => `<label class="f"><span>${l}</span><input class="in" type="number" step="0.005" min="0" inputmode="decimal" data-pm="${k}" value="${esc(st[k] == null ? v : st[k])}"></label>`;
    const ex = (a, b) => { const A1 = UI.ZLL[a], A2 = UI.ZLL[b], k = a === b ? 0 : UI.km(A1, A2); let f = Math.max(num(st.min_fee), Math.round((num(st.base_fee) + num(st.per_km) * k) * 4) / 4); if (num(st.max_fee) > 0) f = Math.min(f, num(st.max_fee)); return `${a} ← ${b}: ${k.toFixed(0)} كم = <b>${money(f)}</b>`; };
    return `<div class="card" style="margin-top:12px"><b>⚙️ طريقة حساب السعر</b>
      <label class="radio"><input type="radio" name="pmode" value="zone" ${!km ? "checked" : ""}> 🗺️ حسب المحافظة (الجدول تحت)</label><label class="radio"><input type="radio" name="pmode" value="km" ${km ? "checked" : ""}> 📏 حسب المسافة (كيلو)</label>
      <div class="row2">${pf("base_fee", "سعر فتح الطلب", 1)}${pf("per_km", "سعر الكيلو", 0.1)}</div><div class="row2">${pf("min_fee", "أقل سعر", 1)}${pf("max_fee", "أعلى سعر (اختياري)", "")}</div>
      ${km ? `<p class="mut" style="font-size:13px">أمثلة: ${ex("العاصمة", "حولي")}<br>${ex("العاصمة", "الجهراء")}<br>${ex("الأحمدي", "الجهراء")}</p>` : `<p class="mut" style="font-size:13px">المسافة بتتحسب بين مراكز المحافظات وبتتقرّب لأقرب ربع دينار.</p>`}
      <button class="btn tq block" id="savePM">💾 حفظ طريقة الحساب</button></div>
      <div class="card" style="${km ? "opacity:.55" : ""}"><b>💰 سعر التوصيل بين المحافظات (د.ك)</b>${km ? ` <span class="pill">مش مستخدم دلوقتي</span>` : ""}<p class="mut" style="font-size:13px">من (يمين) ← إلى (فوق). السعر بيتطبق في الاتجاهين.</p>
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
      <div class="h2" style="margin-top:14px">🤖 التوزيع التلقائي</div>
      <label class="radio"><input type="checkbox" data-set="auto_dispatch" ${s.auto_dispatch !== false ? "checked" : ""}> وزّع الشحنات الجديدة لوحدها على أقرب مندوب متاح</label>
      <div class="row2"><label class="f"><span>مهلة القبول (ثانية)</span><input class="in" type="number" min="20" data-set="offer_seconds" value="${esc(s.offer_seconds || 60)}"></label><label class="f"><span>أقصى شحنات مع المندوب</span><input class="in" type="number" min="1" data-set="max_active" value="${esc(s.max_active || 3)}"></label></div>
      <div class="h2">💰 أرباح المندوب من كل شحنة</div>
      <div class="row2"><label class="f"><span>طريقة الحساب</span><select class="in" data-set="driver_pay_type"><option value="fixed" ${s.driver_pay_type !== "percent" ? "selected" : ""}>مبلغ ثابت (د.ك)</option><option value="percent" ${s.driver_pay_type === "percent" ? "selected" : ""}>نسبة من سعر التوصيل %</option></select></label><label class="f"><span>القيمة</span><input class="in" type="number" step="0.005" min="0" inputmode="decimal" data-set="driver_pay" value="${esc(s.driver_pay ?? 0.5)}"></label></div>
      <p class="mut" style="font-size:12px">بتتحسب على كل شحنة لحظة التسليم.</p>
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
    const el = e.target.closest("[data-tab],[data-filter],[data-newd],[data-proof],[data-fee],[data-wa],[data-del],[data-pay],[data-hand],[data-dpay],[data-stmt],[data-unset],[data-adddrv],[data-revs],[data-dstmt],#savePM,#saveP,#allBtn,#saveS,#resetDemo"); if (!el) return;
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
      else if (ds.dpay) moneySheet("driver_payout", ds.dpay);
      else if (ds.stmt) stmtSheet(ds.stmt);
      else if (ds.revs) revsSheet(ds.revs);
      else if (ds.dstmt) dstmtSheet(ds.dstmt);
      else if (el.id === "savePM") { const s = { price_mode: (document.querySelector("input[name=pmode]:checked") || {}).value || "zone" }; document.querySelectorAll("[data-pm]").forEach((i) => (s[i.dataset.pm] = i.value === "" ? null : num(i.value))); await Store.saveSettings(s); toast("اتحفظ ✓"); await load(); }
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
    await Store.dispatchTick();
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
