// تطبيق المناديب – شركة التوصيل
(function () {
  const { esc, money, toast, fmtDate, LOGO, num, sheet, closeSheet, DST } = UI;
  const $ = (id) => document.getElementById(id);
  const D = { me: null, list: [], setl: [], tab: "active", known: null, name: "Goten Delivery", watch: null, lastPing: 0, sharing: false };
  const collectOf = (d) => num(d.cod_amount) + (d.fee_payer === "receiver" ? num(d.fee) : 0);
  const today = (d) => d && new Date(d).toDateString() === new Date().toDateString();
  const maps = (area, addr) => "https://maps.google.com/?q=" + encodeURIComponent((addr ? addr + " " : "") + area + " الكويت");

  async function loginView(msg) {
    let demoList = "";
    if (!Store.live) { const ps = (await Store.profiles()).filter((p) => p.role === "driver"); demoList = ps.map((p) => `<button class="btn ghost block" style="margin:6px 0" data-demo="${p.id}">🛵 ${esc(p.full_name)}</button>`).join(""); }
    $("app").innerHTML = `<div class="login"><div class="brand" style="justify-content:center;color:var(--navy);font-size:22px;margin-bottom:6px">${LOGO}<span>مناديب ${esc(D.name)}</span></div>${msg ? `<div class="notice">${msg}</div>` : ""}
      ${Store.live ? `<div class="card"><label class="f"><span>البريد الإلكتروني</span><input class="in" id="em" type="email" autocomplete="username"></label><label class="f"><span>كلمة المرور</span><input class="in" id="pw" type="password" autocomplete="current-password"></label><button class="btn block" id="inBtn">دخول</button><button class="btn ghost block" style="margin-top:8px" data-forgot="1">نسيت كلمة السر؟</button></div>
        <details class="card"><summary><b>مندوب جديد؟ سجّل هنا</b></summary><label class="f"><span>الاسم</span><input class="in" id="nn"></label><label class="f"><span>رقم الهاتف</span><input class="in" id="np" type="tel" inputmode="numeric" maxlength="8" placeholder="5xxxxxxx"></label><p class="mut">اكتب البريد وكلمة السر فوق وبعدين اضغط:</p><button class="btn tq block" id="upBtn">إنشاء حساب</button></details>`
      : `<div class="card"><span class="demo-tag">وضع تجريبي</span><p class="mut">اختار المندوب:</p>${demoList}</div>`}${D.me ? "" : ""}<button class="btn ghost block" id="outBtn2" style="${msg ? "" : "display:none"}">خروج</button></div>`;
    const o2 = $("outBtn2"); if (o2) o2.onclick = async () => { await Store.signOut(); loginView(); };
    if (Store.live) {
      $("inBtn").onclick = async () => { try { await Store.signIn($("em").value.trim(), $("pw").value); boot(); } catch (e) { toast(e.message.includes("Invalid") ? "الإيميل أو كلمة السر غلط" : e.message, "err"); } };
      $("upBtn").onclick = async () => { const ph = $("np").value.replace(/\D/g, ""); if (!$("nn").value.trim() || ph.length !== 8) return toast("اكتب الاسم ورقم 8 أرقام", "err"); if ($("pw").value.length < 6) return toast("كلمة السر 6 حروف على الأقل", "err"); try { await Store.signUp($("em").value.trim(), $("pw").value, { full_name: $("nn").value.trim(), phone: "965" + ph, wants: "driver" }); boot(); toast("اتسجّل – استنى موافقة الإدارة"); } catch (e) { toast(e.message, "err"); } };
    }
  }

  function card(d) {
    const c = collectOf(d), st = DST[d.status];
    let act = "";
    if (d.status === "assigned") act = `<button class="btn tq" data-go="${d.id}:picked_up">📦 استلمت الشحنة</button>`;
    if (d.status === "picked_up") act = `<button class="btn green" data-done="${d.id}">✅ تم التسليم + صورة</button><button class="btn ghost" data-fail="${d.id}">❌ فشل</button>`;
    const step = d.status === "assigned" ? "pickup" : "drop";
    return `<div class="dcard" style="border-color:${st.c}"><div class="hd"><b>#${d.no}</b><span class="st" style="background:${st.c}">${st.ar}</span></div>
      <div class="ad" style="${step === "pickup" ? "" : "opacity:.6"}">🟦 <b>استلام:</b> ${esc(d.sender_name)} – ${esc(d.pickup_area)}${d.pickup_address ? "، " + esc(d.pickup_address) : ""}
        <div class="acts"><a class="btn sm ghost" href="tel:+${esc(d.sender_phone)}">📞 اتصال</a><a class="btn sm ghost" target="_blank" rel="noopener" href="${maps(d.pickup_area, d.pickup_address)}">🗺️ خريطة</a></div></div>
      <div class="ad" style="${step === "drop" ? "" : "opacity:.6"}">🟩 <b>تسليم:</b> ${esc(d.receiver_name)} – ${esc(d.drop_area)}${d.drop_address ? "، " + esc(d.drop_address) : ""}
        <div class="acts"><a class="btn sm ghost" href="tel:+${esc(d.receiver_phone)}">📞 اتصال</a><a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/${esc(d.receiver_phone)}">💬 واتساب</a><a class="btn sm ghost" target="_blank" rel="noopener" href="${maps(d.drop_area, d.drop_address)}">🗺️ خريطة</a></div></div>
      ${d.package ? `<div class="mut">📦 ${esc(d.package)}</div>` : ""}${d.schedule ? `<div class="mut">⏰ ${esc(d.schedule)}</div>` : ""}${d.notes ? `<div class="mut">📝 ${esc(d.notes)}</div>` : ""}
      <div style="margin-top:8px">${c ? `<span class="pill cod">💵 حصّل ${money(c)}</span>` : `<span class="pill">مدفوع – مفيش تحصيل</span>`}</div>
      ${act ? `<div class="acts">${act}</div>` : ""}</div>`;
  }
  function render() {
    const active = D.list.filter((d) => ["assigned", "picked_up"].includes(d.status));
    const done = D.list.filter((d) => ["delivered", "failed"].includes(d.status) && today(d.delivered_at || d.updated_at));
    const collected = D.list.filter((d) => d.status === "delivered").reduce((s, d) => s + collectOf(d), 0);
    const handed = D.setl.filter((s) => s.kind === "driver_handover").reduce((s, x) => s + num(x.amount), 0);
    const todayCash = D.list.filter((d) => d.status === "delivered" && today(d.delivered_at)).reduce((s, d) => s + collectOf(d), 0);
    const list = D.tab === "active" ? active : done;
    $("app").innerHTML = `<header class="top"><div class="wrap"><div class="row"><div class="brand">${LOGO}<div>مناديب ${esc(D.name)}<small>${esc(D.me.full_name || "")}</small></div></div><div class="sp"></div><button class="chip-btn" id="outBtn">خروج</button></div>
      <div class="tabs"><button class="${D.tab === "active" ? "on" : ""}" data-tab="active">الحالية (${active.length})</button><button class="${D.tab === "done" ? "on" : ""}" data-tab="done">خلصت النهارده (${done.length})</button></div></div></header>
      <main><div class="wrap">
        <div class="card" style="display:flex;align-items:center;gap:10px;margin-top:12px"><div style="flex:1"><b>📍 مشاركة موقعي</b><div class="mut" style="font-size:12px">الإدارة والزبون يشوفوا مكانك وانت شغال. خلّي الصفحة مفتوحة.</div></div><button class="btn sm ${D.sharing ? "green" : "ghost"}" id="locBtn">${D.sharing ? "شغّال ✓" : "شغّل"}</button></div>
        <div class="stats"><div class="stat"><span class="mut">كاش النهارده</span><b>${money(todayCash)}</b></div><div class="stat"><span class="mut">الكاش اللي معاك</span><b style="color:#b45309">${money(collected - handed)}</b></div></div>
        ${list.length ? list.map(card).join("") : `<div class="empty"><div class="e">${D.tab === "active" ? "😴" : "📭"}</div>${D.tab === "active" ? "مفيش شحنات عليك دلوقتي" : "لسه مفيش"}</div>`}
      </div></main>`;
    $("outBtn").onclick = async () => { stopLoc(); await Store.signOut(); D.me = null; loginView(); };
    $("locBtn").onclick = () => (D.sharing ? stopLoc() : startLoc());
  }

  function startLoc() {
    if (!navigator.geolocation) return toast("الجهاز مش بيدعم الموقع", "err");
    D.watch = navigator.geolocation.watchPosition((p) => {
      if (!D.sharing) { D.sharing = true; render(); toast("📍 موقعك بيتشارك"); }
      if (Date.now() - D.lastPing > 25000) { D.lastPing = Date.now(); Store.driverPing(p.coords.latitude, p.coords.longitude).catch(() => {}); }
    }, (e) => { toast(e.code === 1 ? "اسمح للتطبيق بالموقع من الإعدادات" : "تعذر تحديد الموقع", "err"); stopLoc(); }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
  }
  function stopLoc() { if (D.watch != null) navigator.geolocation.clearWatch(D.watch); D.watch = null; D.sharing = false; if (D.me) render(); }

  function doneSheet(id) {
    const d = D.list.find((x) => x.id === id), c = collectOf(d);
    sheet(`<h3>تسليم شحنة #${d.no}</h3>${c ? `<div class="notice" style="background:#fef3c7;color:#92400e">💵 اتأكد إنك حصّلت <b>${money(c)}</b> من المستلم</div>` : ""}
      <p class="mut">صوّر الشحنة مع المستلم أو عند الباب (إجباري)</p>
      <label class="btn ghost block" style="cursor:pointer">📸 صوّر الإثبات<input type="file" accept="image/*" capture="environment" id="pf" hidden></label>
      <img id="pv" class="proof" style="display:none" alt=""><button class="btn green block" id="okDone" disabled style="margin-top:10px">✅ تأكيد التسليم</button>`, () => {
      let file = null;
      $("pf").onchange = (e) => { file = e.target.files[0]; if (!file) return; $("pv").src = URL.createObjectURL(file); $("pv").style.display = "block"; $("okDone").disabled = false; };
      $("okDone").onclick = async () => {
        if (!file) return; $("okDone").disabled = true; $("okDone").textContent = "جاري الرفع...";
        try { const url = await Store.uploadFile(file, "proofs"); await Store.driverUpdate(id, "delivered", url); closeSheet(); toast("تم التسليم ✓"); await refresh(); }
        catch (e) { toast(e.message, "err"); $("okDone").disabled = false; $("okDone").textContent = "✅ تأكيد التسليم"; }
      };
    });
  }
  function failSheet(id) {
    const rs = ["المستلم مش بيرد", "العنوان غلط", "المستلم رفض الاستلام", "المستلم طلب التأجيل", "سبب آخر"];
    sheet(`<h3>سبب فشل التوصيل</h3>${rs.map((r, i) => `<label class="radio"><input type="radio" name="fr" value="${r}" ${i ? "" : "checked"}> ${r}</label>`).join("")}<input class="in" id="frx" placeholder="تفاصيل (اختياري)"><button class="btn block" style="margin-top:10px;background:var(--red)" id="okFail">تسجيل الفشل</button>`, () => {
      $("okFail").onclick = async () => { const r = document.querySelector("input[name=fr]:checked").value + ($("frx").value.trim() ? " – " + $("frx").value.trim() : ""); try { await Store.driverUpdate(id, "failed", null, r); closeSheet(); toast("اتسجّل"); await refresh(); } catch (e) { toast(e.message, "err"); } };
    });
  }

  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-demo],[data-go],[data-tab],[data-done],[data-fail]"); if (!el) return;
    if (el.dataset.demo) { const p = (await Store.profiles()).find((x) => x.id === el.dataset.demo); Store.demoLogin({ id: p.id, role: "driver", full_name: p.full_name, phone: p.phone }); boot(); }
    else if (el.dataset.tab) { D.tab = el.dataset.tab; render(); }
    else if (el.dataset.done) doneSheet(el.dataset.done);
    else if (el.dataset.fail) failSheet(el.dataset.fail);
    else if (el.dataset.go) { const [id, st] = el.dataset.go.split(":"); el.disabled = true; try { await Store.driverUpdate(id, st); toast("بالتوفيق 🛵 – روح للمستلم"); await refresh(); } catch (err) { toast(err.message, "err"); el.disabled = false; } }
  });
  async function refresh() {
    [D.list, D.setl] = await Promise.all([Store.driverDeliveries(), Store.settlements()]);
    const ids = new Set(D.list.map((o) => o.id));
    if (D.known && D.list.some((o) => !D.known.has(o.id))) { toast("🔔 شحنة جديدة عليك"); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} }
    D.known = ids; if (!document.getElementById("sheet")) render();
  }
  async function boot() {
    try { const s = await Store.settings(); D.name = (s && s.company_name) || D.name; document.title = "مناديب " + D.name; } catch (e) {}
    const me = await Store.me();
    if (!me) return loginView();
    if (me.role !== "driver") return loginView(me.role === "pending" ? "⏳ حسابك قيد المراجعة – الإدارة لازم توافق الأول." : "الحساب ده مش حساب مندوب.");
    D.me = me; await refresh();
  }
  (async () => { try { await Store.init(); await boot(); Store._onRecovery = () => UI.recover(() => boot()); if (Store.recovery) Store._onRecovery(); } catch (e) { toast(e.message, "err"); } Store.onChange(() => { if (D.me) refresh().catch(() => {}); }, 20000); if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {}); })();
})();
