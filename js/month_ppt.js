/* «Итоги месяца»: презентация .pptx (собирается на устройстве библиотекой PptxGenJS, лежит в js/lib). */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const isn = (v) => typeof v === "number" && isFinite(v);
  const fmt = (v, d = 1, s = false) => KPI.analysis.fmt(v, d, s);
  const rubS = (v, s) => KPI.monthAn.rubS(v, s);
  const C = { navy: "1F3864", ink: "1F2937", muted: "6B7280", line: "E5E7EB", card: "F3F6FA", tint: "DCE6F2", good: "1E8E3E", bad: "C62828", goodBg: "E3F4E6", badBg: "FBE3E3", white: "FFFFFF", prev: "B8C4D6" };
  const FONT = "Calibri";
  const W = 13.333, H = 7.5, M = 0.55;

  // ---------------------------------------------------------------- библиотека
  let libP = null;
  function lib() {
    if (typeof G.PptxGenJS !== "undefined") return Promise.resolve(G.PptxGenJS);
    if (!libP) libP = new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = "js/lib/pptxgen.bundle.js";
      s.onload = () => (G.PptxGenJS ? ok(G.PptxGenJS) : fail(new Error("библиотека презентаций не загрузилась")));
      s.onerror = () => { libP = null; fail(new Error("не найден файл js/lib/pptxgen.bundle.js")); };
      document.head.appendChild(s);
    });
    return libP;
  }

  // ---------------------------------------------------------------- примитивы
  const txt = (sl, text, x, y, w, h, o = {}) => sl.addText(text, Object.assign({ x, y, w, h, fontFace: FONT, fontSize: 14, color: C.ink, margin: 0, valign: "top", isTextBox: true }, o));
  function title(sl, t, sub) {
    txt(sl, t, M, 0.38, W - 2 * M, 0.6, { fontSize: 30, bold: true, color: C.navy, valign: "middle" });
    if (sub) txt(sl, sub, M, 1.0, W - 2 * M, 0.35, { fontSize: 14, color: C.muted, valign: "middle" });
  }
  const card = (pres, sl, x, y, w, h, fill) => sl.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill || C.card }, line: { color: fill || C.card }, rectRadius: 0.08 });
  const colorOf = (v, lowerBetter) => (!isn(v) || Math.abs(v) < 0.05 ? C.muted : (lowerBetter ? v < 0 : v > 0) ? C.good : C.bad);
  const arrow = (v, unit, d = 1) => (!isn(v) ? "—" : Math.abs(v) < Math.pow(10, -d) / 2 ? `0${unit}` : `${v > 0 ? "▲" : "▼"} ${fmt(v, d, true)}${unit}`);
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/[\s,;]+\S*$/, "") + "…" : s);
  function footer(sl, res, n) {
    txt(sl, `Итоги: ${res.monthLabel.toLowerCase()} · ${res.name}`, M, H - 0.42, 8, 0.25, { fontSize: 10, color: C.muted });
    txt(sl, String(n), W - M - 1, H - 0.42, 1, 0.25, { fontSize: 10, color: C.muted, align: "right" });
  }
  // карточка показателя: подпись, значение, до трёх изменений
  function kpiCard(pres, sl, x, y, w, h, label, value, deltas, note) {
    const bad = deltas.some(([, v, , lb]) => isn(v) && (lb ? v > 0.05 : v < -0.05));
    card(pres, sl, x, y, w, h, bad ? C.badBg : C.card);
    txt(sl, label, x + 0.2, y + 0.15, w - 0.4, 0.3, { fontSize: 13, color: C.muted, bold: true });
    txt(sl, value, x + 0.2, y + 0.45, w - 0.4, 0.55, { fontSize: 26, bold: true, color: C.ink, valign: "middle", fit: "shrink" });
    let dy = 1.0;
    if (note) { txt(sl, note, x + 0.2, y + 0.98, w - 0.4, 0.22, { fontSize: 10, color: C.muted }); dy = 1.2; }
    // изменения — строками: подпись слева, значение справа
    const lh = Math.min(0.22, (h - dy - 0.08) / Math.max(1, deltas.length));
    deltas.forEach(([l, v, u, lb], i) => {
      txt(sl, l, x + 0.2, y + dy + i * lh, w - 1.55, lh, { fontSize: 11, color: C.muted, valign: "middle" });
      txt(sl, arrow(v, u), x + w - 1.4, y + dy + i * lh, 1.2, lh, { fontSize: 12, bold: true, color: colorOf(v, lb), align: "right", valign: "middle" });
    });
  }
  // таблица: head — заголовки, rows — массив строк из {t, c(цвет), b(жирный), fill}
  function table(sl, x, y, colW, head, rows, o = {}) {
    const fs = o.fontSize || 11;
    const H_ = head.map((h, i) => ({ text: h, options: { bold: true, color: C.white, fill: { color: C.navy }, align: i ? "right" : "left", fontSize: fs, valign: "middle" } }));
    const R = rows.map((r, ri) => r.map((c, i) => {
      const cell = typeof c === "object" && c !== null ? c : { t: c };
      return { text: cell.t == null ? "—" : String(cell.t), options: { color: cell.c || C.ink, bold: !!cell.b, fill: { color: cell.fill || (ri % 2 ? "F8FAFC" : C.white) }, align: i ? "right" : "left", fontSize: fs, valign: "middle" } };
    }));
    sl.addTable([H_].concat(R), { x, y, colW, fontFace: FONT, border: { type: "solid", pt: 0.5, color: C.line }, rowH: o.rowH || 0.3, margin: [0.03, 0.08, 0.03, 0.08], autoPage: false });
  }
  const dCell = (v, u, d = 1, lb) => ({ t: arrow(v, u, d), c: colorOf(v, lb), b: true });

  // ---------------------------------------------------------------- слайды
  function sTitle(pres, res) {
    const sl = pres.addSlide(); sl.background = { color: C.navy };
    const MG = KPI.month.MONTHS_GEN[res.Mo];
    txt(sl, `Итоги ${MG} ${res.Y}`, M, 1.2, W - 2 * M, 0.9, { fontSize: 44, bold: true, color: C.white });
    txt(sl, res.name, M, 2.15, W - 2 * M, 0.6, { fontSize: 28, color: "CADCFC" });
    txt(sl, res.sub || "", M, 2.75, W - 2 * M, 0.4, { fontSize: 16, color: "CADCFC" });
    const r = (k) => (res.kpi || []).find((x) => x.k === k) || {};
    const stats = [];
    if (res.P && res.P.cur) stats.push([rubS(res.P.cur.rev), "оборот за месяц"]);
    if (isn(r("rev").dPy)) stats.push([`${fmt(r("rev").dPy, 1, true)}%`, "оборот к прошлому году"]);
    if (res.gross && res.gross.month) stats.push([`${fmt(res.gross.month.pct, 1)}%`, `гросс-маржа (${rubS(res.gross.month.gm)})`]);
    else if (res.P && res.P.cur && isn(res.P.cur.conv)) stats.push([`${fmt(res.P.cur.conv, 1)}%`, "конверсия"]);
    stats.slice(0, 3).forEach(([v, l], i) => {
      const x = M + i * 4.1;
      txt(sl, v, x, 4.3, 3.9, 0.9, { fontSize: 44, bold: true, color: C.white });
      txt(sl, l, x, 5.2, 3.9, 0.4, { fontSize: 14, color: "CADCFC" });
    });
    const d = new Date();
    txt(sl, `Сформировано ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`, M, H - 0.6, 6, 0.3, { fontSize: 11, color: "9FB0CF" });
  }
  function sKpi(pres, res, n) {
    if (!res.kpi) return n;
    const sl = pres.addSlide(); sl.background = { color: C.white };
    const region = res.level !== "store";
    title(sl, "Ключевые показатели", `${res.monthLabel}: к прошлому месяцу, к прошлому году${region ? ", LfL" : " и с начала года"}`);
    const r = (k) => res.kpi.find((x) => x.k === k);
    const val = (x) => (!x ? "—" : x.type === "sum" ? (x.k === "traffic" || x.k === "checks" ? fmt(x.cur, 0) : rubS(x.cur)) : x.type === "avg" ? (x.k === "upt" ? fmt(x.cur, 2) : `${fmt(x.cur, 0)} ₽`) : x.type === "pct" ? `${fmt(x.cur, 1)}%` : "");
    const u = (x) => (x.type === "pct" || x.type === "eff" ? " п.п." : "%");
    const cards = [];
    for (const k of ["rev", "traffic", "conv", "eff", "avg", "price", "upt", "planPct"]) {
      const x = r(k); if (!x) continue;
      const third = region ? ["LfL", x.dLfl, u(x)] : ["с начала года", x.dYtd, u(x)];
      if (k === "eff") cards.push([x.label, isn(x.dPy) ? `${fmt(x.dPy, 1, true)} п.п.` : "—", [["к прошлому месяцу", x.dPrev, u(x)], third], "рост оборота минус рост трафика, к году"]);
      else cards.push([x.label, val(x), [["к прошл. месяцу", x.dPrev, u(x)], ["к прошл. году", x.dPy, u(x)], third]]);
    }
    if (res.gross && res.gross.month) cards.push(["Гросс-маржа", `${fmt(res.gross.month.pct, 1)}%`, [["к прошл. месяцу", res.gross.dPrevPct, " п.п."], ["гросс, ₽", res.gross.dPrevGm, "%"]], rubS(res.gross.month.gm)]);
    const a = r("accSh"), s = r("srvSh");
    if (a) cards.push(["Доля аксессуаров", val(a), [["к прошл. месяцу", a.dPrev, " п.п."], ["к прошл. году", a.dPy, " п.п."]]]);
    if (s) cards.push(["Доля услуг", val(s), [["к прошл. месяцу", s.dPrev, " п.п."], ["к прошл. году", s.dPy, " п.п."]]]);
    if (res.types && isn(res.types.chdu)) cards.push(["ЧДУ", `${fmt(res.types.chdu, 1)}%`, [], `без Е-ком и B2B · норма ${fmt(res.norms.chdu_min, 0)}%`]);
    const list = cards.slice(0, 12), cols = 4, rowsN = Math.ceil(list.length / cols);
    const cw = (W - 2 * M - (cols - 1) * 0.25) / cols, ch = Math.min(1.75, (H - 1.6 - 0.6 - (rowsN - 1) * 0.2) / rowsN);
    list.forEach((c, i) => kpiCard(pres, sl, M + (i % cols) * (cw + 0.25), 1.55 + Math.floor(i / cols) * (ch + 0.2), cw, ch, c[0], c[1], c[2], c[3]));
    footer(sl, res, ++n); return n;
  }
  function sDrivers(pres, res, n) {
    if (!res.decPy && !res.series) return n;
    const sl = pres.addSlide(); sl.background = { color: C.white };
    title(sl, "За счёт чего изменился оборот", "Вклад факторов в изменение к прошлому году, млн ₽; справа — оборот по месяцам");
    if (res.decPy) {
      const d = res.decPy, L = ["Трафик", "Конверсия", "Средняя цена", "Штуки в чеке", "Итого"], V = [d.traffic, d.conv, d.price, d.upt, d.dR].map((v) => v / 1e6);
      sl.addChart(pres.charts.BAR, [{ name: "Рост", labels: L, values: V.map((v) => (v > 0 ? +v.toFixed(2) : 0)) }, { name: "Падение", labels: L, values: V.map((v) => (v < 0 ? +v.toFixed(2) : 0)) }], {
        x: M, y: 1.5, w: 6.0, h: 4.4, barDir: "bar", barGrouping: "stacked", catAxisLabelPos: "low", chartColors: [C.good, C.bad], showLegend: false, catAxisOrientation: "maxMin",
        showValue: true, dataLabelPosition: "ctr", dataLabelFormatCode: '#,##0.0;-#,##0.0;""', dataLabelColor: C.white, dataLabelFontSize: 11, dataLabelFontFace: FONT,
        catAxisLabelFontFace: FONT, catAxisLabelFontSize: 12, catAxisLabelColor: C.ink, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 10, valAxisLabelColor: C.muted,
        valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: "none" }, valAxisLabelFormatCode: "#,##0.0" });
      const parts = [["трафик", d.traffic], ["конверсия", d.conv], ["средняя цена", d.price], ["штуки в чеке", d.upt]].sort((a, b) => a[1] - b[1]);
      const worst = parts[0], best = parts[parts.length - 1];
      const lines = [`Оборот к прошлому году: ${rubS(d.dR, true)}`];
      if (worst[1] < 0) lines.push(`Сильнее всего тянет вниз ${worst[0]}: ${rubS(worst[1], true)}`);
      if (best[1] > 0) lines.push(`Больше всего помогает ${best[0]}: ${rubS(best[1], true)}`);
      txt(sl, lines.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < lines.length - 1, bold: i === 0 } })), M, 6.0, 6.0, 0.9, { fontSize: 13, paraSpaceAfter: 2 });
    }
    if (res.series) {
      const MS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
      const [a, b] = res.series;
      const x0 = res.decPy ? 6.9 : M, w0 = res.decPy ? W - M - 6.9 : W - 2 * M;
      sl.addChart(pres.charts.BAR, [{ name: String(a.year), labels: MS, values: a.rev.map((v) => (isn(v) ? +(v / 1e6).toFixed(2) : 0)) }, { name: String(b.year), labels: MS, values: b.rev.map((v) => (isn(v) ? +(v / 1e6).toFixed(2) : 0)) }], {
        x: x0, y: 1.5, w: w0, h: 4.4, barDir: "col", barGapWidthPct: 60, chartColors: [C.prev, C.navy], showLegend: true, legendPos: "b", legendFontFace: FONT, legendFontSize: 11,
        catAxisLabelFontFace: FONT, catAxisLabelFontSize: 10, catAxisLabelColor: C.muted, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 10, valAxisLabelColor: C.muted,
        valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: "none" }, valAxisLabelFormatCode: "#,##0", showTitle: true, title: "Оборот по месяцам, млн ₽", titleFontFace: FONT, titleFontSize: 13, titleColor: C.ink });
      const P = res.P;
      if (P && P.ytd && P.ytdPy) txt(sl, [{ text: `С начала года: ${rubS(P.ytd.rev)} `, options: { bold: true } }, { text: arrow((P.ytd.rev / P.ytdPy.rev - 1) * 100, "%"), options: { bold: true, color: colorOf(P.ytd.rev / P.ytdPy.rev - 1) } }, { text: " к прошлому году", options: { color: C.muted } }], x0, 6.05, w0, 0.4, { fontSize: 13 });
    }
    footer(sl, res, ++n); return n;
  }
  function sGross(pres, res, n) {
    const g = res.gross; if (!g) return n;
    const sl = pres.addSlide(); sl.background = { color: C.white };
    title(sl, "Гросс-маржа", "В рублях и доля в обороте");
    const P = [["month", res.monthLabel], ["prev", "Прошлый месяц"], ["ytd", "С начала года"]].filter(([k]) => g[k]);
    P.forEach(([k, l], i) => {
      const x = M + i * 4.15;
      card(pres, sl, x, 1.55, 3.95, 1.75, i === 0 ? C.tint : C.card);
      txt(sl, l, x + 0.25, 1.7, 3.5, 0.3, { fontSize: 13, bold: true, color: C.muted });
      txt(sl, `${fmt(g[k].pct, 1)}%`, x + 0.25, 2.0, 3.5, 0.6, { fontSize: 32, bold: true, color: C.navy });
      txt(sl, `${rubS(g[k].gm)} гросс · оборот ${rubS(g[k].rev)}`, x + 0.25, 2.7, 3.5, 0.4, { fontSize: 12, color: C.ink });
    });
    let y = 3.6;
    if (g.prev && g.month) {
      txt(sl, [{ text: "К прошлому месяцу: ", options: { bold: true } }, { text: `маржинальность ${arrow(g.dPrevPct, " п.п.")}`, options: { bold: true, color: colorOf(g.dPrevPct) } }, { text: ", гросс в рублях " }, { text: arrow(g.dPrevGm, "%"), options: { bold: true, color: colorOf(g.dPrevGm) } },
        { text: isn(g.benchPct) && res.bench ? ` · среднее по ${res.bench.name}: ${fmt(g.benchPct, 1)}%` : "", options: { color: C.muted } }], M, y, W - 2 * M, 0.35, { fontSize: 14 });
      y += 0.55;
    }
    if (res.ggroups) {
      const half = (W - 2 * M - 0.4) / 2;
      txt(sl, "Больше всего гросса", M, y, half, 0.3, { fontSize: 14, bold: true, color: C.navy });
      table(sl, M, y + 0.35, [half - 2.6, 1.3, 1.3], ["Группа товаров", "Гросс", "Маржа"], res.ggroups.top.slice(0, 6).map((x) => [short(x.name, 38), rubS(x.gm), isn(x.pct) ? `${fmt(x.pct, 1)}%` : "—"]), { fontSize: 11 });
      txt(sl, "Отрицательная маржа", M + half + 0.4, y, half, 0.3, { fontSize: 14, bold: true, color: C.bad });
      if (res.ggroups.neg.length) table(sl, M + half + 0.4, y + 0.35, [half - 2.6, 1.3, 1.3], ["Группа товаров", "Гросс", "Оборот"], res.ggroups.neg.slice(0, 6).map((x) => [short(x.name, 38), { t: rubS(x.gm), c: C.bad, b: true }, rubS(x.rev)]), { fontSize: 11 });
      else txt(sl, "Групп с отрицательной маржой нет.", M + half + 0.4, y + 0.4, half, 0.3, { fontSize: 13, color: C.muted });
    }
    footer(sl, res, ++n); return n;
  }
  function sCats(pres, res, n) {
    const c = res.cats; if (!c) return n;
    for (const [arr, t] of [[c.top, "Топ-15 подкатегорий: рост"], [c.anti, "Антитоп-15 подкатегорий: падение"]]) {
      if (!arr.length) continue;
      const sl = pres.addSlide(); sl.background = { color: C.white };
      title(sl, t, `${res.monthLabel} к прошлому месяцу: оборот, штуки, средняя цена и средний чек`);
      const mx = Math.max(...arr.map((x) => Math.abs(x.d)), 1);
      const rows = arr.slice(0, 15).map((x) => [short(x.name, 36), rubS(x.rev), { t: rubS(x.d, true), c: x.d >= 0 ? C.good : C.bad, b: true, fill: Math.abs(x.d) > mx * 0.5 ? (x.d >= 0 ? C.goodBg : C.badBg) : undefined },
        dCell(x.dPct, "%", 0), fmt(x.qty, 0), dCell(x.dQty, "%", 0), isn(x.price) ? `${fmt(x.price, 0)} ₽` : "—", dCell(x.dPrice, "%", 0), isn(x.chk) ? `${fmt(x.chk, 0)} ₽` : "—", dCell(x.dChk, "%", 0)]);
      table(sl, M, 1.5, [3.3, 1.25, 1.25, 0.85, 0.75, 0.85, 1.15, 0.85, 1.15, 0.83], ["Подкатегория", "Оборот", "Изменение", "%", "Штук", "Δ шт", "Ср. цена", "Δ цены", "Ср. чек", "Δ чека"], rows, { fontSize: 11, rowH: 0.3 });
      footer(sl, res, ++n);
    }
    return n;
  }
  function sAcc(pres, res, n) {
    const a = res.acc; if (!a) return n;
    const sl = pres.addSlide(); sl.background = { color: C.white };
    const t = a.t, b = res.accBench && res.accBench.t;
    title(sl, "Аксессуары", `${res.monthLabel} к тому же месяцу прошлого года`);
    const cards = [["Оборот аксессуаров", rubS(t.acc), [["к прошл. году", t.yoy, "%"]]], ["Доля аксессуаров", `${fmt(t.sh, 1)}%`, [["к прошл. году", t.dSh, " п.п."]].concat(b && isn(b.sh) ? [[`к ${res.bench.name}`, t.sh - b.sh, " п.п."]] : [])],
      ["Аттач (розница)", isn(t.att) ? `${fmt(t.att, 1)}%` : "—", [["к прошл. году", t.dAtt, " п.п."]]], ["План аксессуаров", isn(t.plan) ? `${fmt(t.plan, 1)}%` : "—", [["до 100%", isn(t.plan) ? t.plan - 100 : null, " п.п."]]]];
    const cw = (W - 2 * M - 0.75) / 4;
    cards.forEach((c, i) => kpiCard(pres, sl, M + i * (cw + 0.25), 1.5, cw, 1.65, c[0], c[1], c[2]));
    txt(sl, "По категориям: что растёт и что падает", M, 3.4, W - 2 * M, 0.3, { fontSize: 14, bold: true, color: C.navy });
    const hasAtt = a.eco.some((e) => isn(e.att));
    table(sl, M, 3.75, hasAtt ? [3.6, 1.7, 1.7, 1.1, 1.3, 1.3, 1.53] : [4.0, 1.9, 1.9, 1.3, 1.55, 1.58], ["Категория", "Оборот АКС", "Изменение, ₽", "%", "Доля АКС", "Δ доли"].concat(hasAtt ? ["Аттач"] : []),
      a.eco.filter((e) => e.acc || e.accPY).slice(0, 8).map((e) => [e.name, rubS(e.acc), { t: rubS(e.d, true), c: e.d >= 0 ? C.good : C.bad, b: true }, dCell(e.yoy, "%", 0), isn(e.sh) ? `${fmt(e.sh, 1)}%` : "—", dCell(e.dSh, " п.п.")].concat(hasAtt ? [isn(e.att) ? `${fmt(e.att, 1)}%` : "—"] : [])), { fontSize: 11 });
    footer(sl, res, ++n); return n;
  }
  function sSrv(pres, res, n) {
    const s = res.srv, T = res.types; if (!s && !T) return n;
    const sl = pres.addSlide(); sl.background = { color: C.white };
    title(sl, "Сервисы", "За счёт каких категорий растут или падают услуги (к прошлому году)");
    const cw = (W - 2 * M - 0.75) / 4;
    if (s) {
      const t = s.t, b = res.srvBench && res.srvBench.t;
      const cards = [["Оборот услуг", rubS(t.srv), [["к прошл. году", t.yoy, "%"]]], ["Доля услуг", `${fmt(t.sh, 1)}%`, [["к прошл. году", t.dSh, " п.п."]].concat(b && isn(b.sh) ? [[`к ${res.bench.name}`, t.sh - b.sh, " п.п."]] : [])],
        ["План услуг", isn(t.plan) ? `${fmt(t.plan, 1)}%` : "—", [["до 100%", isn(t.plan) ? t.plan - 100 : null, " п.п."]]], ["ЧДУ", T && isn(T.chdu) ? `${fmt(T.chdu, 1)}%` : "—", T && isn(T.chdu) ? [["к норме " + fmt(res.norms.chdu_min, 0) + "%", T.chdu - res.norms.chdu_min, " п.п."]] : []]];
      cards.forEach((c, i) => kpiCard(pres, sl, M + i * (cw + 0.25), 1.5, cw, 1.65, c[0], c[1], c[2]));
      const L = s.eco.filter((e) => e.srv || e.srvPY).sort((a, b) => a.d - b.d).slice(0, 8);
      table(sl, M, 3.5, [3.6, 1.7, 1.7, 1.1, 1.3, 1.3, 1.53], ["Категория", "Оборот услуг", "Изменение, ₽", "%", "Доля", "Δ доли", "План"],
        L.map((e) => [e.name, rubS(e.srv), { t: rubS(e.d, true), c: e.d >= 0 ? C.good : C.bad, b: true }, dCell(e.yoy, "%", 0), isn(e.sh) ? `${fmt(e.sh, 1)}%` : "—", dCell(e.dSh, " п.п."), { t: isn(e.plan) ? `${fmt(e.plan, 0)}%` : "—", c: isn(e.plan) && e.plan < 100 ? C.bad : C.ink }]), { fontSize: 11 });
    }
    footer(sl, res, ++n);
    if (T) {
      const list = T.types.filter((t) => t.rub || t.qty || t.benchPen);
      if (list.length) {
        const s2 = pres.addSlide(); s2.background = { color: C.white };
        title(s2, "Виды услуг", `Проникновение — услуг на 100 штук основного товара${res.bench ? `; сравнение со средним по ${res.bench.name}` : ""}`);
        const head = ["Вид услуги", "Оборот", "Штук", "Доля в услугах", "Ср. цена", "Проникновение"].concat(res.bench ? ["Среднее по региону", "Потенциал"] : []);
        const colW = res.bench ? [3.3, 1.35, 0.9, 1.35, 1.25, 1.4, 1.4, 1.28] : [4.2, 1.7, 1.2, 1.7, 1.6, 1.83];
        table(s2, M, 1.5, colW, head, list.map((t) => [t.name, rubS(t.rub), fmt(t.qty, 0), isn(t.sh) ? `${fmt(t.sh, 1)}%` : "—", isn(t.price) ? `${fmt(t.price, 0)} ₽` : "—",
          { t: isn(t.pen) ? `${fmt(t.pen, 1)}%` : "—", c: isn(t.benchPen) && isn(t.pen) && t.pen < t.benchPen ? C.bad : C.ink, b: true }].concat(res.bench ? [isn(t.benchPen) ? `${fmt(t.benchPen, 1)}%` : "—", { t: t.potential > 0 ? "+" + rubS(t.potential) : "—", c: t.potential > 0 ? C.good : C.muted, b: t.potential > 0 }] : [])), { fontSize: 12, rowH: 0.36 });
        const pot = list.filter((t) => t.potential > 0).reduce((a, t) => a + t.potential, 0);
        const yy = 1.5 + 0.36 * (list.length + 1) + 0.35;
        if (pot > 0) txt(s2, [{ text: "Выход на средний уровень региона по всем видам услуг: ", options: { color: C.ink } }, { text: `+${rubS(pot)} в месяц`, options: { bold: true, color: C.good } }], M, yy, W - 2 * M, 0.4, { fontSize: 15 });
        if (T.ext.some((e) => e.rub)) { const tot = T.ext.reduce((a, e) => a + e.rub, 0); txt(s2, `Расширенная гарантия по срокам: ${T.ext.map((e) => `${e.name} ${tot ? fmt((e.rub / tot) * 100, 0) : 0}%`).join(" · ")}`, M, yy + 0.45, W - 2 * M, 0.35, { fontSize: 13, color: C.muted }); }
        footer(s2, res, ++n);
      }
    }
    return n;
  }
  function sStores(pres, res, n) {
    const S = res.stores; if (!S || S.length < 2) return n;
    const per = 14, pages = Math.min(4, Math.ceil(S.length / per));
    const avg = (k) => { const a = S.map((s) => s[k]).filter(isn); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
    const gmA = avg("gmPct");
    for (let p = 0; p < pages; p++) {
      const sl = pres.addSlide(); sl.background = { color: C.white };
      title(sl, pages > 1 ? `Магазины (${p + 1} из ${pages})` : "Магазины", `${res.monthLabel}: по обороту; зелёный — лучше, красный — хуже`);
      const sh = (v, good) => (isn(v) ? (good ? C.goodBg : C.badBg) : undefined);
      const rows = S.slice(p * per, (p + 1) * per).map((s, i) => [`${p * per + i + 1}. ${s.code}${s.city ? " · " + short(s.city, 14) : ""}${s.part ? " *" : ""}`, rubS(s.rev),
        { t: isn(s.dPy) ? `${fmt(s.dPy, 1, true)}%` : "—", fill: sh(s.dPy, s.dPy >= 0), b: true }, { t: isn(s.dPrev) ? `${fmt(s.dPrev, 1, true)}%` : "—", fill: sh(s.dPrev, s.dPrev >= 0) },
        isn(s.conv) ? `${fmt(s.conv, 1)}%` : "—", { t: isn(s.dConv) ? fmt(s.dConv, 1, true) : "—", fill: sh(s.dConv, s.dConv >= 0) }, { t: isn(s.eff) ? fmt(s.eff, 1, true) : "—", fill: sh(s.eff, s.eff >= 0) },
        { t: isn(s.plan) ? `${fmt(s.plan, 0)}%` : "—", fill: sh(s.plan, s.plan >= 100) }, { t: isn(s.gmPct) ? `${fmt(s.gmPct, 1)}%` : "—", fill: isn(s.gmPct) && isn(gmA) ? sh(s.gmPct, s.gmPct >= gmA) : undefined },
        isn(s.accSh) ? `${fmt(s.accSh, 1)}%` : "—", { t: isn(s.srvSh) ? `${fmt(s.srvSh, 1)}%` : "—", fill: sh(s.srvSh, s.srvSh >= res.norms.srv_share_min) }]);
      table(sl, M, 1.5, [2.9, 1.25, 1.05, 1.05, 0.95, 0.85, 0.95, 0.8, 0.85, 0.8, 0.83], ["Магазин", "Оборот", "к году", "к пр. мес.", "Конверсия", "Δ конв.", "Эффект.", "План", "Гросс", "АКС", "Услуги"], rows, { fontSize: 11, rowH: 0.3 });
      if (S.some((s) => s.part)) txt(sl, "* неполный месяц или новый магазин — сравнение условное", M, H - 0.75, 8, 0.25, { fontSize: 10, color: C.muted });
      footer(sl, res, ++n);
    }
    return n;
  }
  function sFindings(pres, res, n) {
    const sl = pres.addSlide(); sl.background = { color: C.white };
    title(sl, "Где хорошо и где плохо", "Главное по итогам месяца");
    const half = (W - 2 * M - 0.4) / 2;
    const col = (arr, x, head, color, fill) => {
      card(pres, sl, x, 1.5, half, 5.35, fill);
      txt(sl, head, x + 0.25, 1.65, half - 0.5, 0.35, { fontSize: 18, bold: true, color });
      const items = arr.slice(0, 6);
      if (!items.length) { txt(sl, "—", x + 0.25, 2.1, half - 0.5, 0.3, { fontSize: 13, color: C.muted }); return; }
      txt(sl, items.map((it, i) => [{ text: it.area + ". ", options: { bold: true, bullet: true } }, { text: short(it.text, 210), options: { breakLine: i < items.length - 1 } }]).flat(), x + 0.25, 2.1, half - 0.5, 4.6, { fontSize: 12, paraSpaceAfter: 6, color: C.ink, fit: "shrink" });
    };
    col(res.bad, M, "Где плохо", C.bad, "FDF2F2");
    col(res.good, M + half + 0.4, "Где хорошо", C.good, "EEF8F0");
    footer(sl, res, ++n); return n;
  }
  function sActions(pres, res, n) {
    const sl = pres.addSlide(); sl.background = { color: C.navy };
    txt(sl, "План действий", M, 0.38, W - 2 * M, 0.6, { fontSize: 30, bold: true, color: C.white, valign: "middle" });
    txt(sl, "Что делаем в следующем месяце", M, 1.0, W - 2 * M, 0.35, { fontSize: 14, color: "CADCFC" });
    const A = res.actions.slice(0, 7), rh = Math.min(0.78, 5.6 / Math.max(1, A.length));
    A.forEach((a, i) => {
      const y = 1.55 + i * rh;
      sl.addShape(pres.shapes.OVAL, { x: M, y: y + 0.05, w: 0.42, h: 0.42, fill: { color: a.prio === "Высокий" ? "E57373" : a.prio === "Средний" ? "F2C14E" : "9FB0CF" }, line: { color: C.navy } });
      txt(sl, String(i + 1), M, y + 0.05, 0.42, 0.42, { fontSize: 14, bold: true, color: C.navy, align: "center", valign: "middle" });
      txt(sl, [{ text: `${a.area}: `, options: { bold: true, color: C.white } }, { text: short(a.what, 170), options: { color: C.white, breakLine: true } }, { text: short(a.why, 110), options: { color: "9FB0CF", fontSize: 11 } }],
        M + 0.6, y, W - 2 * M - 0.6, rh - 0.05, { fontSize: 13, fit: "shrink" });
    });
  }

  async function build(res) {
    const P = await lib();
    const pres = new P();
    pres.layout = "LAYOUT_WIDE";
    pres.title = `Итоги: ${res.monthLabel} — ${res.name}`;
    pres.author = "Анализ KPI";
    sTitle(pres, res);
    let n = 1;
    n = sKpi(pres, res, n); n = sDrivers(pres, res, n); n = sGross(pres, res, n); n = sCats(pres, res, n);
    n = sAcc(pres, res, n); n = sSrv(pres, res, n); n = sStores(pres, res, n); n = sFindings(pres, res, n);
    sActions(pres, res, n);
    const browser = typeof window !== "undefined" && typeof document !== "undefined";
    return pres.write({ outputType: browser ? "blob" : "nodebuffer", compression: true });
  }

  KPI.monthPpt = { build };
})(typeof globalThis !== "undefined" ? globalThis : this);
