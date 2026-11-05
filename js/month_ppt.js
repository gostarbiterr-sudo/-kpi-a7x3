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
    const H_ = head.map((h, i) => ({ text: h, options: { bold: true, color: C.white, fill: { color: C.navy }, align: o.align ? o.align[i] : i ? "right" : "left", fontSize: fs, valign: "middle" } }));
    const R = rows.map((r, ri) => r.map((c, i) => {
      const cell = typeof c === "object" && c !== null ? c : { t: c };
      return { text: cell.t == null ? "—" : String(cell.t), options: { color: cell.c || C.ink, bold: !!cell.b, fill: { color: cell.fill || (ri % 2 ? "F8FAFC" : C.white) }, align: o.align ? o.align[i] : i ? "right" : "left", fontSize: fs, valign: "middle" } };
    }));
    sl.addTable([H_].concat(R), { x, y, colW, fontFace: FONT, border: { type: "solid", pt: 0.5, color: C.line }, rowH: o.rowH || 0.3, margin: [0.03, 0.08, 0.03, 0.08], autoPage: false });
  }
  const dCell = (v, u, d = 1, lb) => ({ t: arrow(v, u, d), c: colorOf(v, lb), b: true });

  // ---------------------------------------------------------------- слайды
  function sTitle(pres, res) {
    const sl = pres.addSlide(); sl.background = { color: C.white };
    const MG = KPI.month.MONTHS_GEN[res.Mo];
    txt(sl, `Итоги ${MG} ${res.Y}`, M, 1.0, W - 2 * M, 0.9, { fontSize: 44, bold: true, color: C.navy });
    txt(sl, res.name, M, 1.95, W - 2 * M, 0.6, { fontSize: 28, color: C.ink });
    txt(sl, res.sub || "", M, 2.55, W - 2 * M, 0.4, { fontSize: 16, color: C.muted });
    const r = (k) => (res.kpi || []).find((x) => x.k === k);
    const val = (x) => (x.k === "rev" ? rubS(x.cur) : x.k === "traffic" ? fmt(x.cur, 0) : x.k === "upt" ? fmt(x.cur, 2) : `${fmt(x.cur, 0)} ₽`);
    const stats = [["rev", "Оборот"], ["traffic", "Трафик"], ["price", "Средняя цена"], ["avg", "Средний чек"], ["upt", "Штук в чеке"]].map(([k, l]) => [r(k), l]).filter((x) => x[0] && isn(x[0].cur));
    const gap = 0.25, cw = (W - 2 * M - gap * (stats.length - 1)) / Math.max(1, stats.length);
    stats.forEach(([x, l], i) => {
      const xx = M + i * (cw + gap), y = 3.75;
      card(pres, sl, xx, y, cw, 2.2, C.card);
      txt(sl, l, xx + 0.25, y + 0.2, cw - 0.5, 0.35, { fontSize: 14, bold: true, color: C.muted });
      txt(sl, val(x), xx + 0.25, y + 0.6, cw - 0.5, 0.7, { fontSize: 30, bold: true, color: C.navy, valign: "middle", fit: "shrink" });
      txt(sl, [{ text: arrow(x.dPy, "%"), options: { bold: true, color: colorOf(x.dPy) } }, { text: "  к году", options: { color: C.muted } }], xx + 0.25, y + 1.4, cw - 0.4, 0.3, { fontSize: 11 });
      txt(sl, [{ text: arrow(x.dPrev, "%"), options: { bold: true, color: colorOf(x.dPrev) } }, { text: "  к прошл. мес.", options: { color: C.muted } }], xx + 0.25, y + 1.72, cw - 0.4, 0.3, { fontSize: 11 });
    });
    const d = new Date();
    txt(sl, `Сформировано ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`, M, H - 0.6, 6, 0.3, { fontSize: 11, color: C.muted });
  }
  function sKpi(pres, res, n) {
    if (!res.kpi) return n;
    const sl = pres.addSlide(); sl.background = { color: C.white };
    const RG = res.level === "store" ? KPI.monthAn.regionOf(res) : null;
    if (RG) {   // магазин рядом с регионом: одна таблица показателей и факторов
      title(sl, "Ключевые показатели и из чего сложился оборот", `${res.monthLabel}: магазин и ${RG.code.replace("Регион", "регион")} — к прошлому году и к прошлому месяцу`);
      mTable(sl, KPI.monthAn.multiRows("main").concat([["Вывод", (r) => ({ note: facConclusion(r) })]]), [res, RG], 1.38, H - 1.38 - 0.5, false, true);
      footer(sl, res, ++n); return n;
    }
    const region = res.level !== "store";
    title(sl, "Ключевые показатели", `${res.monthLabel}: к прошлому месяцу, к прошлому году${region ? ", LfL" : " и с начала года"}`);
    const r = (k) => res.kpi.find((x) => x.k === k);
    const val = (x) => (!x ? "—" : x.type === "sum" ? (x.k === "traffic" || x.k === "checks" ? fmt(x.cur, 0) : rubS(x.cur)) : x.type === "avg" ? (x.k === "upt" ? fmt(x.cur, 2) : `${fmt(x.cur, 0)} ₽`) : x.type === "pct" ? `${fmt(x.cur, 1)}%` : "");
    const u = (x) => (x.type === "pct" || x.type === "eff" ? " п.п." : "%");
    const cards = [];
    for (const k of ["rev", "traffic", "conv", "eff", "avg", "price", "upt"]) {
      const x = r(k); if (!x) continue;
      const third = region ? ["LfL", x.dLfl, u(x)] : ["с начала года", x.dYtd, u(x)];
      if (k === "eff") cards.push([x.label, isn(x.dPy) ? `${fmt(x.dPy, 1, true)}%` : "—", [["к прошлому месяцу", x.dPrev, u(x)], third], "рост оборота минус рост трафика, к году"]);
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
    const RG = res.level === "store" ? KPI.monthAn.regionOf(res) : null;
    if (RG && !res.series) return n;
    if (!res.factors && !res.series) return n;
    const sl = pres.addSlide(); sl.background = { color: C.white };
    title(sl, RG ? "Оборот по месяцам" : "Из чего сложился оборот", RG ? "Этот год против прошлого, млн ₽" : "Трафик, конверсия, чек, цена и штуки в чеке: этот год против прошлого; справа — оборот по месяцам");
    const lw = RG ? 0 : res.series ? 6.3 : W - 2 * M;
    if (res.factors && !RG) {
      const MN = KPI.month.MONTHS[res.Mo];
      const rows = res.factors.map((f) => [f.label, `${fmt(f.cur, f.d)}${f.u}`, `${fmt(f.py, f.d)}${f.u}`, dCell(f.dPy, f.t === "pp" ? " п.п." : "%"), dCell(f.dPrev, f.t === "pp" ? " п.п." : "%")]);
      const R = res.P;
      if (R && R.cur && R.py) rows.unshift([{ t: "Оборот", b: true }, { t: rubS(R.cur.rev), b: true }, rubS(R.py.rev), dCell((R.cur.rev / R.py.rev - 1) * 100, "%"), dCell(R.prev ? (R.cur.rev / R.prev.rev - 1) * 100 : null, "%")]);
      table(sl, M, 1.5, [lw - 4.6, 1.3, 1.3, 1.0, 1.0], ["Показатель", `${MN} ${res.Y}`, `${MN} ${res.Y - 1}`, "к году", "к мес."], rows, { fontSize: 12, rowH: 0.42 });
      const F = {}; res.factors.forEach((f) => (F[f.k] = f));
      const up = [], down = [];
      for (const [k, nm] of [["traffic", "трафик"], ["conv", "конверсия"], ["price", "средняя цена"], ["upt", "штуки в чеке"]]) {
        const f = F[k]; if (!f || !isn(f.dPy)) continue;
        (f.dPy >= 0 ? up : down).push(`${nm} ${f.t === "pp" ? `${fmt(f.dPy, 1, true)} п.п.` : `${fmt(f.dPy, 1, true)}%`}`);
      }
      const lines = [];
      if (up.length) lines.push({ text: `Помогли: ${up.join(", ")}`, options: { bullet: true, breakLine: true, color: C.good } });
      if (down.length) lines.push({ text: `Тянули вниз: ${down.join(", ")}`, options: { bullet: true, color: C.bad } });
      if (lines.length) txt(sl, lines, M, 1.5 + 0.42 * (rows.length + 1) + 0.25, lw, 1.0, { fontSize: 13, paraSpaceAfter: 4, bold: true });
    }
    if (res.series) {
      const MS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
      const [a, b] = res.series;
      const x0 = res.factors && !RG ? M + lw + 0.4 : M, w0 = W - M - x0;
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
    title(sl, "Гросс-маржа", "Сколько заработали на продажах: в рублях и доля в обороте");
    const P = [["month", res.monthLabel], ["prev", "Прошлый месяц"], ["ytd", "С начала года"]].filter(([k]) => g[k]);
    P.forEach(([k, l], i) => {
      const x = M + i * 4.15;
      card(pres, sl, x, 1.55, 3.95, 1.75, i === 0 ? C.tint : C.card);
      txt(sl, l, x + 0.25, 1.7, 3.5, 0.3, { fontSize: 13, bold: true, color: C.muted });
      txt(sl, `${fmt(g[k].pct, 1)}%`, x + 0.25, 2.0, 3.5, 0.6, { fontSize: 32, bold: true, color: C.navy });
      txt(sl, `${rubS(g[k].gm)} гросс · оборот ${rubS(g[k].rev)}`, x + 0.25, 2.7, 3.5, 0.4, { fontSize: 12, color: C.ink });
    });
    const lines = [];
    if (g.prev && g.month) lines.push([{ text: "К прошлому месяцу: ", options: { bold: true } }, { text: `маржинальность ${arrow(g.dPrevPct, " п.п.")}`, options: { bold: true, color: colorOf(g.dPrevPct) } }, { text: ", гросс в рублях " }, { text: arrow(g.dPrevGm, "%"), options: { bold: true, color: colorOf(g.dPrevGm) } },
      { text: "", options: { breakLine: true } }]);
    const RGg = res.level === "store" ? KPI.monthAn.regionOf(res) : null;
    if (RGg && RGg.gross && RGg.gross.month) { const q = RGg.gross;
      lines.push([{ text: `${RGg.code}: `, options: { bold: true } }, { text: `${fmt(q.month.pct, 1)}% за месяц` + (q.ytd ? `, ${fmt(q.ytd.pct, 1)}% с начала года` : "") + (isn(q.dPrevGm) ? `, гросс к прошлому месяцу ${fmt(q.dPrevGm, 1, true)}%` : "") + " · у магазина ", options: { color: C.ink } },
        { text: `${g.month.pct >= q.month.pct ? "выше" : "ниже"} на ${fmt(Math.abs(g.month.pct - q.month.pct), 1)} п.п.`, options: { bold: true, color: g.month.pct >= q.month.pct ? C.good : C.bad, breakLine: true } }]); }
    if (isn(g.effRev)) lines.push([{ text: "Почему изменился гросс: ", options: { bold: true } }, { text: `${rubS(g.dGm, true)} всего; из-за оборота `, options: {} }, { text: rubS(g.effRev, true), options: { bold: true, color: colorOf(g.effRev) } },
      { text: ", из-за маржинальности " }, { text: rubS(g.effPct, true), options: { bold: true, color: colorOf(g.effPct), breakLine: true } }]);
    if (res.ggroups) {
      if (res.ggroups.top.length) lines.push([{ text: "Основной гросс дают: ", options: { bold: true } }, { text: res.ggroups.top.slice(0, 3).map((x) => `${x.name} (${rubS(x.gm)}, ${fmt(x.share, 0)}%)`).join(", "), options: { color: C.good, breakLine: true } }]);
      if (res.ggroups.neg.length) lines.push([{ text: "Продажи в минус: ", options: { bold: true } }, { text: `${res.ggroups.neg.length} групп на ${rubS(res.ggroups.negSum)} — ${res.ggroups.neg.slice(0, 3).map((x) => x.name).join(", ")}`, options: { color: C.bad } }]);
    }
    if (lines.length) txt(sl, lines.flat(), M, 3.65, W - 2 * M, 2.8, { fontSize: 15, paraSpaceAfter: 10 });
    footer(sl, res, ++n);
    if (res.ggroups) {
      const s2 = pres.addSlide(); s2.background = { color: C.white };
      const ra = RGg && RGg.ggroups ? RGg.ggroups.all : null;
      title(s2, "Гросс по группам товаров", ra ? "Топ-10 и антитоп-10 групп: гросс, доля в гроссе, маржа магазина (зелёная — выше региона, красная — ниже) и региона" : "Топ-10 и антитоп-10 групп за месяц: гросс в рублях, доля в общем гроссе и маржа");
      const half = (W - 2 * M - 0.4) / 2, nw = half - (ra ? 4.4 : 3.5);
      for (const [i, key, t, col] of [[0, "top", "Топ-10: где зарабатываем больше всего", C.good], [1, "anti", "Антитоп-10: где зарабатываем меньше всего", C.bad]]) {
        const x = M + i * (half + 0.4);
        txt(s2, t, x, 1.45, half, 0.3, { fontSize: 14, bold: true, color: col });
        table(s2, x, 1.85, ra ? [nw, 1.15, 0.9, 1.05, 1.3] : [nw, 1.25, 1.0, 1.25], ["Группа товаров", "Гросс", "Доля", "Маржа"].concat(ra ? ["Маржа рег."] : []), res.ggroups[key].slice(0, 10).map((x2) => [x2.name, { t: rubS(x2.gm), c: x2.gm < 0 ? C.bad : key === "top" ? C.good : C.ink, b: true },
          isn(x2.share) ? `${fmt(x2.share, 1)}%` : "—", { t: isn(x2.pct) ? `${fmt(x2.pct, 1)}%` : "—", c: isn(x2.pct) && x2.pct < 0 ? C.bad : ra && isn(x2.pct) && isn(ra[x2.id]) ? (x2.pct >= ra[x2.id] ? C.good : C.bad) : C.ink, b: !!ra }]
          .concat(ra ? [{ t: isn(ra[x2.id]) ? `${fmt(ra[x2.id], 1)}%` : "—", c: C.muted }] : [])), { fontSize: 10, rowH: 0.42 });
      }
      footer(s2, res, ++n);
    }
    return n;
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
    title(sl, "Аксессуары", `${res.monthLabel}: к прошлому году, к прошлому месяцу и к региону`);
    const rn = res.bench ? `регион ${res.bench.name}` : "";
    const cards = [["Оборот аксессуаров", rubS(t.acc), [["к прошл. году", t.yoy, "%"], ["к прошл. месяцу", t.dPrev, "%"]], b && isn(b.yoy) ? `${rn}: ${fmt(b.yoy, 1, true)}% к году` : ""],
      ["Доля аксессуаров", `${fmt(t.sh, 1)}%`, [["к прошл. году", t.dSh, " п.п."], ["к региону", b && isn(b.sh) ? t.sh - b.sh : null, " п.п."]], b && isn(b.sh) ? `${rn}: ${fmt(b.sh, 1)}%` : ""],
      ["Аттач (розница)", isn(t.att) ? `${fmt(t.att, 1)}%` : "—", [["к прошл. году", t.dAtt, " п.п."], ["к региону", b && isn(b.att) && isn(t.att) ? t.att - b.att : null, " п.п."]], b && isn(b.att) ? `${rn}: ${fmt(b.att, 1)}%` : ""]];
    const cw = (W - 2 * M - 0.5) / 3;
    cards.forEach((c, i) => kpiCard(pres, sl, M + i * (cw + 0.25), 1.5, cw, 1.75, c[0], c[1], c[2], c[3]));
    txt(sl, "По категориям: что растёт и что падает", M, 3.4, W - 2 * M, 0.3, { fontSize: 14, bold: true, color: C.navy });
    const hasAtt = a.eco.some((e) => isn(e.att));
    table(sl, M, 3.75, hasAtt ? [3.6, 1.7, 1.7, 1.1, 1.3, 1.3, 1.53] : [4.0, 1.9, 1.9, 1.3, 1.55, 1.58], ["Категория", "Оборот АКС", "Изменение, ₽", "%", "Доля АКС", "Δ доли"].concat(hasAtt ? ["Аттач"] : []),
      a.eco.filter((e) => e.acc || e.accPY).slice(0, 8).map((e) => [e.name, rubS(e.acc), { t: rubS(e.d, true), c: e.d >= 0 ? C.good : C.bad, b: true }, dCell(e.yoy, "%", 0), isn(e.sh) ? `${fmt(e.sh, 1)}%` : "—", dCell(e.dSh, " п.п.")].concat(hasAtt ? [isn(e.att) ? `${fmt(e.att, 1)}%` : "—"] : [])), { fontSize: 11 });
    footer(sl, res, ++n); return n;
  }
  function sSrv(pres, res, n) {
    const s = res.srv, T = res.types; if (!s && !T) return n;
    const sl = pres.addSlide(); sl.background = { color: C.white };
    title(sl, "Сервисы", "К прошлому году, к прошлому месяцу и к региону; ниже — за счёт каких категорий растут или падают услуги");
    const cw = (W - 2 * M - 0.5) / 3;
    if (s) {
      const t = s.t, b = res.srvBench && res.srvBench.t;
      const rn = res.bench ? `регион ${res.bench.name}` : "", tb = res.typesBench;
      const cards = [["Оборот услуг", rubS(t.srv), [["к прошл. году", t.yoy, "%"], ["к прошл. месяцу", t.dPrev, "%"]], b && isn(b.yoy) ? `${rn}: ${fmt(b.yoy, 1, true)}% к году` : ""],
        ["Доля услуг", `${fmt(t.sh, 1)}%`, [["к прошл. году", t.dSh, " п.п."], ["к региону", b && isn(b.sh) ? t.sh - b.sh : null, " п.п."]], b && isn(b.sh) ? `${rn}: ${fmt(b.sh, 1)}%` : ""],
        ["ЧДУ", T && isn(T.chdu) ? `${fmt(T.chdu, 1)}%` : "—", T && isn(T.chdu) ? [["к норме " + fmt(res.norms.chdu_min, 0) + "%", T.chdu - res.norms.chdu_min, " п.п."], ["к региону", tb && isn(tb.chdu) ? T.chdu - tb.chdu : null, " п.п."]] : [], tb && isn(tb.chdu) ? `${rn}: ${fmt(tb.chdu, 1)}%` : ""]];
      cards.forEach((c, i) => kpiCard(pres, sl, M + i * (cw + 0.25), 1.5, cw, 1.75, c[0], c[1], c[2], c[3]));
      const L = s.eco.filter((e) => e.srv || e.srvPY).sort((a, b) => a.d - b.d).slice(0, 8);
      table(sl, M, 3.5, [4.0, 1.9, 1.9, 1.3, 1.55, 1.58], ["Категория", "Оборот услуг", "Изменение, ₽", "%", "Доля", "Δ доли"],
        L.map((e) => [e.name, rubS(e.srv), { t: rubS(e.d, true), c: e.d >= 0 ? C.good : C.bad, b: true }, dCell(e.yoy, "%", 0), isn(e.sh) ? `${fmt(e.sh, 1)}%` : "—", dCell(e.dSh, " п.п.")]), { fontSize: 11 });
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
        { t: isn(s.gmPct) ? `${fmt(s.gmPct, 1)}%` : "—", fill: isn(s.gmPct) && isn(gmA) ? sh(s.gmPct, s.gmPct >= gmA) : undefined },
        isn(s.accSh) ? `${fmt(s.accSh, 1)}%` : "—", { t: isn(s.srvSh) ? `${fmt(s.srvSh, 1)}%` : "—", fill: sh(s.srvSh, s.srvSh >= res.norms.srv_share_min) }]);
      table(sl, M, 1.5, [3.2, 1.3, 1.1, 1.1, 1.0, 0.9, 1.0, 0.95, 0.85, 0.83], ["Магазин", "Оборот", "к году", "к пр. мес.", "Конверсия", "Δ конв.", "Эффект.", "Гросс", "АКС", "Услуги"], rows, { fontSize: 11, rowH: 0.3 });
      if (S.some((s) => s.part)) txt(sl, "* неполный месяц или новый магазин — сравнение условное", M, H - 0.75, 8, 0.25, { fontSize: 10, color: C.muted });
      footer(sl, res, ++n);
    }
    return n;
  }
  const dedupe = (it) => it.text.toLowerCase().startsWith(it.area.toLowerCase().split(" ")[0]);
  function sFindings(pres, res, n) {
    const sl = pres.addSlide(); sl.background = { color: C.white };
    title(sl, "Где хорошо и где плохо", "Главное по итогам месяца");
    const half = (W - 2 * M - 0.4) / 2;
    const col = (arr, x, head, color, fill) => {
      card(pres, sl, x, 1.5, half, 5.35, fill);
      txt(sl, head, x + 0.25, 1.65, half - 0.5, 0.35, { fontSize: 18, bold: true, color });
      const items = arr.slice(0, 6);
      if (!items.length) { txt(sl, "—", x + 0.25, 2.1, half - 0.5, 0.3, { fontSize: 13, color: C.muted }); return; }
      txt(sl, items.map((it, i) => (dedupe(it) ? [{ text: it.text, options: { bullet: true, breakLine: i < items.length - 1 } }] : [{ text: it.area + ". ", options: { bold: true, bullet: true } }, { text: it.text, options: { breakLine: i < items.length - 1 } }])).flat(), x + 0.25, 2.1, half - 0.5, 4.6, { fontSize: 12, paraSpaceAfter: 6, color: C.ink, fit: "shrink" });
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
      txt(sl, [{ text: `${a.area}: `, options: { bold: true, color: C.white } }, { text: a.what, options: { color: C.white, breakLine: true } }, { text: a.why, options: { color: "9FB0CF", fontSize: 11 } }],
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

  // ---------------------------------------------------------------- несколько магазинов: результаты рядом
  // таблица «показатели × магазины»: в ячейке значение, строка-пояснение и изменения
  function mTable(sl, rows, stores, y, maxH, big, compact) {
    const n = stores.length, lw = 2.3, cw = (W - 2 * M - lw) / n;
    const head = [{ text: "Показатель", options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: 12 } }].concat(stores.map((r) => ({
      text: [{ text: r.code, options: { bold: true, breakLine: true } }, { text: r.attrs ? r.attrs.city : "", options: { fontSize: 10, color: "CADCFC" } }], options: { color: C.white, fill: { color: r.isRegion ? "4A6FA5" : C.navy }, fontSize: 13 } })));
    const body = [];
    rows.forEach(([label, f]) => {
      const cells = stores.map((r) => f(r));
      if (cells.every((c) => !c)) return;
      const fill0 = { color: body.length % 2 ? "F8FAFC" : C.white }, fill = fill0;
      body.push([{ text: label, options: { bold: true, color: C.ink, fontSize: compact ? 11 : 12, fill } }].concat(cells.map((c, ci) => {
        const fill = stores[ci].isRegion ? { color: body.length % 2 ? "E6EDF7" : "EEF3FA" } : fill0;
        if (!c) return { text: "—", options: { color: C.muted, fill } };
        if (c.note) return { text: c.note, options: { fill, fontSize: compact ? (stores.length > 2 ? 8.5 : 9) : 10.5, color: C.ink, valign: "top" } };
        const fs = big ? [22, 13, 13, 12] : compact ? [12.5, 8.5, 9, 8.5] : [15, 10.5, 10.5, 10];
        const D = c.one ? c.d.filter((x) => isn(x[1])) : c.d;
        const t = [{ text: c.v, options: { bold: true, fontSize: fs[0], color: c.sign != null ? (c.sign >= 0 ? C.good : C.bad) : C.ink, breakLine: !!(c.sub || D.length) } }];
        if (c.sub) t.push({ text: c.sub, options: { fontSize: fs[1], color: C.muted, breakLine: D.length > 0 } });
        D.forEach(([l, v, u], i) => {
          if (c.one && i) t.push({ text: "  ·  ", options: { fontSize: fs[3], color: C.muted } });
          t.push({ text: arrow(v, u) + " ", options: { bold: true, fontSize: fs[2], color: colorOf(v) } }); t.push({ text: l, options: { fontSize: fs[3], color: C.muted, breakLine: !c.one && i < D.length - 1 } }); });
        return { text: t, options: { fill } };
      })));
    });
    const rh = Math.min(big ? 1.35 : 0.85, (maxH || H - y - 0.7) / Math.max(1, body.length + 1));
    const fix = big || compact, hh = compact ? 0.45 : 0.6, rh2 = fix ? Math.min(big ? 1.35 : 0.85, ((maxH || H - y - 0.7) - hh) / Math.max(1, body.length)) : rh;
    sl.addTable([head].concat(body), { x: M, y, colW: [lw].concat(stores.map(() => cw)), fontFace: FONT, border: { type: "solid", pt: 0.5, color: C.line }, rowH: fix ? [hh].concat(body.map(() => rh2)) : rh, valign: "middle", margin: compact ? [0.02, 0.1, 0.02, 0.1] : [0.04, 0.1, 0.04, 0.1], autoPage: false });
    return fix ? y + hh + rh2 * body.length : y + rh * (body.length + 1);
  }
  function mCols(pres, sl, stores, y, fn, dark) {
    const n = stores.length, gap = 0.25, cw = (W - 2 * M - gap * (n - 1)) / n;
    stores.forEach((r, i) => {
      const x = M + i * (cw + gap);
      card(pres, sl, x, y, cw, H - y - 0.65, dark ? "2B4A7E" : C.card);
      txt(sl, [{ text: r.code + "  ", options: { bold: true } }, { text: r.attrs ? r.attrs.city : "", options: { color: dark ? "CADCFC" : C.muted, fontSize: 12 } }], x + 0.2, y + 0.15, cw - 0.4, 0.35, { fontSize: 16, color: dark ? C.white : C.navy });
      fn(r, x + 0.2, y + 0.6, cw - 0.4, H - y - 1.35, cw);
    });
  }
  // короткий вывод по факторам оборота — словами, из данных таблицы
  function facConclusion(r, brief) {
    const F = {}; (r.factors || []).forEach((f) => (F[f.k] = f));
    if (!r.P || !r.P.cur || !r.P.py) return "";
    const d = (r.P.cur.rev / r.P.py.rev - 1) * 100;
    if (r.isRegion) return `Регион: оборот ${fmt(d, 1, true)}% к году` + (r.P.prev && r.P.prev.rev ? `, ${fmt((r.P.cur.rev / r.P.prev.rev - 1) * 100, 1, true)}% к прошлому месяцу` : "") + ".";
    const up = [], down = [];
    for (const [k, n] of [["traffic", "трафик"], ["conv", "конверсия"], ["price", "средняя цена"], ["upt", "штуки в чеке"]]) {
      const f = F[k]; if (!f || !isn(f.dPy)) continue;
      const s = `${n} ${f.t === "pp" ? `${fmt(f.dPy, 1, true)} п.п.` : `${fmt(f.dPy, 1, true)}%`}`;
      (f.dPy >= 0 ? up : down).push(s);
    }
    let t = `Оборот ${fmt(d, 1, true)}% к прошлому году.` + (up.length ? ` Помогли: ${up.join(", ")}.` : "") + (down.length ? ` Тянули вниз: ${down.join(", ")}.` : "");
    if (r.P.prev && r.P.prev.rev) {
      const pm = KPI.month.MONTHS_GEN[(r.Mo + 11) % 12].replace(/я$/, "ю").replace(/а$/, "у");
      const ms = [["traffic", "трафик"], ["conv", "конверсия"], ["avg", "средний чек"], ["upt", "штуки в чеке"]].map(([k, n]) => { const f = F[k]; return f && isn(f.dPrev) ? `${n} ${f.t === "pp" ? `${fmt(f.dPrev, 1, true)} п.п.` : `${fmt(f.dPrev, 1, true)}%`}` : null; }).filter(Boolean);
      t += ` К ${pm}: оборот ${fmt((r.P.cur.rev / r.P.prev.rev - 1) * 100, 1, true)}%${ms.length && !brief ? `, ${ms.join(", ")}` : ""}.`;
    }
    return t.replace(/п\.п\.\./g, "п.п.");
  }
  async function buildMulti(R) {
    const P = await lib();
    const pres = new P();
    pres.layout = "LAYOUT_WIDE";
    pres.title = `Итоги: ${R.monthLabel} — ${R.name}`;
    pres.author = "Анализ KPI";
    const MG = KPI.month.MONTHS_GEN[R.Mo], AN = KPI.monthAn;
    // магазины по слайдам: таблицы — до 4, списки групп — до 2 на слайд
    const split = (k) => { const pages = Math.ceil(R.list.length / k), per = Math.ceil(R.list.length / pages), out = []; for (let i = 0; i < R.list.length; i += per) out.push(R.list.slice(i, i + per)); return out; };
    const T2 = split(2);
    // колонка «Регион»: итоги региона (ASM) магазинов страницы
    const regs = (st) => [...new Set(st.map((r) => AN.regionOf(r)).filter(Boolean))];
    const T4 = R.list.some((r) => AN.regionOf(r)) ? split(3) : split(4);
    const wr = (st) => st.concat(regs(st));
    const sfx = (arr, k) => (arr.length > 1 ? ` (${k + 1} из ${arr.length})` : "");
    let n = 0;
    const foot = (sl) => { txt(sl, `Итоги: ${R.monthLabel.toLowerCase()} · ${R.name}`, M, H - 0.42, 8, 0.25, { fontSize: 10, color: C.muted }); txt(sl, String(++n), W - M - 1, H - 0.42, 1, 0.25, { fontSize: 10, color: C.muted, align: "right" }); };
    const page = (t, sub, k, arr) => { const sl = pres.addSlide(); sl.background = { color: C.white }; title(sl, t + sfx(arr, k), sub); return sl; };
    // 1. ключевые показатели и из чего сложился оборот — одна таблица и вывод
    T4.forEach((st, k) => {
      const sl = page(`Ключевые показатели — ${R.monthLabel.toLowerCase()}`, st.map((r) => `${r.code}${r.attrs && r.attrs.city ? " " + r.attrs.city : ""}`).join(", ") + ". К прошлому году и к прошлому месяцу; эффективность — рост оборота минус рост трафика", k, T4);
      mTable(sl, AN.multiRows("main").concat([["Вывод", (r) => ({ note: facConclusion(r, wr(st).length > 2) })]]), wr(st), 1.38, H - 1.38 - 0.5, false, true);
      foot(sl);
    });
    // 4. гросс-маржа и её влияние
    if (R.list.some((r) => r.gross)) T4.forEach((st, k) => {
      const sl = page("Гросс-маржа", "Сколько заработали на продажах: месяц, прошлый месяц, с начала года", k, T4);
      mTable(sl, AN.multiRows("gross"), wr(st), 1.5, null, true);
      foot(sl);
    });
    // 5–6. гросс по группам товаров: топ-10 и антитоп-10
    if (R.list.some((r) => r.ggroups)) for (const [key, t, sub] of [["top", "Гросс: топ-10 групп товаров", "Гросс в рублях, доля в гроссе магазина, маржа магазина и региона: зелёная — выше региона, красная — ниже"],
      ["anti", "Гросс: антитоп-10 групп товаров", "Где зарабатываем меньше всего или продаём в минус; маржа зелёная — выше региона, красная — ниже"]]) {
      T2.forEach((st, k) => {
        const sl = page(t, sub, k, T2);
        const gap = 0.3, cw = (W - 2 * M - gap * (st.length - 1)) / st.length;
        st.forEach((r, i) => {
          const x = M + i * (cw + gap);
          txt(sl, [{ text: r.code + "  ", options: { bold: true, color: C.navy } }, { text: r.attrs ? r.attrs.city : "", options: { color: C.muted, fontSize: 12 } }], x, 1.45, cw, 0.35, { fontSize: 16 });
          if (!r.ggroups) { txt(sl, "Нет данных по группам товаров", x, 1.9, cw, 0.3, { fontSize: 12, color: C.muted }); return; }
          const L = r.ggroups[key].slice(0, 10), rg = AN.regionOf(r), ra = rg && rg.ggroups ? rg.ggroups.all : null;
          const nw = cw - (ra ? 4.5 : 3.6);
          table(sl, x, 1.85, ra ? [nw, 1.15, 0.95, 1.1, 1.3] : [nw, 1.25, 1.1, 1.25], ["Группа товаров", "Гросс", "Доля", "Маржа"].concat(ra ? ["Маржа рег."] : []), L.map((g) => [g.name, { t: rubS(g.gm), c: g.gm < 0 ? C.bad : key === "top" ? C.good : C.ink, b: true },
            isn(g.share) ? `${fmt(g.share, 1)}%` : "—", { t: isn(g.pct) ? `${fmt(g.pct, 1)}%` : "—", c: isn(g.pct) && g.pct < 0 ? C.bad : isn(g.pct) && ra && isn(ra[g.id]) ? (g.pct >= ra[g.id] ? C.good : C.bad) : C.ink, b: !!ra }]
            .concat(ra ? [{ t: isn(ra[g.id]) ? `${fmt(ra[g.id], 1)}%` : "—", c: C.muted }] : [])), { fontSize: 10, rowH: 0.42 });
        });
        foot(sl);
      });
    }
    // 7. категории (оборот): рост и падение
    if (R.list.some((r) => r.cats)) T4.forEach((st, k) => {
      const sl = page("Оборот по категориям", `${R.monthLabel} к прошлому месяцу: топ-10 роста и топ-10 падения, в рублях`, k, T4);
      const gap = 0.3, cw = (W - 2 * M - gap * (st.length - 1)) / st.length;
      st.forEach((r, i) => {
        const x = M + i * (cw + gap);
        txt(sl, [{ text: r.code + "  ", options: { bold: true, color: C.navy } }, { text: r.attrs ? r.attrs.city : "", options: { color: C.muted, fontSize: 12 } }], x, 1.45, cw, 0.35, { fontSize: 16 });
        if (!r.cats) { txt(sl, "Нет данных по категориям", x, 1.9, cw, 0.3, { fontSize: 12, color: C.muted }); return; }
        const num = st.length > 2 ? 0.95 : 1.15, nw = (cw - 2 * num) / 2;
        const rows = Array.from({ length: 10 }, (_, j) => { const a = r.cats.top[j], b = r.cats.anti[j];
          return [a ? a.name : "", a ? { t: rubS(a.d, true), c: C.good, b: true } : "", b ? b.name : "", b ? { t: rubS(b.d, true), c: C.bad, b: true } : ""]; });
        table(sl, x, 1.85, [nw, num, nw, num], ["Рост", "₽", "Падение", "₽"], rows, { fontSize: st.length > 2 ? 9 : 10.5, rowH: 0.45, align: ["left", "right", "left", "right"] });
      });
      foot(sl);
    });
    // 8. аксессуары и услуги
    if (R.list.some((r) => r.acc || r.srv)) T4.forEach((st, k) => { const sl = page("Аксессуары и услуги", "К прошлому году и к прошлому месяцу", k, T4); mTable(sl, AN.multiRows("mix").slice(1), wr(st), 1.5); foot(sl); });
    // 9. где хорошо и где плохо — полностью, без сокращений
    T2.forEach((st, k) => {
      const sl = page("Где хорошо и где плохо", "По блокам: ● зелёный — хорошо, ● красный — плохо, ● жёлтый — по-разному", k, T2);
      const TC = { good: C.good, bad: C.bad, mix: "C98A00" };
      mCols(pres, sl, st, 1.5, (r, x, y, w, h) => {
        const Bk = r.blocks || [];
        if (!Bk.length) { txt(sl, "Нет данных", x, y, w, 0.3, { fontSize: 12, color: C.muted }); return; }
        const t = Bk.map((b, i) => [{ text: "● ", options: { color: TC[b.tone] || C.muted, bold: true } }, { text: b.area, options: { bold: true, color: TC[b.tone] || C.ink, breakLine: true } },
          { text: b.text, options: { color: C.ink, breakLine: i < Bk.length - 1 } }]).flat();
        txt(sl, t, x, y - 0.05, w, h + 0.1, { fontSize: st.length > 2 ? 9.5 : 11, paraSpaceAfter: 5, fit: "shrink", valign: "top" });
      });
      foot(sl);
    });
    // 10. план действий — полностью
    T2.forEach((st, k) => {
      const sl = pres.addSlide(); sl.background = { color: C.navy };
      txt(sl, "План действий" + sfx(T2, k), M, 0.38, W - 2 * M, 0.6, { fontSize: 30, bold: true, color: C.white, valign: "middle" });
      txt(sl, "Что делает каждый магазин в следующем месяце", M, 1.0, W - 2 * M, 0.35, { fontSize: 14, color: "CADCFC" });
      mCols(pres, sl, st, 1.5, (r, x, y, w, h) => {
        const A = r.actions.filter((a) => a.area !== "Контроль").slice(0, 4);
        txt(sl, A.map((a, i) => [{ text: `${i + 1}. ${a.area}: `, options: { bold: true, color: C.white } }, { text: a.what, options: { color: "DCE6F2", breakLine: i < A.length - 1 } }]).flat(), x, y, w, h, { fontSize: 12, paraSpaceAfter: 10, fit: "shrink" });
      }, true);
    });
    const browser = typeof window !== "undefined" && typeof document !== "undefined";
    return pres.write({ outputType: browser ? "blob" : "nodebuffer", compression: true });
  }

  KPI.monthPpt = { build: (res) => (res.type === "monthMulti" ? buildMulti(res) : build(res)), facText: facConclusion };
})(typeof globalThis !== "undefined" ? globalThis : this);
