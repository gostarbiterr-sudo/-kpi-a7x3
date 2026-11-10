/* «Часы и чеки»: две картинки (покрытие трафика и комплектность чеков) + страница отчёта. Рисуется на canvas на устройстве. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const isn = (v) => typeof v === "number" && isFinite(v);
  const S = 2, W = 1080, PAD = 36;
  const C = { navy: "#1F3864", ink: "#1F2937", mut: "#6B7280", line: "#E5E7EB", bg: "#FFFFFF", card: "#F3F6FA", good: "#1E8E3E", bad: "#C62828", a: "#A9BCD9", b: "#1F3864", org: "#F59E0B", reg: "#9CA3AF" };
  const F = () => KPI.hours.fmt;
  const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"], WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const dl = (d, i) => (d ? `${d.getUTCDate()} ${MON[d.getUTCMonth()]} (${WD[d.getUTCDay()]})` : i ? "второй день" : "первый день");
  const ds = (d, i) => (d ? `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}` : i ? "день 2" : "день 1");
  const heat = (v, soft) => (!isn(v) ? "#FFFFFF" : v >= soft ? "#BFE5C6" : v >= 0 ? "#E3F4E6" : v > -soft ? "#FFF1CC" : v > -3 * soft ? "#FAD4CF" : "#F4AFA6");

  function mk(h) { const c = document.createElement("canvas"); c.width = W * S; c.height = h * S; const x = c.getContext("2d"); x.scale(S, S); x.fillStyle = C.bg; x.fillRect(0, 0, W, h); x.textBaseline = "middle"; return [c, x]; }
  const font = (x, px, w) => (x.font = `${w || 400} ${px}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`);
  function t(x, s, X, Y, px, w, col, al) { font(x, px, w); x.fillStyle = col || C.ink; x.textAlign = al || "left"; x.fillText(String(s), X, Y); }
  function wrap(x, s, maxW, px, w) { font(x, px, w); const out = []; let line = ""; for (const word of String(s).split(" ")) { const tr = line ? line + " " + word : word; if (x.measureText(tr).width > maxW && line) { out.push(line); line = word; } else line = tr; } if (line) out.push(line); return out; }
  function rr(x, X, Y, w, h, r, fill) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); x.fillStyle = fill; x.fill(); }
  function header(x, title, sub) {
    x.fillStyle = C.navy; x.fillRect(0, 0, W, 92);
    t(x, title, PAD, 36, 28, 700, "#FFFFFF"); t(x, sub, PAD, 70, 15, 400, "#CADCFC");
    return 112;
  }
  function tiles(x, y, list) {
    const n = list.length, gap = 12, w = (W - 2 * PAD - gap * (n - 1)) / n, h = 104;
    list.forEach((o, i) => { const X = PAD + i * (w + gap); rr(x, X, y, w, h, 10, C.card);
      t(x, o.l, X + 14, y + 20, 13, 600, C.mut); t(x, o.v, X + 14, y + 52, 26, 700, C.navy);
      if (o.d) t(x, o.d, X + 14, y + 84, 13, 600, o.dc || C.mut); });
    return y + h + 18;
  }
  function para(x, y, title, lines, col) {
    if (!lines.length) return y;
    t(x, title, PAD, y + 10, 18, 700, C.navy); y += 30;
    for (const s of lines) { const L = wrap(x, s, W - 2 * PAD - 18, 15, 400); t(x, "•", PAD, y + 9, 15, 700, col || C.navy); L.forEach((l, i) => t(x, l, PAD + 18, y + 9 + i * 21, 15, 400, C.ink)); y += L.length * 21 + 8; }
    return y + 6;
  }
  function footer(x, y) { t(x, `Сформировано ${new Date().toLocaleDateString("ru-RU")} · данные обработаны на устройстве`, PAD, y + 12, 12, 400, C.mut); return y + 30; }
  const sgnCol = (v) => (!isn(v) || Math.abs(v) < 0.05 ? C.mut : v > 0 ? C.good : C.bad);

  // ---------------------------------------------------------------- картинка 1: трафик и покрытие
  function cover(r) {
    const f = F(), rows = r.rows, n = rows.length;
    const M = r.month, mh = M ? 70 + M.hours.length * 22 + 40 : 0;
    const est = 112 + 122 + 330 + 40 + (n + 2) * 30 + 30 + mh + 60 + r.findings.cov.length * 70 + 60;
    const [c, x] = mk(est);
    let y = header(x, `Трафик и покрытие · ${r.code} ${r.name}`, `${dl(r.dates[0], 0)} и ${dl(r.dates[1], 1)} · продавцы по графику (без кладовщиков и руководителей)`);
    const a = r.tot[0], b = r.tot[1], e0 = r.ev[0], e1 = r.ev[1], pd = (p, q) => (p ? ((q / p - 1) * 100) : null);
    y = tiles(x, y, [
      { l: "Трафик", v: `${a.trf} → ${b.trf}`, d: `${f.sg(pd(a.trf, b.trf))}%`, dc: sgnCol(pd(a.trf, b.trf)) },
      { l: "Чеки", v: `${a.chk} → ${b.chk}`, d: `${f.sg(pd(a.chk, b.chk))}%`, dc: sgnCol(pd(a.chk, b.chk)) },
      { l: "Конверсия", v: `${f.pc(b.conv)}%`, d: `${f.sg(b.conv - a.conv)} п.п. · регион ${f.pc(r.regTot[1])}%`, dc: sgnCol(b.conv - a.conv) },
      { l: "Вечер с 18:00", v: `${f.pc(e1.conv)}%`, d: `конв. · ${e1.trf} чел.${isn(e1.avgSel) ? ` · ${f.pc(e1.avgSel)} прод.` : ""}`, dc: sgnCol(e1.conv - (e0.conv || 0)) }]);
    // график по часам
    const cx = PAD + 40, cw = W - 2 * PAD - 80, ch = 230, top = y + 34;
    t(x, "Трафик по часам (столбики) и конверсия (линии)", PAD, y + 10, 18, 700, C.navy);
    const mxT = Math.max(5, ...rows.map((q) => Math.max(q.d[0].trf, q.d[1].trf))), mxC = Math.max(20, ...rows.flatMap((q) => [q.d[0].conv || 0, q.d[1].conv || 0, q.reg[1] || 0])) * 1.1;
    const bw = cw / Math.max(1, n);
    x.strokeStyle = C.line; x.lineWidth = 1; for (let g = 0; g <= 4; g++) { const Y = top + ch - (ch * g) / 4; x.beginPath(); x.moveTo(cx, Y); x.lineTo(cx + cw, Y); x.stroke(); t(x, Math.round((mxT * g) / 4), cx - 6, Y, 11, 400, C.mut, "right"); t(x, `${Math.round((mxC * g) / 4)}%`, cx + cw + 6, Y, 11, 400, C.mut); }
    // вечер подсветка
    rows.forEach((q, i) => { if (q.h >= 18) { x.fillStyle = "#FFF7ED"; x.fillRect(cx + i * bw, top, bw, ch); } });
    rows.forEach((q, i) => { const X = cx + i * bw; [0, 1].forEach((d) => { const hgt = (q.d[d].trf / mxT) * ch; x.fillStyle = d ? C.b : C.a; x.fillRect(X + bw * (0.14 + d * 0.36), top + ch - hgt, bw * 0.34, hgt); }); t(x, `${q.h}`, X + bw / 2, top + ch + 14, 12, 600, C.ink, "center"); });
    const line = (get, col, dash, wdt) => { x.setLineDash(dash); x.strokeStyle = col; x.lineWidth = wdt; x.beginPath(); let st = false; rows.forEach((q, i) => { const v = get(q); if (!isn(v)) { st = false; return; } const X = cx + i * bw + bw / 2, Y = top + ch - (v / mxC) * ch; st ? x.lineTo(X, Y) : x.moveTo(X, Y); st = true; }); x.stroke(); x.setLineDash([]);
      rows.forEach((q, i) => { const v = get(q); if (!isn(v) || dash.length) return; x.fillStyle = col; x.beginPath(); x.arc(cx + i * bw + bw / 2, top + ch - (v / mxC) * ch, 3.5, 0, 7); x.fill(); }); };
    line((q) => q.reg[1], C.reg, [3, 4], 1.5); line((q) => q.d[0].conv, "#93A5C6", [6, 4], 2); line((q) => q.d[1].conv, C.org, [], 3);
    // продавцы под осью
    let yy = top + ch + 34;
    if (r.sch) { t(x, "продавцов", cx - 6, yy, 11, 600, C.mut, "right"); rows.forEach((q, i) => { const v = q.d[1].sel; if (!isn(v)) return; const X = cx + i * bw + bw * 0.15, col = v < 1.5 ? "#F4AFA6" : v < 2.5 ? "#FFF1CC" : "#BFE5C6"; rr(x, X, yy - 10, bw * 0.7, 20, 4, col); t(x, f.pc(v, v % 1 ? 1 : 0), X + bw * 0.35, yy, 12, 700, C.ink, "center"); }); yy += 26; }
    // легенда
    const lg = [[C.a, `трафик ${ds(r.dates[0], 0)}`, "bar"], [C.b, `трафик ${ds(r.dates[1], 1)}`, "bar"], ["#93A5C6", `конверсия ${ds(r.dates[0], 0)}`, "l"], [C.org, `конверсия ${ds(r.dates[1], 1)}`, "l"], [C.reg, "конверсия региона", "l"]];
    let lx = PAD; lg.forEach(([col, s, k]) => { x.fillStyle = col; if (k === "bar") x.fillRect(lx, yy - 6, 14, 12); else x.fillRect(lx, yy - 2, 18, 4); t(x, s, lx + 22, yy, 12, 400, C.mut); font(x, 12); lx += 30 + x.measureText(s).width + 14; });
    y = yy + 26;
    // таблица по часам
    const cols = [["Час", 70], [`Трафик ${ds(r.dates[0], 0)}`, 110], [ds(r.dates[1], 1), 90], [`Чеки ${ds(r.dates[0], 0)}`, 105], [ds(r.dates[1], 1), 80], [`Конв. ${ds(r.dates[0], 0)}`, 105], [ds(r.dates[1], 1), 85], ["Регион", 85], ["Продавцов", 110], ["Посет. на продавца", 168]];
    const tw = cols.reduce((s2, q) => s2 + q[1], 0), sc = (W - 2 * PAD) / tw, rh = 28;
    let X0 = PAD; x.fillStyle = C.navy; x.fillRect(PAD, y, W - 2 * PAD, rh); cols.forEach(([s2, w]) => { t(x, s2, X0 + (w * sc) / 2, y + rh / 2, 12, 700, "#FFFFFF", "center"); X0 += w * sc; }); y += rh;
    const cell = (i, s2, bg, col, w) => { let X = PAD; for (let k = 0; k < i; k++) X += cols[k][1] * sc; if (bg) { x.fillStyle = bg; x.fillRect(X, y, cols[i][1] * sc, rh); } t(x, s2, X + (cols[i][1] * sc) / 2, y + rh / 2, 13, w || 400, col || C.ink, "center"); };
    rows.forEach((q, i) => { const z = q.h >= 18 ? "#FFF7ED" : i % 2 ? "#F9FAFB" : "#FFFFFF"; x.fillStyle = z; x.fillRect(PAD, y, W - 2 * PAD, rh);
      const A = q.d[0], B = q.d[1];
      cell(0, `${q.h}:00`, null, C.ink, 700); cell(1, A.trf); cell(2, B.trf, null, C.ink, 700); cell(3, A.chk); cell(4, B.chk, B.trf >= 5 && !B.chk ? "#F4AFA6" : null, C.ink, 700);
      cell(5, isn(A.conv) ? `${f.pc(A.conv, 0)}%` : "—"); cell(6, isn(B.conv) ? `${f.pc(B.conv, 0)}%` : "—", isn(B.conv) && isn(q.reg[1]) ? heat(B.conv - q.reg[1], 3) : null, C.ink, 700); cell(7, isn(q.reg[1]) ? `${f.pc(q.reg[1], 0)}%` : "—", null, C.mut);
      cell(8, r.sch ? `${f.pc(A.sel, A.sel % 1 ? 1 : 0)} → ${f.pc(B.sel, B.sel % 1 ? 1 : 0)}` : "—", r.sch && isn(B.sel) && B.sel < 1.5 ? "#FAD4CF" : null);
      cell(9, isn(B.tps) ? Math.round(B.tps) : "—", isn(B.tps) && B.tps >= 12 ? (B.tps >= 18 ? "#F4AFA6" : "#FFF1CC") : null, C.ink, 700); y += rh; });
    y += 22;
    // график месяца
    if (M) {
      t(x, `График на месяц: продавцов в зале по часам (сотрудников-продавцов: ${M.sellers})`, PAD, y + 10, 18, 700, C.navy); y += 30;
      const lw = 50, gw = (W - 2 * PAD - lw) / M.days.length, gh = 22;
      M.days.forEach((dd, i) => { const X = PAD + lw + i * gw, we = dd.wd === 0 || dd.wd === 6; t(x, dd.d, X + gw / 2, y + 8, 11, 700, we ? C.bad : C.ink, "center"); t(x, WD[dd.wd], X + gw / 2, y + 22, 10, 400, we ? C.bad : C.mut, "center"); });
      y += 34;
      M.hours.forEach((h, hi) => { t(x, `${h}:00`, PAD + lw - 6, y + gh / 2, 11, 600, h >= 18 ? "#B45309" : C.mut, "right");
        M.days.forEach((dd, i) => { const v = dd.v[hi], X = PAD + lw + i * gw, col = v < 0.5 ? "#F4AFA6" : v < 1.5 ? "#FAD4CF" : v < 2.5 ? "#FFF1CC" : "#BFE5C6"; x.fillStyle = col; x.fillRect(X + 1, y + 1, gw - 2, gh - 2); t(x, Math.round(v), X + gw / 2, y + gh / 2, 10, 600, C.ink, "center"); });
        y += gh; });
      // отметить дни анализа
      [0, 1].forEach((k) => { const dn = r.dayNum[k]; const i = M.days.findIndex((q) => q.d === dn); if (i < 0) return; const X = PAD + lw + i * gw; x.strokeStyle = k ? C.org : "#93A5C6"; x.lineWidth = 3; x.strokeRect(X, y - gh * M.hours.length - 34, gw, gh * M.hours.length + 34); });
      y += 10; t(x, "красный — никого или 1 продавец, жёлтый — 2, зелёный — 3 и больше; рамкой выделены дни анализа", PAD, y + 8, 12, 400, C.mut); y += 28;
    }
    y = para(x, y, "Что видно", r.findings.cov, C.navy);
    y = footer(x, y);
    return crop(c, y);
  }

  // ---------------------------------------------------------------- картинка 2: чеки и комплекты
  function kits(r) {
    if (!r.kits) return null;
    const f = F(), [k0, k1] = r.kits, t0 = k0.tot, t1 = k1.tot, rg = r.kits.reg[1].tot, opp = KPI.hours.oppList(r);
    const est = 112 + 122 + 60 + (opp.length + 1) * 54 + 330 + r.findings.kit.length * 90 + 100;
    const [c, x] = mk(est);
    let y = header(x, `Чеки и комплекты · ${r.code} ${r.name}`, `${dl(r.dates[0], 0)} и ${dl(r.dates[1], 1)} · чеки с основным товаром: есть ли в них аксессуары и услуги`);
    const p = (q, k) => (q.main ? (q[k] / q.main) * 100 : null);
    y = tiles(x, y, [
      { l: "Чеков с основным товаром", v: `${t0.main} → ${t1.main}` },
      { l: "С аксессуаром", v: `${f.pc(p(t1, "acc"), 0)}%`, d: `было ${f.pc(p(t0, "acc"), 0)}% · регион ${f.pc(p(rg, "acc"), 0)}%`, dc: sgnCol(p(t1, "acc") - p(rg, "acc")) },
      { l: "С услугой", v: `${f.pc(p(t1, "srv"), 0)}%`, d: `было ${f.pc(p(t0, "srv"), 0)}% · регион ${f.pc(p(rg, "srv"), 0)}%`, dc: sgnCol(p(t1, "srv") - p(rg, "srv")) },
      { l: "«Пустые» чеки", v: `${t1.empty}`, d: `${f.pc(p(t1, "empty"), 0)}% · было ${t0.empty}`, dc: C.bad },
      { l: "Чеки только с аксессуарами", v: `${t1.accOnly}`, d: `было ${t0.accOnly}` }]);
    // таблица по семьям
    t(x, "Где вернуть комплекты (второй день)", PAD, y + 10, 18, 700, C.navy); y += 30;
    const cols = [["Основной товар", 250], ["Чеков", 80], ["Пустых", 80], ["С акс., %", 110], ["С усл., %", 110], ["Что предлагать", 450]];
    const tw = cols.reduce((s2, q) => s2 + q[1], 0), sc = (W - 2 * PAD) / tw, X = (i) => PAD + cols.slice(0, i).reduce((s2, q) => s2 + q[1] * sc, 0);
    x.fillStyle = C.navy; x.fillRect(PAD, y, W - 2 * PAD, 30); cols.forEach(([s2, w], i) => t(x, s2, X(i) + (i === 0 || i === 5 ? 10 : (w * sc) / 2), y + 15, 12, 700, "#FFFFFF", i === 0 || i === 5 ? "left" : "center")); y += 30;
    opp.forEach((o, i) => {
      const tip = wrap(x, o.tip, cols[5][1] * sc - 20, 12, 400), sub = o.top.length ? wrap(x, o.top.join(", "), cols[0][1] * sc - 20, 11, 400) : [];
      const h = Math.max(44, 14 + Math.max(tip.length * 16, 18 + sub.length * 14));
      x.fillStyle = i % 2 ? "#F9FAFB" : "#FFFFFF"; x.fillRect(PAD, y, W - 2 * PAD, h);
      t(x, o.name, X(0) + 10, y + 14, 13, 700); sub.forEach((l, j) => t(x, l, X(0) + 10, y + 31 + j * 14, 11, 400, C.mut));
      t(x, o.main, X(1) + (cols[1][1] * sc) / 2, y + h / 2, 14, 700, C.ink, "center");
      if (o.empty) { x.fillStyle = o.empty / o.main >= 0.8 ? "#F4AFA6" : "#FAD4CF"; x.fillRect(X(2) + 4, y + 4, cols[2][1] * sc - 8, h - 8); }
      t(x, o.empty, X(2) + (cols[2][1] * sc) / 2, y + h / 2, 14, 700, C.ink, "center");
      t(x, `${f.pc(o.accP, 0)}%`, X(3) + (cols[3][1] * sc) / 2, y + h / 2 - 8, 14, 700, sgnCol(o.accP - o.regAccP), "center"); t(x, `рег. ${f.pc(o.regAccP, 0)}%`, X(3) + (cols[3][1] * sc) / 2, y + h / 2 + 10, 11, 400, C.mut, "center");
      t(x, `${f.pc(o.srvP, 0)}%`, X(4) + (cols[4][1] * sc) / 2, y + h / 2 - 8, 14, 700, sgnCol(o.srvP - o.regSrvP), "center"); t(x, `рег. ${f.pc(o.regSrvP, 0)}%`, X(4) + (cols[4][1] * sc) / 2, y + h / 2 + 10, 11, 400, C.mut, "center");
      tip.forEach((l, j) => t(x, l, X(5) + 10, y + h / 2 - ((tip.length - 1) * 16) / 2 + j * 16, 12, 400, C.ink));
      x.strokeStyle = C.line; x.lineWidth = 1; x.beginPath(); x.moveTo(PAD, y + h); x.lineTo(W - PAD, y + h); x.stroke();
      y += h;
    });
    y += 24;
    // по часам: чеки с основным товаром и «пустые»
    const hrs = r.rows.map((q) => q.h);
    t(x, `Чеки с основным товаром по часам, ${ds(r.dates[1], 1)}: тёмные — с аксессуаром или услугой, красные — «пустые»`, PAD, y + 10, 16, 700, C.navy); y += 30;
    const cx = PAD + 30, cw = W - 2 * PAD - 30, chh = 170, bw = cw / Math.max(1, hrs.length), mx = Math.max(3, ...hrs.map((h) => (t1.byHour[h] ? t1.byHour[h].main : 0)));
    hrs.forEach((h, i) => { const o = t1.byHour[h] || { main: 0, empty: 0 }, X2 = cx + i * bw; if (h >= 18) { x.fillStyle = "#FFF7ED"; x.fillRect(X2, y, bw, chh); }
      const he = (o.empty / mx) * (chh - 20), hf = ((o.main - o.empty) / mx) * (chh - 20);
      x.fillStyle = C.b; x.fillRect(X2 + bw * 0.2, y + chh - hf, bw * 0.6, hf); x.fillStyle = "#EE8E84"; x.fillRect(X2 + bw * 0.2, y + chh - hf - he, bw * 0.6, he);
      if (o.main) t(x, `${o.empty}/${o.main}`, X2 + bw / 2, y + chh - hf - he - 9, 11, 600, C.ink, "center");
      t(x, h, X2 + bw / 2, y + chh + 12, 12, 600, C.ink, "center"); });
    y += chh + 32;
    y = para(x, y, "Что видно", r.findings.kit, C.navy);
    y = footer(x, y);
    return crop(c, y);
  }
  function crop(c, h) { const o = document.createElement("canvas"); o.width = c.width; o.height = Math.ceil(h * S); o.getContext("2d").drawImage(c, 0, 0); return o; }

  // ---------------------------------------------------------------- страница отчёта
  function body(r) {
    const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
    return {
      title: `Часы и чеки — ${r.code}`,
      css: `.hp{max-width:1100px;margin:0 auto;padding:12px}.hp h1{font-size:20px;margin:8px 0}.hp .muted{color:#6B7280;font-size:13px}.hp img{width:100%;height:auto;display:block;margin:12px 0;border-radius:10px;box-shadow:0 1px 6px rgba(0,0,0,.12)}.hp .ph{padding:40px;text-align:center;color:#6B7280}`,
      body: `<div class="hp"><h1>Часы и чеки · ${esc(r.code)} ${esc(r.name)}</h1><p class="muted">Картинки можно отправить кнопкой «Отправить» или сохранить кнопкой «Файл».</p><div id="hpImgs"><p class="ph">Рисую картинки…</p></div></div>`,
    };
  }
  async function images(r) {
    const out = [], toBlob = (c) => new Promise((ok) => c.toBlob((b) => ok(b), "image/png"));
    const c1 = cover(r); out.push({ name: `pokrytie_${r.code}.png`, canvas: c1 });
    const c2 = kits(r); if (c2) out.push({ name: `cheki_${r.code}.png`, canvas: c2 });
    for (const o of out) { o.blob = await toBlob(o.canvas); o.url = URL.createObjectURL(o.blob); }
    return out;
  }
  KPI.hoursPic = { body, images, cover, kits };
})(typeof globalThis !== "undefined" ? globalThis : this);
