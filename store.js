// طبقة البيانات: Supabase (حقيقي) أو وضع تجريبي على نفس الجهاز
(function () {
  const CFG = window.APP_CONFIG || {};
  const C = { ...CFG };
  const LIVE = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  const KEY = "tawseel_demo_v1";
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const nowISO = () => new Date().toISOString();
  let sb = null;
  const RECOVERY = /type=recovery/.test(location.hash) || /type=recovery/.test(location.search);
  const chk = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };

  async function compress(file, max = 1200, q = 0.8) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      return c;
    } finally { URL.revokeObjectURL(url); }
  }

  // ---------- وضع تجريبي ----------
  function seed() {
    const zones = Object.keys(UI.AREAS), prices = [];
    zones.forEach((a) => zones.forEach((b) => prices.push({ from_zone: a, to_zone: b, price: a === b ? 1 : 1.5 })));
    return {
      settings: { company_name: "Goten Delivery", tagline: "توصيل سريع لكل مناطق الكويت", is_open: true, whatsapp: "", notice: "نسخة تجريبية – البيانات على هذا الجهاز فقط" },
      prices, deliveries: [], settlements: [], locations: [], nextNo: 1001,
      profiles: [
        { id: "d1", full_name: "سالم (مندوب تجريبي)", phone: "96599990001", role: "driver" },
        { id: "d2", full_name: "فهد (مندوب تجريبي)", phone: "96599990002", role: "driver" },
        { id: "m1", full_name: "أبو محمد", business_name: "مطعم تجريبي", phone: "96555550001", pickup_area: "السالمية", pickup_address: "ق 10 ش 5", role: "merchant" }
      ]
    };
  }
  let mem = null;
  const db = () => { if (mem) return mem; try { mem = JSON.parse(localStorage.getItem(KEY)); } catch (e) {} if (!mem) { mem = seed(); persist(); } return mem; };
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { throw new Error("مساحة التخزين التجريبية امتلأت"); } }
  const sess = { get() { try { return JSON.parse(sessionStorage.getItem("tawseel_demo_user")); } catch (e) { return null; } }, set(v) { try { sessionStorage.setItem("tawseel_demo_user", JSON.stringify(v)); } catch (e) {} } };
  function demoPrice(a1, a2) {
    const z1 = UI.zoneOf(a1), z2 = UI.zoneOf(a2); if (!z1 || !z2) throw new Error("BAD_AREA");
    const p = db().prices.find((x) => (x.from_zone === z1 && x.to_zone === z2)) || db().prices.find((x) => x.from_zone === z2 && x.to_zone === z1);
    if (!p) throw new Error("NO_PRICE"); return { z1, z2, fee: Number(p.price) };
  }
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("تعذر تحميل مكتبة Supabase – تأكد من الإنترنت")); document.head.appendChild(s); }); }

  const Store = {
    live: LIVE,
    async init() {
      if (!LIVE) { db(); return; }
      if (!window.supabase) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
      sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
      Store.recovery = RECOVERY;
      sb.auth.onAuthStateChange((ev) => { if (ev === "PASSWORD_RECOVERY") { Store.recovery = true; if (Store._onRecovery) Store._onRecovery(); } });
      if (RECOVERY) await sb.auth.getSession();
    },
    onChange(cb, ms = 15000) {
      if (!LIVE) window.addEventListener("storage", (e) => { if (e.key === KEY) { mem = null; cb(); } });
      setInterval(() => { if (!LIVE) mem = null; cb(); }, ms);
    },

    async settings() { return LIVE ? chk(await sb.from("settings").select("*").eq("id", 1).single()) : db().settings; },
    async saveSettings(s) { if (LIVE) return chk(await sb.from("settings").update(s).eq("id", 1)); db().settings = { ...db().settings, ...s }; persist(); },
    async prices() { return LIVE ? chk(await sb.from("prices").select("*")) : db().prices; },
    async savePrices(rows) { if (LIVE) return chk(await sb.from("prices").upsert(rows, { onConflict: "from_zone,to_zone" })); const d = db(); rows.forEach((r) => { const i = d.prices.findIndex((x) => x.from_zone === r.from_zone && x.to_zone === r.to_zone); if (i >= 0) d.prices[i] = r; else d.prices.push(r); }); persist(); },

    async uploadFile(file, folder = "proofs") {
      const c = await compress(file, 1280, 0.78);
      if (!LIVE) return c.toDataURL("image/jpeg", 0.6);
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.78));
      const path = folder + "/" + uid() + ".jpg";
      chk(await sb.storage.from("files").upload(path, blob, { contentType: "image/jpeg" }));
      return sb.storage.from("files").getPublicUrl(path).data.publicUrl;
    },

    // ---------- الشحنات ----------
    async createDelivery(p) {
      if (LIVE) return chk(await sb.rpc("create_delivery", { p }));
      const d = db(); if (!d.settings.is_open) throw new Error("CLOSED");
      const { z1, z2, fee } = demoPrice(p.pickup_area, p.drop_area);
      const me = sess.get();
      const row = { ...p, id: uid(), no: d.nextNo++, merchant_id: me && me.role === "merchant" ? me.id : null, pickup_zone: z1, drop_zone: z2, fee, cod_amount: Number(p.cod_amount || 0), fee_payer: p.fee_payer === "receiver" ? "receiver" : "sender", status: "new", driver_id: null, created_at: nowISO(), updated_at: nowISO() };
      d.deliveries.unshift(row); persist();
      return { id: row.id, no: row.no, fee };
    },
    async trackDelivery(id) {
      if (LIVE) return chk(await sb.rpc("track_delivery", { did: id }));
      const d = db(), x = d.deliveries.find((y) => y.id === id); if (!x) return null;
      const dr = d.profiles.find((p) => p.id === x.driver_id), loc = d.locations.find((l) => l.driver_id === x.driver_id);
      const live = ["assigned", "picked_up"].includes(x.status);
      return { ...x, driver_name: dr && dr.full_name, driver_phone: dr && dr.phone, lat: live && loc ? loc.lat : null, lng: live && loc ? loc.lng : null, loc_at: live && loc ? loc.updated_at : null };
    },
    async deliveries() {
      if (LIVE) return chk(await sb.from("deliveries").select("*").order("created_at", { ascending: false }).limit(1000));
      const me = sess.get(), all = db().deliveries;
      if (me && me.role === "merchant") return all.filter((x) => x.merchant_id === me.id);
      return all;
    },
    async updateDelivery(id, patch) { patch = { ...patch, updated_at: nowISO() }; if (patch.status === "delivered") patch.delivered_at = nowISO(); if (LIVE) return chk(await sb.from("deliveries").update(patch).eq("id", id)); Object.assign(db().deliveries.find((x) => x.id === id), patch); persist(); },
    async deleteDelivery(id) { if (LIVE) return chk(await sb.from("deliveries").delete().eq("id", id)); const d = db(); d.deliveries = d.deliveries.filter((x) => x.id !== id); persist(); },
    async driverDeliveries() {
      const me = await this.me(); if (!me) return [];
      if (LIVE) return chk(await sb.from("deliveries").select("*").eq("driver_id", me.id).order("created_at", { ascending: false }).limit(300));
      return db().deliveries.filter((x) => x.driver_id === me.id);
    },
    async driverUpdate(id, st, proof, reason) {
      if (LIVE) return chk(await sb.rpc("driver_update", { did: id, st, proof: proof || null, reason: reason || null }));
      const patch = { status: st }; if (proof) patch.proof_url = proof; if (st === "failed") patch.failed_reason = reason; return this.updateDelivery(id, patch);
    },
    async driverPing(lat, lng) {
      if (LIVE) return chk(await sb.rpc("driver_ping", { plat: lat, plng: lng }));
      const me = sess.get(); if (!me) return; const d = db(); d.locations = d.locations.filter((l) => l.driver_id !== me.id); d.locations.push({ driver_id: me.id, lat, lng, updated_at: nowISO() }); persist();
    },
    async driverLocations() { return LIVE ? chk(await sb.from("driver_locations").select("*")) : db().locations; },

    // ---------- التسويات ----------
    async settlements() {
      if (LIVE) return chk(await sb.from("settlements").select("*").order("created_at", { ascending: false }).limit(2000));
      const me = sess.get(), all = db().settlements; return me && me.role !== "admin" ? all.filter((s) => s.party === me.id) : all;
    },
    async saveSettlement(s) { if (LIVE) return chk(await sb.from("settlements").insert(s)); db().settlements.unshift({ ...s, id: uid(), created_at: nowISO() }); persist(); },
    async deleteSettlement(id) { if (LIVE) return chk(await sb.from("settlements").delete().eq("id", id)); const d = db(); d.settlements = d.settlements.filter((x) => x.id !== id); persist(); },

    // ---------- الحسابات ----------
    async me() {
      if (!LIVE) return sess.get();
      const { data } = await sb.auth.getUser(); if (!data || !data.user) return null;
      const p = (await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle()).data;
      return p ? { ...p, email: data.user.email } : { id: data.user.id, role: "pending", email: data.user.email };
    },
    async signIn(email, password) { if (!LIVE) throw new Error("DEMO"); chk(await sb.auth.signInWithPassword({ email, password })); },
    async signUp(email, password, meta) { if (!LIVE) throw new Error("DEMO"); return chk(await sb.auth.signUp({ email, password, options: { data: meta } })); },
    async resetPassword(email) {
      if (!LIVE) throw new Error("مش متاح في الوضع التجريبي");
      chk(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
    },
    async setNewPassword(pw) { chk(await sb.auth.updateUser({ password: pw })); Store.recovery = false; history.replaceState(null, "", location.pathname); },
    async signOut() { if (LIVE) await sb.auth.signOut(); else sess.set(null); },
    demoLogin(user) { sess.set(user); },
    async profiles() { return LIVE ? chk(await sb.from("profiles").select("*").order("created_at", { ascending: false })) : db().profiles; },
    async saveProfile(p) { if (LIVE) { const { id, ...rest } = p; delete rest.email; delete rest.created_at; return chk(await sb.from("profiles").update(rest).eq("id", id)); } const d = db(); const i = d.profiles.findIndex((x) => x.id === p.id); if (i >= 0) d.profiles[i] = { ...d.profiles[i], ...p }; else d.profiles.push({ ...p, id: p.id || uid() }); persist(); },
    async updateMyProfile(p) { if (LIVE) return chk(await sb.rpc("update_my_profile", { p })); const me = sess.get(); await this.saveProfile({ ...p, id: me.id }); sess.set({ ...me, ...p }); },
    async savePush(sub) {
      if (!LIVE) throw new Error("الإشعارات بتشتغل في النسخة الحقيقية بس");
      const j = sub.toJSON();
      chk(await sb.rpc("save_push_subscription", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth }));
    },
    async resetDemo() { if (!LIVE) { mem = seed(); persist(); } }
  };
  window.Store = Store;
})();
