/* Разбор выгрузок: KPI магазинов (день / неделя / месяц) и сотрудники («Файл для УС»). Порт loader.py. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const PERIODS = ["day", "week", "month"];
  const PERIOD_RU = { day: "День", week: "Неделя", month: "Месяц" };

  // ---------------------------------------------------------------- нормализация текста
  const LOOK_FROM = "авсенкмортху", LOOK_TO = "abcehkmoptxy";
  const UP_FROM = "АВСЕНКМОРТХУ", UP_TO = "ABCEHKMOPTXY";
  function tr(s, from, to) {
    let out = "";
    for (const ch of s) { const i = from.indexOf(ch); out += i >= 0 ? to[i] : ch; }
    return out;
  }
  function key(s) {
    s = tr(String(s).toLowerCase().replace(/ё/g, "е"), LOOK_FROM, LOOK_TO);
    return s.replace(/[^0-9a-zа-я%]+/g, "");
  }
  function normCode(s) {
    s = tr(String(s).trim().toUpperCase(), UP_FROM, UP_TO);
    return s.replace(/[\s\-_.]+/g, "");
  }
  const CODE_RE = /^[A-Z]{1,2}\d{2,4}$/;
  const L = "A-Za-zА-Яа-я";
  const CODE_START = new RegExp("^\\s*(?:(?:магазин|маг\\.?|тт|точка|подразделение)[^0-9A-Za-zА-Яа-яЁё_]*)?([" + L + "]{1,2}\\s?\\d{2,4})(?![" + L + "0-9])", "i");
  const CODE_ANY = new RegExp("(?:^|[^" + L + "0-9])([" + L + "]{1,2}\\d{2,4})(?![" + L + "0-9])");

  // ---------------------------------------------------------------- какие колонки ищем
  const KPI_COLS = {
    asm: ["ASM"], store: ["Магазин"], city: ["Город"], status: ["Статус магазина"], tc: ["ТЦ"], format: ["Формат"],
    revenue: ["Оборот"],
    rev_p: ["Прирост оборота к периоду %"], rev_y: ["Прирост оборота к году %"], rev_l: ["Прирост оборота к году LfL %"],
    revr_p: ["Прирост оборота к периоду розница %"], revr_y: ["Прирост оборота розница к году %"], revr_l: ["Прирост оборота розница к году LFL, %"],
    eff_p: ["Эффективность розницы период"], eff_y: ["Эффективность розницы год"], eff_l: ["Эффективность розницы год LfL"],
    effo_p: ["Эффективность офлайн к периоду"], effo_y: ["Эффективность офлайн к году"], effo_l: ["Эффективность розницы офлайн год lfl"],
    traffic: ["Трафик офлайн"],
    tr_p: ["Прирост к периоду трафика офлайн %"], tr_y: ["Прирост к году трафика офлайн %"], tr_l: ["Прирост к году трафика офлайн LFL %"],
    conv: ["Конверсия офлайн"],
    conv_p: ["Прирост конверсии офлайн к периоду п.п."], conv_y: ["Прирост конверсии офлайн к году п.п."], conv_l: ["Прирост конверсии офлайн к году LfL п.п."],
    checks: ["Чеки"], checks_p: ["Прирост чеков к периоду %"], checks_y: ["Прирост чеков к году %"], checks_l: ["Прирост чеков к году LfL %"],
    avg: ["Средний чек"], avg_p: ["Прирост Средний чек к периоду"], avg_y: ["Прирост Средний чек к году"], avg_l: ["Прирост Средний чек к году LfL"],
    upt: ["Штуки в чеке"], upt_p: ["Прирост Штуки в чеке к периоду"], upt_y: ["Прирост Штуки в чеке к году"], upt_l: ["Прирост Штуки в чеке к году LfL"],
    acc_rev: ["Оборот Аксессуары"], acc_att: ["Аттач акс в 1 чеке с товаром (розница)"],
    acc_att_p: ["Прирост аттача акс в 1 чеке к периоду п.п."], acc_att_y: ["Прирост аттача акс в 1 чеке к году, п.п."],
    acc_sh: ["Доля АКС в обороте"], acc_sh_p: ["Прирост Доли АКС к периоду, п.п."], acc_sh_y: ["Прирост Доли АКС к году, п.п."],
    acc_rev_p: ["Прирост оборота АКС к периоду"], acc_rev_y: ["Прирост оборота АКС к году"], acc_rev_l: ["Прирост оборота АКС к году LfL"],
    srv_rev: ["Оборот Услуги"], srv_sh: ["Доля Услуги в обороте"],
    srv_sh_p: ["Прирост Доли услуги к периоду, п.п"], srv_sh_y: ["Прирост Доли услуги к году, п.п"],
    srv_rev_p: ["Прирост оборота Услуги к периоду"], srv_rev_y: ["Прирост оборота Услуги году", "Прирост оборота Услуги к году"],
    srv_rev_l: ["Прирост оборота Услуги к году LfL"],
    chdu: ["ЧДУ, %", "ЧДУ"], credit: ["Доля кредита"],
    ecom: ["Доля Е-ком, руб", "Доля E-com, руб", "Доля Е-com, руб", "Доля E-ком, руб", "Доля Е-ком", "Доля E-com"],
    b2b: ["Доля B2B", "Доля В2В"],
  };
  const KPI_TEXT = new Set(["asm", "store", "city", "status", "tc", "format"]);
  const KPI_LEVEL_PCT = ["conv", "acc_att", "acc_sh", "srv_sh", "chdu", "credit", "ecom", "b2b"];
  const EMP_COLS = {
    name: ["Сотрудник ФИО", "ФИО", "Сотрудник"], store: ["Магазин", "Код магазина", "Подразделение"],
    avg: ["Средний чек"], att: ["Аттач. Аксессуаров", "Аттач Аксессуаров", "Аттач акс", "Аттач АКС"],
    compl: ["Доля Компл. чеков", "Доля комплектных чеков", "Доля Компл чеков"], cps: ["Чеки в смену"],
    upt: ["ШтВЧ", "Штуки в чеке"], revenue: ["Оборот"], acc_rev: ["Оборот АКС", "Оборот Аксессуары"],
    acc_sh: ["Доля АКС"], srv_rev: ["Оборот УСЛ", "Оборот Услуги"], srv_sh: ["Доля УСЛ", "Доля Услуги"],
  };
  const EMP_LEVEL_PCT = ["att", "compl", "acc_sh", "srv_sh"];

  // ---------------------------------------------------------------- помощники
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const cell = (row, j) => (j != null && j < row.length ? row[j] : null);
  function sval(v) {
    if (v == null) return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
    return String(v).trim();
  }

  function matchColumns(header, spec) {
    const keyidx = new Map();
    header.forEach((h, j) => { if (typeof h === "string" && h.trim()) { const k = key(h); if (!keyidx.has(k)) keyidx.set(k, j); } });
    const found = {}, used = new Set();
    for (const cid of Object.keys(spec)) {
      for (const a of spec[cid]) {
        const j = keyidx.get(key(a));
        if (j != null && !used.has(j)) { found[cid] = j; used.add(j); break; }
      }
    }
    return found;
  }
  function bestHeader(rows, spec, limit = 40) {
    let bestN = 0, bestI = null, bestFound = null;
    rows.slice(0, limit).forEach((row, i) => {
      const f = matchColumns(row, spec), n = Object.keys(f).length;
      if (n > bestN) { bestN = n; bestI = i; bestFound = f; }
    });
    return [bestN, bestI, bestFound];
  }
  function fixLevels(recs, found, pctCols, ids, notes) {
    for (const cid of ids) {
      if (!(cid in found) || pctCols.has(found[cid])) continue;
      const vals = recs.map((r) => r[cid]).filter(isNum);
      if (vals.length && Math.max(...vals) <= 1.0 && Math.min(...vals) >= 0) {
        recs.forEach((r) => { if (isNum(r[cid])) r[cid] = r[cid] * 100; });
        notes.push(`«${cid}»: значения до 1 прочитаны как доли и умножены на 100`);
      }
    }
  }

  // ---------------------------------------------------------------- разбор листов
  function parseKpi(rows, pctCols) {
    const [n, i, found] = bestHeader(rows, KPI_COLS);
    if (i == null || n < 8 || !("store" in found) || !("revenue" in found)) return null;
    let recs = [];
    const subs = [];                     // итоговые строки: итог региона, строки ASM
    const metricRec = (row, extra) => {
      const rec = Object.assign({}, extra);
      for (const cid of Object.keys(found)) {
        if (cid === "store") continue;
        const v = cell(row, found[cid]);
        rec[cid] = KPI_TEXT.has(cid) ? sval(v) : (isNum(v) ? v : null);
      }
      return rec;
    };
    for (const row of rows.slice(i + 1)) {
      const sraw = sval(cell(row, found.store));
      const low = sraw.toLowerCase();
      if (!sraw || low.includes("итог") || low.includes("всего")) {
        const asmTxt = "asm" in found ? sval(cell(row, found.asm)) : "";
        const name = sraw.replace(/итого?|всего/gi, "").trim() || asmTxt;
        if (name && isNum(cell(row, found.revenue))) subs.push(metricRec(row, { name, store_raw: sraw }));
        continue;
      }
      const m0 = CODE_START.exec(sraw);
      const rec = { store_raw: sraw, code: m0 ? normCode(m0[1]) : normCode(sraw) };
      for (const cid of Object.keys(found)) {
        if (cid === "store") continue;
        const v = cell(row, found[cid]);
        rec[cid] = KPI_TEXT.has(cid) ? sval(v) : (isNum(v) ? v : null);
      }
      recs.push(rec);
    }
    if (!recs.length) return null;
    if (recs.some((r) => CODE_RE.test(r.code))) {
      recs.filter((r) => !CODE_RE.test(r.code) && isNum(r.revenue)).forEach((r) => subs.push(Object.assign({}, r, { name: r.store_raw })));
      recs = recs.filter((r) => CODE_RE.test(r.code));
    }
    const seen = new Set();
    recs = recs.filter((r) => (seen.has(r.code) ? false : (seen.add(r.code), true)));
    const notes = [];
    fixLevels(recs.concat(subs), found, pctCols, KPI_LEVEL_PCT, notes);
    // уровень итоговой строки: имя совпадает с ASM магазинов -> «asm», иначе -> «total» (весь файл — итог региона)
    const asmKeys = new Set(recs.map((r) => key(r.asm || "")).filter(Boolean));
    const regions = [], seenR = new Set();
    for (const r of subs) {
      const k = key(r.name);
      if (!k || seenR.has(k)) continue;
      seenR.add(k);
      regions.push({ name: r.name, level: asmKeys.has(k) ? "asm" : "total", rec: r, source: "file" });
    }
    return { kind: "kpi", recs, found, notes, columnsFound: n, regions };
  }

  function parseEmp(rows, pctCols) {
    const [, i, found] = bestHeader(rows, EMP_COLS);
    const metricIds = found ? Object.keys(found).filter((c) => c !== "name" && c !== "store") : [];
    if (i == null || !("name" in found) || metricIds.length < 4) return null;
    const storeIdx = "store" in found ? found.store : null;
    const recs = [];
    let cur = null, markers = 0, noStore = 0;
    for (const row of rows.slice(i + 1)) {
      if (storeIdx != null) {
        const sv = sval(cell(row, storeIdx));
        if (sv) { const m = CODE_START.exec(sv); cur = m ? normCode(m[1]) : normCode(sv); }
      }
      let name = cell(row, found.name);
      if (typeof name !== "string" || !name.trim()) continue;
      name = name.replace(/\s+/g, " ").trim();
      const low = name.toLowerCase();
      if (low.includes("итог") || low.includes("всего")) continue;
      const m = CODE_START.exec(name);
      if (m && CODE_RE.test(normCode(m[1]))) { cur = normCode(m[1]); markers++; continue; }
      let store = cur;
      if (store == null) {
        const m2 = CODE_ANY.exec(name);
        if (m2 && CODE_RE.test(normCode(m2[1]))) store = normCode(m2[1]);
      }
      const rec = { name, store_code: store };
      for (const cid of metricIds) { const v = cell(row, found[cid]); rec[cid] = isNum(v) ? v : null; }
      if (store == null) noStore++;
      recs.push(rec);
    }
    if (!recs.length) return null;
    const notes = [];
    fixLevels(recs, found, pctCols, EMP_LEVEL_PCT, notes);
    const method = storeIdx != null ? "колонка «Магазин»" : markers ? `строки-заголовки магазинов (${markers} шт.)` : "код магазина в имени сотрудника";
    return { kind: "emp", recs, found, notes, method, noStore };
  }

  // ---------------------------------------------------------------- имена файлов и листов
  function detectPeriod(text) {
    const t = String(text).toLowerCase().replace(/ё/g, "е");
    if (/день|дневн|(?:^|[^а-я])дн(?![а-я])/.test(t)) return "day";
    if (t.includes("недел")) return "week";
    if (/месяц|(?:^|[^а-я])мес(?![а-я])/.test(t)) return "month";
    return null;
  }
  const DATE_PATS = [[/(?:^|\D)(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})(?!\d)/g, "ymd"], [/(?:^|\D)(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})(?!\d)/g, "dmy"]];
  const COPY_TAIL = /(\s*\(\d+\)|\s*[-–]\s*(копия|copy)(\s*\(\d+\))?)+\s*$/i;
  function stem(name) { return name.replace(/\.[^.]+$/, "").replace(COPY_TAIL, "").trim(); }
  function validDate(y, m, d) {
    const x = new Date(Date.UTC(y, m - 1, d));
    return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d ? x : null;
  }
  function nameDate(name) {
    const s = stem(name);
    for (const [re, order] of DATE_PATS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(s))) {
        const [a, b, c] = [m[1], m[2], m[3]].map(Number);
        const d = order === "ymd" ? validDate(a, b, c) : validDate(c, b, a);
        if (d) return d;
        re.lastIndex = m.index + 1;
      }
    }
    return null;
  }
  function fileRegion(name) {
    let s = stem(name);
    for (const [re] of DATE_PATS) s = s.replace(new RegExp(re.source, "g"), (m0) => m0.replace(/\d.*$/, " "));
    const m = /KPI[\s_]+[^\s_]+[\s_]*(.*)$/i.exec(s);
    if (!m) return "";
    return m[1].replace(/[\s_\-–.]+/g, " ").trim();
  }
  const iso = (d) => (d ? d.toISOString().slice(0, 10) : "");
  const ru = (d) => (d ? `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}` : "");

  // ---------------------------------------------------------------- загрузка набора файлов
  /* files: [{name, lastModified, buffer}] */
  async function loadFiles(files, progress) {
    const say = progress || (() => {});
    const cands = [], info = [];
    const addInfo = (file, sheet, kind, period, region, d, rows, comment) =>
      info.push({ file, sheet, kind, period: PERIOD_RU[period] || "—", region, date: iso(d), rows, comment });

    for (const f of files) {
      const base = f.name;
      if (base.startsWith("~$")) continue;
      if (!/\.(xlsx|xlsm)$/i.test(base)) { addInfo(base, "", "не Excel", null, "", null, 0, "формат не поддерживается (нужен .xlsx)"); continue; }
      say(`Читаю ${base}…`);
      let book;
      try { book = await KPI.xlsx.readWorkbook(f.buffer); }
      catch (e) { addInfo(base, "", "ошибка", null, "", null, 0, `не удалось открыть: ${e.message || e}`); continue; }
      const nd = nameDate(base);
      const md = new Date(f.lastModified || Date.now());
      const d = nd || new Date(Date.UTC(md.getFullYear(), md.getMonth(), md.getDate()));
      const region = fileRegion(base);
      const dateNote = nd ? "" : " Даты в названии нет — взята дата изменения файла.";
      for (const sh of book.sheets) {
        let rows, pct;
        try { ({ rows, pctCols: pct } = await KPI.xlsx.readSheet(book, sh)); }
        catch (e) { addInfo(base, sh.name, "ошибка", null, region, d, 0, `не удалось прочитать лист: ${e.message || e}`); continue; }
        const skey = key(sh.name);
        if (skey.includes("сотрудник") || skey.startsWith(key("Сотр"))) {
          const t = parseEmp(rows, pct);
          if (!t) { addInfo(base, sh.name, "сотрудники?", null, "", d, rows.length, "лист похож на сотрудников, но колонки не распознаны (нужны: Сотрудник ФИО, Средний чек, Оборот, Доля УСЛ…)"); continue; }
          cands.push({ kind: "emp", period: detectPeriod(sh.name) || "month", region: "", date: d, t, named: !!nd, file: base, sheet: sh.name, warn: dateNote.trim() });
          continue;
        }
        const t = parseKpi(rows, pct);
        if (!t) { addInfo(base, sh.name, "не KPI-отчёт", null, region, d, rows.length, "лист пропущен"); continue; }
        let period = detectPeriod(base) || detectPeriod(sh.name), warn = "";
        if (!period) { period = "month"; warn = "период не найден в названии — принят «Месяц»"; }
        cands.push({ kind: "kpi", period, region, date: d, t, named: !!nd, file: base, sheet: sh.name, warn: (warn + dateNote).trim() });
      }
    }

    const ck = (c) => `${c.kind}|${c.period}|${c.region}`;
    const chosen = new Map();
    for (const c of cands) {
      const cur = chosen.get(ck(c));
      if (!cur || c.date > cur.date || (+c.date === +cur.date && c.t.recs.length > cur.t.recs.length)) chosen.set(ck(c), c);
    }
    const kpiNamed = new Set([...chosen.values()].filter((c) => c.kind === "kpi" && c.file.toLowerCase().includes("kpi")).map((c) => c.period));
    for (const [k, c] of [...chosen]) {
      if (c.kind === "kpi" && kpiNamed.has(c.period) && !c.file.toLowerCase().includes("kpi")) { c.superseded = true; chosen.delete(k); }
    }
    const res = { kpi: {}, emp: {}, files: [], dates: {}, warnings: [], regions: {}, regionName: "" };
    for (const c of cands) {
      if (c.superseded) { addInfo(c.file, c.sheet, "KPI магазинов", c.period, c.region, c.date, c.t.recs.length, "не используется: за этот период есть файл «KPI …»"); continue; }
      const top = chosen.get(ck(c));
      const what = c.kind === "kpi" ? "KPI магазинов" : "Сотрудники";
      let comment = c.warn || "";
      if (top === c) {
        if (c.kind === "emp") comment = (comment + ` Магазин определён: ${c.t.method}; без магазина: ${c.t.noStore}.`).trim();
        comment = ("используется. " + (comment + " " + c.t.notes.join("; ")).trim()).trim();
      } else {
        comment = `не используется: есть более свежая выгрузка — ${top.file} (${ru(top.date)})`;
      }
      addInfo(c.file, c.sheet, what, c.period, c.region, c.date, c.t.recs.length, comment);
    }
    for (const c of chosen.values()) {
      const target = c.kind === "kpi" ? res.kpi : res.emp;
      (target[c.period] = target[c.period] || []).push(c.t.recs);
      const dk = `${c.kind}|${c.period}`;
      if (!res.dates[dk] || c.date > res.dates[dk]) res.dates[dk] = c.date;
    }
    res.regions = {};
    res.regionName = "";
    for (const c of chosen.values()) {
      if (c.kind !== "kpi") continue;
      const list = (res.regions[c.period] = res.regions[c.period] || []);
      for (const r of c.t.regions || []) if (!list.some((x) => key(x.name) === key(r.name))) list.push(Object.assign({ fileRegion: c.region }, r));
      if (!res.regionName && c.region) res.regionName = c.region;
    }
    for (const target of [res.kpi, res.emp]) {
      for (const p of Object.keys(target)) {
        let all = [].concat(...target[p]);
        if (target === res.kpi) { const seen = new Set(); all = all.filter((r) => (seen.has(r.code) ? false : (seen.add(r.code), true))); }
        target[p] = all;
      }
    }
    const named = [...chosen.values()].filter((c) => c.named);
    const ds = [...new Set(named.map((c) => +c.date))].sort((a, b) => a - b);
    if (ds.length > 1 && ds[ds.length - 1] - ds[0] >= 86400000) {
      const byKey = {};
      named.forEach((c) => { const k = `${c.kind}|${c.period}`; if (!byKey[k] || c.date > byKey[k]) byKey[k] = c.date; });
      const parts = Object.keys(byKey).sort((a, b) => { const [ka, pa] = a.split("|"), [kb, pb] = b.split("|"); return ka < kb ? -1 : ka > kb ? 1 : PERIODS.indexOf(pa) - PERIODS.indexOf(pb); })
        .map((k) => { const [kind, p] = k.split("|"); return `${kind === "kpi" ? "KPI" : "сотрудники"} ${PERIOD_RU[p].toLowerCase()} — ${ru(byKey[k])}`; });
      res.warnings.push("Файлы выгружены в разные дни: " + parts.join("; ") + ". Проверьте, что загружены свежие выгрузки.");
    }
    for (const p of PERIODS) {
      if (!res.kpi[p]) res.warnings.push(`Нет KPI-файла за период «${PERIOD_RU[p]}» — анализ магазина за этот период недоступен.`);
      if (!res.emp[p]) res.warnings.push(`Нет вкладки сотрудников за период «${PERIOD_RU[p]}» — анализ продавцов за этот период недоступен.`);
    }
    info.forEach((r, i) => (r._i = i));
    info.sort((a, b) => {
      const oa = a.comment.startsWith("используется") ? 0 : 1, ob = b.comment.startsWith("используется") ? 0 : 1;
      return oa - ob || (a.file < b.file ? -1 : a.file > b.file ? 1 : a._i - b._i);
    });
    info.forEach((r) => { delete r._i; if (r.comment === "лист пропущен") r.comment = "служебный лист — не нужен для анализа"; });
    res.files = info;
    return res;
  }

  KPI.loader = { PERIODS, PERIOD_RU, key, normCode, CODE_RE, detectPeriod, nameDate, fileRegion, loadFiles, ru, iso };
})(typeof globalThis !== "undefined" ? globalThis : this);
