// صفحة العملاء والمحلات: طلب توصيل + تتبع + حساب المحل
(function () {
  const { esc, money, num, ls, toast, sheet, closeSheet, AREAS, fmtDate, LOGO, DST, DFLOW, zoneOf, ago, makeMap } = UI;
  const $ = (id) => document.getElementById(id);
  const S = { view: "new", me: null, settings: {}, prices: [], mine: ls.get("tw_mine", []), last: ls.get("tw_last", {}), list: [], setl: [] };
  const P8 = /^[124569]\d{7}$/;
  const ph = (v) => String(v || "").replace(/\D/g, "").replace(/^965(?=\d{8}$)/, "");
  const areaOptions = (sel) => `<option value="">اختر المنطقة</option>` + Object.entries(AREAS).map(([g, arr]) => `<optgroup label="${g}">${arr.map((x) => `<option ${sel === x ? "selected" : ""}>${x}</option>`).join("")}</optgroup>`).join("");
  const isMerchant = () => S.me && (S.me.role === "merchant" || S.me.role === "driver");
  const isDriver = () => S.me && S.me.role === "driver";

  function feeFor(a1, a2) {
    const z1 = zoneOf(a1), z2 = zoneOf(a2); if (!z1 || !z2) return null;
    const st = S.settings;
    if (st.price_mode === "km") {
      const A1 = UI.ZLL[z1], A2 = UI.ZLL[z2], d = z1 === z2 || !A1 || !A2 ? 0 : UI.km(A1, A2);
      let f = Math.round((num(st.base_fee) + num(st.per_km) * d) * 4) / 4; f = Math.max(num(st.min_fee), f); if (num(st.max_fee) > 0) f = Math.min(f, num(st.max_fee)); return f;
    }
    const p = S.prices.find((x) => x.from_zone === z1 && x.to_zone === z2) || S.prices.find((x) => x.from_zone === z2 && x.to_zone === z1);
    return p ? num(p.price) : null;
  }

  // ---------- الواجهة ----------
  function header() {
    const s = S.settings;
    return `<header class="shop-top"><div class="wrap"><div class="shop-row"><div class="shop-side"></div>
      <div class="shop-brand">${s.logo ? `<img src="${esc(s.logo)}" alt="">` : LOGO}<span>${esc(s.company_name || "Guten Delivery")}</span></div>
      <div class="shop-side end">${s.whatsapp ? `<a class="icon-btn" target="_blank" rel="noopener" href="https://wa.me/${waNum()}" aria-label="whatsapp">💬</a>` : ""}</div></div></div></header>`;
  }
  function field(id, label, val, type = "text", extra = "") { return `<label class="f"><span>${label}</span><input class="in" id="${id}" type="${type}" value="${esc(val || "")}" ${extra}></label>`; }
  function newView() {
    const s = S.settings, m = isMerchant() ? S.me : null, l = S.last;
    const snd = m ? { name: m.business_name || m.full_name, phone: ph(m.phone), area: m.pickup_area || l.pickup_area, addr: m.pickup_address || l.pickup_address } : { name: l.sender_name, phone: ph(l.sender_phone), area: l.pickup_area, addr: l.pickup_address };
    return `<div class="wrap">
      ${s.tagline ? `<p class="mut" style="text-align:center;margin:14px 0 4px">${esc(s.tagline)}</p>` : ""}
      ${!s.is_open ? `<div class="notice">⛔ مش بنستقبل طلبات دلوقتي</div>` : ""}${s.notice ? `<div class="notice">📢 ${esc(s.notice)}</div>` : ""}
      ${m ? `<div class="notice" style="background:#e8fafa;color:#0e7490">🏪 بتطلب باسم <b>${esc(m.business_name || m.full_name)}</b> – الشحنة هتتسجّل في كشف حسابك</div>` : ""}
      <div class="card"><div class="sec-t"><span class="dot1">1</span> الاستلام من (المرسل)</div>
        <div class="row2">${field("sName", "الاسم *", snd.name)}${field("sPhone", "الهاتف *", snd.phone, "tel", 'inputmode="numeric" maxlength="8" placeholder="5xxxxxxx"')}</div>
        <label class="f"><span>المنطقة *</span><select class="in" id="sArea">${areaOptions(snd.area)}</select></label>
        ${field("sAddr", "العنوان (قطعة، شارع، منزل)", snd.addr)}</div>
      <div id="drops">${dropCard(0)}</div>
      <button class="btn ghost block" id="addDrop" style="margin-bottom:12px">➕ عنوان تسليم تاني (أكتر من شحنة مرة واحدة)</button>
      <div class="card"><div class="sec-t"><span class="dot1 c">3</span> تفاصيل الشحنة</div>
        ${field("pkg", "إيه اللي هيتوصّل؟", "", "text", 'placeholder="مثال: طلب أكل، كرتونة ملابس، مستندات"')}
        <div class="f"><span class="mut" style="font-size:13px;font-weight:600">سعر التوصيل يدفعه</span>
          <div class="row2" style="margin-top:6px"><label class="radio"><input type="radio" name="payer" value="sender" checked> المرسل</label><label class="radio"><input type="radio" name="payer" value="receiver"> المستلم</label></div></div>
        <label class="f"><span>الوقت</span><select class="in" id="sched"><option>بأسرع وقت</option><option>اليوم – الفترة المسائية</option><option>بكرة – الصبح</option><option>بكرة – بالليل</option></select></label>
        ${field("notes", "ملاحظات للمندوب", "")}</div>
      <div class="card quote" id="quote"></div>
      <button class="btn tq block" id="send" ${!s.is_open ? "disabled" : ""}>🛵 اطلب المندوب</button>
      ${s.whatsapp ? `<button class="btn block" id="waOrder" style="margin-top:8px;background:#16a34a;color:#fff">💬 اطلب بالواتساب بدل الفورم</button><p class="mut" style="text-align:center;font-size:13px;margin:6px 0 0">ابعتلنا العناوين على الواتساب وإحنا نسجّل الطلب ونبعت المندوب</p>` : ""}
      <p class="mut" style="text-align:center;margin:18px 0">${isMerchant() ? "" : "عندك محل؟ سجّل من «حسابي» وخد كشف حساب أسبوعي 🏪"}</p></div>`;
  }
  function dropCard(i) {
    return `<div class="card" data-drop="${i}"><div class="sec-t"><span class="dot1 b">${i ? "+" : "2"}</span> التسليم إلى ${i ? `(عنوان ${i + 1}) <button class="btn sm ghost" data-rmdrop="${i}" style="margin-inline-start:auto">✕ شيل</button>` : "(المستلم)"}</div>
      <div class="row2">${field("rName" + i, "الاسم *", "")}${field("rPhone" + i, "الهاتف *", "", "tel", 'inputmode="numeric" maxlength="8" placeholder="5xxxxxxx"')}</div>
      <label class="f"><span>المنطقة *</span><select class="in" id="rArea${i}" data-q>${areaOptions("")}</select></label>
      ${field("rAddr" + i, "العنوان (قطعة، شارع، منزل)", "")}
      ${field("cod" + i, "مبلغ يتحصّل من المستلم (د.ك) – اتركه فاضي لو مدفوع", "", "number", 'step="0.005" min="0" inputmode="decimal" data-q')}</div>`;
  }
  const dropIdx = () => [...document.querySelectorAll("[data-drop]")].map((el) => +el.dataset.drop);
  function quoteHtml() {
    const a1 = $("sArea") && $("sArea").value, payer = (document.querySelector("input[name=payer]:checked") || {}).value, ids = dropIdx();
    const rows = ids.map((i) => ({ i, a2: ($("rArea" + i) || {}).value, cod: num(($("cod" + i) || {}).value), nm: (($("rName" + i) || {}).value || "").trim() })).map((r) => ({ ...r, fee: feeFor(a1, r.a2) }));
    if (!a1 || rows.every((r) => r.fee == null)) return `<div class="mut" style="text-align:center">اختار منطقة الاستلام والتسليم علشان يظهرلك السعر</div>`;
    const tot = rows.reduce((a, r) => a + (r.fee || 0), 0), multi = rows.length > 1;
    return rows.map((r, n) => r.fee == null ? `<div class="line mut"><span>${multi ? `شحنة ${n + 1}: ` : ""}اختار المنطقة</span></div>` : `<div class="line"><span>${multi ? `شحنة ${n + 1}${r.nm ? " – " + esc(r.nm) : ""}: ` : ""}التوصيل (${esc(zoneOf(a1))} ← ${esc(zoneOf(r.a2))})</span><b>${money(r.fee)}</b></div>${r.cod + (payer === "receiver" ? r.fee : 0) ? `<div class="line mut" style="font-size:13px"><span>المندوب هيحصّل من المستلم</span><span>${money(r.cod + (payer === "receiver" ? r.fee : 0))}</span></div>` : ""}`).join("")
      + (multi ? `<div class="line total"><span>إجمالي التوصيل (${rows.length} شحنات)</span><span>${money(tot)}</span></div>` : "")
      + (payer === "sender" ? `<div class="mut">المرسل يدفع التوصيل${multi ? "" : " " + money(tot)}${rows.some((r) => r.cod) ? " – بيتخصم من المبلغ المحصّل" : ""}</div>` : "")
      + (S.settings.price_mode === "km" ? `<div class="mut" style="font-size:12px">السعر محسوب بالمسافة بين المناطق</div>` : "");
  }
  const waNum = () => String(S.settings.whatsapp || "").replace(/\D/g, "").replace(/^(\d{8})$/, "965$1");
  function waOrder() {
    const v = (id) => ($(id) ? $(id).value.trim() : ""), ids = dropIdx();
    const drops = ids.map((i, n) => [v("rName" + i), v("rPhone" + i), v("rArea" + i), v("rAddr" + i), v("cod" + i)]).filter((r) => r.some(Boolean));
    const t = `السلام عليكم، عايز أطلب توصيل 🛵\n\n📦 الاستلام من: ${v("sName") || "…"} – ${v("sPhone") || "…"}\n📍 ${v("sArea") || "…"} – ${v("sAddr") || "…"}\n\n${drops.length ? drops.map((r, n) => `🏠 التسليم ${drops.length > 1 ? n + 1 : ""}: ${r[0] || "…"} – ${r[1] || "…"}\n📍 ${r[2] || "…"} – ${r[3] || "…"}${r[4] ? `\n💵 تحصيل: ${r[4]} د.ك` : ""}`).join("\n\n") : "🏠 التسليم: (الاسم – الهاتف – المنطقة – العنوان)"}\n\n📝 الشحنة: ${v("pkg") || "…"}\n⏰ الوقت: ${v("sched")}${v("notes") ? "\nملاحظات: " + v("notes") : ""}`;
    open("https://wa.me/" + String(S.settings.whatsapp).replace(/\D/g, "").replace(/^(\d{8})$/, "965$1") + "?text=" + encodeURIComponent(t), "_blank");
  }
  const errTxt = (e) => { const m = String(e.message); return m.includes("CLOSED") ? "مش بنستقبل طلبات دلوقتي" : m.includes("PHONE") ? "رقم الهاتف غلط" : m.includes("AREA") || m.includes("PRICE") ? "المنطقة دي مش متاحة" : m; };
  async function send() {
    const v = (id) => ($(id) ? $(id).value.trim() : "");
    const base = { sender_name: v("sName"), sender_phone: ph(v("sPhone")), pickup_area: v("sArea"), pickup_address: v("sAddr"), package: v("pkg"), fee_payer: (document.querySelector("input[name=payer]:checked") || {}).value || "sender", schedule: v("sched"), notes: v("notes") };
    const list = dropIdx().map((i) => ({ ...base, receiver_name: v("rName" + i), receiver_phone: ph(v("rPhone" + i)), drop_area: v("rArea" + i), drop_address: v("rAddr" + i), cod_amount: num(v("cod" + i)) }));
    if (base.sender_name.length < 2 || !base.pickup_area || !P8.test(base.sender_phone)) return toast("عبّي اسم المرسل ومنطقته ورقمه (8 أرقام)", "err");
    for (const [n, p] of list.entries()) { if (p.receiver_name.length < 2 || !p.drop_area) return toast(`عبّي اسم ومنطقة المستلم${list.length > 1 ? " رقم " + (n + 1) : ""}`, "err"); if (!P8.test(p.receiver_phone)) return toast(`رقم المستلم${list.length > 1 ? " " + (n + 1) : ""} لازم 8 أرقام`, "err"); }
    list.forEach((p) => { p.sender_phone = "965" + p.sender_phone; p.receiver_phone = "965" + p.receiver_phone; });
    $("send").disabled = true; $("send").textContent = "⏳ بيتسجّل…";
    const ok = [], bad = [];
    for (const p of list) { try { const r = await Store.createDelivery(p); ok.push({ r, p }); S.mine.unshift({ id: r.id, no: r.no, to: p.receiver_name, area: p.drop_area, at: new Date().toISOString() }); } catch (e) { bad.push({ p, e: errTxt(e) }); } }
    ls.set("tw_mine", S.mine.slice(0, 100));
    if (!ok.length) { $("send").disabled = false; $("send").textContent = "🛵 اطلب المندوب"; return toast(bad[0].e, "err"); }
    const p0 = list[0]; S.last = { sender_name: p0.sender_name, sender_phone: p0.sender_phone, pickup_area: p0.pickup_area, pickup_address: p0.pickup_address }; ls.set("tw_last", S.last);
    S.view = "list"; await loadList(); render();
    const link = (id) => location.origin + location.pathname + "?track=" + id;
    sheet(`<div class="empty" style="padding:16px 0"><div class="e">✅</div><h2>${ok.length > 1 ? `تم تسجيل ${ok.length} شحنات` : "تم تسجيل الطلب"}</h2><p>إجمالي التوصيل <b>${money(ok.reduce((a, x) => a + num(x.r.fee), 0))}</b></p></div>
      ${ok.map(({ r, p }) => `<div class="card" style="padding:10px"><div class="line"><b>#${r.no} · ${esc(p.receiver_name)}</b><span>${money(r.fee)}</span></div><div class="mut">📍 ${esc(p.drop_area)}</div>
        <div class="acts"><a class="btn sm green" target="_blank" rel="noopener" href="https://wa.me/${p.receiver_phone}?text=${encodeURIComponent(`مرحباً ${p.receiver_name}، شحنتك رقم #${r.no} في الطريق إليك 🛵\nتابعها من هنا: ${link(r.id)}`)}">💬 رابط التتبع للمستلم</a><button class="btn sm tq" data-track="${r.id}">📍 تتبع</button></div></div>`).join("")}
      ${bad.length ? `<div class="notice">⚠️ ${bad.length} شحنة ماتسجّلتش: ${bad.map((b) => esc(b.p.receiver_name) + " (" + esc(b.e) + ")").join("، ")}</div>` : ""}`);
  }

  async function loadList() { if (isMerchant()) { S.list = (await Store.deliveries()).filter((d) => d.merchant_id === S.me.id); S.setl = await Store.settlements(); } }
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
      ${(() => { const e = UI.eta(d); return e ? `<div class="card" style="background:#eef6ff;text-align:center"><div class="mut">⏱️ الوصول المتوقع</div><b style="font-size:24px">خلال ~${e.min} دقيقة</b><div class="mut">حوالي الساعة ${e.at}${d.status === "new" ? " · بندوّر على أقرب مندوب" : ""}</div></div>` : ""; })()}
      ${d.status === "delivered" ? (d.rating ? `<div class="card" style="text-align:center"><div class="mut">تقييمك للمندوب</div>${UI.stars(d.rating, 26)}<div class="mut">شكراً لتقييمك 🙏</div></div>` : `<div class="card" style="text-align:center"><b>قيّم المندوب ${esc(d.driver_name || "")}</b><div id="rateStars" style="font-size:38px;letter-spacing:4px;margin:6px 0;cursor:pointer">${[1, 2, 3, 4, 5].map((i) => `<span data-star="${i}" style="color:#cbd5e1">★</span>`).join("")}</div><input class="in" id="rateNote" placeholder="تعليق (اختياري)"><button class="btn tq block" style="margin-top:8px" id="rateBtn" disabled>إرسال التقييم</button></div>`) : ""}
      ${d.driver_name ? `<div class="card" style="background:#effcfc"><b>🛵 المندوب: ${esc(d.driver_name)}</b>${d.driver_avg ? ` <span style="white-space:nowrap">${UI.stars(d.driver_avg, 14)} <small class="mut">${d.driver_avg}</small></span>` : ""}${d.driver_phone ? ` <a class="btn sm tq" href="tel:+${esc(d.driver_phone)}">📞 اتصال</a>` : ""}</div>` : ""}
      ${d.lat || (d.p_lat && !["delivered", "failed", "cancelled"].includes(d.status)) ? `<div id="tmap" class="mapbox"></div><div class="mut" id="tmapAt">${d.lat ? `🟢 تتبع مباشر · آخر تحديث لموقع المندوب: ${ago(d.loc_at)}` : "📍 منطقة الاستلام والتسليم – موقع المندوب هيظهر أول ما يستلم الشحنة"}</div>` : ""}
      ${d.proof_url ? `<b>📸 صورة التسليم</b><img src="${esc(d.proof_url)}" alt="" class="proof">` : ""}
      <div class="line"><span>التوصيل</span><b>${money(d.fee)} (${d.fee_payer === "receiver" ? "على المستلم" : "على المرسل"})</b></div>
      ${collect ? `<div class="line total"><span>المطلوب من المستلم</span><span>${money(collect)}</span></div>` : ""}
      <button class="btn ghost block" style="margin-top:10px" data-share="${d.id}" data-no="${d.no}">🔗 مشاركة رابط التتبع</button>`, () => {
      if (d.lat || d.p_lat) liveMap(d);
      const rs = $("rateStars");
      if (rs) {
        let v = 0;
        rs.querySelectorAll("[data-star]").forEach((el) => (el.onclick = () => { v = +el.dataset.star; rs.querySelectorAll("[data-star]").forEach((x) => (x.style.color = +x.dataset.star <= v ? "#f59e0b" : "#cbd5e1")); $("rateBtn").disabled = false; }));
        $("rateBtn").onclick = async () => { $("rateBtn").disabled = true; try { await Store.rateDelivery(d.id, v, $("rateNote").value.trim()); toast("شكراً لتقييمك ⭐"); openTrack(d.id); } catch (e) { toast(String(e.message).includes("ALREADY") ? "الشحنة دي اتقيّمت قبل كده" : e.message, "err"); } };
      }
    });
  }

  // تتبع مباشر: الخريطة بتتحدّث كل 15 ثانية طول ما الشحنة مفتوحة
  let liveT = null;
  async function liveMap(d) {
    clearInterval(liveT);
    const el = $("tmap"); if (!el) return;
    const pts = (x) => [x.p_lat && { lat: x.p_lat, lng: x.p_lng, label: "📦 الاستلام: " + x.pickup_area }, x.d_lat && { lat: x.d_lat, lng: x.d_lng, label: "🏠 التسليم: " + x.drop_area }, x.lat && { lat: x.lat, lng: x.lng, label: "🛵 " + (x.driver_name || "المندوب") }].filter(Boolean);
    let map; try { map = await makeMap(el, pts(d)); } catch (e) { return; }
    const L = window.L; let dm = null;
    map.eachLayer((ly) => { if (ly.getLatLng && d.lat && Math.abs(ly.getLatLng().lat - d.lat) < 1e-9) dm = ly; });
    if (!["assigned", "picked_up", "new"].includes(d.status)) return;
    liveT = setInterval(async () => {
      if (!document.body.contains(el)) return clearInterval(liveT);
      try { const x = await Store.trackDelivery(d.id); if (!x) return;
        if (x.status !== d.status) { clearInterval(liveT); return openTrack(d.id); }
        if (x.lat && L) { if (dm) dm.setLatLng([x.lat, x.lng]); else { dm = L.marker([x.lat, x.lng]).addTo(map).bindPopup("🛵 " + (x.driver_name || "المندوب")); } const at = $("tmapAt"); if (at) at.textContent = "🟢 تتبع مباشر · آخر تحديث لموقع المندوب: " + ago(x.loc_at); }
      } catch (e) {}
    }, 15000);
  }

  // ---------- حساب المحل ----------
  function statement() {
    const done = S.list.filter((d) => d.status === "delivered");
    const owe = done.reduce((s, d) => s + num(d.cod_amount) - (d.fee_payer === "sender" ? num(d.fee) : 0), 0);
    const paid = S.setl.filter((x) => x.kind === "merchant_payout").reduce((s, x) => s + num(x.amount), 0);
    return { done, owe, paid, bal: owe - paid, fees: done.reduce((s, d) => s + (d.fee_payer === "sender" ? num(d.fee) : 0), 0), cod: done.reduce((s, d) => s + num(d.cod_amount), 0) };
  }
  function mExport(kind) {
    const st = statement(), m = S.me, nm = m.business_name || m.full_name || "", co = S.settings.company_name || "Guten Delivery";
    const fee = (d) => (d.fee_payer === "sender" ? num(d.fee) : 0), pays = S.setl.filter((x) => x.kind === "merchant_payout");
    const rows = st.done.map((d) => [d.no, fmtDate(d.delivered_at), d.receiver_name, d.drop_area, +num(d.cod_amount).toFixed(3), +fee(d).toFixed(3), +(num(d.cod_amount) - fee(d)).toFixed(3)]);
    const H = ["رقم الشحنة", "تاريخ التسليم", "المستلم", "المنطقة", "التحصيل", "التوصيل عليك", "الصافي"];
    if (kind === "xls") return UI.xlsx(`كشف-${nm}`, [["الشحنات", [H, ...rows, ["الإجمالي", "", "", "", +st.cod.toFixed(3), +st.fees.toFixed(3), +(st.cod - st.fees).toFixed(3)]]], ["التحويلات", [["التاريخ", "ملاحظة", "المبلغ"], ...pays.map((x) => [fmtDate(x.created_at), x.note || "", +num(x.amount).toFixed(3)])]], ["الملخص", [["البند", "المبلغ"], ["مبالغ اتحصّلت", +st.cod.toFixed(3)], ["مصاريف التوصيل", +st.fees.toFixed(3)], ["اتحوّلك", +st.paid.toFixed(3)], ["الرصيد", +st.bal.toFixed(3)]]]]);
    UI.printDoc("كشف حساب " + nm, `<h1>🧾 ${esc(co)} – كشف حساب</h1><div class="m">${esc(nm)}${m.phone ? " · " + esc(m.phone) : ""}</div>
      <div class="k"><div>شحنات اتسلمت<b>${st.done.length}</b></div><div>اتحصّل<b>${money(st.cod)}</b></div><div>توصيل عليك<b>${money(st.fees)}</b></div><div>اتحوّلك<b>${money(st.paid)}</b></div><div>${st.bal >= 0 ? "ليك عندنا" : "عليك لينا"}<b>${money(Math.abs(st.bal))}</b></div></div>
      <h2>الشحنات</h2>${UI.tbl(H, rows.map((r) => r.map((c, i) => (i >= 4 ? Number(c).toFixed(3) : c))), ["الإجمالي", "", "", "", st.cod.toFixed(3), st.fees.toFixed(3), (st.cod - st.fees).toFixed(3)])}
      ${pays.length ? `<h2>التحويلات</h2>${UI.tbl(["التاريخ", "ملاحظة", "المبلغ"], pays.map((x) => [fmtDate(x.created_at), x.note || "", num(x.amount).toFixed(3)]))}` : ""}`);
  }
  function accountView() {
    if (!S.me) return `<div class="wrap"><div class="h2">حسابي</div>
      <div class="card"><b>🏪 دخول المحلات والشركات</b><p class="mut">سجّل محلك علشان بياناتك تتحفظ، وتشوف كل شحناتك وكشف حساب بالمبالغ اللي اتحصّلت.</p>
        ${Store.live ? `${field("em", "البريد الإلكتروني", "", "email", 'autocomplete="username"')}${field("pw", "كلمة المرور", "", "password", 'autocomplete="current-password"')}
        <button class="btn block" id="inBtn">دخول</button><button class="btn ghost block" style="margin-top:8px" data-forgot="1">نسيت كلمة السر؟</button>
        <details style="margin-top:12px"><summary><b>محل جديد؟ سجّل هنا</b></summary>${field("bn", "اسم المحل *", "")}<div class="row2">${field("fn", "اسمك", "")}${field("bp", "الهاتف *", "", "tel", 'inputmode="numeric" maxlength="8"')}</div>
          <label class="f"><span>منطقة الاستلام</span><select class="in" id="ba">${areaOptions("")}</select></label>${field("bd", "عنوان الاستلام", "")}<p class="mut">اكتب الإيميل وكلمة السر فوق، وبعدين:</p><button class="btn tq block" id="upBtn">إنشاء حساب المحل</button></details>`
        : `<span class="demo-tag">وضع تجريبي</span><button class="btn block" style="margin-top:8px" id="demoM">🏪 دخول كمحل تجريبي</button>`}</div></div>`;
    if (!isMerchant()) return `<div class="wrap"><div class="h2">حسابي</div><div class="card"><b>${esc(S.me.business_name || S.me.full_name || S.me.email || "")}</b><p class="mut">${S.me.role === "pending" ? "⏳ حسابك قيد المراجعة – هنفعّله ونكلمك قريب." : "الحساب ده مش حساب محل."}</p><button class="btn ghost block" id="outBtn">خروج</button></div></div>`;
    const st = statement(), m = S.me;
    return `<div class="wrap"><div class="h2">${isDriver() ? "🛵" : "🏪"} ${esc(m.business_name || m.full_name)}</div>${isDriver() ? `<a class="btn tq block" style="margin-bottom:10px;text-align:center;text-decoration:none" href="driver.html">🛵 رجوع لشغل المندوب</a>` : ""}
      <div class="stats"><div class="stat"><span class="mut">شحنات اتسلمت</span><b>${st.done.length}</b></div><div class="stat"><span class="mut">رصيدك عندنا</span><b style="color:${st.bal >= 0 ? "#16a34a" : "#dc2626"}">${money(st.bal)}</b></div></div>
      <div class="card"><b>📒 كشف الحساب</b>
        <div class="line"><span>مبالغ اتحصّلت من زباينك</span><b>${money(st.cod)}</b></div>
        <div class="line"><span>− مصاريف التوصيل عليك</span><b>${money(st.fees)}</b></div>
        <div class="line"><span>− اتحوّلك قبل كده</span><b>${money(st.paid)}</b></div>
        <div class="line total"><span>${st.bal >= 0 ? "ليك عندنا" : "عليك لينا"}</span><span>${money(Math.abs(st.bal))}</span></div>
        ${S.setl.filter((x) => x.kind === "merchant_payout").slice(0, 10).map((x) => `<div class="line mut"><span>✅ تحويل ${fmtDate(x.created_at)}${x.note ? " – " + esc(x.note) : ""}</span><span>${money(x.amount)}</span></div>`).join("")}
        <div class="acts" style="margin-top:10px"><button class="btn sm tq" id="mPdf">🧾 فاتورة / كشف PDF</button><button class="btn sm green" id="mXls">📊 Excel</button></div></div>
      <div class="card"><b>📍 بيانات الاستلام</b>${field("mbn", "اسم المحل", m.business_name)}${field("mph", "الهاتف", ph(m.phone), "tel")}
        <label class="f"><span>المنطقة</span><select class="in" id="mar">${areaOptions(m.pickup_area)}</select></label>${field("mad", "العنوان", m.pickup_address)}<button class="btn sm" id="saveM">💾 حفظ</button></div>
      <button class="btn ghost block" id="outBtn">خروج</button></div>`;
  }

  function render() {
    $("app").innerHTML = header() + `<main class="shop">${S.view === "list" ? listView() : S.view === "account" ? accountView() : newView()}</main>
      <nav class="nav shop-nav"><div class="wrap">${[["new", "🛵", "طلب توصيل"], ["list", "📦", "شحناتي"], ["account", "👤", "حسابي"]].map(([v, i, l]) => `<button class="${S.view === v ? "on" : ""}" data-view="${v}"><i style="font-size:22px">${i}</i>${l}</button>`).join("")}</div></nav>`;
    const h = document.querySelector(".shop-top"); if (h) document.documentElement.style.setProperty("--hh", h.offsetHeight + "px");
    if (S.settings.accent) document.documentElement.style.setProperty("--acc", S.settings.accent);
    if (S.view === "new") {
      const q = () => { $("quote").innerHTML = quoteHtml(); }, wire = () => { ["sArea"].concat([...document.querySelectorAll("[data-q]")].map((x) => x.id)).forEach((id) => { $(id).onchange = q; $(id).oninput = q; }); };
      wire(); document.querySelectorAll("input[name=payer]").forEach((r) => (r.onchange = q)); q(); $("send").onclick = send;
      if ($("waOrder")) $("waOrder").onclick = waOrder;
      $("addDrop").onclick = () => { const ids = dropIdx(); if (ids.length >= 10) return toast("أقصى حاجة 10 عناوين في المرة", "err"); const n = Math.max(...ids) + 1; $("drops").insertAdjacentHTML("beforeend", dropCard(n)); wire(); q(); $("rName" + n).focus(); };
      $("drops").onclick = (e) => { const b = e.target.closest("[data-rmdrop]"); if (!b) return; const c = document.querySelector(`[data-drop="${b.dataset.rmdrop}"]`); if (c) c.remove(); q(); };
    }
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
    on("mPdf", () => mExport("pdf")); on("mXls", () => mExport("xls").catch((e) => toast(e.message, "err")));
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
    S.settings = s || {}; S.prices = p || []; S.me = me; document.title = S.settings.company_name || "Guten Delivery";
    await loadList(); render();
  }
  (async () => {
    try { await Store.init(); await boot(); Store._onRecovery = () => UI.recover(() => boot()); if (Store.recovery) Store._onRecovery(); } catch (e) { $("app").innerHTML = `<div class="empty"><div class="e">⚠️</div>${esc(e.message)}</div>`; return; }
    const t = new URLSearchParams(location.search).get("track"); if (t) openTrack(t);
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  })();
})();
