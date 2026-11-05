/* «Итоги месяца»: наглядный отчёт (вкладки) по результату KPI.monthAn.analyze. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const isn = (v) => typeof v === "number" && isFinite(v);
  const fmt = (v, d = 1, s = false) => KPI.analysis.fmt(v, d, s);
  const esc = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rubS = (v, s) => KPI.monthAn.rubS(v, s);
  const rub = (v) => (isn(v) ? fmt(v, 0) + " ₽" : "—");
  // число со стрелкой: ▲ зелёным, ▼ красным; lowerBetter — наоборот
  function dl(v, unit = "%", d = 1, lowerBetter) {
    if (!isn(v)) return '<span class="dl na">—</span>';
    if (Math.abs(v) < Math.pow(10, -d) / 2) return `<span class="dl na">0${unit}</span>`;
    const good = lowerBetter ? v < 0 : v > 0;
    return `<span class="dl ${good ? "up" : "down"}">${v > 0 ? "▲" : "▼"} ${fmt(v, d, true)}${unit}</span>`;
  }
  const unitOf = (type) => (type === "pct" || type === "eff" ? " п.п." : "%");
  const valOf = (r) => (r.type === "sum" ? (r.k === "rev" || r.k === "acc" || r.k === "srv" ? rubS(r.cur) : fmt(r.cur, 0)) : r.type === "avg" ? (r.k === "upt" ? fmt(r.cur, 2) : rub(r.cur)) : r.type === "pct" ? `${fmt(r.cur, 1)}%` : "");
  // цвет ячейки по знаку (условное форматирование)
  function bg(v, scale) {
    if (!isn(v)) return "";
    const t = Math.max(-1, Math.min(1, v / scale));
    const a = Math.abs(t) * 0.55 + 0.08;
    return t >= 0 ? `background:rgba(12,163,12,${a.toFixed(2)})` : `background:rgba(208,59,59,${a.toFixed(2)})`;
  }

  // ---------------------------------------------------------------- блоки
  function tiles(res) {
    const row = (k) => (res.kpi || []).find((r) => r.k === k);
    const region = res.level !== "store";
    const T = [];
    const add = (t, v, rr, note) => T.push({ t, v, r: rr, note });
    if (res.kpi) {
      for (const k of ["rev", "traffic", "conv", "eff", "avg", "price", "upt"]) { const r = row(k); if (r) add(r.label, r.type === "eff" ? (isn(r.dPy) ? `${fmt(r.dPy, 1, true)}%` : "—") : valOf(r), r); }
    }
    if (res.gross && res.gross.month) T.push({ t: "Гросс-маржа", v: rubS(res.gross.month.gm), note: `${fmt(res.gross.month.pct, 1)}% оборота`, extra: [["к прошлому месяцу", res.gross.dPrevPct, " п.п."]] });
    const a = row("accSh"); if (a) add("Доля аксессуаров", valOf(a), a);
    const s = row("srvSh"); if (s) add("Доля услуг", valOf(s), s);
    if (res.types && isn(res.types.chdu)) T.push({ t: "ЧДУ", v: `${fmt(res.types.chdu, 1)}%`, note: `без Е-ком и B2B · норма ${fmt(res.norms.chdu_min, 0)}%`, st: res.types.chdu >= res.norms.chdu_min ? "good" : "bad" });
    return `<div class="mtiles">${T.map((x) => {
      let neg = false;
      const ds = x.r ? (x.r.type === "eff" ? [["к прошлому месяцу", x.r.dPrev], region ? ["LfL", x.r.dLfl] : ["с начала года", x.r.dYtd]] : [["к прошлому месяцу", x.r.dPrev], ["к прошлому году", x.r.dPy], region ? ["LfL", x.r.dLfl] : ["с начала года", x.r.dYtd]]) : x.extra || [];
      const u = x.r ? unitOf(x.r.type) : " п.п.";
      ds.forEach(([, v]) => { if (isn(v) && v < 0) neg = true; });
      if (x.r && x.r.type === "eff" && isn(x.r.dPy) && x.r.dPy < 0) neg = true;
      const st = x.st || (neg ? "bad" : "good");
      return `<div class="mtile ${st}"><small>${esc(x.t)}</small><b>${esc(x.v)}</b>${x.note ? `<em>${esc(x.note)}</em>` : ""}<div class="mtd">${ds.map(([l, v]) => `<span><i>${esc(l)}</i>${dl(v, u)}</span>`).join("")}</div></div>`;
    }).join("")}</div>`;
  }
  function decompBlock(dec, title) {
    if (!dec) return "";
    const items = [["Трафик", dec.traffic], ["Конверсия", dec.conv], ["Средняя цена", dec.price], ["Штуки в чеке", dec.upt]];
    const m = Math.max(...items.map((i) => Math.abs(i[1])), Math.abs(dec.dR), 1);
    const row = (l, v, tot) => {
      const w = Math.min(50, (Math.abs(v) / m) * 50), side = v >= 0 ? "pos" : "neg";
      const style = v >= 0 ? `left:50%;width:${w.toFixed(1)}%` : `left:${(50 - w).toFixed(1)}%;width:${w.toFixed(1)}%`;
      return `<div class="drv-row${tot ? " tot" : ""}"><div class="drv-l">${esc(l)}</div><div class="drv-t"><div class="drv-0"></div><div class="drv-b ${side}" style="${style}"></div></div><div class="drv-v ${side}">${rubS(v, true)}</div></div>`;
    };
    return `<section class="panel"><h3>${esc(title)}</h3><p class="muted">На сколько рублей изменился оборот из-за каждого фактора (оборот = трафик × конверсия × средняя цена × штуки в чеке).</p><div class="drv mdrv">${items.map(([l, v]) => row(l, v)).join("")}${row("Итого", dec.dR, true)}</div></section>`;
  }
  function factorsBlock(res) {
    if (!res.factors) return "";
    const MN = KPI.month.MONTHS[res.Mo], R = res.P;
    const rows = (R && R.cur && R.py ? [`<tr><th class="rl">Оборот</th><td><b>${rubS(R.cur.rev)}</b></td><td>${rubS(R.py.rev)}</td><td>${dl((R.cur.rev / R.py.rev - 1) * 100)}</td><td>${dl(R.prev ? (R.cur.rev / R.prev.rev - 1) * 100 : null)}</td></tr>`] : [])
      .concat(res.factors.map((f) => `<tr><th class="rl">${esc(f.label)}</th><td><b>${fmt(f.cur, f.d)}${f.u}</b></td><td>${fmt(f.py, f.d)}${f.u}</td><td>${dl(f.dPy, f.t === "pp" ? " п.п." : "%")}</td><td>${dl(f.dPrev, f.t === "pp" ? " п.п." : "%")}</td></tr>`)).join("");
    return `<section class="panel"><h3>Из чего сложился оборот</h3><p class="muted">Оборот = трафик × конверсия × средний чек; средний чек = средняя цена × штуки в чеке.</p><div class="tw"><table class="mt"><thead><tr><th>Показатель</th><th>${esc(MN)} ${res.Y}</th><th>${esc(MN)} ${res.Y - 1}</th><th>к году</th><th>к прошл. мес.</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  function chart(res) {
    if (!res.series) return "";
    const [a, b] = res.series;
    const all = [...a.rev, ...b.rev].filter(isn); if (!all.length) return "";
    const mx = Math.max(...all) * 1.1, W = 640, H = 220, L = 46, B = 24, bw = (W - L - 10) / 12;
    const MS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="mchart" role="img" aria-label="Оборот по месяцам: ${b.year} и ${a.year}">`;
    for (let k = 0; k <= 4; k++) { const y = H - B - ((H - B - 10) * k) / 4; svg += `<line x1="${L}" x2="${W - 6}" y1="${y}" y2="${y}" class="gl"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" class="ax">${fmt((mx * k) / 4 / 1e6, mx > 5e7 ? 0 : 1)}</text>`; }
    for (let m = 0; m < 12; m++) {
      const x = L + m * bw;
      const h = (v) => (isn(v) ? ((H - B - 10) * v) / mx : 0);
      if (isn(a.rev[m])) svg += `<rect x="${x + bw * 0.12}" y="${H - B - h(a.rev[m])}" width="${bw * 0.36}" height="${h(a.rev[m])}" class="bp"><title>${a.year}, ${MS[m]}: ${rubS(a.rev[m])}</title></rect>`;
      if (isn(b.rev[m])) svg += `<rect x="${x + bw * 0.5}" y="${H - B - h(b.rev[m])}" width="${bw * 0.36}" height="${h(b.rev[m])}" class="bc${m === res.Mo ? " cur" : ""}"><title>${b.year}, ${MS[m]}: ${rubS(b.rev[m])}</title></rect>`;
      svg += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" class="ax">${MS[m]}</text>`;
    }
    svg += "</svg>";
    return `<section class="panel"><h3>Оборот по месяцам, млн ₽</h3><div class="mleg"><span><i class="bp"></i>${a.year}</span><span><i class="bc"></i>${b.year}</span></div>${svg}</section>`;
  }
  function lists(res) {
    const li = (arr, cls) => arr.length ? `<ul class="mli ${cls}">${arr.map((x) => `<li><b>${esc(x.area)}.</b> ${esc(x.text)}</li>`).join("")}</ul>` : '<p class="muted">—</p>';
    return `<div class="two"><section class="panel"><h3>Где плохо</h3>${li(res.bad, "bad")}</section><section class="panel"><h3>Где хорошо</h3>${li(res.good, "good")}</section></div>`;
  }
  function kpiTable(res) {
    if (!res.kpi) return '<p class="muted">Нет исторической справки.</p>';
    const region = res.level !== "store";
    const sc = (r) => (r.type === "pct" || r.type === "eff" ? 3 : 15);
    const rows = res.kpi.map((r) => {
      const u = unitOf(r.type);
      const cell = (v) => `<td style="${bg(v, sc(r))}">${isn(v) ? fmt(v, 1, true) + u : "—"}</td>`;
      return `<tr><th class="rl">${esc(r.label)}</th><td><b>${r.type === "eff" ? "" : esc(valOf(r))}</b></td>${cell(r.dPrev)}${cell(r.dPy)}${region ? cell(r.dLfl) : ""}${cell(r.dYtd)}<td>${r.type === "eff" || r.ytd == null ? "" : esc(valOf({ ...r, cur: r.ytd }))}</td></tr>`;
    }).join("");
    return `<section class="panel"><h3>Показатели: ${esc(res.monthLabel.toLowerCase())}</h3><p class="muted">Доли, конверсия, эффективность и выполнение плана — изменение в п.п., остальное — в %. ${region ? `LfL — ${res.lflN} магазинов, работавших полный месяц и в этом, и в прошлом году.` : ""}</p>
<div class="tw"><table class="mt sticky1"><thead><tr><th>Показатель</th><th>${esc(res.monthLabel)}</th><th>к ${esc(res.prevLabel.replace(/ь$/, "ю").replace(/т$/, "ту").replace(/й$/, "ю"))}</th><th>к прошлому году</th>${region ? "<th>LfL</th>" : ""}<th>с начала года к прошлому</th><th>с начала года</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  function grossBlock(res) {
    const g = res.gross;
    if (!g) return '<p class="muted">Нет файлов гросс-маржи.</p>';
    const P = [["month", res.monthLabel], ["prev", "Прошлый месяц"], ["ytd", "С начала года"]].filter(([k]) => g[k]);
    let h = `<section class="panel"><h3>Гросс-маржа</h3><div class="tw"><table class="mt"><thead><tr><th>Период</th><th>Оборот</th><th>Гросс-маржа</th><th>Доля в обороте</th></tr></thead><tbody>${P.map(([k, l]) =>
      `<tr><th class="rl">${esc(l)}</th><td>${rub(g[k].rev)}</td><td><b>${rub(g[k].gm)}</b></td><td><b>${fmt(g[k].pct, 1)}%</b></td></tr>`).join("")}</tbody></table></div>`;
    if (g.month && g.prev) h += `<p>К прошлому месяцу: гросс ${dl(g.dPrevGm)}, маржинальность ${dl(g.dPrevPct, " п.п.")}.${isn(g.benchPct) && res.bench ? ` Среднее по ${esc(res.bench.name)}: ${fmt(g.benchPct, 1)}%.` : ""}</p>`;
    if (isn(g.effRev)) h += `<p>Почему изменился гросс: <b>${rubS(g.dGm, true)}</b> — из-за оборота <b class="${g.effRev >= 0 ? "pos" : "neg"}">${rubS(g.effRev, true)}</b>, из-за маржинальности <b class="${g.effPct >= 0 ? "pos" : "neg"}">${rubS(g.effPct, true)}</b>.</p>`;
    h += "</section>";
    if (res.ggroups) {
      const t = (arr, title) => arr.length ? `<section class="panel"><h3>${title}</h3><div class="tw"><table class="mt"><thead><tr><th>Группа товаров</th><th>Оборот</th><th>Гросс</th><th>Доля гросса</th><th>Маржа</th></tr></thead><tbody>${arr.map((x) =>
        `<tr><th class="rl">${esc(x.name)}</th><td>${rub(x.rev)}</td><td class="${x.gm < 0 ? "c-bad" : ""}">${rub(x.gm)}</td><td>${isn(x.share) ? fmt(x.share, 1) + "%" : "—"}</td><td>${isn(x.pct) ? fmt(x.pct, 1) + "%" : "—"}</td></tr>`).join("")}</tbody></table></div></section>` : "";
      h += `<div class="two">${t(res.ggroups.top, "Топ-10 групп по гроссу (месяц)")}${t(res.ggroups.anti, "Антитоп-10 групп по гроссу (месяц)")}</div>`;
    }
    return h;
  }
  function catTable(arr, title, res) {
    if (!arr.length) return `<section class="panel"><h3>${title}</h3><p class="muted">Нет.</p></section>`;
    return `<section class="panel"><h3>${title}</h3><div class="tw"><table class="mt sticky1"><thead><tr><th>Подкатегория</th><th>Оборот</th><th>к прошлому месяцу, ₽</th><th>%</th><th>Штук</th><th>Δ штук</th><th>Ср. цена</th><th>Δ цены</th><th>Ср. чек</th><th>Δ чека</th><th>Доля</th></tr></thead><tbody>${arr.map((x) =>
      `<tr><th class="rl">${esc(x.name)}</th><td>${rub(x.rev)}</td><td style="${bg(x.d, Math.max(...arr.map((y) => Math.abs(y.d))))}"><b>${rubS(x.d, true)}</b></td><td>${dl(x.dPct, "%", 0)}</td><td>${fmt(x.qty, 0)}</td><td>${dl(x.dQty, "%", 0)}</td><td>${rub(x.price)}</td><td>${dl(x.dPrice, "%", 0)}</td><td>${rub(x.chk)}</td><td>${dl(x.dChk, "%", 0)}</td><td>${isn(x.share) ? fmt(x.share, 1) + "%" : "—"}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  function catsBlock(res) {
    if (!res.cats) return '<p class="muted">Нет файла «Сравнение периодов».</p>';
    const c = res.cats;
    return `<p class="lead">Оборот по подкатегориям: ${esc(res.monthLabel.toLowerCase())} ${rubS(c.total)} против ${rubS(c.totalPrev)} в прошлом месяце (${dl(c.totalPrev ? (c.total / c.totalPrev - 1) * 100 : null)}).</p>` +
      catTable(c.top, "Топ-15: рост к прошлому месяцу", res) + catTable(c.anti, "Антитоп-15: падение к прошлому месяцу", res);
  }
  function accBlock(res) {
    const a = res.acc;
    if (!a) return '<p class="muted">Нет отчёта по аксессуарам за этот месяц.</p>';
    const t = a.t, b = res.accBench && res.accBench.t;
    const hasAtt = a.eco.some((e) => isn(e.att));
    const rows = a.eco.map((e) => `<tr><th class="rl">${esc(e.name)}</th><td>${rub(e.acc)}</td><td style="${bg(e.d, Math.max(...a.eco.map((x) => Math.abs(x.d)), 1))}"><b>${rubS(e.d, true)}</b></td><td>${dl(e.yoy, "%", 0)}</td><td>${isn(e.sh) ? fmt(e.sh, 1) + "%" : "—"}</td><td>${dl(e.dSh, " п.п.")}</td>${hasAtt ? `<td>${isn(e.att) ? fmt(e.att, 1) + "%" : "—"}</td><td>${dl(e.dAtt, " п.п.")}</td>` : ""}</tr>`).join("");
    return `<div class="mtiles">${[["Оборот аксессуаров", rubS(t.acc), [["к прошлому году", t.yoy, "%"]]], ["Доля аксессуаров", `${fmt(t.sh, 1)}%`, [["к прошлому году", t.dSh, " п.п."]].concat(b ? [["против " + res.bench.name, isn(b.sh) ? t.sh - b.sh : null, " п.п."]] : [])],
      ["Аттач (розница)", isn(t.att) ? `${fmt(t.att, 1)}%` : "—", [["к прошлому году", t.dAtt, " п.п."]]]].map(([l, v, ds]) =>
      `<div class="mtile ${ds.some((d) => isn(d[1]) && d[1] < 0) ? "bad" : "good"}"><small>${esc(l)}</small><b>${esc(v)}</b><div class="mtd">${ds.map(([x, y, u]) => `<span><i>${esc(x)}</i>${dl(y, u)}</span>`).join("")}</div></div>`).join("")}</div>
<section class="panel"><h3>За счёт каких категорий (к прошлому году)</h3><div class="tw"><table class="mt sticky1"><thead><tr><th>Категория</th><th>Оборот АКС</th><th>Изменение, ₽</th><th>%</th><th>Доля АКС</th><th>Δ доли</th>${hasAtt ? "<th>Аттач</th><th>Δ аттача</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  function srvBlock(res) {
    const s = res.srv, T = res.types;
    if (!s && !T) return '<p class="muted">Нет отчёта по сервисам за этот месяц.</p>';
    let h = "";
    if (s) {
      const t = s.t, b = res.srvBench && res.srvBench.t;
      h += `<div class="mtiles">${[["Оборот услуг", rubS(t.srv), [["к прошлому году", t.yoy, "%"]]], ["Доля услуг", `${fmt(t.sh, 1)}%`, [["к прошлому году", t.dSh, " п.п."]].concat(b ? [["против " + res.bench.name, isn(b.sh) ? t.sh - b.sh : null, " п.п."]] : [])], ["ЧДУ", T && isn(T.chdu) ? `${fmt(T.chdu, 1)}%` : "—", []]].map(([l, v, ds]) =>
        `<div class="mtile ${ds.some((d) => isn(d[1]) && d[1] < 0) || (l === "ЧДУ" && T && isn(T.chdu) && T.chdu < res.norms.chdu_min) ? "bad" : "good"}"><small>${esc(l)}</small><b>${esc(v)}</b><div class="mtd">${ds.map(([x, y, u]) => `<span><i>${esc(x)}</i>${dl(y, u)}</span>`).join("")}</div></div>`).join("")}</div>`;
      const mx = Math.max(...s.eco.map((x) => Math.abs(x.d)), 1);
      h += `<section class="panel"><h3>За счёт каких категорий растут или падают услуги (к прошлому году)</h3><div class="tw"><table class="mt sticky1"><thead><tr><th>Категория</th><th>Оборот услуг</th><th>Изменение, ₽</th><th>%</th><th>Доля услуг</th><th>Δ доли</th><th>Проникновение, шт</th></tr></thead><tbody>${s.eco.map((e) =>
        `<tr><th class="rl">${esc(e.name)}</th><td>${rub(e.srv)}</td><td style="${bg(e.d, mx)}"><b>${rubS(e.d, true)}</b></td><td>${dl(e.yoy, "%", 0)}</td><td>${isn(e.sh) ? fmt(e.sh, 1) + "%" : "—"}</td><td>${dl(e.dSh, " п.п.")}</td><td>${isn(e.pen) ? fmt(e.pen, 1) + "%" : "—"}</td></tr>`).join("")}</tbody></table></div></section>`;
    }
    if (T) {
      const list = T.types.filter((t) => t.rub || t.qty || t.benchPen);
      h += `<section class="panel"><h3>Виды услуг: ${esc(res.monthLabel.toLowerCase())}</h3><p class="muted">Проникновение — штук услуг на 100 штук основного товара.${res.bench ? ` Сравнение со средним по ${esc(res.bench.name)}; «потенциал» — сколько добавит выход на средний уровень.` : ""}</p>
<div class="tw"><table class="mt sticky1"><thead><tr><th>Вид услуги</th><th>Оборот</th><th>Штук</th><th>Доля в услугах</th><th>Ср. цена</th><th>Проникновение</th>${res.bench ? "<th>Среднее по региону</th><th>Потенциал в месяц</th>" : ""}</tr></thead><tbody>${list.map((t) =>
        `<tr><th class="rl">${esc(t.name)}</th><td>${rub(t.rub)}</td><td>${fmt(t.qty, 0)}</td><td>${isn(t.sh) ? fmt(t.sh, 1) + "%" : "—"}</td><td>${rub(t.price)}</td><td class="${isn(t.benchPen) && isn(t.pen) && t.pen < t.benchPen ? "c-bad" : ""}">${isn(t.pen) ? fmt(t.pen, 1) + "%" : "—"}</td>${res.bench ? `<td>${isn(t.benchPen) ? fmt(t.benchPen, 1) + "%" : "—"}</td><td>${t.potential > 0 ? "+" + rubS(t.potential) : "—"}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
      if (T.ext.some((e) => e.rub)) { const tot = T.ext.reduce((a, e) => a + e.rub, 0); h += `<p>Расширенная гарантия по срокам: ${T.ext.map((e) => `${e.name} — ${rubS(e.rub)} (${tot ? fmt((e.rub / tot) * 100, 0) : 0}%)`).join(", ")}.</p>`; }
      h += "</section>";
    }
    return h;
  }
  function storesBlock(res) {
    if (!res.stores || !res.stores.length) return "";
    const S = res.stores;
    const col = (v, sc, inv) => bg(isn(v) ? (inv ? -v : v) : null, sc);
    const avg = (k) => { const a = S.map((s) => s[k]).filter(isn); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
    const gmA = avg("gmPct"), accA = avg("accSh"), srvA = avg("srvSh");
    const rows = S.map((s, i) => `<tr><td>${i + 1}</td><th class="rl">${esc(s.code)}<small class="sub">${esc([s.city, s.part].filter(Boolean).join(" · "))}</small></th>${res.level === "dsm" || res.level === "all" || res.level === "group" ? `<td class="tl">${esc(s.asm)}</td>` : ""}<td>${rubS(s.rev)}</td>
<td style="${col(s.dPy, 25)}">${isn(s.dPy) ? fmt(s.dPy, 1, true) + "%" : "—"}</td><td style="${col(s.dPrev, 25)}">${isn(s.dPrev) ? fmt(s.dPrev, 1, true) + "%" : "—"}</td>
<td>${isn(s.conv) ? fmt(s.conv, 1) + "%" : "—"}</td><td style="${col(s.dConv, 3)}">${isn(s.dConv) ? fmt(s.dConv, 1, true) : "—"}</td><td style="${col(s.eff, 15)}">${isn(s.eff) ? fmt(s.eff, 1, true) : "—"}</td>
<td style="${col(s.dAvg, 15)}">${isn(s.dAvg) ? fmt(s.dAvg, 1, true) + "%" : "—"}</td>
<td style="${col(isn(s.gmPct) && isn(gmA) ? s.gmPct - gmA : null, 4)}">${isn(s.gmPct) ? fmt(s.gmPct, 1) + "%" : "—"}</td><td style="${col(isn(s.accSh) && isn(accA) ? s.accSh - accA : null, 2)}">${isn(s.accSh) ? fmt(s.accSh, 1) + "%" : "—"}</td>
<td style="${col(isn(s.srvSh) ? s.srvSh - res.norms.srv_share_min : null, 2)}">${isn(s.srvSh) ? fmt(s.srvSh, 1) + "%" : "—"}</td><td style="${col(isn(s.chdu) ? s.chdu - res.norms.chdu_min : null, 3)}">${isn(s.chdu) ? fmt(s.chdu, 1) + "%" : "—"}</td></tr>`).join("");
    return `<section class="panel"><h3>Магазины: ${esc(res.monthLabel.toLowerCase())}</h3><p class="muted">Зелёный — лучше, красный — хуже: приросты относительно нуля, гросс и доля аксессуаров — относительно среднего по магазинам, доля услуг и ЧДУ — относительно нормы.</p>
<div class="tw"><table class="mt sticky1"><thead><tr><th>№</th><th>Магазин</th>${res.level === "dsm" || res.level === "all" || res.level === "group" ? "<th>ASM</th>" : ""}<th>Оборот</th><th>к году</th><th>к прошлому месяцу</th><th>Конверсия</th><th>Δ конв., п.п.</th><th>Эффективность</th><th>Ср. чек к году</th><th>Гросс</th><th>Доля АКС</th><th>Доля услуг</th><th>ЧДУ</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  function actionsBlock(res) {
    return res.actions.map((a, i) => `<div class="act ${a.prio === "Высокий" ? "bad" : a.prio === "Средний" ? "warn" : ""}"><div class="act-h"><b>${i + 1}. ${esc(a.area)}</b><span class="prio">${esc(a.prio)} приоритет</span></div><p class="what">${esc(a.what)}</p><p class="muted">${esc(a.why)}</p></div>`).join("");
  }

  function build(res, baseCss) {
    const tabs = [["sum", "Сводка"], ["kpi", "Показатели"]];
    if (res.gross || res.ggroups) tabs.push(["gross", "Гросс"]);
    if (res.cats) tabs.push(["cat", "Категории"]);
    if (res.acc) tabs.push(["acc", "Аксессуары"]);
    if (res.srv || res.types) tabs.push(["srv", "Сервисы"]);
    if (res.stores && res.stores.length) tabs.push(["st", "Магазины"]);
    tabs.push(["plan", "План действий"]);
    const notes = res.notes.map((n) => `<div class="banner">ℹ ${esc(n)}</div>`).join("");
    const sec = { sum: notes + tiles(res) + `<div class="two">${factorsBlock(res)}${chart(res)}</div>` + lists(res),
      kpi: kpiTable(res), gross: grossBlock(res), cat: catsBlock(res), acc: accBlock(res), srv: srvBlock(res), st: storesBlock(res), plan: actionsBlock(res) };
    const now = new Date();
    const body = `<div class="rep"><header class="top"><div class="ttl"><h1>Итоги: ${esc(res.monthLabel.toLowerCase())} · ${esc(res.name)}</h1><p>${esc(res.sub)}</p><p class="muted">Отчёт ${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}</p></div></header>
<nav class="tabs">${tabs.map(([t, n], i) => `<button class="tb${i ? "" : " on"}" data-t="${t}">${n}</button>`).join("")}</nav><main>
${tabs.map(([t], i) => `<section class="tab${i ? "" : " on"}" data-tab="${t}">${sec[t]}</section>`).join("\n")}
</main><div class="tipbox" role="tooltip"></div></div>`;
    return { body, css: baseCss + CSS, title: `Итоги месяца — ${res.name}` };
  }
  const CSS = `
.mtiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin:14px 0}
@media (max-width:700px){.mtile b{font-size:19px}.mtd{gap:2px 10px}}
.mtile{background:var(--surface);border:1px solid var(--line);border-left:6px solid var(--good);border-radius:12px;padding:10px 12px}
.mtile.bad{border-left-color:var(--bad)}.mtile small{display:block;color:var(--text2);font-weight:600}.mtile b{display:block;font-size:22px;margin:2px 0}
.mtile em{display:block;font-style:normal;color:var(--muted);font-size:12px}.mtd{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px}
.mtd span{font-size:12.5px}.mtd i{font-style:normal;color:var(--muted);display:block;font-size:11px}
.dl{font-weight:700;white-space:nowrap}.dl.up{color:var(--good)}.dl.down{color:var(--bad)}.dl.na{color:var(--muted)}
.mdrv .drv-row{grid-template-columns:120px 1fr 110px}
.mchart{width:100%;height:auto}.mchart .gl{stroke:var(--line)}.mchart .ax{font-size:11px;fill:var(--muted)}.mchart .bp{fill:var(--b2)}.mchart .bc{fill:#7f9cc9}.mchart .bc.cur{fill:var(--accent)}
.mleg{display:flex;gap:14px;font-size:12.5px;color:var(--text2)}.mleg i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.mleg i.bp{background:var(--b2)}.mleg i.bc{background:var(--accent)}
.mli{margin:0;padding-left:18px}.mli li{margin:6px 0}.mli.bad li::marker{color:var(--bad)}.mli.good li::marker{color:var(--good)}
td.tl{text-align:left}
@media (prefers-color-scheme:dark){.mchart .bc{fill:#5b78a8}}
`;

  // ---------------------------------------------------------------- несколько магазинов: результаты рядом, без суммы
  function multiTable(R, kind, title, note) {
    const rows = KPI.monthAn.multiRows(kind);
    const L = R.list;
    const head = `<th>Показатель</th>` + L.map((r) => `<th class="mh"><b>${esc(r.code)}</b><small>${esc(r.attrs ? r.attrs.city : "")}</small></th>`).join("");
    const body = rows.map(([label, f]) => {
      const cells = L.map((r) => { const c = f(r); if (!c) return '<td class="mc">—</td>';
        const v = c.sign != null ? `<b class="${c.sign >= 0 ? "pos" : "neg"}">${esc(c.v)}</b>` : `<b>${esc(c.v)}</b>`;
        return `<td class="mc">${v}${c.sub ? `<span class="muted">${esc(c.sub)}</span>` : ""}${c.one ? `<span>${c.d.filter((q) => isn(q[1])).map(([l, x, u]) => `${dl(x, u)} <i>${esc(l)}</i>`).join(" · ")}</span>` : c.d.map(([l, x, u]) => `<span>${dl(x, u)} <i>${esc(l)}</i></span>`).join("")}</td>`; });
      return cells.every((c) => c === '<td class="mc">—</td>') ? "" : `<tr><th class="rl">${esc(label)}</th>${cells.join("")}</tr>`;
    }).join("");
    return `<section class="panel"><h3>${esc(title)}</h3>${note ? `<p class="muted">${esc(note)}</p>` : ""}<div class="tw"><table class="mt mtm sticky1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></section>`;
  }
  function multiCards(R, fn) {
    return `<div class="mcards">${R.list.map((r) => `<section class="panel"><h3>${esc(r.code)} <small class="muted">${esc(r.attrs ? [r.attrs.city, r.attrs.asm].filter(Boolean).join(" · ") : "")}</small></h3>${fn(r)}</section>`).join("")}</div>`;
  }
  function buildMulti(R, baseCss) {
    const li = (arr, cls, n) => arr.length ? `<ul class="mli ${cls}">${arr.slice(0, n).map((x) => `<li><b>${esc(x.area)}.</b> ${esc(x.text)}</li>`).join("")}</ul>` : '<p class="muted">—</p>';
    const catList = (arr, cls) => arr.length ? `<ol class="mli ${cls}">${arr.slice(0, 10).map((x) => `<li>${esc(x.name)} <b class="${x.d >= 0 ? "pos" : "neg"}">${rubS(x.d, true)}</b> <span class="muted">(${isn(x.dQty) ? `шт ${fmt(x.dQty, 0, true)}%` : ""}${isn(x.dPrice) ? `, цена ${fmt(x.dPrice, 0, true)}%` : ""})</span></li>`).join("")}</ol>` : '<p class="muted">—</p>';
    const tabs = [["kpi", "Показатели"], ["gross", "Гросс"], ["mix", "Аксессуары и услуги"], ["cat", "Категории"], ["fin", "Выводы"], ["plan", "План действий"]];
    const gTab = (r, key, title) => (r.ggroups ? `<h4>${title}</h4><ol class="mli">${r.ggroups[key].slice(0, 10).map((x) => `<li>${esc(x.name)} <b class="${x.gm >= 0 ? "pos" : "neg"}">${rubS(x.gm)}</b> <span class="muted">(${isn(x.share) ? fmt(x.share, 1) + "% гросса, " : ""}маржа ${fmt(x.pct, 1)}%)</span></li>`).join("")}</ol>` : "");
    const notes = [...new Set(R.list.flatMap((r) => r.notes))].map((n) => `<div class="banner">ℹ ${esc(n)}</div>`).join("");
    const sec = {
      kpi: notes + multiTable(R, "main", `Ключевые показатели: ${R.monthLabel.toLowerCase()}`, "К прошлому году и к прошлому месяцу. Эффективность — рост оборота минус рост трафика к году.") +
        multiCards(R, (r) => { const t = KPI.monthPpt && KPI.monthPpt.facText ? KPI.monthPpt.facText(r) : ""; return t ? `<h4>Вывод</h4><p>${esc(t)}</p>` : '<p class="muted">—</p>'; }),
      gross: multiTable(R, "gross", "Гросс-маржа", "Месяц, прошлый месяц и с начала года: в рублях и в доле от оборота.") + multiCards(R, (r) => gTab(r, "top", "Топ-10 групп по гроссу") + gTab(r, "anti", "Антитоп-10 групп по гроссу") || '<p class="muted">Нет данных по группам товаров.</p>'),
      mix: multiTable(R, "mix", "Аксессуары и услуги", "К прошлому году и к прошлому месяцу."),
      cat: multiCards(R, (r) => (r.cats ? `<h4>Топ-10 роста к прошлому месяцу</h4>${catList(r.cats.top, "good")}<h4>Топ-10 падения</h4>${catList(r.cats.anti, "bad")}` : '<p class="muted">Нет данных по подкатегориям.</p>')),
      fin: multiCards(R, (r) => (r.blocks || []).map((b) => `<div class="blk ${b.tone}"><b>${esc(b.area)}</b><p>${esc(b.text)}</p></div>`).join("") || '<p class="muted">—</p>'),
      plan: multiCards(R, (r) => r.actions.slice(0, 5).map((a, i) => `<div class="act ${a.prio === "Высокий" ? "bad" : a.prio === "Средний" ? "warn" : ""}"><div class="act-h"><b>${i + 1}. ${esc(a.area)}</b></div><p class="what">${esc(a.what)}</p></div>`).join("")),
    };
    const now = new Date();
    const body = `<div class="rep"><header class="top"><div class="ttl"><h1>Итоги: ${esc(R.monthLabel.toLowerCase())} · ${esc(R.name)}</h1><p>${esc(R.sub)}</p><p class="muted">Отчёт ${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}</p></div></header>
<nav class="tabs">${tabs.map(([t, n], i) => `<button class="tb${i ? "" : " on"}" data-t="${t}">${n}</button>`).join("")}</nav><main>
${tabs.map(([t], i) => `<section class="tab${i ? "" : " on"}" data-tab="${t}">${sec[t]}</section>`).join("\n")}
</main><div class="tipbox" role="tooltip"></div></div>`;
    return { body, css: baseCss + CSS + MCSS, title: `Итоги месяца — ${R.name}` };
  }
  const MCSS = `
.mtm td.mc{text-align:left;vertical-align:top;white-space:nowrap;min-width:150px}.mtm td.mc b{display:block;font-size:16px}.mtm td.mc span{display:block;font-size:12px}.mtm td.mc i{font-style:normal;color:var(--muted);display:inline}.mtm td.mc .dl{display:inline}
.mtm th.mh{text-align:left;min-width:150px}.mtm th.mh small{display:block;font-weight:400;color:var(--muted)}
.blk{border-left:5px solid var(--muted);padding:4px 10px;margin:8px 0}.blk.good{border-left-color:var(--good)}.blk.bad{border-left-color:var(--bad)}.blk.mix{border-left-color:#c98a00}.blk p{margin:2px 0 0}.blk.good b{color:var(--good)}.blk.bad b{color:var(--bad)}.blk.mix b{color:#c98a00}
b.pos{color:var(--good)}b.neg{color:var(--bad)}.mcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}.mcards .panel{margin:12px 0 0}.mcards h4{margin:10px 0 4px;font-size:13.5px}
`;

  KPI.monthReport = { build, buildMulti };
})(typeof globalThis !== "undefined" ? globalThis : this);
