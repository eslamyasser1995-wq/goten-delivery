// صفحة العملاء والمحلات: طلب توصيل + تتبع + حساب المحل
(function () {
  const { esc, money, num, ls, toast, sheet, closeSheet, AREAS, fmtDate, LOGO, DST, DFLOW, zoneOf, ago, makeMap } = UI;
  const $ = (id) => document.getElementById(id);
  const S = { view: "new", me: null, settings: {}, prices: [], mine: ls.get("tw_mine", []), last: ls.get("tw_last", {}), list: [], setl: [] };
  const P8 = /^[124569]\d{7}$/;
  const ph = (v) => String(v || "").replace(/\D/g, "").replace(/^965(?=\d{8}$)/, "");
  const areaOptions = (sel) => `<option value="">اختر المنطقة</option>` + Object.entries(AREAS).map(([g, arr]) => `<optgroup label="${g}">${arr.map((x) => `<option ${sel === x ? "selected" : ""}>${x}</option>`).join("")}</optgroup>`).join("");
  const isMerchant = () => S.me && S.me.role === "merchant";

  function feeFor(a1, a2) {
    const z1 = zoneOf(a1), z2 = zoneOf(a2); if (!z1 || !z2) return null;
    const p = S.prices.find((x) => x.from_zone === z1 && x.to_zone === z2) || S.prices.find((x) => x.from_zone === z2 && x.to_zone === z1);
    return p ? num(p.price) : null;
  }

  // ---------- الواجهة ----------
  function header() {
    const s = S.settings;
    return `<header class="shop-top"><div class="wrap"><div class="shop-row"><div class="shop-side"></div>
      <div class="shop-brand">${s.logo ? `<img src="${esc(s.logo)}" alt="">` : LOGO}<span>${esc(s.company_name || "Goten Delivery")}</span></div>
      <div class="shop-side end">${s.whatsapp ? `<a class="icon-btn" target="_blank" rel="noopener" href="https://wa.me/${esc(s.whatsapp)}" aria-label="whatsapp">💬</a>` : ""}</div></div></div></header>`;
  }
  function field(id, label, val, type = "text", extra = "") { return `<label class="f"><span>${label}</span><input class="in" id="${id}" type="${type}" value="${esc(val || "")}" ${extra}></label>`; }
  function newView() {
    const s = S.settings, m = isMerchant() ? S.me : null, l = S.last;
    const snd = m ? { name: m.business_name || m.full_name, phone: ph(m.phone), area: m.pickup_area, addr: m.pickup_address } : { name: l.sender_name, phone: ph(l.sender_phone), area: l.pickup_area, addr: l.pickup_address };
    return `<div class="wrap">
      ${s.tagline ? `<p class="mut" style="text-align:center;margin:14px 0 4px">${esc(s.tagline)}</p>` : ""}
      ${!s.is_open ? `<div class="notice">⛔ مش بنستقبل طلبات دلوقتي</div>` : ""}${s.notice ? `<div class="notice">📢 ${esc(s.notice)}</div>` : ""}
      ${m ? `<div class="notice" style="background:#e8fafa;color:#0e7490">🏪 بتطلب باسم <b>${esc(m.business_name || m.full_name)}</b> – الشحنة هتتسجّل في كشف حسابك</div>` : ""}
      <div class="card"><div class="sec-t"><span class="dot1">1</span> الاستلام من (المرسل)</div>
        <div class="row2">${field("sName", "الاسم *", snd.name)}${field("sPhone", "الهاتف *", snd.phone, "tel", 'inputmode="numeric" maxlength="8" placeholder="5xxxxxxx"')}</div>
        <label class="f"><span>المنطقة *</span><select class="in" id="sArea">${areaOptions(snd.area)}</select></label>
        ${field("sAddr", "العنوان (قطعة، شارع، منزل)", snd.addr)}</div>
      <div class="card"><div class="sec-t"><span class="dot1 b">2</span> التسليم إلى (المستلم)</div>
        <div class="row2">${field("rName", "الاسم *", "")}${field("rPhone", "الهاتف *", "", "tel", 'inputmode="numeric" maxlength="8" placeholder="5xxxxxxx"')}</div>
        <label class="f"><span>المنطقة *</span><select class="in" id="rArea">${areaOptions("")}</select></label>
        ${field("rAddr", "العنوان (قطعة، شارع، منزل)", "")}</div>
      <div class="card"><div class="sec-t"><span class="dot1 c">3</span> تفاصيل الشحنة</div>
        ${field("pkg", "إيه اللي هيتوصّل؟", "", "text", 'placeholder="مثال: طلب أكل، كرتونة ملابس، مستندات"')}
        ${field("cod", "مبلغ يتحصّل من المستلم (د.ك) – اتركه فاضي لو مدفوع", "", "number", 'step="0.005" min="0" inputmode="decimal"')}
        <div class="f"><span class="mut" style="font-size:13px;font-weight:600">سعر التوصيل يدفعه</span>
          <div class="row2" style="margin-top:6px"><label class="radio"><input type="radio" name="payer" value="sender" checked> المرسل</label><label class="radio"><input type="radio" name="payer" value="receiver"> المستلم</label></div></div>
        <label class="f"><span>الوقت</span><select class="in" id="sched"><option>بأسرع وقت</option><option>اليوم – الفترة المسائية</option><option>بكرة – الصبح</option><option>بكرة – بالليل</option></select></label>
        ${field("notes", "ملاحظات للمندوب", "")}</div>
      <div class="card quote" id="quote"></div>
      <button class="btn tq block" id="send" ${!s.is_open ? "disabled" : ""}>🛵 اطلب المندوب</button>
      <p class="mut" style="text-align:center;margin:18px 0">${isMerchant() ? "" : "عندك محل؟ سجّل من «حسابي» وخد كشف حساب أسبوعي 🏪"}</p></div>`;
  }
  function quoteHtml() {
    const a1 = $("sArea") && $("sArea").value, a2 = $("rArea") && $("rArea").value;
    const fee = feeFor(a1, a2), cod = num($("cod") && $("cod").value), payer = (document.querySelector("input[name=payer]:checked") || {}).value;
    if (fee == null) return `<div class="mut" style="text-align:center">اختار منطقة الاستلام والتسليم علشان يظهرلك السعر</div>`;
    const collect = cod + (payer === "receiver" ? fee : 0);
    return `<div class="line"><span>سعر التوصيل (${esc(zoneOf(a1))} ← ${esc(zoneOf(a2))})</span><b>${money(fee)}</b></div>
      <div class="line total"><span>المندوب هيحصّل من المستلم</span><span>${collect ? money(collect) : "ولا حاجة"}</span></div>
      ${payer === "sender" ? `<div class="mut">المرسل يدفع التوصيل ${money(fee)}${cod ? " – بيتخصم من المبلغ المحصّل" : ""}</div>` : ""}`;
  }
  async function send() {
    const v = (id) => ($(id) ? $(id).value.trim() : "");
    const p = { sender_name: v("sName"), sender_phone: ph(v("sPhone")), pickup_area: v("sArea"), pickup_address: v("sAddr"), receiver_name: v("rName"), receiver_phone: ph(v("rPhone")), drop_area: v("rArea"), drop_address: v("rAddr"), package: v("pkg"), cod_amount: num(v("cod")), fee_payer: (document.querySelector("input[name=payer]:checked") || {}).value || "sender", schedule: v("sched"), notes: v("notes") };
    if (p.sender_name.length < 2 || p.receiver_name.length < 2 || !p.pickup_area || !p.drop_area) return toast("عبّي الأسماء والمناطق", "err");
    if (!P8.test(p.sender_phone) || !P8.test(p.receiver_phone)) return toast("رقم الهاتف لازم 8 أرقام", "err");
    p.sender_phone = "965" + p.sender_phone; p.receiver_phone = "965" + p.receiver_phone;
    $("send").disabled = true;
    try {
      const r = await Store.createDelivery(p);
      S.last = { sender_name: p.sender_name, sender_phone: p.sender_phone, pickup_area: p.pickup_area, pickup_address: p.pickup_address }; ls.set("tw_last", S.last);
      S.mine.unshift({ id: r.id, no: r.no, to: p.receiver_name, area: p.drop_area, at: new Date().toISOString() }); ls.set("tw_mine", S.mine.slice(0, 100));
      const link = location.origin + location.pathname + "?track=" + r.id;
      const msg = `مرحباً ${p.receiver_name}، شحنتك رقم #${r.no} في الطريق إليك 🛵\nتابعها من هنا: ${link}`;
      S.view = "list"; await loadList(); render();
      sheet(`<div class="empty" style="padding:16px 0"><div class="e">✅</div><h2>تم تسجيل الطلب</h2><p>رقم الشحنة <b>#${r.no}</b> · التوصيل <b>${money(r.fee)}</b></p>
        <a class="btn green block" target="_blank" rel="noopener" href="https://wa.me/${p.receiver_phone}?text=${encodeURIComponent(msg)}">💬 ابعت رابط التتبع للمستلم</a>
        <button class="btn tq block" style="margin-top:8px" data-track="${r.id}">📍 تتبع الشحنة</button></div>`);
    } catch (e) { const m = String(e.message); toast(m.includes("CLOSED") ? "مش بنستقبل طلبات دلوقتي" : m.includes("PHONE") ? "رقم الهاتف غلط" : m.includes("AREA") || m.includes("PRICE") ? "المنطقة دي مش متاحة" : m, "err"); $("send").disabled = false; }
  }

  async function loadList() { if (isMerchant()) { S.list = await Store.deliveries(); S.setl = await Store.settlements(); } }
  function listView() {
    const rows = isMerchant() ? S.list.map((d) => ({ id: d.id, no: d.no, to: d.receiver_name, area: d.drop_area, at: d.created_at, st: d.status, cod: d.cod_amount, fee: d.fee })) : S.mine;
    if (!rows.length) return `<div class="wrap"><div class="empty"><div class="e">📦</div>لسه مفيش شحنات</div></div>`;
    return `<div class="wrap"><div class="h2">شحناتي</div>${rows.map((r) => `<div class="ord" data-track="${r.id}" style="cursor:pointer;border-color:${r.st ? DST[r.st].c : "#cbd5e1"}"><div class="hd"><b>#${r.no} · ${esc(r.to || "")}</b><span class="st" id="st_${r.id}" style="background:${r.st ? DST[r.st].c : "#94a3b8"}">${r.st ? DST[r.st].ar : "…"}</span></div><div class="mut">📍 ${esc(r.area || "")} · ${fmtDate(r.at)}${r.cod ? ` · تحصيل ${money(r.cod)}` : ""}</div></div>`).join("")}</div>`;
  }
  async function fillStatuses() { if (isMerchant()) return; for (const r of S.mine.slice(0, 20)) { try { const d = await Store.trackDelivery(r.id); const el = $("st_" + r.id); if (d && el) { el.textContent = DST[d.status].ar; el.style.background = DST[d.status].c; } } catch (e) {} } }

  async function openTrack(id) {
    let d; try { d = await Store.trackDelivery(id); } catch (e) { return toast(e.message, "err"); }
    if (!d) return toast("الشحنة مش موجودة", "err");
    const idx = DFLOW.indexOf(d.status), bad = ["failed", "cancelled"].includes(d.status);
    const collect = num(d.cod_amount) + (d.fee_payer === "receiver" ? num(d.fee) : 0);
    sheet(`<h3 style="margin:4px 0">شحنة #${d.no}</h3><div class="mut">${esc(d.pickup_area)} ← ${esc(d.drop_area)} · ${fmtDate(d.created_at)}</div>
      ${bad ? `<p><span class="st" style="background:${DST[d.status].c}">${DST[d.status].ar}</span> ${d.failed_reason ? esc(d.failed_reason) : ""}</p>` :
        `<div class="timeline">${DFLOW.map((s, i) => `<div class="tl ${i <= idx ? "done" : ""}"><span class="dot">${i <= idx ? "✓" : ""}</span>${DST[s].ar}</div>`).join("")}</div>`}
      ${d.driver_name ? `<div class="card" style="background:#effcfc"><b>🛵 المندوب: ${esc(d.driver_name)}</b>${d.driver_phone ? ` <a class="btn sm tq" href="tel:+${esc(d.driver_phone)}">📞 اتصال</a>` : ""}</div>` : ""}
      ${d.lat ? `<div id="tmap" class="mapbox"></div><div class="mut">آخر تحديث لموقع المندوب: ${ago(d.loc_at)}</div>` : ""}
      ${d.proof_url ? `<b>📸 صورة التسليم</b><img src="${esc(d.proof_url)}" alt="" class="proof">` : ""}
      <div class="line"><span>التوصيل</span><b>${money(d.fee)} (${d.fee_payer === "receiver" ? "على المستلم" : "على المرسل"})</b></div>
      ${collect ? `<div class="line total"><span>المطلوب من المستلم</span><span>${money(collect)}</span></div>` : ""}
      <button class="btn ghost block" style="margin-top:10px" data-share="${d.id}" data-no="${d.no}">🔗 مشاركة رابط التتبع</button>`, () => {
      if (d.lat) makeMap($("tmap"), [{ lat: d.lat, lng: d.lng, label: "🛵 " + (d.driver_name || "المندوب") }]).catch(() => {});
    });
  }

  // ---------- حساب المحل ----------
  function statement() {
    const done = S.list.filter((d) => d.status === "delivered");
    const owe = done.reduce((s, d) => s + num(d.cod_amount) - (d.fee_payer === "sender" ? num(d.fee) : 0), 0);
    const paid = S.setl.filter((x) => x.kind === "merchant_payout").reduce((s, x) => s + num(x.amount), 0);
    return { done, owe, paid, bal: owe - paid, fees: done.reduce((s, d) => s + (d.fee_payer === "sender" ? num(d.fee) : 0), 0), cod: done.reduce((s, d) => s + num(d.cod_amount), 0) };
  }
  function accountView() {
    if (!S.me) return `<div class="wrap"><div class="h2">حسابي</div>
      <div class="card"><b>🏪 دخول المحلات والشركات</b><p class="mut">سجّل محلك علشان بياناتك تتحفظ، وتشوف كل شحناتك وكشف حساب بالمبالغ اللي اتحصّلت.</p>
        ${Store.live ? `${field("em", "البريد الإلكتروني", "", "email", 'autocomplete="username"')}${field("pw", "كلمة المرور", "", "password", 'autocomplete="current-password"')}
        <button class="btn block" id="inBtn">دخول</button>
        <details style="margin-top:12px"><summary><b>محل جديد؟ سجّل هنا</b></summary>${field("bn", "اسم المحل *", "")}<div class="row2">${field("fn", "اسمك", "")}${field("bp", "الهاتف *", "", "tel", 'inputmode="numeric" maxlength="8"')}</div>
          <label class="f"><span>منطقة الاستلام</span><select class="in" id="ba">${areaOptions("")}</select></label>${field("bd", "عنوان الاستلام", "")}<p class="mut">اكتب الإيميل وكلمة السر فوق، وبعدين:</p><button class="btn tq block" id="upBtn">إنشاء حساب المحل</button></details>`
        : `<span class="demo-tag">وضع تجريبي</span><button class="btn block" style="margin-top:8px" id="demoM">🏪 دخول كمحل تجريبي</button>`}</div></div>`;
    if (S.me.role !== "merchant") return `<div class="wrap"><div class="h2">حسابي</div><div class="card"><b>${esc(S.me.business_name || S.me.full_name || S.me.email || "")}</b><p class="mut">${S.me.role === "pending" ? "⏳ حسابك قيد المراجعة – هنفعّله ونكلمك قريب." : "الحساب ده مش حساب محل."}</p><button class="btn ghost block" id="outBtn">خروج</button></div></div>`;
    const st = statement(), m = S.me;
    return `<div class="wrap"><div class="h2">🏪 ${esc(m.business_name || m.full_name)}</div>
      <div class="stats"><div class="stat"><span class="mut">شحنات اتسلمت</span><b>${st.done.length}</b></div><div class="stat"><span class="mut">رصيدك عندنا</span><b style="color:${st.bal >= 0 ? "#16a34a" : "#dc2626"}">${money(st.bal)}</b></div></div>
      <div class="card"><b>📒 كشف الحساب</b>
        <div class="line"><span>مبالغ اتحصّلت من زباينك</span><b>${money(st.cod)}</b></div>
        <div class="line"><span>− مصاريف التوصيل عليك</span><b>${money(st.fees)}</b></div>
        <div class="line"><span>− اتحوّلك قبل كده</span><b>${money(st.paid)}</b></div>
        <div class="line total"><span>${st.bal >= 0 ? "ليك عندنا" : "عليك لينا"}</span><span>${money(Math.abs(st.bal))}</span></div>
        ${S.setl.filter((x) => x.kind === "merchant_payout").slice(0, 10).map((x) => `<div class="line mut"><span>✅ تحويل ${fmtDate(x.created_at)}${x.note ? " – " + esc(x.note) : ""}</span><span>${money(x.amount)}</span></div>`).join("")}</div>
      <div class="card"><b>📍 بيانات الاستلام</b>${field("mbn", "اسم المحل", m.business_name)}${field("mph", "الهاتف", ph(m.phone), "tel")}
        <label class="f"><span>المنطقة</span><select class="in" id="mar">${areaOptions(m.pickup_area)}</select></label>${field("mad", "العنوان", m.pickup_address)}<button class="btn sm" id="saveM">💾 حفظ</button></div>
      <button class="btn ghost block" id="outBtn">خروج</button></div>`;
  }

  function render() {
    $("app").innerHTML = header() + `<main class="shop">${S.view === "list" ? listView() : S.view === "account" ? accountView() : newView()}</main>
      <nav class="nav shop-nav"><div class="wrap">${[["new", "🛵", "طلب توصيل"], ["list", "📦", "شحناتي"], ["account", "👤", "حسابي"]].map(([v, i, l]) => `<button class="${S.view === v ? "on" : ""}" data-view="${v}"><i style="font-size:22px">${i}</i>${l}</button>`).join("")}</div></nav>`;
    const h = document.querySelector(".shop-top"); if (h) document.documentElement.style.setProperty("--hh", h.offsetHeight + "px");
    if (S.settings.accent) document.documentElement.style.setProperty("--acc", S.settings.accent);
    if (S.view === "new") { const q = () => { $("quote").innerHTML = quoteHtml(); }; ["sArea", "rArea", "cod"].forEach((id) => { $(id).onchange = q; $(id).oninput = q; }); document.querySelectorAll("input[name=payer]").forEach((r) => (r.onchange = q)); q(); $("send").onclick = send; }
    if (S.view === "list") fillStatuses();
    bindAccount();
  }
  function bindAccount() {
    const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
    on("inBtn", async () => { try { await Store.signIn($("em").value.trim(), $("pw").value); await boot(); toast("أهلاً بيك 👋"); } catch (e) { toast(e.message.includes("Invalid") ? "الإيميل أو كلمة السر غلط" : e.message, "err"); } });
    on("upBtn", async () => {
      const bp = ph($("bp").value); if (!$("bn").value.trim() || !P8.test(bp)) return toast("اكتب اسم المحل ورقم 8 أرقام", "err");
      if (!$("em").value.trim() || $("pw").value.length < 6) return toast("اكتب الإيميل وكلمة سر 6 حروف على الأقل", "err");
      try { await Store.signUp($("em").value.trim(), $("pw").value, { business_name: $("bn").value.trim(), full_name: $("fn").value.trim(), phone: "965" + bp, pickup_area: $("ba").value, pickup_address: $("bd").value.trim(), wants: "merchant" }); await boot(); toast("✅ اتسجّل – هنراجع الحساب ونفعّله"); } catch (e) { toast(e.message, "err"); }
    });
    on("demoM", async () => { const p = (await Store.profiles()).find((x) => x.role === "merchant"); Store.demoLogin(p); await boot(); });
    on("outBtn", async () => { await Store.signOut(); S.me = null; S.list = []; render(); });
    on("saveM", async () => { const p = { business_name: $("mbn").value.trim(), phone: "965" + ph($("mph").value), pickup_area: $("mar").value, pickup_address: $("mad").value.trim() }; try { await Store.updateMyProfile(p); Object.assign(S.me, p); toast("اتحفظ ✓"); } catch (e) { toast(e.message, "err"); } });
  }

  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-view],[data-track],[data-share]"); if (!el) return;
    if (el.dataset.view) { closeSheet(); S.view = el.dataset.view; if (S.view === "list") await loadList(); render(); scrollTo(0, 0); }
    else if (el.dataset.track) openTrack(el.dataset.track);
    else if (el.dataset.share) { const url = location.origin + location.pathname + "?track=" + el.dataset.share, text = `تتبع الشحنة #${el.dataset.no}: ${url}`; if (navigator.share) navigator.share({ text }).catch(() => {}); else { try { await navigator.clipboard.writeText(url); toast("اتنسخ الرابط ✓"); } catch (x) { toast(url); } } }
  });

  async function boot() {
    const [s, p, me] = await Promise.all([Store.settings(), Store.prices(), Store.me()]);
    S.settings = s || {}; S.prices = p || []; S.me = me; document.title = S.settings.company_name || "Goten Delivery";
    await loadList(); render();
  }
  (async () => {
    try { await Store.init(); await boot(); } catch (e) { $("app").innerHTML = `<div class="empty"><div class="e">⚠️</div>${esc(e.message)}</div>`; return; }
    const t = new URLSearchParams(location.search).get("track"); if (t) openTrack(t);
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  })();
})();
