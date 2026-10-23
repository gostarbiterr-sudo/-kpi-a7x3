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
    const arr = [...list].filter((f) => /\.(xlsx|xlsm)$/i.test(f.name));
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
    $("#contestBox").hidden = m !== "contest";
    $("#plansRow").hidden = m === "contest";
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
        (loaded.contest ? `<p class="muted">Конкурс 1P: магазинов <b>${loaded.contest.stores.length}</b> · выгрузка ${loader.ru(loaded.contest.exp)}</p>` : "") + `</div>` +
        loaded.warnings.map((w) => `<p class="warn">⚠ ${esc(w)}</p>`).join("") +
        `<details><summary>Что прочитано из файлов</summary><div class="rd">${loaded.files.map((r) =>
          `<div class="rdi ${r.comment.startsWith("используется") ? "used" : ""}"><b>${esc(r.file)}</b> · ${esc(r.sheet)}<br><small>${esc(r.kind)}${r.period !== "—" ? " · " + esc(r.period) : ""}${r.date ? " · " + esc(r.date) : ""} — ${esc(r.comment)}</small></div>`).join("")}</div></details>` : "");
    const hasC = !!(loaded && loaded.contest);
    $("#step2").hidden = !loaded || (nStores === 0 && !hasC);
    document.querySelector('#step2 .seg2 button[data-m="store"]').hidden = nStores === 0;
    document.querySelector('#step2 .seg2 button[data-m="region"]').hidden = nStores === 0;
    document.querySelector('#step2 .seg2 button[data-m="contest"]').hidden = !hasC;
    if (hasC) {
      const lastC = store.get("kpi_last_clevel", "");
      $("#cLevel").innerHTML = KPI.contest.levels(loaded.contest).map((l) => { const v = l.level + "|" + l.name; return `<option value="${esc(v)}"${v === lastC ? " selected" : ""}>${esc(l.label)}</option>`; }).join("");
      $("#cCodes").innerHTML = loaded.contest.stores.map((x) => `<option value="${esc(x.code)}">`).join("");
    }
    if (mode === "contest" && !hasC) mode = "store";
    if (mode !== "contest" && nStores === 0 && hasC) mode = "contest";
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
    if (obj.type === "contest") return KPI.contest.analyze(loaded.contest, obj.sel);
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
  function runContest(useCode, codeArg) {
    if (!loaded || !loaded.contest) return;
    const box = $("#choices"); box.innerHTML = "";
    if (useCode) {
      const q = (codeArg || $("#cCode").value).trim();
      if (!q) { toast("Впишите код магазина"); return; }
      const found = KPI.contest.findStore(loaded.contest, q);
      if (!found.length) { box.innerHTML = `<p class="warn">Магазин «${esc(q)}» не найден в файле конкурса.</p>`; return; }
      if (found.length > 1 && !codeArg) {
        box.innerHTML = '<p class="muted">Найдено несколько магазинов — выберите:</p>' + found.slice(0, 40).map((c) => `<button class="choice" data-c="${esc(c)}"><b>${esc(c)}</b></button>`).join("");
        box.querySelectorAll(".choice").forEach((b) => (b.onclick = () => runContest(true, b.dataset.c)));
        return;
      }
      $("#cCode").value = found[0];
      open({ type: "contest", sel: { level: "store", code: found[0] } });
      return;
    }
    const v = $("#cLevel").value, i = v.indexOf("|");
    store.set("kpi_last_clevel", v);
    open({ type: "contest", sel: { level: v.slice(0, i), name: v.slice(i + 1) } });
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
    report.bind(host);
    document.title = r.title;
    $("#setup").hidden = true;
    host.hidden = false;
    $("#bar").hidden = false;
    $("#plansBtn").hidden = result.type === "contest";
    window.scrollTo(0, 0);
    if (push) history.pushState({ report: 1 }, "");
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
    const name = `${result.type === "contest" ? "konkurs_1P" : "otchet"}_${id}_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.html`;
    return new File([html], name, { type: "text/html" });
  }
  function save() { download(reportFile()); }
  // ---- отправка картинкой: картинку готовим заранее, чтобы нажатие «Отправить» сразу открывало меню (иначе iOS теряет жест)
  let shPer = "month", shKind = "store", shImg = null, shUrl = null, shSeq = 0;
  function openShare() {
    const rep = document.querySelector("#report .rep");
    const pb = document.querySelectorAll("#shPer button"), kb = document.querySelectorAll("#shKind button");
    if (result.type === "contest") {
      shPer = (rep && rep.dataset.plan) || "p1";
      ["p1", "p2", "p3"].forEach((p, i) => { pb[i].dataset.p = p; pb[i].textContent = `План ${i + 1}`; });
      shKind = shKind === "clist" ? "clist" : "csum";
      kb[0].dataset.k = "csum"; kb[0].textContent = "Сводка";
      kb[1].dataset.k = "clist";
      kb[1].textContent = { store: "Продавцы", asm: "Магазины", dsm: "ASM", company: "ASM" }[result.level];
      kb[1].hidden = result.level === "store" && !result.sellers.length;
      if (kb[1].hidden) shKind = "csum";
    } else {
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
  function sendImage() {
    if (!shImg) return;
    const f = shImg.file;
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      navigator.share({ files: [f] }).catch(() => {});
    } else { download(f); toast("Отправка из браузера недоступна — картинка сохранена, приложите её в мессенджере"); }
  }

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
    $("#goC").onclick = () => runContest(false);
    $("#goCS").onclick = () => runContest(true);
    $("#cCode").addEventListener("keydown", (e) => { if (e.key === "Enter") runContest(true); });
    $("#code").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    $("#back").onclick = () => history.back();
    $("#save").onclick = save;
    $("#share").onclick = openShare;
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
