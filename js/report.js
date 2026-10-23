/* Наглядный отчёт по магазину (порт report_html.py, адаптирован под телефон).
   build(res) -> {body, css, script}: тело отчёта, стили и скрипт вкладок; bind(root) — оживить вкладки в приложении. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const { PERIOD_RU } = KPI.loader;
  const { fmt, isn } = KPI.analysis;
  const SHOW = ["month", "week", "day"];

  const esc = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => (isn(v) ? v : null);
  const ru = KPI.loader.ru;
  const ICON = { good: "✓", bad: "✕", warn: "!", na: "–", info: "i" };
  const WORD = { good: "норма", bad: "ниже нормы", warn: "внимание", na: "нет данных", info: "" };
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

  function chip(st, text) { return `<span class="chip ${st}"><i>${ICON[st]}</i>${esc(text == null ? WORD[st] : text)}</span>`; }
  function delta(v, unit = "%", d = 1) {
    if (v == null) return '<span class="dl na">—</span>';
    const up = v >= 0;
    return `<span class="dl ${up ? "up" : "dn"}">${up ? "▲" : "▼"} ${fmt(v, d, true)}${esc(unit)}</span>`;
  }
  function pctBar(v, norm) {
    if (v == null) return "";
    const top = Math.max(norm * 1.6, v * 1.1, 0.1);
    const w = Math.max(0, Math.min(100, (v / top) * 100)), n = Math.min(100, (norm / top) * 100);
    return `<div class="pbar"><div class="pfill ${v >= norm ? "good" : "bad"}" style="width:${f1(w)}%"></div><div class="pnorm" style="left:${f1(n)}%"><span>норма ${fmt(norm, 1)}%</span></div></div>`;
  }
  const tip = (t) => (t ? ` data-tip="${esc(t)}"` : "");
  const money = (v) => (v != null ? `${fmt(v, 0)} ₽` : "—");
  const stNorm = (v, n) => (v == null ? "na" : v >= n ? "good" : "bad");
  const stMed = (v, st) => (v == null || !st ? "info" : v >= st.q[2] ? "good" : "warn");
  const rv = (P, c) => num((P.row || {})[c]);

  // ---------------------------------------------------------------- графики
  function hbars(rows, norm = null, unit = "%", d = 1) {
    rows = rows.filter((r) => r.v != null);
    if (!rows.length) return '<p class="muted">Нет данных.</p>';
    const vmax = Math.max(...rows.map((r) => r.v), norm ? norm * 1.25 : 0, 0.0001);
    let out = '<div class="hb">';
    if (norm != null) out += `<div class="hb-legend"><i class="sw nrm"></i>норма ${fmt(norm, 1)}${esc(unit)}</div>`;
    for (const r of rows) {
      const w = Math.max(0.6, Math.min(100, (Math.max(0, r.v) / vmax) * 100));
      const st = r.st || "info";
      const mark = ["good", "bad", "warn"].includes(st) ? `<i class="ic ${st}">${ICON[st]}</i>` : "";
      const nl = norm != null ? `<div class="hb-n" style="left:${f1(Math.min(100, (norm / vmax) * 100))}%"></div>` : "";
      out += `<div class="hb-row"${tip(r.tip)}><div class="hb-l">${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</div>` +
        `<div class="hb-t"><div class="hb-b ${r.money ? "money" : st}" style="width:${f1(w)}%"></div>${nl}</div>` +
        `<div class="hb-v">${r.money ? money(r.v) : fmt(r.v, d) + esc(unit)} ${mark}</div></div>`;
    }
    return out + "</div>";
  }
  function drivers(items, totalLabel, total) {
    const vals = items.filter((i) => i[1] != null).map((i) => Math.abs(i[1])).concat(total != null ? [Math.abs(total)] : []);
    const m = Math.max(...vals, 1);
    let out = '<div class="drv">';
    for (const [lab, v, hint] of items.concat([[totalLabel, total, ""]])) {
      const tot = lab === totalLabel ? " tot" : "";
      if (v == null) { out += `<div class="drv-row${tot}"><div class="drv-l">${esc(lab)}</div><div class="drv-t"><div class="drv-0"></div></div><div class="drv-v muted">нет данных</div></div>`; continue; }
      const w = Math.min(50, (Math.abs(v) / m) * 50), side = v >= 0 ? "pos" : "neg";
      const style = v >= 0 ? `left:50%;width:${f1(w)}%` : `left:${f1(50 - w)}%;width:${f1(w)}%`;
      out += `<div class="drv-row${tot}"${tip(hint)}><div class="drv-l">${esc(lab)}</div><div class="drv-t"><div class="drv-0"></div><div class="drv-b ${side}" style="${style}"></div></div>` +
        `<div class="drv-v ${side}">${v >= 0 ? "▲" : "▼"} ${fmt(v, 1, true)}%</div></div>`;
    }
    return out + "</div>";
  }
  function bullet(st, norm, d, unit, status) {           // HTML-версия: не искажается на узком экране
    const q = st.q, v = st.v;
    const pts = [q[0], q[4], v].concat(norm != null ? [norm] : []);
    let lo = Math.min(...pts), hi = Math.max(...pts);
    const pad = (hi - lo) * 0.08 || Math.max(Math.abs(hi), 1) * 0.1;
    lo -= pad; hi += pad;
    const X = (t) => ((t - lo) / (hi - lo)) * 100;
    const medX = Math.min(Math.max(X(q[2]), 12), 88);
    return `<div class="bul" role="img" aria-label="Магазин ${esc(fmt(v, d) + unit)}, медиана сети ${esc(fmt(q[2], d) + unit)}">` +
      `<div class="b1" style="left:${f1(X(q[0]))}%;width:${f1(Math.max(0.5, X(q[4]) - X(q[0])))}%"></div>` +
      `<div class="b2" style="left:${f1(X(q[1]))}%;width:${f1(Math.max(0.5, X(q[3]) - X(q[1])))}%"></div>` +
      `<div class="med" style="left:${f1(X(q[2]))}%"></div>` +
      (norm != null ? `<div class="nrm" style="left:${f1(X(norm))}%"></div>` : "") +
      `<div class="dot ${status}" style="left:${f1(X(v))}%" title="Магазин: ${esc(fmt(v, d) + unit)}"></div>` +
      `<div class="ax" style="left:${f1(medX)}%">медиана ${esc(fmt(q[2], d) + unit)}</div></div>`;
  }
  function segbar(parts) {
    const segs = parts.filter((p) => p[1]).map(([lab, n, st]) => `<div class="seg ${st}" style="flex:${n}"${tip(`${lab}: ${n}`)}>${n}</div>`).join("");
    const legend = parts.map(([lab, n, st]) => `<span class="lg"><i class="sw ${st}"></i>${esc(lab)} — ${n}</span>`).join("");
    return `<div class="segbar">${segs}</div><div class="legend">${legend}</div>`;
  }
  function ring(share, st) {
    const r = 30, c = 2 * Math.PI * r;
    const fg = share > 0 ? `<circle cx="40" cy="40" r="${r}" class="rfg ${st}" stroke-dasharray="${f1(c * share)} ${f1(c)}" transform="rotate(-90 40 40)"/>` : "";
    return `<svg class="ring" viewBox="0 0 80 80"><circle cx="40" cy="40" r="${r}" class="rbg"/>${fg}<text x="40" y="46" text-anchor="middle">${Math.round(share * 100)}%</text></svg>`;
  }

  // ---------------------------------------------------------------- «Главное»
  function normGrid(res) {
    const labels = [];
    SHOW.forEach((p) => res.periods[p].checks.forEach((c) => { if (!labels.includes(c.label)) labels.push(c.label); }));
    if (!labels.length) return '<p class="muted">Нет данных по магазину.</p>';
    const head = SHOW.map((p) => `<th>${PERIOD_RU[p]}</th>`).join("");
    const rows = labels.map((lab) => `<tr><th class="rl">${esc(lab.replace(" (худший из периода/года/LfL)", ""))}</th>` + SHOW.map((p) => {
      const c = res.periods[p].checks.find((x) => x.label === lab);
      return c ? `<td>${chip(c.ok ? "good" : "bad", c.text)}</td>` : '<td class="na">—</td>';
    }).join("") + "</tr>").join("");
    return `<div class="tw"><table class="grid"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function scoreTiles(res) {
    return '<div class="tiles">' + SHOW.map((p) => {
      const P = res.periods[p], cs = P.checks;
      if (!P.has_store || !cs.length) return `<div class="tile na"><b>${PERIOD_RU[p]}</b><div class="big">—</div><span>нет данных</span></div>`;
      const ok = cs.filter((c) => c.ok).length, share = ok / cs.length;
      const st = share === 1 ? "good" : share >= 0.6 ? "warn" : "bad";
      const pf = P.planFact || [];
      const pok = pf.filter((t) => t.status === "good").length;
      const pl = pf.length ? `<span class="tplan ${pok === pf.length ? "good" : "bad"}">план: <strong>${pok} из ${pf.length}</strong> в норме</span>` : "";
      return `<div class="tile ${st}"><b>${PERIOD_RU[p]}</b>${ring(share, st)}<span>норм выполнено <strong>${ok} из ${cs.length}</strong>${pl}</span></div>`;
    }).join("") + "</div>";
  }
  function pfItem(P, id) { return (P.planFact || []).find((t) => t.id === id && t.status !== "na"); }
  const pfPct = (t) => (t.sum ? t.pctDate : t.pct);
  function planLine(P, id) {
    const t = pfItem(P, id);
    if (!t) return "";
    const pv = (v) => `${fmt(v, t.d)}${t.unit === "%" ? "%" : " " + t.unit}`;
    const w = Math.max(0, Math.min(100, pfPct(t) / 1.3));
    const head = t.sum ? `План ${pv(t.plan)} · на дату ${pv(t.planDate)}` : `План ${pv(t.plan)}`;
    const tail = t.sum ? ` · прогноз <b>${fmt(t.pctFc, 0)}%</b>` : "";
    return `<div class="planl ${t.status}"><div class="planh"><span>${head}</span><b>${fmt(pfPct(t), 0)}%</b></div>` +
      `<div class="pbar sm"><div class="pfill ${t.status === "good" ? "good" : t.status === "warn" ? "warn" : "bad"}" style="width:${f1(w)}%"></div><div class="pnorm" style="left:${f1(100 / 1.3)}%"></div></div>` +
      `<small>${t.sum ? "выполнение плана на дату" : "выполнение плана"}${tail}</small></div>`;
  }
  function kpiCards(P, norms) {
    if (!P.has_store) return `<p class="muted">${esc(P.notes[0] || "Нет данных по магазину за этот период.")}</p>`;
    const R = (c) => rv(P, c), cards = [];
    const card = (title, value, body, st, hint) => cards.push(`<div class="card ${st || ""}"${tip(hint)}><div class="ct">${esc(title)}${["good", "bad", "warn"].includes(st) ? chip(st) : ""}</div><div class="cv">${value}</div><div class="cb">${body}</div></div>`);
    const trio = (a, b, c, unit = "%") => `<div class="trio"><span>к периоду ${delta(R(a), unit)}</span><span>к году ${delta(R(b), unit)}</span><span>LfL ${delta(R(c), unit)}</span></div>`;
    const anyNeg = (ids) => ids.map(R).some((x) => x != null && x < 0);
    const anyVal = (ids) => ids.map(R).some((x) => x != null);
    card("Оборот", money(R("revenue")), trio("rev_p", "rev_y", "rev_l") + planLine(P, "revenue"), anyNeg(["rev_p", "rev_y", "rev_l"]) ? "bad" : anyVal(["rev_p", "rev_y", "rev_l"]) ? "good" : null, "Норма: оборот растёт к прошлому периоду, к году и LfL");
    const ev = ["eff_p", "eff_y", "eff_l"].map(R).filter((x) => x != null);
    if (ev.length) card("Эффективность розницы", `${fmt(Math.min(...ev), 1, true)} <small>п.п. (худшая)</small>`, trio("eff_p", "eff_y", "eff_l", " п.п."), ev.some((x) => x < 0) ? "bad" : "good", "Эффективность = прирост оборота минус прирост трафика. Норма: не ниже 0");
    card("Конверсия офлайн", `${fmt(R("conv"), 1)}%`, trio("conv_p", "conv_y", "conv_l", " п.п.") + planLine(P, "conv"), anyNeg(["conv_p", "conv_y", "conv_l"]) ? "bad" : anyVal(["conv_p", "conv_y", "conv_l"]) ? "good" : null, "Норма: конверсия не падает");
    const ps = (id) => { const t = pfItem(P, id); return t ? t.status : null; };
    card("Трафик офлайн", fmt(R("traffic"), 0), trio("tr_p", "tr_y", "tr_l") + planLine(P, "traffic"), ps("traffic"), "Справочно");
    card("Средний чек", money(R("avg")), trio("avg_p", "avg_y", "avg_l") + planLine(P, "avg"), ps("avg"), "Справочно");
    for (const [title, cid, k, pp] of [["Аттач аксессуаров", "acc_att", "attach_min", ["acc_att_p", "acc_att_y"]], ["Доля услуг", "srv_sh", "srv_share_min", ["srv_sh_p", "srv_sh_y"]], ["ЧДУ", "chdu", "chdu_min", [null, null]]]) {
      const v = R(cid), nm = norms[k];
      if (v == null) continue;
      const gap = v < nm ? `<span class="gap">до нормы не хватает <b>${fmt(nm - v, 1)} п.п.</b></span>` : '<span class="gap ok">норма выполнена</span>';
      const dd = pp.map((id, i) => (id && R(id) != null ? `<span>${["к периоду", "к году"][i]} ${delta(R(id), " п.п.")}</span>` : "")).join("");
      card(title, `${fmt(v, 1)}%`, pctBar(v, nm) + gap + (dd ? `<div class="trio">${dd}</div>` : "") + planLine(P, cid), stNorm(v, nm), `Норма: не ниже ${fmt(nm, 1)}%`);
    }
    return `<div class="cards">${cards.join("")}</div>`;
  }
  function planFactBlock(P, isApp) {
    const pf = (P.planFact || []);
    if (!pf.length) return isApp ? '<div class="panel planhint">🎯 Планы на этот период не заданы. Нажмите <b>«Планы»</b> внизу, чтобы задать план по оборо­ту, конверсии, аттачу, услугам и другим показателям.</div>' : "";
    const pr = pf[0];
    const rows = pf.map((t) => {
      const pv = (v) => `${fmt(v, t.d)}${t.unit === "%" ? "%" : " " + t.unit}`;
      if (t.status === "na") return `<div class="pfr na"><div class="pfn"><b>${esc(t.label)}</b><small>план ${pv(t.plan)} · нет факта в выгрузке</small></div></div>`;
      const pct = pfPct(t), w = Math.max(0, Math.min(100, pct / 1.3));
      const sub = t.sum
        ? `факт ${pv(t.fact)} · план на дату ${pv(t.planDate)} · план периода ${pv(t.plan)} · прогноз ${fmt(t.pctFc, 0)}%` + (t.remaining > 0 && t.need > 0 ? ` · нужно ${pv(t.need)} в день` : "")
        : `факт ${pv(t.fact)} · план ${pv(t.plan)} · ${t.diff >= 0 ? "выше" : "ниже"} плана на ${fmt(Math.abs(t.diff), t.d)}${t.unit === "%" ? " п.п." : " " + t.unit}`;
      return `<div class="pfr ${t.status}"><div class="pfn"><b>${esc(t.label)}</b>${chip(t.status === "good" ? "good" : t.status === "warn" ? "warn" : "bad", fmt(pct, 0) + "%")}</div>` +
        `<div class="pbar sm"><div class="pfill ${t.status === "good" ? "good" : t.status === "warn" ? "warn" : "bad"}" style="width:${f1(w)}%"></div><div class="pnorm" style="left:${f1(100 / 1.3)}%"><span>100%</span></div></div><small>${esc(sub)}</small></div>`;
    }).join("");
    const dayTxt = P.period === "day" ? "" : ` · прошло ${pr.elapsed} из ${pr.total} дн.`;
    return `<section class="panel"><h3>План / факт</h3><p class="muted">Суммы (оборот, трафик, чеки…) сравниваются с планом на дату выгрузки${esc(dayTxt)}; проценты и средние — с планом напрямую. Зелёный — ≥ 100%, жёлтый — 95–100%, красный — ниже.</p><div class="pfl">${rows}</div></section>`;
  }
  function painGain(P) {
    const items = (lst, st) => (lst.length ? lst.map((f) => `<div class="pg ${st}"><i class="ic ${st}">${ICON[st]}</i><div><b>${esc(f.area)}</b><p>${esc(f.text)}</p></div></div>`).join("")
      : `<p class="muted">${st === "bad" ? "Проблем по нормам не найдено." : "Пока нечем похвалиться — смотрите план."}</p>`);
    return `<div class="two"><section class="panel"><h3>Где болит</h3>${items(P.findings.filter((f) => f.level === "Плохо"), "bad")}</section>` +
      `<section class="panel"><h3>Что хорошо</h3>${items(P.findings.filter((f) => f.level === "Хорошо"), "good")}</section></div>`;
  }
  function staffCounts(er) {          // «обе нормы» — доля комплектных чеков и доля услуг
    const k = (f) => f.fails.filter((c) => c === "compl" || c === "srv_sh").length;
    const both = er.n - er.flagged.filter((f) => k(f)).length;
    return [both, er.flagged.filter((f) => k(f) === 1).length, er.flagged.filter((f) => k(f) === 2).length];
  }
  function staffOverview(res, norms) {
    return `<p class="muted">Нормы продавца: доля комплектных чеков ≥ ${fmt(norms.compl_emp_min, 0)}%, доля услуг ≥ ${fmt(norms.srv_emp_min, 1)}%.</p>` + SHOW.map((p) => {
      const er = res.periods[p].emp;
      if (!er.n) return `<div class="so"><b>${PERIOD_RU[p]}</b><span class="muted">нет данных по сотрудникам</span></div>`;
      const [b, o, n] = staffCounts(er);
      return `<div class="so"><b>${PERIOD_RU[p]}</b><div>${segbar([["выполняют обе нормы", b, "good"], ["одну", o, "warn"], ["ни одной", n, "bad"]])}</div></div>`;
    }).join("");
  }

  // ---------------------------------------------------------------- «Магазин»
  function storeTable(P) {
    if (!P.has_store) return `<p class="muted">${esc(P.notes[0] || "Нет данных.")}</p>`;
    const M = P.metrics;
    const uc = (c) => (c.startsWith("Ед.") ? ' class="unit"' : "");
    const head = M.cols.map((c) => `<th${uc(c)}>${esc(c)}</th>`).join("");
    const rows = M.view.map((row, i) => "<tr>" + row.map((txt, j) => {
      const c = M.cols[j];
      if (c === "Статус") { const st = { "Плохо": "bad", "Хорошо": "good", "Внимание": "warn" }[txt]; return `<td>${st ? chip(st, txt) : ""}</td>`; }
      if (c === "Показатель") return `<th class="rl">${esc(txt)}</th>`;
      const cls = (M.bad.has(`${i}|${c}`) ? "c-bad" : M.warn.has(`${i}|${c}`) ? "c-warn" : "") + (c.startsWith("Ед.") ? " unit" : "");
      return `<td class="${cls}">${esc(txt)}</td>`;
    }).join("") + "</tr>").join("");
    const pills = P.kpi.map(([k, v]) => `<span class="pill"><small>${esc(k)}</small>${esc(v)}</span>`).join("");
    return `<div class="pills">${pills}</div><div class="tw"><table class="mt sticky1"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>` +
      '<p class="muted">Таблицу можно листать вбок. Красная ячейка — нарушение нормы, жёлтая — заметное снижение справочного показателя (больше 5%).</p>';
  }

  // ---------------------------------------------------------------- «Продавцы»
  const EMP_COLS = [["revenue", "Оборот", 0, " ₽"], ["avg", "Средний чек", 0, " ₽"], ["att", "Аттач АКС", 1, "%"], ["compl", "Компл. чеки", 1, "%"],
    ["cps", "Чеки в смену", 1, ""], ["upt", "ШтВЧ", 2, ""], ["acc_sh", "Доля АКС", 1, "%"], ["srv_sh", "Доля УСЛ", 1, "%"]];
  function staffBlock(P, norms) {
    const er = P.emp;
    if (!er.n) { const ex = P.notes.filter((n) => n.toLowerCase().includes("сотрудник")); return `<p class="muted">${esc(ex[0] || "Нет данных по сотрудникам за этот период.")}</p>`; }
    const e = er.e, has = (c) => e.length && c in e[0];
    const flags = {}; er.flagged.forEach((f) => (flags[f.name] = f));
    const todo = {}; P.actions.filter((a) => a.key.startsWith("emp:")).forEach((a) => (todo[a.who.replace(/^Сотрудник /, "")] = a.what));
    const cmin = norms.compl_emp_min, smin = norms.srv_emp_min;
    const [both, one, none] = staffCounts(er);
    const rowsFor = (col, nm) => [...e].sort((a, b) => (b[col] ?? -Infinity) - (a[col] ?? -Infinity)).map((r) => ({ label: r.name, v: num(r[col]), st: stNorm(num(r[col]), nm), tip: `${r.name}: ${fmt(r[col], 1)}% (норма ${fmt(nm, 1)}%)` }));
    const tot = has("revenue") ? e.reduce((s, r) => s + (r.revenue || 0), 0) : 0;
    const revRows = has("revenue") ? e.map((r) => ({ label: r.name, v: tot ? (r.revenue / tot) * 100 : null, st: "info", sub: money(num(r.revenue)), tip: `${r.name}: ${money(num(r.revenue))}` })) : [];
    const charts = `<div class="two"><section class="panel"><h3>Доля комплектных чеков</h3><p class="muted">Норма — не ниже ${fmt(cmin, 0)}%. Красные — ниже нормы.</p>${has("compl") ? hbars(rowsFor("compl", cmin), cmin) : '<p class="muted">Нет колонки.</p>'}</section>` +
      `<section class="panel"><h3>Доля услуг</h3><p class="muted">Норма — не ниже ${fmt(smin, 1)}%.</p>${has("srv_sh") ? hbars(rowsFor("srv_sh", smin), smin) : '<p class="muted">Нет колонки.</p>'}</section></div>`;
    const contrib = revRows.length ? `<section class="panel"><h3>Вклад в оборот магазина</h3><p class="muted">Доля каждого продавца в обороте за период.</p>${hbars(revRows, null, "%", 1)}</section>` : "";
    const cols = EMP_COLS.filter(([c]) => has(c));
    if (e.some((r) => r.srv_need != null)) cols.push(["srv_need", `Не хватает услуг до ${fmt(smin, 1)}%`, 0, " ₽"]);
    const mx = {}; cols.forEach(([c]) => (mx[c] = Math.max(0, ...e.map((r) => (isn(r[c]) ? r[c] : 0)))));
    const gradeOf = (r) => { const f = flags[r.name] || { fails: [], lows: [] }; return [f, f.fails.length ? "bad" : f.lows.length ? "warn" : "good"]; };
    const gradeTxt = { bad: "ниже нормы", warn: "хуже коллег", good: "в норме" };
    const head = "<th>Сотрудник</th>" + cols.map(([, t]) => `<th>${esc(t)}</th>`).join("") + "<th>Оценка</th><th>Что делать</th>";
    const body = e.map((r) => {
      const [f, g] = gradeOf(r);
      return `<tr><th class="rl">${esc(r.name)}</th>` + cols.map(([c, , d, u]) => {
        const v = num(r[c]), cls = c === "srv_need" ? (v > 0 ? "c-bad" : "") : f.fails.includes(c) ? "c-bad" : f.lows.includes(c) ? "c-warn" : "";
        const w = v != null && mx[c] > 0 ? (v / mx[c]) * 100 : 0;
        return `<td class="${cls}"><div class="cellv">${fmt(v, d)}${v != null ? esc(u) : ""}</div><div class="cbar"><div style="width:${Math.round(Math.max(0, Math.min(100, w)))}%"></div></div></td>`;
      }).join("") + `<td>${chip(g, gradeTxt[g])}</td><td class="todo">${esc(todo[r.name] || "Держать результат")}</td></tr>`;
    }).join("");
    const cards = e.map((r) => {
      const [f, g] = gradeOf(r);
      const cells = cols.map(([c, t, d, u]) => {
        const v = num(r[c]), cls = c === "srv_need" ? (v > 0 ? "c-bad" : "") : f.fails.includes(c) ? "c-bad" : f.lows.includes(c) ? "c-warn" : "";
        return `<div class="ec ${cls}"><small>${esc(t)}</small><b>${fmt(v, d)}${v != null ? esc(u) : ""}</b></div>`;
      }).join("");
      return `<article class="empcard ${g}"><div class="ech"><b>${esc(r.name)}</b>${chip(g, gradeTxt[g])}</div><div class="ecg">${cells}</div><p class="todo">${esc(todo[r.name] || "Держать результат")}</p></article>`;
    }).join("");
    const d = P.date_emp;
    const needN = e.filter((r) => r.srv_need > 0).length;
    const top = `<div class="pills"><span class="pill"><small>Сотрудников с продажами</small>${er.n}</span>${d ? `<span class="pill"><small>Выгрузка</small>${ru(d)}</span>` : ""}` +
      (er.srvNeedTotal != null && e.some((r) => r.srv_need != null) ? `<span class="pill"><small>Не хватает услуг до ${fmt(smin, 1)}%</small>${needN ? `${money(er.srvNeedTotal)} · ${needN} чел.` : "все в норме"}</span>` : "") + `</div>` +
      segbar([["выполняют обе нормы", both, "good"], ["одну", one, "warn"], ["ни одной", none, "bad"]]);
    const table = `<section class="panel"><h3>Профиль продавцов</h3><p class="muted">Красный — ниже нормы, жёлтый — ниже 80% медианы коллег. «Не хватает услуг» — сколько рублей услуг нужно добавить, чтобы доля услуг продавца достигла ${fmt(smin, 1)}%.</p>` +
      `<div class="wide-only"><div class="tw"><table class="mt emp"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>` +
      `<div class="narrow-only">${cards}</div></section>`;
    return top + charts + contrib + table;
  }

  // ---------------------------------------------------------------- «Проф. анализ»
  function factorBlock(P) {
    const R = (c) => rv(P, c), conv = R("conv"), out = [];
    for (const [title, rid, tid, cid, aid] of [["К прошлому периоду", "rev_p", "tr_p", "conv_p", "avg_p"], ["К прошлому году", "rev_y", "tr_y", "conv_y", "avg_y"], ["LfL к году", "rev_l", "tr_l", "conv_l", "avg_l"]]) {
      const rev = R(rid);
      if (rev == null) continue;
      const trv = R(tid), pp = R(cid), av = R(aid);
      let crel = null, other = null;
      if (conv != null && pp != null && conv - pp > 0) crel = (conv / (conv - pp) - 1) * 100;
      if (trv != null && crel != null && av != null) { const base = (1 + trv / 100) * (1 + crel / 100) * (1 + av / 100); if (base > 0) other = ((1 + rev / 100) / base - 1) * 100; }
      const items = [["Трафик", trv, "Сколько посетителей зашло"], ["Конверсия", crel, pp != null ? `Относительное изменение конверсии (${fmt(pp, 1, true)} п.п.)` : ""],
        ["Средний чек", av, "Сколько в среднем тратит покупатель"], ["Прочее", other, "Е-ком, маркетплейсы, B2B и округления"]];
      const known = items.slice(0, 3).filter((i) => i[1] != null);
      let text = "";
      if (known.length) {
        const worst = known.reduce((a, b) => (b[1] < a[1] ? b : a)), best = known.reduce((a, b) => (b[1] > a[1] ? b : a));
        text = `Оборот ${fmt(rev, 1, true)}%. `;
        if (worst[1] < 0) text += `Сильнее всего тянет вниз: ${worst[0].toLowerCase()} (${fmt(worst[1], 1, true)}%). `;
        if (best[1] > 0) text += `Помогает: ${best[0].toLowerCase()} (${fmt(best[1], 1, true)}%).`;
      }
      out.push(`<section class="panel"><h3>${esc(title)}</h3><p class="lead">${esc(text)}</p>${drivers(items, "Итого оборот", rev)}</section>`);
    }
    if (!out.length) return '<p class="muted">Нет данных о приросте оборота.</p>';
    return '<p class="muted">Оборот ≈ трафик × конверсия × средний чек. Зелёный вправо — помогает обороту, красный влево — тянет вниз.</p><div class="three">' + out.join("") + "</div>";
  }
  const BULLETS = [["Прирост оборота LfL", "rev_l", null, "%", 1], ["Прирост оборота к году", "rev_y", null, "%", 1], ["Эффективность розницы, год", "eff_y", 0, " п.п.", 1],
    ["Конверсия офлайн", "conv", null, "%", 1], ["Средний чек", "avg", null, " ₽", 0], ["Штуки в чеке", "upt", null, "", 2], ["Аттач аксессуаров", "acc_att", "attach_min", "%", 1],
    ["Доля АКС в обороте", "acc_sh", null, "%", 1], ["Доля услуг", "srv_sh", "srv_share_min", "%", 1], ["ЧДУ", "chdu", "chdu_min", "%", 1]];
  function positionBlock(P, norms) {
    const dist = P.dist || {}, rows = [];
    for (const [lab, cid, nk, unit, d] of BULLETS) {
      const st = dist[cid];
      if (!st) continue;
      const norm = typeof nk === "string" ? norms[nk] : nk;
      const status = norm != null ? stNorm(st.v, norm) : stMed(st.v, st);
      const label = { good: norm != null ? "норма" : "выше медианы", bad: "ниже нормы", warn: "ниже медианы" }[status];
      const a = st.asm;
      rows.push(`<div class="bu"><div class="bu-h"><b>${esc(lab)}</b><span class="bu-v">${esc(fmt(st.v, d) + unit)} ${label ? chip(status, label) : ""}</span></div>${bullet(st, norm, d, unit, status)}` +
        `<div class="bu-f">Место ${st.rank} из ${st.n} · лучше, чем ${fmt(st.better, 0)}% магазинов сети${norm != null ? ` · норма ${esc(fmt(norm, d) + unit)}` : ""}${a ? ` · у ASM место ${a.rank} из ${a.n} (медиана ${esc(fmt(a.med, d) + unit)})` : ""}</div></div>`);
    }
    if (!rows.length) return '<p class="muted">Нет данных для сравнения с сетью.</p>';
    return '<div class="legend"><span class="lg"><i class="sw b1"></i>80% магазинов</span><span class="lg"><i class="sw b2"></i>средние 50%</span><span class="lg"><i class="sw med"></i>медиана</span><span class="lg"><i class="sw nrm"></i>норма</span><span class="lg"><i class="sw dotl"></i>ваш магазин</span></div><div class="bus">' + rows.join("") + "</div>";
  }
  function potentialBlock(P, norms) {
    const R = (c) => rv(P, c), dist = P.dist || {}, rev = R("revenue");
    if (rev == null) return '<p class="muted">Нет данных.</p>';
    const peer = P.stores ? "медианы ASM" : "медианы сети";
    const items = [];
    const srv = R("srv_sh"), chdu = R("chdu");
    const s1 = srv != null ? (Math.max(0, norms.srv_share_min - srv) / 100) * rev : 0;
    const base = rev * (1 - (R("ecom") || 0) / 100 - (R("b2b") || 0) / 100);
    const s2 = chdu != null ? (Math.max(0, norms.chdu_min - chdu) / 100) * base : 0;
    if (Math.max(s1, s2) > 0) items.push({ label: "Услуги до нормы", v: Math.max(s1, s2), sub: `доля ${fmt(srv, 1)}% → ${fmt(norms.srv_share_min, 1)}%, ЧДУ ${fmt(chdu, 1)}% → ${fmt(norms.chdu_min, 1)}%`, tip: "Если выйти на норму по доле услуг и ЧДУ (берётся большее)" });
    const acc = R("acc_sh"), accd = dist.acc_sh;
    if (acc != null && accd && accd.q[2] > acc) items.push({ label: "Аксессуары до " + peer, v: ((accd.q[2] - acc) / 100) * rev, sub: `доля АКС ${fmt(acc, 1)}% → ${fmt(accd.q[2], 1)}%`, tip: "Если доля аксессуаров выйдет на медиану" });
    const conv = R("conv"), convd = dist.conv, trf = R("traffic"), avg = R("avg");
    if (conv != null && trf != null && avg != null && convd && convd.q[2] > conv) items.push({ label: "Конверсия до " + peer, v: (trf * (convd.q[2] - conv) / 100) * avg, sub: `${fmt(conv, 1)}% → ${fmt(convd.q[2], 1)}% при том же трафике`, tip: "Дополнительные чеки × средний чек" });
    const avgd = dist.avg, checks = R("checks");
    if (avg != null && checks != null && avgd) { const ref = (avgd.asm && avgd.asm.med) || avgd.q[2]; if (ref > avg) items.push({ label: "Средний чек до медианы ASM", v: checks * (ref - avg), sub: `${money(avg)} → ${money(ref)}`, tip: "Те же чеки с медианным средним чеком" }); }
    if (!items.length) return `<p class="good-note">✓ По основным показателям — на уровне нормы и ${peer} — явного недобора не видно.</p>`;
    items.sort((a, b) => b.v - a.v);
    const total = items.reduce((s, r) => s + r.v, 0);
    items.forEach((r) => (r.money = true));
    return `<div class="hero"><small>Оценка недополученного оборота за период</small><b>до ${money(total)}</b><span>≈ ${fmt((total / rev) * 100, 1)}% от текущего оборота</span></div>` +
      hbars(items, null, "", 0) + '<p class="muted">Это ориентир, а не точный расчёт: эффекты частично пересекаются.</p>';
  }
  function staffPotential(P, norms) {
    const er = P.emp;
    if (!er.n || !er.e.length || !("srv_sh" in er.e[0]) || !("revenue" in er.e[0])) return "";
    const nm = norms.srv_emp_min;
    const rows = er.e.filter((r) => isn(r.srv_sh) && r.revenue && r.srv_sh < nm).map((r) => ({ label: r.name, v: ((nm - r.srv_sh) / 100) * r.revenue, money: true, sub: `доля услуг ${fmt(r.srv_sh, 1)}% → ${fmt(nm, 1)}%`, tip: `${r.name}: оборот ${money(r.revenue)}` }));
    if (!rows.length) return '<section class="panel"><h3>Услуги по продавцам</h3><p class="good-note">✓ Все продавцы выполняют норму по доле услуг.</p></section>';
    rows.sort((a, b) => b.v - a.v);
    return `<section class="panel"><h3>Сколько услуг недобирает каждый продавец</h3><p class="muted">Если продавец выйдет на норму ${fmt(nm, 1)}% при своём обороте. Начинать с верхних строк.</p>${hbars(rows, null, "", 0)}</section>`;
  }
  function profBlock(P, norms, res) {
    const region = res && res.type === "region";
    if (!P.has_store) return `<p class="muted">${esc(P.notes[0] || "Нет данных.")}</p>` + (region ? "" : staffPotential(P, norms));
    const posTitle = region ? "Место среди ASM" : "Место магазина в сети";
    const posNote = region ? "Где регион среди всех ASM по каждому показателю." : "Где магазин среди всех работающих магазинов сети.";
    const pos = region && res.level === "total" ? '<p class="muted">Для всего региона сравнивать не с кем — смотрите сравнение ASM на вкладке «Магазины».</p>'
      : (Object.keys(P.dist || {}).length ? positionBlock(P, norms) : '<p class="muted">Для сравнения нужно минимум 3 ASM в выгрузке.</p>');
    let extra = region ? "" : staffPotential(P, norms);
    if (region && P.stores) {
      const svc = P.stores.filter((x) => x.srv_sh != null && x.srv_sh < norms.srv_share_min).map((x) => ({ label: x.code, sub: `доля услуг ${fmt(x.srv_sh, 1)}% → ${fmt(norms.srv_share_min, 1)}%`, v: ((norms.srv_share_min - x.srv_sh) / 100) * x.revenue, money: true }));
      svc.sort((a, b) => b.v - a.v);
      extra = svc.length ? `<section class="panel"><h3>Сколько услуг недобирает каждый магазин</h3><p class="muted">Если магазин выйдет на норму доли услуг при своём обороте.</p>${hbars(svc, null, "", 0)}</section>` : "";
    }
    return `<section class="panel"><h2>Из-за чего меняется оборот</h2>${factorBlock(P)}</section>` +
      `<div class="two wide-left"><section class="panel"><h2>${posTitle}</h2><p class="muted">${posNote}</p>${pos}</section>` +
      `<section class="panel"><h2>Где лежат деньги</h2>${potentialBlock(P, norms)}</section></div>` + extra;
  }

  // ---------------------------------------------------------------- регион: магазины
  function storesOverview(res) {
    return '<p class="muted">Сколько норм магазина не выполняет каждый магазин региона.</p>' + SHOW.map((p) => {
      const S = res.periods[p].stores || [];
      if (!S.length) return `<div class="so"><b>${PERIOD_RU[p]}</b><span class="muted">нет данных</span></div>`;
      const a = S.filter((x) => !x.nFail).length, b = S.filter((x) => x.nFail >= 1 && x.nFail <= 2).length, c = S.filter((x) => x.nFail >= 3).length;
      return `<div class="so"><b>${PERIOD_RU[p]}</b><div>${segbar([["все нормы", a, "good"], ["1–2 нарушения", b, "warn"], ["3 и больше", c, "bad"]])}</div></div>`;
    }).join("");
  }
  const GN = { rev: "Оборот", eff: "Эффективность", conv: "Конверсия", att: "Аттач", srv: "Доля услуг", chdu: "ЧДУ" };
  function storesBlock(P, res) {
    const S = P.stores || [];
    if (!S.length) return `<p class="muted">${esc(P.notes[0] || "Нет данных по магазинам.")}</p>`;
    const n = S.length;
    const fc = (P.failCounts || []).map((f) => ({ label: f.label[0].toUpperCase() + f.label.slice(1), v: f.n, st: f.n === 0 ? "good" : f.n / n >= 0.5 ? "bad" : "warn", tip: `${f.n} из ${n} магазинов` }));
    const decl = S.filter((x) => x.dY != null && x.dY < 0).sort((a, b) => a.dY - b.dY).slice(0, 8).map((x) => ({ label: x.code, sub: [x.city, x.tc].filter(Boolean).join(" · "), v: -x.dY, money: true, tip: `К году: ${fmt(x.rev_y, 1, true)}%` }));
    const grow = S.filter((x) => x.dY != null && x.dY > 0).sort((a, b) => b.dY - a.dY).slice(0, 8).map((x) => ({ label: x.code, sub: [x.city, x.tc].filter(Boolean).join(" · "), v: x.dY, money: true, tip: `К году: ${fmt(x.rev_y, 1, true)}%` }));
    const order = [...S].sort((a, b) => b.nFail - a.nFail || b.revenue - a.revenue);
    const cell = (v, d, u, bad) => `<td class="${bad ? "c-bad" : ""}">${fmt(v, d)}${v != null ? u : ""}</td>`;
    const head = "<th>Магазин</th><th>Оборот</th><th>Прирост LfL</th><th>Конверсия Δ</th><th>Аттач</th><th>Доля услуг</th><th>ЧДУ</th><th>Нарушения</th>";
    const body = order.map((x) => `<tr><th class="rl">${esc(x.code)}<small class="sub">${esc([x.city, x.tc].filter(Boolean).join(" · "))}</small></th>` +
      `<td>${money(x.revenue)}</td>${cell(x.rev_l, 1, "%", x.failGroups.includes("rev"))}${cell(x.convMin, 1, " п.п.", x.failGroups.includes("conv"))}` +
      `${cell(x.acc_att, 1, "%", x.failGroups.includes("att"))}${cell(x.srv_sh, 1, "%", x.failGroups.includes("srv"))}${cell(x.chdu, 1, "%", x.failGroups.includes("chdu"))}` +
      `<td>${x.nFail ? chip("bad", `${x.nFail} из ${x.nChecks}`) : chip("good", "нет")}</td></tr>`).join("");
    const cards = order.map((x) => `<article class="empcard ${x.nFail >= 3 ? "bad" : x.nFail ? "warn" : "good"}"><div class="ech"><b>${esc(x.code)} <small class="muted">${esc([x.city, x.tc].filter(Boolean).join(" · "))}</small></b>${x.nFail ? chip("bad", `нарушений ${x.nFail}`) : chip("good", "все нормы")}</div>` +
      `<div class="ecg"><div class="ec"><small>Оборот</small><b>${money(x.revenue)}</b></div><div class="ec ${x.failGroups.includes("rev") ? "c-bad" : ""}"><small>Прирост LfL</small><b>${fmt(x.rev_l, 1, true)}%</b></div>` +
      `<div class="ec ${x.failGroups.includes("att") ? "c-bad" : ""}"><small>Аттач</small><b>${fmt(x.acc_att, 1)}%</b></div><div class="ec ${x.failGroups.includes("srv") ? "c-bad" : ""}"><small>Доля услуг</small><b>${fmt(x.srv_sh, 1)}%</b></div>` +
      `<div class="ec ${x.failGroups.includes("chdu") ? "c-bad" : ""}"><small>ЧДУ</small><b>${fmt(x.chdu, 1)}%</b></div><div class="ec ${x.failGroups.includes("conv") ? "c-bad" : ""}"><small>Конверсия Δ</small><b>${fmt(x.convMin, 1, true)} п.п.</b></div></div>` +
      (x.failGroups.length ? `<p class="todo">Не в норме: ${esc(x.failGroups.map((g) => GN[g]).join(", "))}</p>` : "") + "</article>").join("");
    let asm = "";
    if (P.asmTable && P.asmTable.length) {
      const rows = P.asmTable.map((x) => `<tr><th class="rl">${esc(x.name)}</th><td>${money(x.revenue)}</td><td>${fmt(x.rev_l, 1, true)}%</td><td>${fmt(x.conv, 1)}%</td><td>${fmt(x.acc_att, 1)}%</td><td>${fmt(x.srv_sh, 1)}%</td><td>${fmt(x.chdu, 1)}%</td><td>${x.nFail ? chip("bad", `${x.nFail} из ${x.nChecks}`) : chip("good", "нет")}</td></tr>`).join("");
      asm = `<section class="panel"><h3>ASM: сравнение</h3><div class="tw"><table class="mt sticky1"><thead><tr><th>ASM</th><th>Оборот</th><th>Прирост LfL</th><th>Конверсия</th><th>Аттач</th><th>Доля услуг</th><th>ЧДУ</th><th>Нарушения норм</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    }
    return `<div class="pills"><span class="pill"><small>Работающих магазинов</small>${n}</span><span class="pill"><small>Выполняют все нормы</small>${S.filter((x) => !x.nFail).length}</span></div>` + asm +
      `<section class="panel"><h3>Сколько магазинов не выполняет норму</h3><p class="muted">Из ${n} работающих магазинов.</p>${hbars(fc, null, "", 0)}</section>` +
      `<div class="two"><section class="panel"><h3>Тянут оборот вниз (к году)</h3><p class="muted">На сколько рублей упал оборот к прошлому году.</p>${decl.length ? hbars(decl.map((r) => Object.assign(r, { st: "bad" })), null, "", 0) : '<p class="good-note">✓ Падающих к году магазинов нет.</p>'}</section>` +
      `<section class="panel"><h3>Дают рост (к году)</h3><p class="muted">На сколько рублей вырос оборот.</p>${grow.length ? hbars(grow, null, "", 0) : '<p class="muted">Растущих к году магазинов нет.</p>'}</section></div>` +
      `<section class="panel"><h3>Рейтинг магазинов</h3><p class="muted">Сверху — больше всего нарушений норм. Красная ячейка — показатель не в норме.</p>` +
      `<div class="wide-only"><div class="tw"><table class="mt sticky1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div><div class="narrow-only">${cards}</div></section>`;
  }

  // ---------------------------------------------------------------- «План дня»
  function dayPlanBlock(res) {
    const D = res.dayPlan;
    if (!D) return "";
    if (!D.ok) return `<p class="muted">${esc(D.reason || "Нет данных для плана дня.")}</p>`;
    const S = D.store;
    const pd = D.planDate ? D.planDate.split("-").reverse().join(".") : "—";
    const L = [];
    L.push(`<div class="dpl"><span>Оборот магазина за месяц (на дату)</span><b>${money(S.rev)}</b></div>`);
    L.push(`<div class="dpl"><span>Минус интернет-заказы (Е-ком ${fmt(S.ecom, 1)}%) и B2B (${fmt(S.b2b, 1)}%)</span><b>розница ${money(S.factRetail)}</b></div>`);
    if (S.mode === "plan") {
      L.push(`<div class="dpl"><span>План месяца ${money(S.planRev)} → розничная часть</span><b>${money(S.planRetail)}</b></div>`);
      L.push(`<div class="dpl"><span>Выполнено розницы</span><b>${fmt((S.factRetail / S.planRetail) * 100, 0)}%</b></div>`);
      L.push(`<div class="dpl hl"><span>Осталось ${money(Math.max(0, S.remRetail))} на ${S.remDays} дн.</span><b>${money(S.R)} в день</b></div>`);
    }
    L.push(`<div class="dpl"><span>Услуги: цель ЧДУ (${esc(S.tSsrc)})</span><b>${fmt(S.tS, 1)}% · сейчас ${fmt(S.chdu, 1)}%</b></div>`);
    if (S.tA != null) L.push(`<div class="dpl"><span>Аксессуары: цель доли АКС (${esc(S.tAsrc)})</span><b>${fmt(S.tA, 1)}% · сейчас ${fmt(S.accSh, 1)}%</b></div>`);
    const chips = D.sellers.map((x, i) => `<label class="dpc"><input type="checkbox" data-i="${i}" checked><span>${esc(x.name)}</span></label>`).join("");
    const json = JSON.stringify(D).replace(/</g, "\\u003c");
    return `<section class="panel"><h3>План на ${pd}</h3><p class="muted">Считается только розница — то, на что влияют продавцы: интернет-заказы и B2B вычитаются, услуги — по чистой доле услуг (ЧДУ).</p>${L.join("")}` +
      D.notes.map((n) => `<p class="warn-s">ℹ ${esc(n)}</p>`).join("") + `</section>` +
      `<section class="panel dp"><h3>Кто сегодня на смене</h3><p class="muted">Снимите галочки с тех, кого нет, — план пересчитается между остальными.</p><div class="dpcs">${chips}</div>` +
      `<script type="application/json" class="dp-json">${json}</script><div class="dp-out"></div></section>` +
      '<p class="muted">План делится пропорционально обычной выработке продавца за смену (средний чек × чеки в смену за месяц). Аксессуары и услуги — в той же доле от оборота, с догоном отставания магазина.</p>';
  }

  // ---------------------------------------------------------------- «План»
  function planBlock(res) {
    const plan = res.plan;
    if (!plan.length) return '<p class="muted">Действий нет.</p>';
    const region = res.type === "region";
    const kindOf = (r) => (region ? (String(r.key || "").startsWith("stores:") ? "emp" : "store") : r.who.startsWith("Сотрудник") ? "emp" : "store");
    const nStore = plan.filter((r) => kindOf(r) === "store").length;
    const cards = plan.map((r) => {
      const st = { "Высокий": "bad", "Средний": "warn", "Низкий": "info" }[r.prio] || "info";
      const kind = kindOf(r);
      const sys = r.where.includes("системная") ? '<span class="tag sys">системная</span>' : "";
      return `<article class="act ${st}" data-kind="${kind}"><div class="act-h"><span class="prio ${st}">${esc(r.prio)}</span><b>${esc(r.who)}</b>${sys}<span class="when">${esc(r.term)}</span></div>` +
        `<p class="what">${esc(r.what)}</p><details><summary>Почему и как проверить</summary><p>${esc(r.why)}</p><p><b>Где проявляется:</b> ${esc(r.where.replace(" — системная проблема", ""))}</p><p><b>Как проверить:</b> ${esc(r.kpi)}</p></details></article>`;
    }).join("");
    return `<div class="filters"><button class="fb on" data-f="all">Все (${plan.length})</button><button class="fb" data-f="store">${region ? "Регион" : "Магазин"} (${nStore})</button><button class="fb" data-f="emp">${region ? "Магазины" : "Продавцы"} (${plan.length - nStore})</button></div>` + cards;
  }

  // ---------------------------------------------------------------- сборка
  const pbuttons = () => SHOW.map((p) => `<button class="pb" data-p="${p}">${PERIOD_RU[p]}</button>`).join("");
  function build(res, opts) {
    if (res.type === "contest") return KPI.contest.build(res, CSS);
    opts = opts || {};
    const norms = res.norms, info = res.info || {}, code = res.code;
    const region = res.type === "region";
    const title = region ? `${res.name}` : [code, info["Город"], info["ТЦ"]].filter(Boolean).join(" · ");
    const meta = region ? (res.level === "asm" ? "Регион ASM · сравнение с другими ASM и рейтинг магазинов" : "Весь регион · сравнение ASM и рейтинг магазинов")
      : [["ASM", info["ASM"]], ["Формат", info["Формат"]], ["Статус", info["Статус"]]].filter((x) => x[1]).map(([k, v]) => `${k}: ${esc(v)}`).join(" · ");
    const dates = SHOW.map((p) => { const d = res.periods[p].date_kpi || res.periods[p].date_emp; return d ? `${PERIOD_RU[p].toLowerCase()} ${ru(d)}` : null; }).filter(Boolean);
    const def = SHOW.find((p) => res.periods[p].has_store || res.periods[p].emp.n) || "month";
    const per = (fn) => SHOW.map((p) => `<div class="per" data-p="${p}">${fn(res.periods[p])}</div>`).join("");
    let warn = res.warnings.map((w) => `<div class="banner">⚠ ${esc(w)}</div>`).join("");
    const st = String(info["Статус"] || "").toLowerCase();
    if (st && !st.startsWith("откр")) warn += `<div class="banner">⚠ Статус магазина в выгрузке: «${esc(info["Статус"])}».</div>`;
    const now = new Date();
    const stamp = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const body = `<div class="rep" data-period="${def}">
<header class="top"><div class="ttl"><h1>${esc(title)}</h1><p>${meta}</p><p class="muted">Выгрузки: ${esc(dates.join(", ") || "—")} · отчёт ${stamp}</p></div></header>
<nav class="tabs"><button class="tb on" data-t="main">Главное</button><button class="tb" data-t="store">${region ? "Показатели" : "Магазин"}</button><button class="tb" data-t="staff">${region ? "Магазины" : "Продавцы"}</button><button class="tb" data-t="prof">Проф. анализ</button>${region ? "" : '<button class="tb" data-t="day">План дня</button>'}<button class="tb" data-t="plan">План</button></nav>
<main>
<section class="tab on" data-tab="main">${warn}<h2>Выполнение норм ${region ? "региона" : "магазина"}</h2>${scoreTiles(res)}
<div class="two wide-left"><section class="panel"><h3>Светофор по периодам</h3>${normGrid(res)}</section><section class="panel"><h3>${region ? "Магазины: выполнение норм" : "Продавцы: выполнение норм"}</h3>${region ? storesOverview(res) : staffOverview(res, norms)}</section></div>
<div class="perbar"><span>Период:</span>${pbuttons()}</div>${per((P) => planFactBlock(P, opts.app) + kpiCards(P, norms) + painGain(P))}</section>
<section class="tab" data-tab="store"><div class="perbar"><span>Период:</span>${pbuttons()}</div>${per(storeTable)}</section>
<section class="tab" data-tab="staff"><div class="perbar"><span>Период:</span>${pbuttons()}</div>${per((P) => (region ? storesBlock(P, res) : staffBlock(P, norms)))}</section>
<section class="tab" data-tab="prof"><div class="perbar"><span>Период:</span>${pbuttons()}</div>${per((P) => profBlock(P, norms, res))}</section>
${region ? "" : `<section class="tab" data-tab="day"><h2>План на день для продавцов</h2>${dayPlanBlock(res)}</section>`}
<section class="tab" data-tab="plan"><h2>План действий</h2><p class="muted">Собран по всем трём периодам. «Системная» — повторяется и в дне, и в неделе, и в месяце: решать в первую очередь.</p>${planBlock(res)}</section>
</main><div class="tipbox" role="tooltip"></div></div>`;
    return { body, css: CSS, title: region ? `${res.name} — анализ региона` : `Магазин ${code} — анализ` };
  }

  function bind(root) {
    const rep = root.querySelector(".rep") || root;
    rep.querySelectorAll(".tb").forEach((t) => (t.onclick = () => {
      rep.querySelectorAll(".tb").forEach((x) => x.classList.toggle("on", x === t));
      rep.querySelectorAll(".tab").forEach((s) => s.classList.toggle("on", s.dataset.tab === t.dataset.t));
      t.scrollIntoView({ inline: "center", block: "nearest" });
      window.scrollTo(0, 0);
    }));
    rep.querySelectorAll(".pb").forEach((p) => (p.onclick = () => (rep.dataset.period = p.dataset.p)));
    rep.querySelectorAll(".plb").forEach((p) => (p.onclick = () => (rep.dataset.plan = p.dataset.p)));
    rep.querySelectorAll(".fb").forEach((f) => (f.onclick = () => {
      rep.querySelectorAll(".fb").forEach((x) => x.classList.toggle("on", x === f));
      rep.querySelectorAll(".act").forEach((a) => (a.style.display = f.dataset.f === "all" || a.dataset.kind === f.dataset.f ? "" : "none"));
    }));
    // ---- план дня: распределение по продавцам на смене
    rep.querySelectorAll(".dp").forEach((box) => {
      const D = JSON.parse(box.querySelector(".dp-json").textContent);
      const nf = (v, d) => (v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("ru-RU", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }));
      const rub = (v) => nf(v, 0) + " ₽";
      const key = "kpi_shift_" + D.code + "_" + (D.planDate || "");
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { saved = null; }
      const boxes = [...box.querySelectorAll(".dpc input")];
      if (saved) boxes.forEach((b) => (b.checked = saved.includes(D.sellers[+b.dataset.i].name)));
      const render = () => {
        const on = boxes.filter((b) => b.checked).map((b) => D.sellers[+b.dataset.i]);
        try { localStorage.setItem(key, JSON.stringify(on.map((x) => x.name))); } catch (e) { /* нет хранилища */ }
        const outEl = box.querySelector(".dp-out");
        if (!on.length) { outEl.innerHTML = '<p class="muted">Отметьте хотя бы одного продавца.</p>'; return; }
        const S = D.store, capSum = on.reduce((a, x) => a + x.cap, 0);
        const R = S.mode === "plan" && S.remRetail > 0 && S.remDays > 0 ? S.R : capSum;
        const A = Math.max(S.Acatch || 0, S.tA != null ? (R * S.tA) / 100 : 0);
        const Sv = Math.max(S.Scatch || 0, (R * S.tS) / 100);
        const stretch = capSum ? (R / capSum - 1) * 100 : 0;
        const aSh = R ? (A / R) * 100 : 0, sSh = R ? (Sv / R) * 100 : 0;
        let h = `<div class="dps"><div><small>Оборот смены</small><b>${rub(R)}</b></div><div><small>Аксессуары</small><b>${rub(A)}</b><span>${nf(aSh, 1)}% оборота</span></div>` +
          `<div><small>Услуги</small><b>${rub(Sv)}</b><span>${nf(sSh, 1)}% (ЧДУ)</span></div></div>`;
        if (S.mode === "plan" && S.remRetail > 0) h += stretch > 3
          ? `<p class="dpw bad">Чтобы выполнить месяц, смене нужно сделать на <b>${nf(stretch, 0)}%</b> больше обычной выработки (обычно ${rub(capSum)}).</p>`
          : `<p class="dpw good">План дня в пределах обычной выработки смены (${rub(capSum)}).</p>`;
        h += on.map((x) => {
          const r = capSum ? (R * x.cap) / capSum : 0, a = R ? (A * r) / R : 0, sv = R ? (Sv * r) / R : 0;
          const up = x.cap ? (r / x.cap - 1) * 100 : 0;
          const chk = x.avg ? r / x.avg : null;
          const accGap = x.accSh != null && aSh > x.accSh + 0.5, srvGap = x.srvSh != null && sSh > x.srvSh + 0.5;
          const dayTxt = x.day && x.day.revenue != null ? `<p class="dpd">Последний день в выгрузке: ${rub(x.day.revenue)} (${nf(r ? (x.day.revenue / r) * 100 : null, 0)}% от плана), АКС ${rub(x.day.acc)}, услуги ${rub(x.day.srv)}</p>` : "";
          return `<article class="empcard ${up > 10 || accGap || srvGap ? "warn" : "good"}"><div class="ech"><b>${x.name.replace(/</g, "&lt;")}</b><span class="muted">обычно ${rub(x.cap)} за смену${x.capGuess ? " (оценка)" : ""}</span></div>` +
            `<div class="ecg"><div class="ec"><small>Оборот</small><b>${rub(r)}</b><span class="${up > 3 ? "neg" : "pos"}">${up >= 0 ? "+" : ""}${nf(up, 0)}% к обычному</span></div>` +
            `<div class="ec"><small>Чеков ≈</small><b>${nf(chk, 0)}</b><span>обычно ${nf(x.cps, 1)} за смену</span></div>` +
            `<div class="ec ${accGap ? "c-warn" : ""}"><small>Аксессуары</small><b>${rub(a)}</b><span>нужно ${nf(aSh, 1)}% · у него ${nf(x.accSh, 1)}%</span></div>` +
            `<div class="ec ${srvGap ? "c-warn" : ""}"><small>Услуги</small><b>${rub(sv)}</b><span>нужно ${nf(sSh, 1)}% · у него ${nf(x.srvSh, 1)}%</span></div></div>${dayTxt}</article>`;
        }).join("");
        outEl.innerHTML = h;
      };
      boxes.forEach((b) => b.addEventListener("change", render));
      render();
    });
    const tipEl = rep.querySelector(".tipbox");
    const show = (el, x, y) => { tipEl.textContent = el.dataset.tip; tipEl.style.display = "block"; tipEl.style.left = Math.max(8, Math.min(x + 12, innerWidth - 300)) + "px"; tipEl.style.top = y + 14 + "px"; };
    rep.addEventListener("mousemove", (e) => { const el = e.target.closest("[data-tip]"); if (el) show(el, e.clientX, e.clientY); else tipEl.style.display = "none"; });
    rep.addEventListener("click", (e) => { const el = e.target.closest("[data-tip]"); if (el && matchMedia("(hover: none)").matches) { show(el, e.clientX, e.clientY); clearTimeout(rep._tt); rep._tt = setTimeout(() => (tipEl.style.display = "none"), 2500); } });
  }

  function standalone(res) {         // отдельный файл отчёта (чтобы сохранить или переслать)
    const r = build(res);
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.title)}</title><style>${r.css}</style></head><body>${r.body}<script>(${bind.toString()})(document);<\/script></body></html>`;
  }

  const CSS = `
.rep{--bg:#f4f5f7;--surface:#fcfcfb;--line:#e3e4e1;--text:#0b0b0b;--text2:#52514e;--muted:#7a7975;--good:#0ca30c;--warn:#fab219;--bad:#d03b3b;--info:#2a78d6;
--goodbg:#e7f6e7;--warnbg:#fff4d6;--badbg:#fbe7e7;--infobg:#e8f1fc;--b1:#e8e7e3;--b2:#cfcdc6;--money:#2a78d6;--accent:#1f3864;color-scheme:light;
background:var(--bg);color:var(--text);font:14px/1.45 "Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;min-height:100vh}
@media (prefers-color-scheme:dark){.rep{color-scheme:dark;--bg:#121211;--surface:#1a1a19;--line:#33332f;--text:#f0efec;--text2:#c3c2b7;--muted:#9a9890;--goodbg:#173317;--warnbg:#3a2f12;--badbg:#3d1d1d;--infobg:#172a44;--b1:#2b2b28;--b2:#45453f;--money:#3987e5;--accent:#9fb5e0}}
body{margin:0}.rep *{box-sizing:border-box}.rep h1{font-size:20px;margin:0 0 2px}.rep h2{font-size:17px;margin:20px 0 10px}.rep h3{font-size:15px;margin:0 0 8px}.rep p{margin:4px 0}
.rep .muted{color:var(--muted);font-size:12.5px}.rep .lead{color:var(--text2);margin-bottom:10px}
.top{background:var(--surface);padding:12px 16px 4px}.ttl p{color:var(--text2)}
.tabs{position:sticky;top:0;z-index:5;display:flex;gap:2px;padding:0 10px;background:var(--surface);border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}.tabs::-webkit-scrollbar{display:none}
.tb{border:0;background:none;padding:10px 12px;font:600 14px/1 inherit;font-family:inherit;color:var(--text2);border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap}
.tb.on{color:var(--text);border-color:var(--accent)}.rep main{padding:6px 16px 40px;max-width:1500px;margin:0 auto}
.tab{display:none}.tab.on{display:block}.per{display:none}
.rep[data-period=day] .per[data-p=day],.rep[data-period=week] .per[data-p=week],.rep[data-period=month] .per[data-p=month]{display:block}
.perbar{display:flex;align-items:center;gap:6px;margin:16px 0 10px;color:var(--text2);flex-wrap:wrap}
.pb,.fb{border:1px solid var(--line);background:var(--surface);color:var(--text);padding:7px 14px;border-radius:18px;cursor:pointer;font:600 13px/1 inherit;font-family:inherit}
.rep[data-period=day] .pb[data-p=day],.rep[data-period=week] .pb[data-p=week],.rep[data-period=month] .pb[data-p=month],.fb.on{background:var(--accent);color:var(--surface);border-color:var(--accent)}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:12px 0}.panel h2{margin-top:0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.two>.panel{margin:12px 0}.two.wide-left{grid-template-columns:1.25fr 1fr}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.three>.panel{margin:6px 0}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.tile{background:var(--surface);border:1px solid var(--line);border-left:6px solid var(--line);border-radius:12px;padding:12px 14px;display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:12px}
.tile b{grid-column:1/3;font-size:15px}.tile span{color:var(--text2)}.tile strong{color:var(--text);font-size:16px}.tile .big{font-size:28px;color:var(--muted)}
.tile.good{border-left-color:var(--good)}.tile.warn{border-left-color:var(--warn)}.tile.bad{border-left-color:var(--bad)}
.ring{width:66px;height:66px}.ring .rbg{fill:none;stroke:var(--b1);stroke-width:9}.ring .rfg{fill:none;stroke-width:9;stroke-linecap:round}
.ring .rfg.good{stroke:var(--good)}.ring .rfg.warn{stroke:var(--warn)}.ring .rfg.bad{stroke:var(--bad)}.ring text{font:700 17px system-ui,sans-serif;fill:var(--text)}
.chip{display:inline-flex;align-items:center;gap:5px;padding:2px 9px 2px 3px;border-radius:12px;font-size:12.5px;font-weight:600;white-space:nowrap;color:var(--text)}
.chip i{font-style:normal;width:18px;height:18px;border-radius:50%;display:inline-grid;place-items:center;color:#fff;font-size:11px}
.chip.good{background:var(--goodbg)}.chip.good i{background:var(--good)}.chip.bad{background:var(--badbg)}.chip.bad i{background:var(--bad)}
.chip.warn{background:var(--warnbg)}.chip.warn i{background:var(--warn);color:#000}.chip.na{background:var(--b1)}.chip.na i{background:var(--muted)}
.ic{font-style:normal;display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;color:#fff;font-size:11px;font-weight:700;flex:none}
.ic.good{background:var(--good)}.ic.bad{background:var(--bad)}.ic.warn{background:var(--warn);color:#000}
.rep table{border-collapse:separate;border-spacing:0;width:100%}.rep th,.rep td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:right;vertical-align:middle}
.rep thead th{font-size:12px;color:var(--text2);font-weight:600;background:var(--surface)}.rep th.rl,.rep thead th:first-child{text-align:left;font-weight:600}
.grid td{text-align:left}.grid td.na{color:var(--muted)}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch;background:var(--surface);border:1px solid var(--line);border-radius:12px}.panel .tw{border:0}
.sticky1 th.rl{position:sticky;left:0;background:var(--surface);z-index:1;min-width:140px}
.mt td{white-space:nowrap}td.c-bad,.ec.c-bad{background:var(--badbg);font-weight:600}td.c-warn,.ec.c-warn{background:var(--warnbg)}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px}.pill{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:6px 12px;font-weight:600}
.pill small{display:block;color:var(--muted);font-weight:400;font-size:11.5px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-bottom:6px}
.card{background:var(--surface);border:1px solid var(--line);border-top:4px solid var(--line);border-radius:12px;padding:12px 14px}
.card.good{border-top-color:var(--good)}.card.bad{border-top-color:var(--bad)}.card.warn{border-top-color:var(--warn)}
.ct{display:flex;justify-content:space-between;align-items:center;gap:8px;color:var(--text2);font-weight:600}.cv{font-size:26px;font-weight:700;margin:6px 0 4px}.cv small{font-size:12px;color:var(--muted);font-weight:400}
.trio{display:flex;flex-wrap:wrap;gap:4px 12px;color:var(--text2);font-size:12.5px;margin-top:4px}.dl{font-weight:700;white-space:nowrap}.dl.up{color:var(--good)}.dl.dn{color:var(--bad)}.dl.na{color:var(--muted)}
.gap{display:block;font-size:12.5px;color:var(--bad);margin-top:4px}.gap.ok{color:var(--good)}
.pbar{position:relative;height:10px;background:var(--b1);border-radius:5px;margin:22px 0 2px}.pfill{height:100%;border-radius:5px}.pfill.good{background:var(--good)}.pfill.bad{background:var(--bad)}
.pnorm{position:absolute;top:-6px;bottom:-6px;border-left:2px dashed var(--text)}.pnorm span{position:absolute;bottom:18px;left:-30px;font-size:11px;color:var(--text2);white-space:nowrap}
.pg{display:flex;gap:10px;padding:10px 12px;border-radius:10px;margin:8px 0}.pg.bad{background:var(--badbg)}.pg.good{background:var(--goodbg)}.pg p{color:var(--text2)}
.so{display:grid;grid-template-columns:64px 1fr;align-items:start;gap:10px;margin:12px 0}
.segbar{display:flex;height:22px;border-radius:6px;overflow:hidden;gap:2px}.seg{display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px;min-width:22px}
.seg.good{background:var(--good)}.seg.warn{background:var(--warn);color:#000}.seg.bad{background:var(--bad)}
.legend{display:flex;flex-wrap:wrap;gap:4px 14px;margin:6px 0;color:var(--text2);font-size:12.5px}.lg{display:inline-flex;align-items:center;gap:6px}
.sw{display:inline-block;width:12px;height:12px;border-radius:3px}.sw.good{background:var(--good)}.sw.warn{background:var(--warn)}.sw.bad{background:var(--bad)}
.sw.b1{background:var(--b1);border:1px solid var(--b2)}.sw.b2{background:var(--b2)}.sw.med{width:3px;height:14px;background:var(--text)}.sw.nrm{width:0;height:14px;border-left:2px dashed var(--bad)}.sw.dotl{border-radius:50%;background:var(--info)}
.hb{display:flex;flex-direction:column;gap:8px}.hb-legend{font-size:12px;color:var(--text2);display:flex;gap:6px;align-items:center}
.hb-row{display:grid;grid-template-columns:minmax(140px,240px) 1fr 110px;align-items:center;gap:10px;min-height:28px}
.hb-l{font-weight:600;line-height:1.2}.hb-l small{display:block;font-weight:400;color:var(--muted);font-size:11.5px}
.hb-t{position:relative;height:16px;background:var(--b1);border-radius:4px}.hb-b{height:100%;border-radius:0 4px 4px 0}
.hb-b.good{background:var(--good)}.hb-b.bad{background:var(--bad)}.hb-b.warn{background:var(--warn)}.hb-b.info,.hb-b.money{background:var(--money)}
.hb-n{position:absolute;top:-4px;bottom:-4px;border-left:2px dashed var(--text)}.hb-v{text-align:right;font-weight:700;white-space:nowrap;display:flex;justify-content:flex-end;gap:6px;align-items:center}
.drv{display:flex;flex-direction:column;gap:7px}.drv-row{display:grid;grid-template-columns:96px 1fr 84px;align-items:center;gap:8px}
.drv-row.tot{border-top:1px solid var(--line);padding-top:8px;font-weight:700}.drv-l{font-weight:600}.drv-t{position:relative;height:18px}
.drv-0{position:absolute;left:50%;top:-3px;bottom:-3px;border-left:2px solid var(--text2)}.drv-b{position:absolute;top:0;height:100%;border-radius:4px}
.drv-b.pos{background:var(--good)}.drv-b.neg{background:var(--bad)}.drv-v{text-align:right;font-weight:700;white-space:nowrap}.drv-v.pos{color:var(--good)}.drv-v.neg{color:var(--bad)}
.bus{display:flex;flex-direction:column;gap:14px}.bu-h{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.bu-v{font-weight:700;display:flex;gap:8px;align-items:center}
.bul{position:relative;height:46px;margin:4px 10px 0}.bul>div{position:absolute}
.bul .b1{top:12px;height:12px;border-radius:6px;background:var(--b1)}.bul .b2{top:12px;height:12px;border-radius:6px;background:var(--b2)}
.bul .med{top:6px;height:24px;width:3px;margin-left:-1.5px;background:var(--text);border-radius:2px}
.bul .nrm{top:0;height:36px;width:0;border-left:2px dashed var(--bad)}
.bul .dot{top:9px;width:18px;height:18px;margin-left:-9px;border-radius:50%;border:3px solid var(--surface);background:var(--info)}
.bul .dot.good{background:var(--good)}.bul .dot.bad{background:var(--bad)}.bul .dot.warn{background:var(--warn)}
.bul .ax{top:30px;transform:translateX(-50%);font-size:11.5px;color:var(--muted);white-space:nowrap}.bu-f{font-size:12px;color:var(--text2)}
.hero{background:var(--infobg);border-radius:12px;padding:14px 16px;margin-bottom:12px}.hero small{display:block;color:var(--text2)}.hero b{display:block;font-size:26px}.hero span{color:var(--text2)}
.good-note{background:var(--goodbg);padding:10px 12px;border-radius:10px}
.emp td{min-width:92px}.emp th.rl{min-width:190px}.cellv{font-weight:600;white-space:nowrap}.cbar{height:4px;background:var(--b1);border-radius:2px;margin-top:4px}.cbar div{height:100%;background:var(--money);border-radius:2px;opacity:.7}
td.todo{text-align:left;min-width:280px;color:var(--text2);font-size:12.5px}
.narrow-only{display:none}.empcard{border:1px solid var(--line);border-left:5px solid var(--line);border-radius:12px;padding:10px 12px;margin:10px 0}
.empcard.bad{border-left-color:var(--bad)}.empcard.warn{border-left-color:var(--warn)}.empcard.good{border-left-color:var(--good)}
.ech{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.ecg{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:8px 0}
.ec{background:var(--bg);border-radius:8px;padding:6px 8px}.ec small{display:block;color:var(--muted);font-size:11.5px}.ec b{font-size:15px}.empcard .todo{color:var(--text2);font-size:12.5px}
.filters{display:flex;gap:8px;margin:6px 0 12px;flex-wrap:wrap}
.act{background:var(--surface);border:1px solid var(--line);border-left:6px solid var(--info);border-radius:12px;padding:12px 14px;margin:10px 0}
.act.bad{border-left-color:var(--bad)}.act.warn{border-left-color:var(--warn)}.act-h{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.prio{font-size:12px;font-weight:700;padding:2px 10px;border-radius:10px}.prio.bad{background:var(--badbg)}.prio.warn{background:var(--warnbg)}.prio.info{background:var(--infobg)}
.tag.sys{font-size:12px;background:var(--bad);color:#fff;padding:2px 8px;border-radius:10px}.when{margin-left:auto;color:var(--text2);font-size:12.5px}
.what{font-size:14.5px;margin:8px 0 4px}.rep details summary{cursor:pointer;color:var(--info);font-size:13px;padding:4px 0}.rep details p{color:var(--text2);font-size:13px}
.tplan{display:block;font-size:12.5px;margin-top:2px}.tplan.good strong{color:var(--good)}.tplan.bad strong{color:var(--bad)}
.planl{margin-top:10px;padding-top:8px;border-top:1px dashed var(--line)}.planh{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--text2)}
.planl.good .planh b{color:var(--good)}.planl.bad .planh b{color:var(--bad)}.planl.warn .planh b{color:#b07800}.planl small{color:var(--muted);font-size:11.5px}
.pbar.sm{height:8px;margin:6px 0 4px}.pfill.warn{background:var(--warn)}.pbar.sm .pnorm{top:-4px;bottom:-4px}.pbar.sm .pnorm span{bottom:10px;left:-14px}
.pfl{display:flex;flex-direction:column;gap:14px;margin-top:8px}.pfr small{color:var(--text2);font-size:12px}.pfn{display:flex;justify-content:space-between;align-items:center;gap:8px}
.pfr .pbar.sm{margin-top:18px}.planhint{background:var(--infobg);border-color:transparent;font-size:13.5px}
.sub{display:block;font-weight:400;color:var(--muted);font-size:11.5px}
.dpl{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px dashed var(--line);font-size:13.5px}.dpl span{color:var(--text2)}.dpl b{white-space:nowrap;text-align:right}
.dpl.hl{background:var(--infobg);border-radius:8px;padding:9px 10px;border:0;margin-top:6px}.warn-s{font-size:12.5px;color:var(--text2);margin-top:8px}
.dpcs{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}.dpc{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:18px;padding:6px 12px;font-size:13px;cursor:pointer;background:var(--surface)}
.dpc input{accent-color:var(--accent)}.dps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0 10px}.dps>div{background:var(--infobg);border-radius:10px;padding:8px 10px}
.dps small{display:block;color:var(--text2);font-size:11.5px}.dps b{display:block;font-size:17px}.dps span{font-size:11.5px;color:var(--text2)}
.dpw{border-radius:10px;padding:8px 12px;font-size:13px;margin:6px 0 4px}.dpw.bad{background:var(--badbg)}.dpw.good{background:var(--goodbg)}
.ec span{display:block;font-size:11.5px;color:var(--text2)}.ec span.neg{color:var(--bad)}.ec span.pos{color:var(--good)}.dpd{font-size:12px;color:var(--text2);margin-top:4px}
@media (max-width:700px){.dps b{font-size:15px}}
.banner{background:var(--warnbg);border-radius:10px;padding:10px 14px;margin:12px 0}
.tipbox{position:fixed;pointer-events:none;background:var(--text);color:var(--surface);padding:6px 10px;border-radius:8px;font-size:12.5px;max-width:290px;display:none;z-index:20}
@media (max-width:1000px){.two,.two.wide-left,.three{grid-template-columns:1fr}}
@media (max-width:700px){.rep main{padding:4px 12px 40px}.top{padding:10px 12px 0}.rep h1{font-size:18px}.tiles{grid-template-columns:1fr;gap:8px}
.tile b,.tile span{grid-column:2}.tile .ring,.tile .big{grid-column:1;grid-row:1/3}
.hb-row{grid-template-columns:1fr auto;grid-template-areas:"l v" "t t";row-gap:4px}.hb-l{grid-area:l}.hb-v{grid-area:v}.hb-t{grid-area:t}
.wide-only{display:none}.narrow-only{display:block}.mt .unit{display:none}.cv{font-size:24px}.grid th,.grid td{padding:5px 3px}.grid th.rl{font-size:12.5px;min-width:96px}.grid thead th{text-align:left}.grid .chip{font-size:11.5px;padding:1px 6px 1px 2px;gap:3px}.grid .chip i{width:15px;height:15px;font-size:9px}}
@media print{.tabs{position:static}.tab{display:block!important}.perbar,.tabs,.filters{display:none}}
`;

  KPI.report = { build, bind, standalone };
})(typeof globalThis !== "undefined" ? globalThis : this);
