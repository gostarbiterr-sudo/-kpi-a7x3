/* «Итоги месяца»: загрузка ежемесячных отчётов и анализ магазина / региона за прошлый месяц.
   Источники (определяются по содержимому, имя файла не важно):
   • историческая справка (.xlsm, кэш сводной: Магазин × Год × Показатель × месяцы) — оборот, трафик, конверсия, чек, цена, план…
   • гросс-маржа по магазинам за месяц / прошлый месяц / год (Кросс-таблица: Магазин, Оборот (чистый), Гросс маржа)
   • гросс-маржа по группам материалов (Кросс-таблица с «Материал: Группа материалов»)
   • сравнение периодов по подкатегориям (оборот, штуки, средний чек, средняя цена: прошлый / предыдущий / текущий)
   • отчёт по аксессуарам (.xlsm, кэш: Магазин × Месяц × Экоюнит, оборот АКС, чеки, прошлый год)
   • отчёт по сервисам (.xlsb, кэши: услуги по экоюнитам с прошлым годом и по видам услуг)
   Всё считается на устройстве. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const X = () => KPI.xparse;
  const isn = (v) => typeof v === "number" && isFinite(v);
  const key = (s) => String(s == null ? "" : s).toLowerCase().replace(/ё/g, "е").replace(/[\s ]+/g, " ").trim();
  const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const MONTHS_PREP = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];
  const monthIdx = (s) => MONTHS.indexOf(key(s));
  const normCode = (s) => {
    const t = String(s == null ? "" : s).trim().toUpperCase().replace(/^А/, "A").replace(/^С/, "S");
    return /^[A-Z]{1,2}[A-Z0-9]?\d{1,3}$/.test(t) ? t : null;
  };
  const cityOf = (s) => { const m = /,\s*(.+)$/.exec(String(s || "")); return m ? m[1].trim() : ""; };

  // ---------------------------------------------------------------- модель
  function emptyModel() {
    return { hist: null, gross: [], ggroup: null, cat: null, acc: null, srvCat: null, srvType: null, files: [] };
  }
  const add = (o, k, v) => { if (isn(v)) o[k] = (o[k] || 0) + v; };

  // ---- историческая справка
  const HIST_RUB = /^Оборот/;          // эти показатели в справке в млн ₽
  async function loadHist(z, cache, say) {
    const F = cache.fields.map((f) => f.name), ix = (n) => F.findIndex((x) => key(x) === key(n));
    const iS = ix("Магазин"), iY = F.findIndex((x) => /^год(\.1)?$/i.test(x) && x !== "ГОД"), iP = ix("Показатель");
    const iA = ix("ASM"), iD = ix("DSM"), iC = ix("Город"), iB = F.findIndex((x) => /^бренд/i.test(x));
    const iM = []; for (let m = 1; m <= 12; m++) iM.push(F.findIndex((x) => x.trim() === String(m).padStart(2, "0") || x.trim() === String(m)));
    const iT = F.findIndex((x) => x === "ГОД");
    const stores = {};
    await X().pivotRowsXml(z, cache, (r) => {
      const code = normCode(r[iS]); if (!code) return;
      const y = r[iY]; if (!isn(y)) return;
      const metric = String(r[iP] || "").trim(); if (!metric) return;
      const st = stores[code] || (stores[code] = { code, asm: "", dsm: "", city: "", brand: "", y: {} });
      if (iA >= 0 && r[iA]) st.asm = String(r[iA]); if (iD >= 0 && r[iD]) st.dsm = String(r[iD]);
      if (iC >= 0 && r[iC]) st.city = String(r[iC]); if (iB >= 0 && r[iB]) st.brand = String(r[iB]);
      const k = HIST_RUB.test(metric) ? 1e6 : 1;
      const arr = iM.map((i) => (i >= 0 && isn(r[i]) ? r[i] * k : null));
      arr.push(iT >= 0 && isn(r[iT]) ? r[iT] * k : null);
      (st.y[y] = st.y[y] || {})[metric] = arr;
    }, (p) => say && say(`Историческая справка: ${Math.round(p * 100)}%`));
    return { stores };
  }

  // ---- отчёт по аксессуарам: магазин × месяц × экоюнит
  const ACC_F = { rev: "Оборот общий", b2b: "Оборот B2B", acc: "Оборот АКС общий", accQty: "АКС штуки", goodsQty: "Основной товар штуки", goods: "Оборот основной товар",
    revPY: "Оборот общий пргод", accPY: "Оборот АКС пргод", accQtyPY: "Штуки акс пргод", goodsQtyPY: "Штуки товар пргод",
    chkAcc: "Чеки акс (kpi)", chkGoods: "Чеки товар (kpi)", chkAccPY: "Чеки акс прг (kpi)", chkGoodsPY: "Чеки товар прг (kpi)",
    bundle: "Оборот акс связка", bundlePY: "Оборот акс связка пг", planAcc: "План акс", plan: "План  общий", credit: "Оборот АКС в кредит" };
  async function loadAcc(z, cache, say) {
    const F = cache.fields.map((f) => key(f.name)), ix = (n) => F.indexOf(key(n));
    const iS = ix("Магазин"), iM = ix("Месяц"), iE = ix("Экоюнит"), iW = ix("Неделя"), iD = ix("День"), iR = ix("Регион"), iDv = ix("Дивизион");
    const iCh = F.findIndex((x) => x.startsWith("канал"));
    const cols = Object.entries(ACC_F).map(([k, n]) => [k, ix(n)]).filter((x) => x[1] >= 0);
    const chk = ["chkAcc", "chkGoods", "chkAccPY", "chkGoodsPY"].map((k) => [k + "R", ix(ACC_F[k])]).filter((x) => x[1] >= 0);
    const S = {}, days = {};
    await X().pivotRowsXml(z, cache, (r) => {
      const code = normCode(r[iS]); const m = monthIdx(r[iM]); if (!code || m < 0) return;
      const eco = r[iE] ? String(r[iE]) : "Прочее";
      const st = S[code] || (S[code] = { asm: r[iR] || "", dsm: r[iDv] || "", m: {} });
      const mm = st.m[m] || (st.m[m] = {}); const o = mm[eco] || (mm[eco] = {});
      for (const [k, i] of cols) add(o, k, r[i]);
      // аттач считаем по рознице (в интернет-заказах чеки с аксессуарами учитываются иначе)
      if (iCh < 0 || /розниц|магазин/i.test(String(r[iCh] || ""))) for (const [k, i] of chk) add(o, k, r[i]);
      if (iW >= 0 && iD >= 0 && isn(r[iW]) && isn(r[iD])) (days[m] = days[m] || new Set()).add(r[iW] * 7 + r[iD]);
    }, (p) => say && say(`Аксессуары: ${Math.round(p * 100)}%`));
    const cover = {}; Object.keys(days).forEach((m) => (cover[m] = days[m].size));
    return { stores: S, cover };
  }

  // ---- сервисы по экоюнитам (с прошлым годом и планом)
  const SRVC_F = { rev: "Оборот общий", plan: "План общий", srv: "Оборот услуг общий", planSrv: "План услуг общий", srvQty: "Услуги штуки", goodsQty: "Основной товар штуки",
    goods: "Оборот основной товар", revPY: "Оборот общий пргод", srvPY: "Оборот услуг пргод", srvCredit: "Оборот услуг в кредит", credit: "Оборот кредита розничного" };
  async function loadSrvCat(z, cache, say) {
    const F = cache.fields.map((f) => key(f.name)), ix = (n) => F.indexOf(key(n));
    const iS = ix("Магазин"), iM = ix("Месяц"), iE = ix("Экоюнит"), iD = ix("День"), iR = ix("Регион");
    const cols = Object.entries(SRVC_F).map(([k, n]) => [k, ix(n)]).filter((x) => x[1] >= 0);
    const S = {}, days = {};
    await X().pivotRowsBin(z, cache, (r) => {
      const code = normCode(r[iS]); const m = monthIdx(r[iM]); if (!code || m < 0) return;
      const eco = r[iE] ? String(r[iE]) : "Прочее";
      const st = S[code] || (S[code] = { asm: r[iR] || "", m: {} });
      const mm = st.m[m] || (st.m[m] = {}); const o = mm[eco] || (mm[eco] = {});
      for (const [k, i] of cols) add(o, k, r[i]);
      if (iD >= 0 && r[iD] != null) (days[m] = days[m] || new Set()).add(String(r[iD]));
    }, (p) => say && say(`Сервисы по категориям: ${Math.round(p * 100)}%`));
    const cover = {}; Object.keys(days).forEach((m) => (cover[m] = days[m].size));
    return { stores: S, cover };
  }
  // ---- сервисы по видам
  const SRVT = [   // [ключ, название, поле руб, поле шт]
    ["inst", "Установки", "Оборот установок", "Кол-во установок"],
    ["ext", "Расширенная гарантия (ЭС)", "Оборот Сертификаты", "Кол-во сертификаты"],
    ["ins", "Страховки", "Оборот страховок", "Кол-во страховок"],
    ["dig", "Цифровые сервисы", "Оборот Цифровых сервисов", "Кол-во цифровых сервисов"],
    ["sub", "Подписка М.Комбо", 'Сервис подписки МВидео 12 месяцев" (М.Комбо), руб', 'Сервис подписки МВидео 12 месяцев" (М.Комбо)'],
    ["cred", "Кредитные сервисы", "Оборот Кредитные сервисы", "Кол-во кредитные сервисы"],
    ["clim", "Установки климат", "Оборот установок климат", "Кол-во установок климат"],
    ["rem", "Вывоз техники", "Вывоз техники, руб", "Вывоз техники, шт"],
  ];
  const SRVT_EXTRA = { ext2: "2 года оборот", ext3: "3 года оборот", ext5: "5 лет оборот", ext2q: "2 года штуки", ext3q: "3 года штуки", ext5q: "5 лет штуки",
    rev: "Оборот общий", srv: "Оборот услуг общий", goods: "Оборот основного товара", goodsQty: "Кол-во основного товара", net: "Чистый оборот услуг", netBase: "Оборот товара для Чистой доли услуг", b2bSrv: "B2B Услуги" };
  async function loadSrvType(z, cache, say) {
    const F = cache.fields.map((f) => key(f.name)), ix = (n) => F.indexOf(key(n));
    const iS = ix("Магазин"), iM = ix("Месяц"), iD = ix("День");
    const cols = [];
    SRVT.forEach(([k, , rub, qty]) => { cols.push([k, ix(rub)]); cols.push([k + "Q", ix(qty)]); });
    Object.entries(SRVT_EXTRA).forEach(([k, n]) => cols.push([k, ix(n)]));
    const use = cols.filter((c) => c[1] >= 0);
    const S = {}, days = {};
    await X().pivotRowsBin(z, cache, (r) => {
      const code = normCode(r[iS]); const m = monthIdx(r[iM]); if (!code || m < 0) return;
      const st = S[code] || (S[code] = {}); const o = st[m] || (st[m] = {});
      for (const [k, i] of use) add(o, k, r[i]);
      if (iD >= 0 && r[iD] != null) (days[m] = days[m] || new Set()).add(String(r[iD]));
    }, (p) => say && say(`Виды сервисов: ${Math.round(p * 100)}%`));
    const cover = {}; Object.keys(days).forEach((m) => (cover[m] = days[m].size));
    return { stores: S, cover, has: Object.fromEntries(SRVT.map(([k, , rub]) => [k, ix(rub) >= 0])) };
  }

  // ---- таблицы «Кросс-таблица»
  function crossKind(rows) {
    const h = (rows[0] || []).map(key);
    const has = (s) => h.some((x) => x.includes(s));
    if (!h.length || key(h[0]) !== "магазин") return null;
    if (has("подкатегор") && has("текущий")) return "cat";
    if (has("группа материалов") && has("гросс")) return "ggroup";
    if (has("гросс") && has("оборот")) return "gross";
    return null;
  }
  function loadGross(rows, name) {
    const h = rows[0].map(key), iR = h.findIndex((x) => x.startsWith("оборот")), iG = h.findIndex((x) => x.includes("гросс"));
    const S = {}; let tot = 0;
    for (const r of rows.slice(1)) {
      const code = normCode(r[0]); if (!code) continue;
      S[code] = { rev: isn(r[iR]) ? r[iR] : 0, gm: isn(r[iG]) ? r[iG] : 0, city: cityOf(r[1]) };
      tot += S[code].rev;
    }
    const n = key(name);
    const hint = /прошл|предыд|пред\.|пп\b/.test(n) ? "prev" : /\bгод|ytd|накоп|с начала/.test(n) ? "ytd" : /месяц|мес\b/.test(n) ? "month" : null;
    return { stores: S, total: tot, hint, file: name };
  }
  function loadGGroup(rows) {
    const h = rows[0].map(key), iR = h.findIndex((x) => x.startsWith("оборот")), iG = h.findIndex((x) => x.includes("гросс"));
    const S = {};
    for (const r of rows.slice(1)) {
      const code = normCode(r[0]); if (!code || !r[2] || /результат/i.test(String(r[2]))) continue;
      (S[code] = S[code] || []).push({ id: String(r[2]), name: String(r[3] || r[2]).replace(/_+$/, "").trim(), rev: isn(r[iR]) ? r[iR] : 0, gm: isn(r[iG]) ? r[iG] : 0 });
    }
    return { stores: S };
  }
  function loadCat(rows) {
    const h = rows[0].map(key);
    const find = (a, b) => h.findIndex((x) => x.includes(a) && x.includes(b));
    const P = ["прошлый", "предыдущий", "текущий"];
    const iRev = P.map((p) => find("оборот", p)), iQty = P.map((p) => find("количество", p)), iChk = P.map((p) => find("средний чек", p)), iPr = P.map((p) => find("средняя цена", p));
    const S = {}, tot = [0, 0, 0];
    const v = (r, i) => (i >= 0 && isn(r[i]) ? r[i] : 0);
    for (const r of rows.slice(1)) {
      const code = normCode(r[0]); if (!code) continue;
      const id = String(r[2] == null ? "" : r[2]);
      if (!id || id === "#" || /результат/i.test(id)) continue;
      const rev = iRev.map((i) => v(r, i)), qty = iQty.map((i) => v(r, i)), chk = iChk.map((i) => v(r, i));
      const checks = rev.map((x, k) => (chk[k] > 0 ? x / chk[k] : 0));
      (S[code] = S[code] || []).push({ id, name: String(r[3] || id).trim(), rev, qty, checks });
      rev.forEach((x, k) => (tot[k] += x));
    }
    return { stores: S, total: tot };
  }

  // ---- определение файла
  async function tryLoad(f, say, M) {
    const nameL = key(f.name);
    if (!/\.(xlsx|xlsm|xlsb)$/.test(nameL)) return false;
    let z;
    try { z = X().zip(f.buffer); } catch (e) { return false; }
    const note = (kind, comment, rows) => M.files.push({ file: f.name, kind, rows: rows || 0, comment });
    if (z.out["xl/workbook.bin"]) {
      const caches = await X().pivotCachesBin(z);
      const names = (c) => c.fields.map((x) => key(x.name));
      const cat = caches.find((c) => { const n = names(c); return n.includes("оборот услуг общий") && n.includes("экоюнит") && n.includes("оборот услуг пргод") && n.some((x) => /^магазин/.test(x)); });
      const typ = caches.find((c) => { const n = names(c); return n.includes("оборот установок") && n.includes("экоюнит") && !n.some((x) => x.includes("фио")); });
      if (!cat && !typ) return false;
      const fix = (c) => { c.fields.forEach((x) => { if (/^магазин(: id)?$/i.test(x.name)) x.name = "Магазин"; }); return c; };
      if (cat) { M.srvCat = await loadSrvCat(z, fix(cat), say); note("Сервисы по категориям", `используется: магазинов ${Object.keys(M.srvCat.stores).length}`); }
      if (typ) { M.srvType = await loadSrvType(z, fix(typ), say); note("Сервисы по видам", `используется: магазинов ${Object.keys(M.srvType.stores).length}`); }
      return true;
    }
    if (z.names.some((n) => /^xl\/pivotCache\/pivotCacheDefinition\d+\.xml$/.test(n))) {
      const caches = await X().pivotCachesXml(z);
      const names = (c) => c.fields.map((x) => key(x.name));
      const hist = caches.find((c) => { const n = names(c); return n.includes("показатель") && n.includes("магазин") && n.some((x) => /^год(\.1)?$/.test(x)) && n.includes("10"); });
      const acc = caches.find((c) => { const n = names(c); return n.includes("оборот акс общий") && n.includes("магазин") && !n.some((x) => x.includes("фио")); });
      if (hist) { M.hist = await loadHist(z, hist, say); note("Историческая справка", `используется: магазинов ${Object.keys(M.hist.stores).length}`); return true; }
      if (acc) { M.acc = await loadAcc(z, acc, say); note("Аксессуары", `используется: магазинов ${Object.keys(M.acc.stores).length}`); return true; }
      if (caches.some((c) => names(c).includes("магазин"))) return false;
    }
    // обычные таблицы: смотрим лист «Кросс-таблица» (или единственный лист)
    if (!KPI.xlsx || !z.out["xl/workbook.xml"]) return false;
    let book;
    try { book = await KPI.xlsx.readWorkbook(f.buffer); } catch (e) { return false; }
    const cand = book.sheets.filter((s) => /кросс/i.test(s.name) || book.sheets.length === 1);
    for (const sh of cand) {
      const { rows } = await KPI.xlsx.readSheet(book, sh);
      const kind = crossKind(rows);
      if (!kind) continue;
      if (kind === "gross") { const g = loadGross(rows, f.name); M.gross.push(g); note("Гросс-маржа по магазинам", `магазинов ${Object.keys(g.stores).length}`, rows.length); }
      else if (kind === "ggroup") { M.ggroup = loadGGroup(rows); note("Гросс-маржа по группам товаров", `магазинов ${Object.keys(M.ggroup.stores).length}`, rows.length); }
      else { M.cat = loadCat(rows); note("Сравнение периодов по подкатегориям", `магазинов ${Object.keys(M.cat.stores).length}`, rows.length); }
      return true;
    }
    return false;
  }

  // ---- после загрузки всех файлов: отчётный месяц, периоды гросса
  function finalize(M) {
    if (!M) return null;
    const any = M.hist || M.gross.length || M.cat || M.acc || M.srvCat || M.srvType;
    if (!any) return null;
    // отчётный месяц: последний месяц справки, где есть оборот у большинства магазинов
    let Y = null, Mo = null;
    if (M.hist) {
      const cnt = {};
      for (const st of Object.values(M.hist.stores)) for (const [y, mt] of Object.entries(st.y)) {
        const a = mt["Оборот"]; if (!a) continue;
        for (let m = 0; m < 12; m++) if (isn(a[m]) && a[m] > 0) cnt[y * 12 + m] = (cnt[y * 12 + m] || 0) + 1;
      }
      const ks = Object.keys(cnt).map(Number).sort((a, b) => b - a);
      if (ks.length) {
        // последний год в справке; в нём — последний месяц, где оборот есть почти у всех магазинов этого года
        const yMax = Math.floor(ks[0] / 12), inY = ks.filter((x) => Math.floor(x / 12) === yMax);
        // неполный месяц узнаём по резкому провалу числа магазинов с оборотом против предыдущего месяца
        const k = inY.find((x) => !cnt[x - 1] || cnt[x] >= cnt[x - 1] * 0.6) ?? inY[0];
        Y = Math.floor(k / 12); Mo = k % 12;
      }
    }
    if (Mo == null) {     // без справки — по самому полному месяцу в отчётах акс/сервисов
      const cov = (M.srvCat && M.srvCat.cover) || (M.acc && M.acc.cover) || {};
      const best = Object.entries(cov).sort((a, b) => b[1] - a[1])[0];
      Mo = best ? +best[0] : new Date().getMonth() - 1;
      Y = new Date().getFullYear(); if (Mo < 0) { Mo = 11; Y--; }
    }
    M.Y = Y; M.Mo = Mo;
    M.dim = new Date(Y, Mo + 1, 0).getDate();
    const pm = (Mo + 11) % 12;
    M.dimPrev = new Date(Mo === 0 ? Y - 1 : Y, pm + 1, 0).getDate();
    // гросс: какой файл за какой период — по подсказке в имени, иначе по сверке с оборотом справки
    const g = { month: null, prev: null, ytd: null };
    const histRev = (code, f) => { const st = M.hist && M.hist.stores[code]; if (!st) return null; return f(st); };
    const score = (G, f) => {
      let n = 0, ok = 0;
      for (const [code, v] of Object.entries(G.stores)) {
        const h = histRev(code, f); if (!isn(h) || h <= 0 || v.rev <= 0) continue;
        n++; if (Math.abs(v.rev / h - 1) < 0.03) ok++;
      }
      return n ? ok / n : 0;
    };
    const fm = (st) => (st.y[Y] && st.y[Y]["Оборот"] ? st.y[Y]["Оборот"][Mo] : null);
    const fp = (st) => { const yy = Mo === 0 ? Y - 1 : Y; return st.y[yy] && st.y[yy]["Оборот"] ? st.y[yy]["Оборот"][pm] : null; };
    const fy = (st) => { const a = st.y[Y] && st.y[Y]["Оборот"]; if (!a) return null; let s = 0; for (let m = 0; m <= Mo; m++) if (isn(a[m])) s += a[m]; return s; };
    const left = [];
    for (const G2 of M.gross) {
      let k = null;
      if (M.hist) {
        const sc = { month: score(G2, fm), prev: score(G2, fp), ytd: score(G2, fy) };
        const best = Object.entries(sc).sort((a, b) => b[1] - a[1])[0];
        if (best[1] >= 0.5) k = best[0];
      }
      if (!k && G2.hint && !g[G2.hint]) k = G2.hint;
      if (k && !g[k]) g[k] = G2; else left.push(G2);
    }
    left.sort((a, b) => b.total - a.total).forEach((G2) => { const k = ["ytd", "month", "prev"].find((x) => !g[x]); if (k) g[k] = G2; });
    M.g = g;
    return M;
  }

  // ---------------------------------------------------------------- выбор: магазины, ASM, DSM
  function allCodes(M) {
    const s = new Set();
    if (M.hist) Object.keys(M.hist.stores).forEach((c) => s.add(c));
    for (const G2 of Object.values(M.g || {})) if (G2) Object.keys(G2.stores).forEach((c) => s.add(c));
    if (M.cat) Object.keys(M.cat.stores).forEach((c) => s.add(c));
    if (M.acc) Object.keys(M.acc.stores).forEach((c) => s.add(c));
    if (M.srvCat) Object.keys(M.srvCat.stores).forEach((c) => s.add(c));
    return s;
  }
  // магазины, у которых есть оборот в отчётном месяце (работающие)
  function liveCodes(M) {
    const out = new Set();
    for (const c of allCodes(M)) {
      const st = M.hist && M.hist.stores[c];
      const r = st && st.y[M.Y] && st.y[M.Y]["Оборот"] ? st.y[M.Y]["Оборот"][M.Mo] : null;
      const g = M.g && M.g.month && M.g.month.stores[c];
      if ((isn(r) && r > 0) || (g && g.rev > 0) || (!M.hist && !(M.g && M.g.month))) out.add(c);
    }
    return out;
  }
  function attrs(M, code) {
    const st = M.hist && M.hist.stores[code];
    const a = { code, asm: st ? st.asm : "", dsm: st ? st.dsm : "", city: st ? st.city : "", brand: st ? st.brand : "" };
    if (!a.asm && M.acc && M.acc.stores[code]) { a.asm = M.acc.stores[code].asm; a.dsm = a.dsm || M.acc.stores[code].dsm; }
    if (!a.asm && M.srvCat && M.srvCat.stores[code]) a.asm = M.srvCat.stores[code].asm;
    if (!a.city) for (const G2 of Object.values(M.g || {})) if (G2 && G2.stores[code] && G2.stores[code].city) { a.city = G2.stores[code].city; break; }
    return a;
  }
  function levels(M) {
    const live = liveCodes(M), asm = {}, dsm = {};
    for (const c of live) { const a = attrs(M, c); if (a.asm) (asm[a.asm] = asm[a.asm] || []).push(c); if (a.dsm) (dsm[a.dsm] = dsm[a.dsm] || []).push(c); }
    const out = [];
    Object.keys(dsm).sort((a, b) => a.localeCompare(b, "ru")).forEach((d) => out.push({ level: "dsm", name: d, label: `${d} — дивизион (DSM), магазинов ${dsm[d].length}`, n: dsm[d].length }));
    Object.keys(asm).sort((a, b) => a.localeCompare(b, "ru")).forEach((a) => out.push({ level: "asm", name: a, label: `${a} (ASM), магазинов ${asm[a].length}`, n: asm[a].length }));
    if (!out.length && live.size) out.push({ level: "all", name: "Все магазины", label: `Все магазины в файлах (${live.size})`, n: live.size });
    return out;
  }
  function findStore(M, q) {
    const s = String(q || "").trim().toUpperCase().replace(/^А/, "A").replace(/^С/, "S");
    if (!s) return [];
    const live = [...liveCodes(M)].sort();
    const ex = live.filter((c) => c === s);
    if (ex.length) return ex;
    const num = s.replace(/^[A-Z]+/, "");
    return live.filter((c) => c.includes(s) || (num && c.replace(/^[A-Z]+/, "") === num) || key(attrs(M, c).city).includes(key(q)));
  }
  function codesFor(M, sel) {
    const live = [...liveCodes(M)];
    if (sel.level === "store") return [sel.code];
    if (sel.level === "asm") return live.filter((c) => attrs(M, c).asm === sel.name);
    if (sel.level === "dsm") return live.filter((c) => attrs(M, c).dsm === sel.name);
    return live;
  }

  KPI.month = Object.assign(KPI.month || {}, { MONTHS, MONTHS_GEN, MONTHS_PREP, emptyModel, tryLoad, finalize, liveCodes, attrs, levels, findStore, codesFor, SRVT, isn, key });
})(typeof globalThis !== "undefined" ? globalThis : this);
