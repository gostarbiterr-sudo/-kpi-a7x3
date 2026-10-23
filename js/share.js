/* Картинки для мессенджеров: карточка магазина/региона (главное) и таблица KPI продавцов за выбранный период.
   Рисуется на холсте (canvas) прямо на устройстве — данные никуда не отправляются, пока вы сами не нажмёте «Отправить». */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const { PERIOD_RU } = KPI.loader;
  const { fmt, isn } = KPI.analysis;
  const ru = KPI.loader.ru;

  const C = { bg: "#f4f5f7", card: "#ffffff", line: "#e3e4e1", text: "#0b0b0b", text2: "#52514e", muted: "#7a7975", navy: "#1f3864",
    good: "#0ca30c", warn: "#fab219", bad: "#d03b3b", goodbg: "#e7f6e7", warnbg: "#fff4d6", badbg: "#fbe7e7", infobg: "#e8f1fc", blue: "#2a78d6", track: "#e8e7e3" };
  const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
  const font = (px, w) => `${w || 400} ${px}px ${FONT}`;
  const money = (v) => (v != null ? `${fmt(v, 0)} ₽` : "—");
  const num = (v) => (isn(v) ? v : null);
  const stColor = (st) => ({ good: C.good, warn: C.warn, bad: C.bad }[st] || C.line);
  const stBg = (st) => ({ good: C.goodbg, warn: C.warnbg, bad: C.badbg }[st] || C.card);

  // ---------------------------------------------------------------- примитивы
  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function rr(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }
  function text(ctx, s, x, y, px, w, color, align) {
    ctx.font = font(px, w); ctx.fillStyle = color || C.text; ctx.textAlign = align || "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(s, x, y);
  }
  function fit(ctx, s, maxW, px, w) {               // обрезать с многоточием
    ctx.font = font(px, w);
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
    return s + "…";
  }
  function wrap(ctx, s, maxW, px, w) {
    ctx.font = font(px, w);
    const words = String(s).split(/\s+/), lines = [];
    let cur = "";
    for (const wd of words) { const t = cur ? cur + " " + wd : wd; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; }
    if (cur) lines.push(cur);
    return lines;
  }
  function badge(ctx, x, y, st, size) {             // кружок со значком ✓ ✕ !
    const r = size / 2;
    ctx.beginPath(); ctx.arc(x + r, y + r, r, 0, Math.PI * 2); ctx.fillStyle = stColor(st); ctx.fill();
    ctx.strokeStyle = st === "warn" ? "#000" : "#fff"; ctx.lineWidth = size / 8; ctx.lineCap = "round";
    ctx.beginPath();
    if (st === "good") { ctx.moveTo(x + r * 0.55, y + r * 1.05); ctx.lineTo(x + r * 0.9, y + r * 1.4); ctx.lineTo(x + r * 1.5, y + r * 0.65); }
    else if (st === "bad") { ctx.moveTo(x + r * 0.62, y + r * 0.62); ctx.lineTo(x + r * 1.38, y + r * 1.38); ctx.moveTo(x + r * 1.38, y + r * 0.62); ctx.lineTo(x + r * 0.62, y + r * 1.38); }
    else { ctx.moveTo(x + r, y + r * 0.5); ctx.lineTo(x + r, y + r * 1.1); ctx.moveTo(x + r, y + r * 1.45); ctx.lineTo(x + r, y + r * 1.47); }
    ctx.stroke();
  }
  const deltaTxt = (v, unit) => (v == null ? null : `${v >= 0 ? "▲" : "▼"} ${fmt(v, 1, true)}${unit}`);
  function nowStamp() { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }

  function header(ctx, W, title, sub, right) {
    ctx.fillStyle = C.navy; ctx.fillRect(0, 0, W, 168);
    text(ctx, fit(ctx, title, W - 96 - (right ? 300 : 0), 40, 700), 48, 72, 40, 700, "#fff");
    text(ctx, sub, 48, 122, 28, 400, "#c9d4ea");
    if (right) {
      ctx.font = font(28, 700);
      const w = ctx.measureText(right.text).width + 92;
      rr(ctx, W - 48 - w, 52, w, 64, 32, "#fff");
      badge(ctx, W - 48 - w + 16, 66, right.st, 36);
      text(ctx, right.text, W - 48 - 22, 95, 28, 700, C.text, "right");
    }
  }
  function footer(ctx, W, y) {
    text(ctx, `Анализ KPI · сформировано ${nowStamp()} · данные обработаны на устройстве`, W / 2, y, 22, 400, C.muted, "center");
  }

  // ---------------------------------------------------------------- карточка магазина / региона
  function storeCard(res, p) {
    const P = res.periods[p], norms = res.norms, R = (c) => num((P.row || {})[c]);
    const W = 1080, PAD = 48, GAP = 20, CW = (W - PAD * 2 - GAP) / 2, CH = 182;
    const region = res.type === "region", info = res.info || {};
    const title = region ? res.name : [res.code, info["Город"], info["ТЦ"]].filter(Boolean).join(" · ");
    const d = P.date_kpi || P.date_emp;
    const sub = `${PERIOD_RU[p]}${d ? " · выгрузка " + ru(d) : ""}${region ? (res.level === "asm" ? " · ASM" : " · весь регион") : ""}`;
    if (!P.has_store) {
      const c = canvas(W, 420), ctx = c.getContext("2d");
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, 420); header(ctx, W, title, sub);
      wrap(ctx, P.notes[0] || "Нет данных за этот период.", W - PAD * 2, 30).forEach((l, i) => text(ctx, l, PAD, 250 + i * 40, 30, 400, C.text2));
      footer(ctx, W, 395); return c;
    }
    // карточки показателей
    const anyNeg = (ids) => ids.map(R).some((x) => x != null && x < 0);
    const tri = (a, b, c, u) => [["к периоду", R(a)], ["к году", R(b)], ["LfL", R(c)]].filter((x) => x[1] != null).map(([l, v]) => [l, v, u]);
    const cards = [];
    cards.push({ t: "Оборот", v: money(R("revenue")), d: tri("rev_p", "rev_y", "rev_l", "%"), st: anyNeg(["rev_p", "rev_y", "rev_l"]) ? "bad" : "good" });
    cards.push({ t: "Конверсия офлайн", v: `${fmt(R("conv"), 1)}%`, d: tri("conv_p", "conv_y", "conv_l", " п.п."), st: anyNeg(["conv_p", "conv_y", "conv_l"]) ? "bad" : "good" });
    cards.push({ t: "Средний чек", v: money(R("avg")), d: tri("avg_p", "avg_y", "avg_l", "%"), st: null });
    cards.push({ t: "Трафик офлайн", v: fmt(R("traffic"), 0), d: tri("tr_p", "tr_y", "tr_l", "%"), st: null });
    for (const [t, cid, k] of [["Аттач аксессуаров", "acc_att", "attach_min"], ["Доля услуг", "srv_sh", "srv_share_min"], ["ЧДУ", "chdu", "chdu_min"]]) {
      const v = R(cid);
      if (v != null) cards.push({ t, v: `${fmt(v, 1)}%`, note: `норма ${fmt(norms[k], 1)}%${v < norms[k] ? ` · не хватает ${fmt(norms[k] - v, 1)} п.п.` : ""}`, st: v >= norms[k] ? "good" : "bad" });
    }
    const ev = ["eff_p", "eff_y", "eff_l"].map(R).filter((x) => x != null);
    if (ev.length) cards.push({ t: "Эффективность", v: `${fmt(Math.min(...ev), 1, true)} п.п.`, note: "худшая из период / год / LfL", st: Math.min(...ev) >= 0 ? "good" : "bad" });
    // план
    const pf = (P.planFact || []).filter((t) => t.status !== "na");
    // главное
    const fails = P.checks.filter((c) => !c.ok);
    const groups = [];
    fails.forEach((c) => { if (!groups.some((g) => g.group === c.group)) groups.push(c); });
    const okGroups = [...new Set(P.checks.map((c) => c.group))].filter((g) => !fails.some((c) => c.group === g));
    const GN = KPI.analysis.GROUP_NAME;
    const main = groups.slice(0, 5).map((c) => ({ st: "bad", s: `${c.label.replace(" (худший из периода/года/LfL)", "")}: ${c.text}` }));
    if (!pf.length) { /* план не задан — в «Главном» только нормы */ }
    if (okGroups.length) main.push({ st: "good", s: "В норме: " + okGroups.map((g) => GN[g]).join(", ") });
    if (region && P.failCounts) {
      const worst = P.failCounts.filter((f) => f.n).sort((a, b) => b.n - a.n)[0];
      if (worst) main.push({ st: "bad", s: `Магазины: ${worst.label} — ${worst.n} из ${worst.total}` });
    }
    // высота
    const rows = Math.ceil(cards.length / 2);
    let H = 168 + 36 + rows * (CH + GAP) + 10;
    if (pf.length) H += 70 + pf.length * 92;
    const tmp = canvas(10, 10).getContext("2d");
    const mainLines = main.map((m) => wrap(tmp, m.s, W - PAD * 2 - 70, 28));
    H += 70 + mainLines.reduce((a, l) => a + l.length * 38 + 16, 0) + 70;
    const c = canvas(W, H), ctx = c.getContext("2d");
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const ok = P.checks.filter((x) => x.ok).length;
    header(ctx, W, title, sub, P.checks.length ? { text: `норм ${ok} из ${P.checks.length}`, st: ok === P.checks.length ? "good" : ok / P.checks.length >= 0.6 ? "warn" : "bad" } : null);
    let y = 168 + 36;
    cards.forEach((k, i) => {
      const x = PAD + (i % 2) * (CW + GAP), yy = y + Math.floor(i / 2) * (CH + GAP);
      rr(ctx, x, yy, CW, CH, 18, C.card);
      ctx.fillStyle = stColor(k.st); ctx.fillRect(x, yy + 14, 8, CH - 28);
      text(ctx, k.t, x + 30, yy + 44, 26, 600, C.text2);
      if (k.st) badge(ctx, x + CW - 52, yy + 18, k.st, 32);
      text(ctx, fit(ctx, k.v, CW - 60, 44, 700), x + 30, yy + 96, 44, 700);
      if (k.d && k.d.length) {
        const colW = (CW - 60) / 3;
        k.d.forEach(([l, v, u], j) => {
          const xx = x + 30 + j * colW;
          text(ctx, l, xx, yy + 136, 21, 400, C.muted);
          text(ctx, fit(ctx, deltaTxt(v, u), colW - 4, 22, 700), xx, yy + 165, 22, 700, v >= 0 ? C.good : C.bad);
        });
      } else if (k.note) wrap(ctx, k.note, CW - 60, 22).slice(0, 2).forEach((l, j) => text(ctx, l, x + 30, yy + 146 + j * 28, 22, 400, k.st === "bad" ? C.bad : C.muted));
    });
    y += rows * (CH + GAP) + 10;
    if (pf.length) {
      text(ctx, "План / факт", PAD, y + 44, 30, 700); y += 70;
      pf.forEach((t) => {
        const pct = t.sum ? t.pctDate : t.pct, st = t.status === "good" ? "good" : t.status === "warn" ? "warn" : "bad";
        rr(ctx, PAD, y, W - PAD * 2, 80, 14, C.card);
        text(ctx, t.label, PAD + 22, y + 34, 26, 600);
        text(ctx, `${fmt(pct, 0)}%`, W - PAD - 22, y + 36, 30, 700, stColor(st), "right");
        const sub2 = t.sum ? `факт ${money(t.fact)} · план на дату ${money(t.planDate)} · прогноз ${fmt(t.pctFc, 0)}%` : `факт ${fmt(t.fact, t.d)} · план ${fmt(t.plan, t.d)}`;
        text(ctx, fit(ctx, sub2, W - PAD * 2 - 330, 21), PAD + 22, y + 66, 21, 400, C.muted);
        const bx = W - PAD - 300, bw = 210;
        rr(ctx, bx, y + 54, bw, 12, 6, C.track); rr(ctx, bx, y + 54, Math.max(6, Math.min(bw, (bw * pct) / 130)), 12, 6, stColor(st));
        ctx.fillStyle = C.text; ctx.fillRect(bx + bw / 1.3, y + 48, 2, 24);
        y += 92;
      });
    }
    text(ctx, "Главное", PAD, y + 44, 30, 700); y += 70;
    main.forEach((m, i) => {
      badge(ctx, PAD, y + 2, m.st, 34);
      mainLines[i].forEach((l, j) => text(ctx, l, PAD + 54, y + 28 + j * 38, 28, 400, C.text));
      y += mainLines[i].length * 38 + 16;
    });
    footer(ctx, W, H - 28);
    return c;
  }

  // ---------------------------------------------------------------- условное форматирование (как цветовая шкала в Excel)
  // t: 0 — красный, 0.5 — жёлтый, 1 — зелёный (пастельные, чтобы читался текст)
  const RED = [244, 166, 166], YEL = [255, 230, 153], GRN = [150, 212, 150];
  const clamp = (x) => Math.max(0, Math.min(1, x));
  function scaleColor(t) {
    t = clamp(t);
    const [a, b, k] = t < 0.5 ? [RED, YEL, t / 0.5] : [YEL, GRN, (t - 0.5) / 0.5];
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;
  }
  // правило раскраски для колонки: {norm} — ниже нормы красно-жёлтое, выше — зелёное; иначе шкала от худшего к лучшему
  function colorer(values, rule) {
    const vs = values.filter((v) => v != null);
    if (!vs.length) return () => null;
    const mn = Math.min(...vs), mx = Math.max(...vs);
    const srt = [...vs].sort((a, b) => a - b), med = srt[Math.floor(srt.length / 2)];
    if (rule && rule.norm != null) {
      const n = rule.norm, lo = Math.min(mn, n), hi = Math.max(mx, n);
      return (v) => {
        if (v == null) return null;
        if (v < n) return scaleColor(n - lo > 0 ? 0.45 * ((v - lo) / (n - lo)) : 0);
        return scaleColor(0.65 + 0.35 * (hi - n > 0 ? (v - n) / (hi - n) : 1));
      };
    }
    if (rule && rule.lowerBetter) return (v) => (v == null ? null : v <= 0 ? scaleColor(1) : scaleColor(mx > 0 ? 0.45 * (1 - v / mx) : 1));
    if (vs.length < 2 || mx === mn) return () => null;
    return (v) => {
      if (v == null) return null;
      const t = v <= med ? (med > mn ? 0.5 * ((v - mn) / (med - mn)) : 0.5) : mx > med ? 0.5 + 0.5 * ((v - med) / (mx - med)) : 0.5;
      return scaleColor(t);
    };
  }
  function legend(ctx, x, y) {
    const w = 220, h = 22;
    for (let i = 0; i < w; i++) { ctx.fillStyle = scaleColor(i / (w - 1)); ctx.fillRect(x + i, y, 1, h); }
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    text(ctx, "хуже", x - 10, y + 18, 21, 400, C.text2, "right");
    text(ctx, "лучше", x + w + 10, y + 18, 21, 400, C.text2);
  }
  function tableHead(ctx, W, PAD, y, HEADH) {
    ctx.fillStyle = C.navy; ctx.beginPath(); ctx.moveTo(PAD + 16, y); ctx.lineTo(W - PAD - 16, y); ctx.arcTo(W - PAD, y, W - PAD, y + 16, 16); ctx.lineTo(W - PAD, y + HEADH); ctx.lineTo(PAD, y + HEADH); ctx.lineTo(PAD, y + 16); ctx.arcTo(PAD, y, PAD + 16, y, 16); ctx.fill();
  }
  function headCell(ctx, t, xr, y) {
    const ls = t.split("|");
    ls.forEach((l, j) => text(ctx, l, xr, y + (ls.length === 1 ? 56 : ls.length === 2 ? 42 + j * 28 : 30 + j * 26), 21, 700, "#fff", "right"));
  }

  // ---------------------------------------------------------------- таблица продавцов
  function staffCard(res, p) {
    const P = res.periods[p], er = P.emp, norms = res.norms, info = res.info || {};
    const title = [res.code, info["Город"], info["ТЦ"]].filter(Boolean).join(" · ") + " — продавцы";
    const d = P.date_emp || P.date_kpi;
    const sub = `${PERIOD_RU[p]}${d ? " · выгрузка " + ru(d) : ""}`;
    const PAD = 40;
    if (!er.n) {
      const W = 1080, c = canvas(W, 400), ctx = c.getContext("2d");
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, 400); header(ctx, W, title, sub);
      text(ctx, "Нет данных по продавцам этого магазина за период.", PAD + 8, 260, 30, 400, C.text2); footer(ctx, W, 375); return c;
    }
    const e = er.e, sm = norms.srv_emp_min;
    const nz = (v) => (v > 0 ? v : null);
    // [поле, заголовок, знаков, единица, ширина, правило раскраски]
    const cols = [["revenue", "Оборот", 0, " ₽", 170, {}], ["avg", "Средний|чек", 0, " ₽", 130, {}],
      ["att", "Аттач|АКС", 1, "%", 112, { norm: nz(norms.att_emp_min) }], ["compl", "Компл.|чеки", 1, "%", 112, { norm: nz(norms.compl_emp_min) }],
      ["cps", "Чеков|в смену", 1, "", 118, { norm: nz(norms.cps_emp_min) }], ["upt", "Штук|в чеке", 2, "", 104, {}],
      ["acc_sh", "Доля|АКС", 1, "%", 104, {}], ["srv_sh", "Доля|услуг", 1, "%", 104, { norm: nz(sm) }],
      ["srv_need", `Не хватает|услуг до|${fmt(sm, 1)}%`, 0, " ₽", 150, { lowerBetter: true }]]
      .filter(([cid]) => e.some((r) => num(r[cid]) != null));
    const col = {}; cols.forEach(([cid, , , , , rule]) => (col[cid] = colorer(e.map((r) => num(r[cid])), rule)));
    const NAMEW = 400;
    const W = PAD * 2 + 44 + NAMEW + cols.reduce((a, c) => a + c[4], 0) + 16;
    const RH = 62, HEADH = 100;
    const needN = e.filter((r) => r.srv_need > 0).length;
    const H = 168 + 150 + HEADH + e.length * RH + 110;
    const c = canvas(W, H), ctx = c.getContext("2d");
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    header(ctx, W, title, sub);
    let y = 168 + 30;
    const nrm = [`доля услуг ≥ ${fmt(sm, 1)}%`, `компл. чеки ≥ ${fmt(norms.compl_emp_min, 0)}%`];
    if (norms.att_emp_min > 0) nrm.push(`аттач АКС ≥ ${fmt(norms.att_emp_min, 0)}%`);
    if (norms.cps_emp_min > 0) nrm.push(`чеков в смену ≥ ${fmt(norms.cps_emp_min, 1)}`);
    text(ctx, fit(ctx, `Нормы продавца: ${nrm.join(", ")}`, W - PAD * 2, 25, 600), PAD + 4, y + 30, 25, 600, C.text2);
    if (er.srvNeedTotal != null && e.some((r) => r.srv_need != null))
      text(ctx, fit(ctx, needN ? `Не хватает услуг до ${fmt(sm, 1)}%: всего ${money(er.srvNeedTotal)} у ${needN} из ${er.n} продавцов` : `Доля услуг ${fmt(sm, 1)}% выполнена у всех продавцов`, W - PAD * 2, 25, 700), PAD + 4, y + 70, 25, 700, needN ? C.bad : C.good);
    legend(ctx, PAD + 70, y + 92);
    text(ctx, "колонки с нормой: красное — ниже нормы, зелёное — норма выполнена", PAD + 380, y + 110, 21, 400, C.muted);
    y += 150;
    rr(ctx, PAD, y, W - PAD * 2, HEADH + e.length * RH, 16, C.card);
    tableHead(ctx, W, PAD, y, HEADH);
    let x = PAD + 44;
    text(ctx, "№", PAD + 22, y + 56, 22, 700, "#fff", "center");
    text(ctx, "Сотрудник", x + 12, y + 56, 23, 700, "#fff");
    x += NAMEW;
    cols.forEach(([, t, , , w]) => { headCell(ctx, t, x + w - 12, y); x += w; });
    y += HEADH;
    e.forEach((r, i) => {
      let xx = PAD + 44;
      text(ctx, String(i + 1), PAD + 22, y + 40, 22, 400, C.muted, "center");
      text(ctx, fit(ctx, r.name, NAMEW - 24, 25, 600), xx + 12, y + 40, 25, 600);
      xx += NAMEW;
      cols.forEach(([cid, , dd, u, w]) => {
        const v = num(r[cid]);
        const bg = col[cid](v);
        if (bg) { ctx.fillStyle = bg; ctx.fillRect(xx + 2, y + 3, w - 4, RH - 6); }
        const t = v == null ? "—" : cid === "srv_need" ? (v > 0 ? `+${fmt(v, 0)} ₽` : "норма") : fmt(v, dd) + u;
        text(ctx, t, xx + w - 12, y + 40, 24, 400, C.text, "right");
        xx += w;
      });
      ctx.fillStyle = C.line; ctx.fillRect(PAD, y + RH - 1, W - PAD * 2, 1);
      y += RH;
    });
    footer(ctx, W, H - 28);
    return c;
  }

  // ---------------------------------------------------------------- таблица магазинов региона
  function storesCard(res, p) {
    const P = res.periods[p], norms = res.norms, S = (P.stores || []).slice();
    const title = `${res.name} — магазины`;
    const d = P.date_kpi;
    const sub = `${PERIOD_RU[p]}${d ? " · выгрузка " + ru(d) : ""}${res.level === "asm" ? " · ASM" : " · весь регион"}`;
    const PAD = 40;
    if (!S.length) {
      const W = 1080, c = canvas(W, 400), ctx = c.getContext("2d");
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, 400); header(ctx, W, title, sub);
      text(ctx, "Нет данных по магазинам региона за период.", PAD + 8, 260, 30, 400, C.text2); footer(ctx, W, 375); return c;
    }
    const showAsm = res.level === "total" && S.some((x) => x.asm);
    if (showAsm) S.sort((a, b) => String(a.asm).localeCompare(String(b.asm), "ru") || (b.revenue || 0) - (a.revenue || 0));
    else S.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
    // [поле, заголовок, знаков, единица, ширина, знак ±, правило раскраски]
    const Z = { norm: 0 };
    const cols = [["revenue", "Оборот", 0, " ₽", 170, false, {}], ["rev_p", "Оборот|к периоду", 1, "%", 122, true, Z], ["rev_y", "Оборот|к году", 1, "%", 112, true, Z],
      ["rev_l", "Оборот|LfL", 1, "%", 104, true, Z], ["conv", "Конвер-|сия", 1, "%", 102, false, {}], ["convMin", "Конверсия|прирост*", 1, " пп", 126, true, Z],
      ["effMin", "Эффек-|тивность*", 1, " пп", 126, true, Z], ["acc_att", "Аттач|АКС", 1, "%", 104, false, { norm: norms.attach_min }],
      ["srv_sh", "Доля|услуг", 1, "%", 100, false, { norm: norms.srv_share_min }], ["chdu", "ЧДУ", 1, "%", 92, false, { norm: norms.chdu_min }]]
      .filter(([cid]) => S.some((x) => x[cid] != null));
    const col = {}; cols.forEach(([cid, , , , , , rule]) => (col[cid] = colorer(S.map((r) => num(r[cid])), rule)));
    const NAMEW = 300, ASMW = showAsm ? 190 : 0;
    const W = PAD * 2 + 44 + NAMEW + ASMW + cols.reduce((a, c) => a + c[4], 0) + 16;
    const RH = 58, HEADH = 92;
    const worst = (P.failCounts || []).filter((f) => f.n).sort((a, b) => b.n - a.n).slice(0, 4);
    const H = 168 + 150 + HEADH + S.length * RH + 110;
    const c = canvas(W, H), ctx = c.getContext("2d");
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    header(ctx, W, title, sub);
    let y = 168 + 30;
    text(ctx, fit(ctx, worst.length ? "Чаще всего: " + worst.map((f) => `${f.label} — ${f.n} из ${f.total}`).join(" · ") : "Нарушений норм нет", W - PAD * 2, 25, 600), PAD + 4, y + 30, 25, 600, C.text2);
    text(ctx, fit(ctx, `Нормы: конверсия и эффективность не ниже 0, оборот растёт, аттач ≥ ${fmt(norms.attach_min, 0)}%, доля услуг ≥ ${fmt(norms.srv_share_min, 1)}%, ЧДУ ≥ ${fmt(norms.chdu_min, 0)}%`, W - PAD * 2, 22), PAD + 4, y + 68, 22, 400, C.muted);
    legend(ctx, PAD + 70, y + 92);
    text(ctx, "* худший из период / год / LfL", PAD + 380, y + 110, 21, 400, C.muted);
    y += 150;
    rr(ctx, PAD, y, W - PAD * 2, HEADH + S.length * RH, 16, C.card);
    tableHead(ctx, W, PAD, y, HEADH);
    let x = PAD + 44;
    text(ctx, "№", PAD + 22, y + 56, 22, 700, "#fff", "center");
    text(ctx, "Магазин", x + 12, y + 56, 23, 700, "#fff"); x += NAMEW;
    if (showAsm) { text(ctx, "ASM", x + 12, y + 56, 23, 700, "#fff"); x += ASMW; }
    cols.forEach(([, t, , , w]) => { headCell(ctx, t, x + w - 12, y); x += w; });
    y += HEADH;
    S.forEach((r, i) => {
      let xx = PAD + 44;
      text(ctx, String(i + 1), PAD + 22, y + 38, 21, 400, C.muted, "center");
      text(ctx, fit(ctx, [r.code, r.city].filter(Boolean).join(" · "), NAMEW - 24, 24, 600), xx + 12, y + 38, 24, 600); xx += NAMEW;
      if (showAsm) { text(ctx, fit(ctx, r.asm || "—", ASMW - 20, 21, 400), xx + 12, y + 38, 21, 400, C.text2); xx += ASMW; }
      cols.forEach(([cid, , dd, u, w, signed]) => {
        const v = num(r[cid]), bg = col[cid](v);
        if (bg) { ctx.fillStyle = bg; ctx.fillRect(xx + 2, y + 3, w - 4, RH - 6); }
        text(ctx, v != null ? fmt(v, dd, signed) + u : "—", xx + w - 12, y + 38, 23, 400, C.text, "right");
        xx += w;
      });
      ctx.fillStyle = C.line; ctx.fillRect(PAD, y + RH - 1, W - PAD * 2, 1);
      y += RH;
    });
    footer(ctx, W, H - 28);
    return c;
  }

  // ---------------------------------------------------------------- конкурс 1P
  const cdate = (d) => (d ? `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}` : "");
  function contestSub(res) {
    const Cc = res.C;
    return `${Cc.start ? `${cdate(Cc.start)}–${cdate(Cc.end)}` : "конкурс"} · выгрузка ${cdate(Cc.exp)}${Cc.totalDays ? ` · осталось ${Cc.remDays} из ${Cc.totalDays} дн.` : ""}`;
  }
  const PLN = (k) => `План ${k + 1} · +${KPI.contest.RULES.growth[k]}%`;
  const cst = (x) => (x.fc == null ? null : x.fc >= 100 ? "good" : x.fc >= 95 ? "warn" : "bad");
  // сводка: все три плана
  function contestSummaryCard(res) {
    const W = 1080, PAD = 48, CH = 300;
    const extra = res.level !== "store" && res.stores.length > 1;
    const H = 168 + 40 + 70 + 3 * (CH + 20) + (extra ? 70 : 0) + 90;
    const c = canvas(W, H), ctx = c.getContext("2d");
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    header(ctx, W, `Конкурс 1P · ${res.name}`, fit(ctx, contestSub(res), W - 96, 28));
    let y = 168 + 40;
    const r = res.reach;
    badge(ctx, PAD, y, r ? (r >= 1 ? "good" : "warn") : "bad", 38);
    text(ctx, fit(ctx, r ? `При текущем темпе выйдет план ${r}` : "При текущем темпе не выходит даже план 1", W - PAD * 2 - 60, 30, 700), PAD + 56, y + 30, 30, 700);
    y += 70;
    res.ms.forEach((x) => {
      const st = cst(x) || "warn";
      rr(ctx, PAD, y, W - PAD * 2, CH, 18, C.card);
      ctx.fillStyle = stColor(st); ctx.fillRect(PAD, y + 14, 8, CH - 28);
      const X = PAD + 32, RW = W - PAD * 2 - 64;
      text(ctx, PLN(x.k), X, y + 46, 30, 700);
      text(ctx, x.gap === 0 ? "выполнен ✓" : `прогноз ${fmt(x.fc, 0)}%`, X + RW, y + 46, 30, 700, stColor(st), "right");
      text(ctx, money(x.fact), X, y + 104, 44, 700);
      ctx.font = font(44, 700); const fw = ctx.measureText(money(x.fact)).width;
      text(ctx, `из ${money(x.plan)} · ${fmt(x.pct, 1)}%`, X + fw + 16, y + 104, 26, 400, C.text2);
      // полоса: факт, отметка — план на дату
      const bw = RW, by = y + 128;
      rr(ctx, X, by, bw, 18, 9, C.track);
      rr(ctx, X, by, Math.max(10, Math.min(bw, (bw * (x.pct || 0)) / 100)), 18, 9, stColor(st));
      const tx = X + Math.min(bw, (bw * (x.plan > 0 ? x.pd / x.plan : 0)));
      ctx.fillStyle = C.text; ctx.fillRect(tx - 1, by - 8, 3, 34);
      text(ctx, "план на сегодня", Math.min(Math.max(tx, X + 90), X + bw - 90), by + 50, 20, 400, C.muted, "center");
      const cells = [["Не хватает", x.gap === 0 ? "—" : money(x.gap)], ["Нужно в день", x.gap === 0 ? "—" : money(x.perDay)],
        [x.lag > 0 ? "Отстаём от плана на сегодня" : "Опережаем план на сегодня", money(x.lag == null ? null : Math.abs(x.lag))]];
      const cw = RW / 3;
      cells.forEach(([l, v], i) => { text(ctx, l, X + i * cw, y + 232, 22, 400, C.muted); text(ctx, fit(ctx, v, cw - 16, 32, 700), X + i * cw, y + 274, 32, 700, i === 0 && x.gap > 0 ? C.bad : C.text); });
      y += CH + 20;
    });
    if (extra) {
      const t = [0, 1, 2].map((k) => `план ${k + 1}: ${res.stores.filter((s) => s.ms[k].fc >= 100).length}`).join(" · ");
      text(ctx, fit(ctx, `Магазинов на темпе (из ${res.stores.length}): ${t}`, W - PAD * 2, 27, 600), PAD, y + 36, 27, 600, C.text2);
    }
    footer(ctx, W, H - 28);
    return c;
  }
  // таблица по выбранному плану: магазины ASM / ASM дивизиона / ASM компании / продавцы магазина
  function contestListCard(res, k) {
    if (res.level === "store") return contestSellersCard(res, k);
    const PAD = 40, rowsAll = res.level === "asm" ? res.stores : res.level === "dsm" ? res.groups || [] : res.asms || [];
    const what = res.level === "asm" ? "магазины" : "ASM";
    const MAX = 120;
    const rows = [...rowsAll].sort((a, b) => (a.ms[k].fc ?? 1e9) - (b.ms[k].fc ?? 1e9)).slice(0, MAX);
    const withD = res.level === "company";
    const cols = [["fact", "Факт", 170], ["plan", "План", 170], ["pct", "Выпол-|нено", 120], ["fc", "Прогноз", 130], ["gap", "Не|хватает", 170], ["perDay", "Нужно|в день", 160]];
    const NAMEW = res.level === "asm" ? 200 : 330, DW = withD ? 150 : 0;
    const W = PAD * 2 + 44 + NAMEW + DW + cols.reduce((a, c) => a + c[2], 0) + 16;
    const RH = 58, HEADH = 92;
    const H = 168 + 120 + HEADH + rows.length * RH + (rowsAll.length > MAX ? 50 : 0) + 100;
    const c = canvas(W, H), ctx = c.getContext("2d");
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    header(ctx, W, `Конкурс 1P · ${res.name} — ${what}`, fit(ctx, `${PLN(k)} · ${contestSub(res)}`, W - 96, 28));
    let y = 168 + 30;
    const ok = rowsAll.filter((r) => r.ms[k].fc >= 100).length;
    text(ctx, fit(ctx, `На темпе ${ok} из ${rowsAll.length} · сначала те, кто дальше всего от плана · «Нужно в день» — до конца конкурса`, W - PAD * 2, 24, 600), PAD + 4, y + 28, 24, 600, C.text2);
    legend(ctx, PAD + 70, y + 54);
    text(ctx, "прогноз: красное — не успевает к концу конкурса, зелёное — успевает", PAD + 380, y + 72, 21, 400, C.muted);
    y += 120;
    const fcCol = colorer(rows.map((r) => r.ms[k].fc), { norm: 100 }), gapCol = colorer(rows.map((r) => r.ms[k].gap), { lowerBetter: true });
    rr(ctx, PAD, y, W - PAD * 2, HEADH + rows.length * RH, 16, C.card);
    tableHead(ctx, W, PAD, y, HEADH);
    let x = PAD + 44;
    text(ctx, "№", PAD + 22, y + 56, 22, 700, "#fff", "center");
    text(ctx, res.level === "asm" ? "Магазин" : "ASM", x + 12, y + 56, 23, 700, "#fff"); x += NAMEW;
    if (withD) { text(ctx, "DSM", x + 12, y + 56, 23, 700, "#fff"); x += DW; }
    cols.forEach(([, t, w]) => { headCell(ctx, t, x + w - 12, y); x += w; });
    y += HEADH;
    rows.forEach((r, i) => {
      const m = r.ms[k];
      let xx = PAD + 44;
      text(ctx, String(i + 1), PAD + 22, y + 38, 21, 400, C.muted, "center");
      text(ctx, fit(ctx, r.code || r.name, NAMEW - 24, 24, 600), xx + 12, y + 38, 24, 600); xx += NAMEW;
      if (withD) { text(ctx, fit(ctx, r.dsm || "", DW - 20, 21), xx + 12, y + 38, 21, 400, C.text2); xx += DW; }
      cols.forEach(([cid, , w]) => {
        const v = m[cid];
        const bg = cid === "fc" ? fcCol(v) : cid === "gap" ? gapCol(v) : null;
        if (bg) { ctx.fillStyle = bg; ctx.fillRect(xx + 2, y + 3, w - 4, RH - 6); }
        const t = v == null ? "—" : cid === "pct" || cid === "fc" ? fmt(v, 1) + "%" : (cid === "gap" || cid === "perDay") && m.gap === 0 ? (cid === "gap" ? "✓" : "—") : fmt(v, 0) + " ₽";
        text(ctx, t, xx + w - 12, y + 38, 23, cid === "perDay" ? 700 : 400, C.text, "right");
        xx += w;
      });
      ctx.fillStyle = C.line; ctx.fillRect(PAD, y + RH - 1, W - PAD * 2, 1);
      y += RH;
    });
    if (rowsAll.length > MAX) text(ctx, `Показаны ${MAX} из ${rowsAll.length}, остальные — в файле отчёта.`, PAD + 4, y + 36, 22, 400, C.muted);
    footer(ctx, W, H - 28);
    return c;
  }
  function contestSellersCard(res, k) {
    const PAD = 40, e = res.sellers, R = KPI.contest.RULES;
    if (!e.length) {
      const W = 1080, c = canvas(W, 400), ctx = c.getContext("2d");
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, 400); header(ctx, W, `Конкурс 1P · ${res.name}`, fit(ctx, contestSub(res), W - 96, 28));
      text(ctx, "В файле конкурса нет продавцов этого магазина.", PAD + 8, 260, 30, 400, C.text2); footer(ctx, W, 375); return c;
    }
    const cols = [["role", "Должность", 180, "l"], ["qty", "Штук", 100], ["rub", "Оборот 1Р", 180], ["share", "Доля|в магазине", 140], ["place", "Место", 100], ["bonus", `Доплата|при плане ${k + 1}`, 170]];
    const NAMEW = 400, W = PAD * 2 + 44 + NAMEW + cols.reduce((a, c) => a + c[2], 0) + 16;
    const RH = 60, HEADH = 92, H = 168 + 120 + HEADH + e.length * RH + 100;
    const c = canvas(W, H), ctx = c.getContext("2d");
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    header(ctx, W, `Конкурс 1P · ${res.name} — продавцы`, fit(ctx, `${PLN(k)} · ${contestSub(res)}`, W - 96, 28));
    let y = 168 + 30;
    const m = res.ms[k];
    text(ctx, fit(ctx, m.gap === 0 ? `Магазин выполнил план ${k + 1}` : `Магазину до плана ${k + 1}: не хватает ${money(m.gap)}, нужно ${money(m.perDay)} в день · прогноз ${fmt(m.fc, 0)}%`, W - PAD * 2, 25, 700), PAD + 4, y + 30, 25, 700, m.gap === 0 ? C.good : C.bad);
    text(ctx, fit(ctx, `Доплата продавцу — ${fmt(R.fundSeller[k], 1)}% от личного оборота 1Р, если магазин выполнит план ${k + 1}. Посчитана от текущего оборота.`, W - PAD * 2, 22), PAD + 4, y + 70, 22, 400, C.muted);
    y += 120;
    const rubCol = colorer(e.map((x) => x.rub), {});
    rr(ctx, PAD, y, W - PAD * 2, HEADH + e.length * RH, 16, C.card);
    tableHead(ctx, W, PAD, y, HEADH);
    let x = PAD + 44;
    text(ctx, "№", PAD + 22, y + 56, 22, 700, "#fff", "center");
    text(ctx, "Сотрудник", x + 12, y + 56, 23, 700, "#fff"); x += NAMEW;
    cols.forEach(([, t, w, al]) => { if (al === "l") text(ctx, t, x + 12, y + 56, 21, 700, "#fff"); else headCell(ctx, t, x + w - 12, y); x += w; });
    y += HEADH;
    e.forEach((r, i) => {
      let xx = PAD + 44;
      text(ctx, String(i + 1), PAD + 22, y + 39, 21, 400, C.muted, "center");
      text(ctx, fit(ctx, r.name, NAMEW - 24, 24, 600), xx + 12, y + 39, 24, 600); xx += NAMEW;
      cols.forEach(([cid, , w, al]) => {
        if (al === "l") { text(ctx, fit(ctx, r.role || "", w - 20, 21), xx + 12, y + 39, 21, 400, C.text2); xx += w; return; }
        const v = cid === "bonus" ? (r.rub > 0 ? (r.rub * R.fundSeller[k]) / 100 : null) : r[cid];
        if (cid === "rub") { const bg = rubCol(v); if (bg) { ctx.fillStyle = bg; ctx.fillRect(xx + 2, y + 3, w - 4, RH - 6); } }
        const t = v == null ? "—" : cid === "share" ? fmt(v, 1) + "%" : cid === "rub" || cid === "bonus" ? fmt(v, 0) + " ₽" : fmt(v, 0);
        text(ctx, t, xx + w - 12, y + 39, 23, cid === "bonus" ? 700 : 400, C.text, "right");
        xx += w;
      });
      ctx.fillStyle = C.line; ctx.fillRect(PAD, y + RH - 1, W - PAD * 2, 1);
      y += RH;
    });
    footer(ctx, W, H - 28);
    return c;
  }

  // ---------------------------------------------------------------- PNG
  function toBlob(c) { return new Promise((res) => c.toBlob((b) => res(b), "image/png")); }
  function fileName(res, p, kind) {
    const id = String(res.code).replace(/[^\wА-Яа-яЁё-]+/g, "_");
    const per = { day: "den", week: "nedelya", month: "mesyac", p1: "plan1", p2: "plan2", p3: "plan3" }[p] || p;
    const d = new Date();
    return `${id}_${{ staff: "prodavcy", region: "region", stores: "magaziny", csum: "konkurs", clist: "konkurs_spisok" }[kind] || "magazin"}_${per}_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.png`;
  }
  async function makeImage(res, p, kind) {
    const c = kind === "csum" ? contestSummaryCard(res) : kind === "clist" ? contestListCard(res, +String(p).replace("p", "") - 1)
      : kind === "staff" ? staffCard(res, p) : kind === "stores" ? storesCard(res, p) : storeCard(res, p);
    const blob = await toBlob(c);
    return { blob, file: new File([blob], fileName(res, p, kind), { type: "image/png" }), width: c.width, height: c.height };
  }

  KPI.share = { storeCard, staffCard, storesCard, contestSummaryCard, contestListCard, makeImage };
})(typeof globalThis !== "undefined" ? globalThis : this);
