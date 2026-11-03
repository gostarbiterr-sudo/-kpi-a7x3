/* Мобильное приложение: выбор выгрузок, магазин или регион, планы, наглядный отчёт.
   Все расчёты — на устройстве, файлы никуда не отправляются. Планы и нормы хранятся в браузере этого устройства. */
(function () {
  "use strict";
  const { loader, analysis, report } = KPI;
  const $ = (s) => document.querySelector(s);
  const esc = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } },
  };
  const fmt = analysis.fmt;

  let files = [];        // [{name, size, lastModified, buffer}]
  let loaded = null;
  let result = null;
  let mode = store.get("kpi_mode", "store");
  let current = null;    // {type:"store", code} | {type:"region", name}

  // ---------------------------------------------------------------- файлы
  async function addFiles(list) {
    const arr = [...list].filter((f) => /\.(xlsx|xlsm|xlsb)$/i.test(f.name));
    const skipped = [...list].length - arr.length;
    for (const f of arr) {
      const i = files.findIndex((x) => x.name === f.name);
      const rec = { name: f.name, size: f.size, lastModified: f.lastModified, buffer: await f.arrayBuffer() };
      if (i >= 0) files[i] = rec; else files.push(rec);
    }
    if (skipped) toast(`Пропущено файлов не в формате .xlsx: ${skipped}`);
    await reload();
  }
  function clearFiles() { files = []; loaded = null; renderSetup(); }

  async function reload() {
    if (!files.length) { loaded = null; renderSetup(); return; }
    setBusy("Читаю файлы…");
    try { loaded = await loader.loadFiles(files, (t) => setBusy(t)); }
    catch (e) { loaded = null; toast("Не удалось прочитать файлы: " + (e.message || e)); console.error(e); }
    setBusy("");
    renderSetup();
  }

  // ---------------------------------------------------------------- экран настройки
  function setMode(m) {
    mode = m;
    store.set("kpi_mode", m);
    document.querySelectorAll("#step2 .seg2 button").forEach((b) => b.classList.toggle("on", b.dataset.m === m));
    $("#storeBox").hidden = m !== "store";
    $("#regionBox").hidden = m !== "region";
    $("#monthBox").hidden = m !== "month";
    $("#plansRow").hidden = m === "month";
    $("#choices").innerHTML = "";
  }
  function renderSetup() {
    const fl = $("#files");
    if (!files.length) {
      fl.innerHTML = '<p class="hint">Выберите 4 файла: <b>KPI день</b>, <b>KPI неделя</b>, <b>KPI месяц</b> и <b>«Файл для УС»</b>. Можно все сразу.</p>';
      $("#step2").hidden = true;
      return;
    }
    const P = loader.PERIODS, R = loader.PERIOD_RU;
    const chip = (ok, t) => `<span class="st ${ok ? "ok" : "no"}">${ok ? "✓" : "✕"} ${t}</span>`;
    const dates = loaded ? loaded.dates : {};
    const dlab = (k) => (dates[k] ? ` <small>${loader.ru(dates[k])}</small>` : "");
    const nStores = loaded ? analysis.liveCodes(loaded).size : 0;
    const regions = loaded ? analysis.regionList(loaded) : [];
    fl.innerHTML =
      `<div class="flist">${files.map((f) => `<div class="fi"><span class="fn">${esc(f.name)}</span><span class="fs">${Math.round(f.size / 1024)} КБ</span></div>`).join("")}</div>` +
      (loaded ? `<div class="sum"><div><b>KPI магазинов</b>${P.map((p) => chip(loaded.kpi[p], R[p] + dlab("kpi|" + p))).join("")}</div>` +
        `<div><b>Сотрудники</b>${P.map((p) => chip(loaded.emp[p], R[p] + dlab("emp|" + p))).join("")}</div>` +
        (nStores ? `<p class="muted">Работающих магазинов: <b>${nStores}</b> · регионов: <b>${regions.length}</b></p>` : "") +
        (loaded.month ? `<p class="muted">Итоги месяца: <b>${KPI.month.MONTHS[loaded.month.Mo]} ${loaded.month.Y}</b> · магазинов ${KPI.month.liveCodes(loaded.month).size} · отчётов ${loaded.month.files.length}</p>` : "") + `</div>` +
        loaded.warnings.map((w) => `<p class="warn">⚠ ${esc(w)}</p>`).join("") +
        `<details><summary>Что прочитано из файлов</summary><div class="rd">${loaded.files.map((r) =>
          `<div class="rdi ${r.comment.startsWith("используется") ? "used" : ""}"><b>${esc(r.file)}</b> · ${esc(r.sheet)}<br><small>${esc(r.kind)}${r.period !== "—" ? " · " + esc(r.period) : ""}${r.date ? " · " + esc(r.date) : ""} — ${esc(r.comment)}</small></div>`).join("")}</div></details>` : "");
    const hasM = !!(loaded && loaded.month);
    $("#step2").hidden = !loaded || (nStores === 0 && !hasM);
    document.querySelector('#step2 .seg2 button[data-m="store"]').hidden = nStores === 0;
    document.querySelector('#step2 .seg2 button[data-m="region"]').hidden = nStores === 0;
    document.querySelector('#step2 .seg2 button[data-m="month"]').hidden = !hasM;
    if (hasM) {
      const lastC = store.get("kpi_last_mlevel", "");
      $("#mLevel").innerHTML = KPI.month.levels(loaded.month).map((l) => { const v = l.level + "|" + l.name; return `<option value="${esc(v)}"${v === lastC ? " selected" : ""}>${esc(l.label)}</option>`; }).join("");
      $("#mCodes").innerHTML = [...KPI.month.liveCodes(loaded.month)].sort().map((c) => `<option value="${esc(c)}">`).join("");
      $("#mTitle").textContent = `Итоги: ${KPI.month.MONTHS[loaded.month.Mo]} ${loaded.month.Y}`;
      if (!$("#mCode").value) $("#mCode").value = store.get("kpi_last_mcode", "");
    }
    if (mode === "month" && !hasM) mode = "store";
    if (mode !== "month" && nStores === 0 && hasM) mode = "month";
    $("#codes").innerHTML = loaded ? [...analysis.liveCodes(loaded)].sort().map((c) => `<option value="${esc(c)}">`).join("") : "";
    const sel = $("#region"), lastR = store.get("kpi_last_region", "");
    sel.innerHTML = regions.map((r) => `<option value="${esc(r.name)}"${r.name === lastR ? " selected" : ""}>${esc(r.level === "total" ? `${r.name} — весь регион` : `${r.name} (ASM)`)}</option>`).join("");
    const last = store.get("kpi_last_code", "");
    if (last && !$("#code").value) $("#code").value = last;
    setMode(mode);
  }

  // ---------------------------------------------------------------- анализ
  const norms = () => Object.assign({}, analysis.DEFAULT_NORMS, store.get("kpi_norms", {}));
  const plans = () => store.get("kpi_plans", {});
  const planOpts = () => ({ includeDay: store.get("kpi_inc_day", true) });

  function compute(obj) {
    if (obj.type === "month") return obj.sel.level === "multi" ? KPI.monthAn.analyzeMulti(loaded.month, obj.sel.codes, norms()) : KPI.monthAn.analyze(loaded.month, obj.sel, norms());
    return obj.type === "store" ? analysis.analyze(loaded, obj.code, norms(), plans(), planOpts())
      : analysis.analyzeRegion(loaded, obj.name, norms(), plans(), planOpts());
  }
  function run(codeArg) {
    if (!loaded) return;
    const q = (codeArg || $("#code").value).trim();
    const box = $("#choices");
    box.innerHTML = "";
    if (!q) { toast("Впишите код магазина, например A103"); return; }
    const found = analysis.findStore(loaded, q);
    if (!found.length) {
      box.innerHTML = `<p class="warn">Магазин «${esc(q)}» не найден. Например: ${esc([...analysis.liveCodes(loaded)].sort().slice(0, 12).join(", "))}</p>`;
      return;
    }
    if (found.length > 1 && !codeArg) {
      box.innerHTML = '<p class="muted">Найдено несколько магазинов — выберите:</p>' + found.slice(0, 40).map((c) => {
        const i = analysis.storeLabel(loaded, c);
        return `<button class="choice" data-c="${esc(c)}"><b>${esc(c)}</b> ${esc([i["Город"], i["ТЦ"]].filter(Boolean).join(" · "))}</button>`;
      }).join("");
      box.querySelectorAll(".choice").forEach((b) => (b.onclick = () => run(b.dataset.c)));
      return;
    }
    $("#code").value = found[0];
    store.set("kpi_last_code", found[0]);
    open({ type: "store", code: found[0] });
  }
  function runRegion() {
    if (!loaded) return;
    const name = $("#region").value;
    if (!name) { toast("В файлах не найдено регионов"); return; }
    store.set("kpi_last_region", name);
    open({ type: "region", name });
  }
  function runMonth(useCode, codeArg) {
    if (!loaded || !loaded.month) return;
    const M = loaded.month, box = $("#choices"); box.innerHTML = "";
    if (useCode) {
      const raw = (codeArg || $("#mCode").value).trim();
      if (!raw) { toast("Впишите код магазина"); return; }
      const parts = raw.split(/[,;\s]+/).filter(Boolean);
      if (parts.length > 1) {              // несколько магазинов
        const codes = [], miss = [];
        for (const q of parts) { const f = KPI.month.findStore(M, q); const ex = f.find((c) => c === q.toUpperCase().replace(/^А/, "A").replace(/^С/, "S")); const c = ex || (f.length === 1 ? f[0] : null); if (c) { if (!codes.includes(c)) codes.push(c); } else miss.push(q); }
        if (miss.length) box.innerHTML = `<p class="warn">Не найдены или неоднозначны: ${esc(miss.join(", "))}. Впишите коды точнее.</p>`;
        if (!codes.length) return;
        if (codes.length === 1) { open({ type: "month", sel: { level: "store", code: codes[0] } }); return; }
        store.set("kpi_last_mcode", codes.join(", "));
        open({ type: "month", sel: { level: "multi", codes } });
        return;
      }
      const q = parts[0];
      const found = KPI.month.findStore(M, q);
      if (!found.length) { box.innerHTML = `<p class="warn">Магазин «${esc(q)}» не найден в отчётах за месяц.</p>`; return; }
      if (found.length > 1 && !codeArg) {
        box.innerHTML = '<p class="muted">Найдено несколько магазинов — выберите:</p>' + found.slice(0, 40).map((c) => { const a = KPI.month.attrs(M, c); return `<button class="choice" data-c="${esc(c)}"><b>${esc(c)}</b> ${esc([a.city, a.asm].filter(Boolean).join(" · "))}</button>`; }).join("");
        box.querySelectorAll(".choice").forEach((b) => (b.onclick = () => runMonth(true, b.dataset.c)));
        return;
      }
      $("#mCode").value = found[0];
      store.set("kpi_last_mcode", found[0]);
      open({ type: "month", sel: { level: "store", code: found[0] } });
      return;
    }
    const v = $("#mLevel").value, i = v.indexOf("|");
    if (!v) { toast("В отчётах не найдено регионов"); return; }
    store.set("kpi_last_mlevel", v);
    open({ type: "month", sel: { level: v.slice(0, i), name: v.slice(i + 1) } });
  }
  // ---- выбор нескольких магазинов из списка
  const pickSel = new Set();
  function renderPick() {
    const M = loaded && loaded.month; if (!M) return;
    const f = KPI.month.key($("#mFilter").value);
    const by = {};
    for (const c of [...KPI.month.liveCodes(M)].sort()) {
      const a = KPI.month.attrs(M, c);
      if (f && !KPI.month.key(c + " " + a.city + " " + a.asm).includes(f)) continue;
      (by[a.asm || "Без ASM"] = by[a.asm || "Без ASM"] || []).push([c, a.city]);
    }
    $("#mList").innerHTML = Object.keys(by).sort((x, y) => x.localeCompare(y, "ru")).map((g) => `<h4>${esc(g)} <button type="button" class="ghost" data-all="${esc(g)}">все</button></h4>` +
      by[g].map(([c, city]) => `<label><input type="checkbox" value="${esc(c)}"${pickSel.has(c) ? " checked" : ""}><b>${esc(c)}</b> <small>${esc(city)}</small></label>`).join("")).join("") || '<p class="muted">Ничего не найдено.</p>';
    $("#mList").querySelectorAll("input").forEach((x) => (x.onchange = () => { x.checked ? pickSel.add(x.value) : pickSel.delete(x.value); syncPick(); }));
    $("#mList").querySelectorAll("button[data-all]").forEach((btn) => (btn.onclick = () => { by[btn.dataset.all].forEach(([c]) => pickSel.add(c)); renderPick(); syncPick(); }));
  }
  function syncPick() {
    $("#mGo").textContent = `Показать выбранные (${pickSel.size})`;
  }
  // ---- презентация (.pptx) по итогам месяца
  let pptBusy = false;
  async function pptFile() {
    const blob = await KPI.monthPpt.build(result);
    const d = new Date(), id = String(result.code).replace(/[^\wА-Яа-яЁё-]+/g, "_");
    return new File([blob], `itogi_${KPI.month.MONTHS[result.Mo]}_${result.Y}_${id}.pptx`, { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  }
  async function presentation(share) {
    if (pptBusy || !result || (result.type !== "month" && result.type !== "monthMulti")) return;
    pptBusy = true; setBusy("Собираю презентацию…");
    try {
      const f = await pptFile();
      setBusy("");
      if (share && navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f] }).catch(() => {});
      else { download(f); toast("Презентация сохранена: " + f.name); }
    } catch (e) { setBusy(""); toast("Не удалось собрать презентацию: " + (e.message || e)); console.error(e); }
    pptBusy = false;
  }
  function open(obj) {
    try { result = compute(obj); } catch (e) { toast("Ошибка анализа: " + (e.message || e)); console.error(e); return; }
    current = obj;
    showReport(true);
  }

  function showReport(push) {
    const r = report.build(result, { app: true });
    const host = $("#report");
    host.innerHTML = `<style>${r.css}</style>${r.body}`;
    if (result.type !== "month" && result.type !== "monthMulti") addPicsTab(host);
    report.bind(host);
    document.title = r.title;
    $("#setup").hidden = true;
    host.hidden = false;
    $("#bar").hidden = false;
    $("#plansBtn").hidden = result.type === "month" || result.type === "monthMulti";
    $("#pptBtn").hidden = result.type !== "month" && result.type !== "monthMulti";
    window.scrollTo(0, 0);
    if (push) history.pushState({ report: 1 }, "");
  }
  // ---- вкладка «Картинки»: отчёт в том же виде, что и картинки для рассылки
  let picsSel = null, picsCache = {}, picsSeq = 0;
  function picKinds() {
    if (result.type === "region") return [["region", "Регион — главное", true], ["stores", "Магазины — KPI", true]];
    return [["store", "Магазин — главное", true], ["staff", "Продавцы — KPI", true]];
  }
  function addPicsTab(host) {
    const tabs = host.querySelector(".tabs"), main = host.querySelector(".rep main");
    if (!tabs || !main) return;
    Object.values(picsCache).forEach((x) => URL.revokeObjectURL(x.url));
    picsCache = {};
    const sel = [["month", "Месяц"], ["week", "Неделя"], ["day", "День"]];
    const rep = host.querySelector(".rep");
    picsSel = (rep && rep.dataset.period) || "month";
    const btn = document.createElement("button");
    btn.className = "tb"; btn.dataset.t = "pics"; btn.textContent = "🖼 Картинки";
    tabs.children[0].after(btn);
    const sec = document.createElement("section");
    sec.className = "tab"; sec.dataset.tab = "pics";
    sec.innerHTML = `<div class="pxbar">${sel.map(([v, t]) => `<button type="button" class="pxb" data-v="${v}">${t}</button>`).join("")}</div>` +
      `<p class="muted">Так отчёт выглядит в картинках для рассылки. Нажмите на картинку, чтобы увеличить.</p><div class="pxlist"></div>`;
    main.prepend(sec);
    sec.querySelectorAll(".pxb").forEach((b) => (b.onclick = () => { picsSel = b.dataset.v; renderPics(sec); }));
    btn.addEventListener("click", () => renderPics(sec));
  }
  async function renderPics(sec) {
    sec.querySelectorAll(".pxb").forEach((b) => b.classList.toggle("on", b.dataset.v === picsSel));
    const list = sec.querySelector(".pxlist"), seq = ++picsSeq, kinds = picKinds();
    list.innerHTML = kinds.map(([, t]) => `<figure class="px"><figcaption>${esc(t)}</figcaption><div class="pxwait">Рисую…</div></figure>`).join("");
    for (let i = 0; i < kinds.length; i++) {
      const [k, t, dep] = kinds[i];
      const ck = (dep ? picsSel : "-") + "|" + k;
      try {
        if (!picsCache[ck]) { const img = await KPI.share.makeImage(result, picsSel, k); img.url = URL.createObjectURL(img.blob); picsCache[ck] = img; }
        if (seq !== picsSeq) return;
        const img = picsCache[ck], fig = list.children[i];
        fig.innerHTML = `<figcaption>${esc(t)}</figcaption><div class="pxwrap"><img src="${img.url}" alt="${esc(t)}"></div>` +
          `<div class="pxact"><button type="button" class="pxs">↗ Отправить</button><button type="button" class="pxd">⬇ Сохранить</button></div>`;
        fig.querySelector(".pxwrap").onclick = (e) => e.currentTarget.classList.toggle("zoom");
        fig.querySelector(".pxs").onclick = () => shareFile(img.file);
        fig.querySelector(".pxd").onclick = () => download(img.file);
      } catch (e) { if (list.children[i]) list.children[i].innerHTML = `<figcaption>${esc(t)}</figcaption><p class="warn">Не удалось нарисовать: ${esc(e.message || e)}</p>`; console.error(e); }
    }
  }
  function shareFile(f) {
    if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch(() => {});
    else { download(f); toast("Отправка из браузера недоступна — картинка сохранена, приложите её в мессенджере"); }
  }

  function backToSetup() {
    $("#report").hidden = true;
    $("#report").innerHTML = "";
    $("#bar").hidden = true;
    $("#setup").hidden = false;
    document.title = "Анализ магазина";
  }
  window.addEventListener("popstate", () => { if (!$("#report").hidden) backToSetup(); });

  function reportFile() {
    const html = report.standalone(result);
    const d = new Date();
    const id = String(result.code).replace(/[^\wА-Яа-яЁё-]+/g, "_");
    const name = `${result.type === "month" || result.type === "monthMulti" ? "itogi_mesyaca" : "otchet"}_${id}_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.html`;
    return new File([html], name, { type: "text/html" });
  }
  function save() { download(reportFile()); }
  // ---- отправка картинкой: картинку готовим заранее, чтобы нажатие «Отправить» сразу открывало меню (иначе iOS теряет жест)
  let shPer = "month", shKind = "store", shImg = null, shUrl = null, shSeq = 0;
  function openShare() {
    const rep = document.querySelector("#report .rep");
    const pb = document.querySelectorAll("#shPer button"), kb = document.querySelectorAll("#shKind button");
    {
      shPer = (rep && rep.dataset.period) || "month";
      [["month", "Месяц"], ["week", "Неделя"], ["day", "День"]].forEach(([p, t], i) => { pb[i].dataset.p = p; pb[i].textContent = t; });
      const reg = result.type === "region";
      if (shKind !== "store") shKind = reg ? "stores" : "staff";
      kb[0].dataset.k = "store";
      kb[0].textContent = reg ? "Регион — главное" : "Магазин — главное";
      kb[1].textContent = reg ? "Магазины — KPI" : "Продавцы — KPI";
      kb[1].dataset.k = reg ? "stores" : "staff";
      kb[1].hidden = false;
    }
    renderShare();
    $("#shareDlg").showModal();
  }
  async function renderShare() {
    document.querySelectorAll("#shPer button").forEach((b) => b.classList.toggle("on", b.dataset.p === shPer));
    document.querySelectorAll("#shKind button").forEach((b) => b.classList.toggle("on", b.dataset.k === shKind));
    $("#shPer").hidden = shKind === "csum";
    const seq = ++shSeq;
    shImg = null; $("#shSend").disabled = $("#shSave").disabled = true;
    try {
      const img = await KPI.share.makeImage(result, shPer, shKind !== "store" ? shKind : result.type === "region" ? "region" : "store");
      if (seq !== shSeq) return;
      shImg = img;
      if (shUrl) URL.revokeObjectURL(shUrl);
      shUrl = URL.createObjectURL(img.blob);
      $("#shPrev").src = shUrl;
      $("#shSend").disabled = $("#shSave").disabled = false;
    } catch (e) { toast("Не удалось нарисовать картинку: " + (e.message || e)); console.error(e); }
  }
  function download(file) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function sendImage() { if (shImg) shareFile(shImg.file); }

  // ---------------------------------------------------------------- планы
  let planObj = null, planPer = "month", draft = null;
  const objLabel = (o) => (o.type === "store" ? `магазин ${o.code}` : o.name);
  function pendingObj() {                       // для кого открыть планы с экрана настройки
    if (!loaded) return null;
    if (mode === "region") { const n = $("#region").value; return n ? { type: "region", name: n } : null; }
    const q = $("#code").value.trim(); const f = q ? analysis.findStore(loaded, q) : [];
    return f.length === 1 ? { type: "store", code: f[0] } : null;
  }
  function openPlans(obj) {
    if (!obj) { toast(mode === "region" ? "Сначала выберите регион" : "Сначала впишите код магазина"); return; }
    planObj = obj;
    draft = JSON.parse(JSON.stringify(plans()[analysis.planKey(obj)] || {}));
    $("#plansTitle").textContent = `Планы: ${objLabel(obj)}`;
    $("#incDay").checked = store.get("kpi_inc_day", true);
    renderPlanForm();
    $("#plansDlg").showModal();
  }
  function factsFor(obj, p) {
    try {
      const res = result && current && analysis.planKey(current) === analysis.planKey(obj) ? result : compute(obj);
      return (res.periods[p] && res.periods[p].row) || {};
    } catch (e) { return {}; }
  }
  const parseNum = (s) => { const v = parseFloat(String(s).replace(/\s| /g, "").replace(",", ".")); return isFinite(v) ? v : null; };
  function collect() {
    const vals = {};
    document.querySelectorAll("#plansForm input").forEach((i) => { const v = parseNum(i.value); if (v != null && v > 0) vals[i.name] = v; });
    if (Object.keys(vals).length) draft[planPer] = vals; else delete draft[planPer];
  }
  function renderPlanForm() {
    document.querySelectorAll("#plansPer button").forEach((b) => b.classList.toggle("on", b.dataset.p === planPer));
    const facts = factsFor(planObj, planPer), cur = draft[planPer] || {};
    const d = result && result.periods[planPer] ? result.periods[planPer].date_kpi : null;
    $("#plansObj").innerHTML = `<p class="muted">${planPer === "day" ? "План на день." : planPer === "week" ? "План на всю неделю (пн–вс)." : "План на весь месяц."} Суммы указывайте за весь период — программа сама посчитает план на дату выгрузки${d ? " (" + loader.ru(d) + ")" : ""}.</p>`;
    $("#plansForm").innerHTML = analysis.PLAN_METRICS.map((m) => {
      const f = facts[m.id];
      const hint = f != null ? `факт: ${fmt(f, m.d)}${m.unit === "%" ? "%" : " " + m.unit}` : "нет факта в выгрузке";
      return `<div class="pf-row"><label for="pl_${m.id}">${esc(m.label)}, ${esc(m.unit)}<small>${esc(hint)}</small></label>` +
        `<input id="pl_${m.id}" name="${m.id}" inputmode="decimal" autocomplete="off" placeholder="—" value="${cur[m.id] != null ? esc(String(cur[m.id]).replace(".", ",")) : ""}"></div>`;
    }).join("");
  }
  function deriveFromMonth() {
    collect();
    const m = draft.month;
    if (!m) { toast("Сначала заполните план на месяц"); return; }
    const d = (result && result.periods.month.date_kpi) || new Date();
    const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    const w = {}, dd = {};
    for (const x of analysis.PLAN_METRICS) {
      if (m[x.id] == null) continue;
      w[x.id] = x.sum ? Math.round((m[x.id] * 7) / dim) : m[x.id];
      dd[x.id] = x.sum ? Math.round(m[x.id] / dim) : m[x.id];
    }
    draft.week = w; draft.day = dd;
    renderPlanForm();
    toast(`Неделя и день рассчитаны из месяца (${dim} дн.)`);
  }
  function savePlans() {
    collect();
    const all = plans(), k = analysis.planKey(planObj);
    if (Object.keys(draft).length) all[k] = draft; else delete all[k];
    store.set("kpi_plans", all);
    store.set("kpi_inc_day", $("#incDay").checked);
    $("#plansDlg").close();
    toast("Планы сохранены");
    if (current && analysis.planKey(current) === k && !$("#report").hidden) { result = compute(current); showReport(false); }
  }

  // ---------------------------------------------------------------- нормы
  const NORM_FIELDS = [["attach_min", "Аттач аксессуаров магазина, не ниже, %"], ["srv_share_min", "Доля услуг магазина, не ниже, %"],
    ["chdu_min", "ЧДУ магазина, не ниже, %"], ["compl_emp_min", "Доля комплектных чеков продавца, не ниже, %"], ["srv_emp_min", "Доля услуг продавца, не ниже, %"],
    ["att_emp_min", "Аттач аксессуаров продавца, не ниже, % (0 — без нормы)"], ["cps_emp_min", "Чеков в смену у продавца, не ниже (0 — без нормы)"]];
  function openNorms() {
    const n = norms();
    $("#normsForm").innerHTML = NORM_FIELDS.map(([k, t]) => `<label>${esc(t)}<input type="number" inputmode="decimal" step="0.1" name="${k}" value="${n[k]}"></label>`).join("") +
      '<div class="row"><button type="button" id="normReset" class="ghost">По умолчанию</button><button type="submit">Сохранить</button></div>';
    $("#normReset").onclick = () => { store.set("kpi_norms", {}); openNorms(); };
    $("#normsDlg").showModal();
  }

  // ---------------------------------------------------------------- мелочи
  function setBusy(t) { const b = $("#busy"); b.textContent = t; b.hidden = !t; }
  let tt;
  function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(tt); tt = setTimeout(() => (el.hidden = true), 4000); }

  // ---------------------------------------------------------------- старт
  function init() {
    if (typeof DecompressionStream === "undefined") {
      $("#setup").innerHTML = '<p class="warn">Этот браузер слишком старый: обновите его (нужен Chrome 80+, Safari 16.4+ или новее).</p>';
      return;
    }
    $("#pick").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
    $("#clear").onclick = clearFiles;
    document.querySelectorAll("#step2 .seg2 button").forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
    $("#go").onclick = () => run();
    $("#goR").onclick = runRegion;
    $("#goM").onclick = () => runMonth(false);
    $("#goMS").onclick = () => runMonth(true);
    $("#mPickBtn").onclick = () => {
      const p = $("#mPick"); p.hidden = !p.hidden;
      if (!p.hidden) { pickSel.clear(); const live = KPI.month.liveCodes(loaded.month); store.get("kpi_last_mmulti", []).forEach((c) => { if (live.has(c)) pickSel.add(c); }); renderPick(); syncPick(); }
    };
    $("#mFilter").addEventListener("input", renderPick);
    $("#mNone").onclick = () => { pickSel.clear(); renderPick(); syncPick(); };
    $("#mGo").onclick = () => {
      if (pickSel.size < 2) { toast("Отметьте хотя бы два магазина"); return; }
      const codes = [...pickSel].sort();
      store.set("kpi_last_mmulti", codes);
      open({ type: "month", sel: { level: "multi", codes } });
    };
    $("#mCode").addEventListener("keydown", (e) => { if (e.key === "Enter") runMonth(true); });
    $("#pptBtn").onclick = () => presentation(false);
    $("#code").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    $("#back").onclick = () => history.back();
    $("#save").onclick = save;
    $("#share").onclick = () => (result && (result.type === "month" || result.type === "monthMulti") ? presentation(true) : openShare());
    document.querySelectorAll("#shPer button").forEach((b) => (b.onclick = () => { shPer = b.dataset.p; renderShare(); }));
    document.querySelectorAll("#shKind button").forEach((b) => (b.onclick = () => { shKind = b.dataset.k; renderShare(); }));
    $("#shSend").onclick = sendImage;
    $("#shSave").onclick = () => shImg && download(shImg.file);
    $("#shClose").onclick = () => $("#shareDlg").close();
    $("#plansBtn").onclick = () => openPlans(current);
    $("#plansBtn2").onclick = () => openPlans(pendingObj());
    document.querySelectorAll("#plansPer button").forEach((b) => (b.onclick = () => { collect(); planPer = b.dataset.p; renderPlanForm(); }));
    $("#plansDerive").onclick = deriveFromMonth;
    $("#plansClear").onclick = () => { delete draft[planPer]; renderPlanForm(); };
    $("#plansSave").onclick = savePlans;
    $("#plansClose").onclick = () => $("#plansDlg").close();
    $("#normsBtn").onclick = openNorms;
    $("#normsForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target), out = {};
      NORM_FIELDS.forEach(([k]) => { const v = parseFloat(String(fd.get(k)).replace(",", ".")); if (isFinite(v)) out[k] = v; });
      store.set("kpi_norms", out);
      $("#normsDlg").close();
      toast("Нормы сохранены");
      if (current && !$("#report").hidden) { result = compute(current); showReport(false); }
    });
    $("#normsClose").onclick = () => $("#normsDlg").close();
    document.addEventListener("dragover", (e) => e.preventDefault());
    document.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
    renderSetup();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((r) => r.update()).catch(() => {});
  }
  init();

  KPI.app = { addFiles, run, runRegion, openPlans, state: () => ({ files, loaded, result, current }) };
})();
