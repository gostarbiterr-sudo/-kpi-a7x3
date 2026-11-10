/* «Часы и чеки»: покрытие трафика продавцами (по графику) и комплектность чеков с основным товаром.
   Источники (R129 «сравнение периодов» за два дня + график .xls):
   - по часам: оборот, чеки, трафик;
   - по часам и подкатегориям: оборот, чеки;
   - по часам и номерам чеков: позиции чека (материал, оборот);
   - график работы магазина на месяц (.xls): смены сотрудников, должности.
   Первая колонка отчётов («прошлый») — первая дата, вторая («предыдущий») — вторая дата.
   Всё считается на устройстве. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const isn = (v) => typeof v === "number" && isFinite(v);
  const key = (s) => String(s == null ? "" : s).toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  const num = (v) => (isn(v) ? v : typeof v === "string" && v.trim() && isFinite(+v.replace(",", ".")) ? +v.replace(",", ".") : 0);
  const hourOf = (s) => { const m = /^(\d{1,2}):\d\d\s*-/.exec(String(s || "")); return m ? +m[1] : null; };

  function empty() { return { traf: {}, sub: {}, txn: {}, sched: {}, names: {}, files: [] }; }

  // ---------------------------------------------------------------- роли подкатегорий
  const R = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  // основной товар → семья; аксессуары и услуги считаются по всему чеку
  const FAM = [
    ["tv", "Телевизоры", [10709, 59201]],
    ["audio", "Аудио и саундбары", [10101, 10405, 10501, 10502, 10802, 11001, 11301]],
    ["mob", "Смартфоны, планшеты, гаджеты", [10907, 20501, 26001, 26201, 30901, 59106]],
    ["pc", "Ноутбуки и компьютеры", [20301, 20401, 20402, 20601, 20602, 20801]],
    ["game", "Игровые консоли", [30401, 60301]],
    ["kbt", "Крупная бытовая техника", [...R(40101, 40107), ...R(40202, 40207), 40301, 40302, 40503, 40801, 40803, 40901, 59706]],
    ["mbt", "Мелкая бытовая техника", [40401, 40402, ...R(40601, 40612), 40701, 40703, 41001, 41002, 41003, 41101, 41201, 41202, ...R(41301, 41308), 53901, 54301, 59903]],
  ];
  const FAM_OF = {}; FAM.forEach(([k, , cs]) => cs.forEach((c) => (FAM_OF[c] = k)));
  const SRV = new Set([21301, 21601, 22101, 23201, 23801, 23902, 24401, 24501, 24601, 24701, 25501, 31101, 31201, 31301, 31401, 61101, 70101, 70301, 70401, 70501, 70601]);
  const TIPS = { tv: "кронштейн, HDMI-кабель, сетевой фильтр, сертификат «Кино и звук»", audio: "кабели, крепления, сертификат",
    mob: "чехол, защитное стекло, зарядка, наушники, сертификат «Мобильная техника»", pc: "мышь, сумка или рюкзак, ПО и антивирус, накопитель, сертификат «Домашний офис»",
    game: "второй геймпад, игры, цифровой код или подписка", kbt: "доставка, установка и подключение, шланги и средства ухода, сертификат",
    mbt: "расходники и насадки (фильтры, мешки, капсулы), средства ухода, сертификат" };
  const ACC_EXTRA = new Set([20605, 30310, 40613, 41004, 41309, 59401]);
  function roleOf(sub) {
    const c = +sub;
    if (!isFinite(c)) return "other";
    if (FAM_OF[c]) return "main";
    if (SRV.has(c) || (c >= 70000 && c < 71000)) return "srv";
    if (ACC_EXTRA.has(c) || (c >= 50000 && c < 59000)) return "acc";
    return "other";
  }

  // ---------------------------------------------------------------- загрузка
  function kindOf(head) {
    const h = head.map(key);
    if (!h.includes("магазин") || !h.includes("час")) return null;
    if (h.some((x) => x.startsWith("номер транзакции"))) return "txn";
    if (h.some((x) => x.startsWith("материал: подкатегор"))) return "sub";
    if (h.some((x) => x.startsWith("трафик прошлый")) && !h.some((x) => x.startsWith("материал"))) return "traf";
    return null;
  }
  const col = (head, re) => head.findIndex((x) => re.test(key(x)));

  function loadRows(rows, kind, H) {
    const head = rows[0];
    const cS = 0, cN = 1, cH = col(head, /^час$/);
    const rv = [col(head, /^оборот .*прошлый/), col(head, /^оборот .*предыдущий/)];
    const ck = [col(head, /^количество чеков прошлый/), col(head, /^количество чеков предыдущий/)];
    const tr = [col(head, /^трафик прошлый/), col(head, /^трафик предыдущий/)];
    let n = 0;
    if (kind === "traf") {
      for (const r of rows.slice(1)) {
        const s = String(r[cS] || "").trim(), h = hourOf(r[cH]); if (!s || h == null || /результат/i.test(s)) continue;
        if (r[cN]) H.names[s] = String(r[cN]).replace(/^.*?№\s*\S+,\s*/, "");
        const st = (H.traf[s] = H.traf[s] || {});
        st[h] = [0, 1].map((d) => ({ rev: num(r[rv[d]]), chk: num(r[ck[d]]), trf: num(r[tr[d]]) }));
        n++;
      }
    } else if (kind === "sub") {
      const cC = col(head, /^материал: подкатегор/);
      for (const r of rows.slice(1)) {
        const s = String(r[cS] || "").trim(), h = hourOf(r[cH]), sub = String(r[cC] == null ? "" : r[cC]).trim();
        if (!s || h == null || !sub || /результат/i.test(sub) || sub === "#") continue;
        if (r[cN]) H.names[s] = H.names[s] || String(r[cN]).replace(/^.*?№\s*\S+,\s*/, "");
        const nm = String(r[cC + 1] || sub);
        for (const d of [0, 1]) {
          const v = num(r[rv[d]]), c = num(r[ck[d]]); if (!v && !c) continue;
          const o = (((H.sub[s] = H.sub[s] || {})[h] = H.sub[s][h] || [{}, {}])[d][sub] = H.sub[s][h][d][sub] || { rev: 0, chk: 0, name: nm });
          o.rev += v; o.chk += c;
        }
        H.subName = H.subName || {}; H.subName[sub] = nm;
        n++;
      }
    } else if (kind === "txn") {
      const cT = col(head, /^номер транзакции/), cM = col(head, /^материал$/);
      for (const r of rows.slice(1)) {
        const s = String(r[cS] || "").trim(), h = hourOf(r[cH]), t = String(r[cT] || "").trim(), m = String(r[cM] == null ? "" : r[cM]).trim();
        if (!s || h == null || !t || t === "#" || /результат/i.test(t) || !m || m === "#" || /результат/i.test(m)) continue;
        for (const d of [0, 1]) {
          const v = num(r[rv[d]]); if (!v) continue;
          ((((H.txn[s] = H.txn[s] || {})[h] = H.txn[s][h] || [[], []])[d])).push({ t, m, name: String(r[cM + 1] || ""), rev: v });
        }
        n++;
      }
    }
    return n;
  }

  // график работы (.xls или .xlsx): «График работы Магазин S635 с 01.11.2026 по 30.11.2026»
  function loadSchedule(rows, H) {
    let code = null, Y = null, Mo = null;
    for (const r of rows.slice(0, 5)) for (const c of r || []) {
      const m = /график работы.*?магазин\s+([A-ZА-Я]{1,2}\d{2,3})\s+с\s+(\d\d)\.(\d\d)\.(\d{4})/i.exec(String(c || ""));
      if (m) { code = m[1].toUpperCase().replace(/А/g, "A").replace(/С/g, "S"); Mo = +m[3] - 1; Y = +m[4]; }
    }
    if (!code) return 0;
    const hi = rows.findIndex((r) => r && r.some((c) => key(c) === "фио"));
    if (hi < 0) return 0;
    const head = rows[hi], dayCol = {};
    head.forEach((c, i) => { const d = typeof c === "number" ? c : /^\d{1,2}$/.test(String(c || "").trim()) ? +c : null; if (d && d >= 1 && d <= 31 && !dayCol[d]) dayCol[d] = i; });
    const cF = head.findIndex((c) => key(c) === "фио");
    const staff = [];
    const shift = (v) => { const m = /(\d{1,2}):(\d\d)\D+(\d{1,2}):(\d\d)/.exec(String(v || "")); return m ? [+m[1] + +m[2] / 60, +m[3] + +m[4] / 60] : null; };
    for (let i = hi + 1; i < rows.length - 1; i++) {
      const r = rows[i] || [], nx = rows[i + 1] || [];
      const name = String(r[cF] || "").trim();
      if (!name || /^итого/i.test(name)) continue;
      const hasDays = Object.values(dayCol).some((c) => r[c] != null && String(r[c]).trim() !== "");
      if (!hasDays) continue;
      const role = String(nx[cF] || "").trim();
      const days = {};
      for (const [d, c] of Object.entries(dayCol)) { const s = shift(r[c]); if (s) days[d] = s; else if (r[c]) days[d] = String(r[c]).trim(); }
      staff.push({ name, role, days });
      i++;
    }
    H.sched[code] = { code, Y, Mo, staff, days: Object.keys(dayCol).map(Number).sort((a, b) => a - b) };
    return staff.length;
  }

  async function tryLoad(f, say, H) {
    const nm = String(f.name || "");
    if (/\.xls$/i.test(nm)) {
      const book = KPI.xls.readXls(f.buffer);
      for (const sh of book.sheets) { const n = loadSchedule(sh.rows, H); if (n) { H.files.push({ file: nm, kind: "График работы", rows: n, comment: `магазин ${Object.keys(H.sched).slice(-1)[0]}, сотрудников ${n}` }); return true; } }
      H.files.push({ file: nm, kind: "не распознан", rows: 0, comment: "файл .xls не похож на график работы" });
      return true;
    }
    if (!/\.xlsx$/i.test(nm) || !KPI.xlsx) return false;
    let book; try { book = await KPI.xlsx.readWorkbook(f.buffer); } catch (e) { return false; }
    for (const sh of book.sheets.filter((x) => /кросс|график|лист|sheet/i.test(x.name) || book.sheets.length === 1)) {
      const { rows } = await KPI.xlsx.readSheet(book, sh);
      if (!rows.length) continue;
      const k = kindOf(rows[0] || []);
      if (k) {
        const n = loadRows(rows, k, H);
        H.files.push({ file: nm, kind: { traf: "Трафик и чеки по часам", sub: "Подкатегории по часам", txn: "Чеки по часам (номера чеков)" }[k], rows: n, comment: `магазинов ${new Set(rows.slice(1).map((r) => r[0]).filter((s) => s && !/результат/i.test(s))).size}` });
        return true;
      }
      if (loadSchedule(rows, H)) { H.files.push({ file: nm, kind: "График работы", rows: 0, comment: "" }); return true; }
    }
    return false;
  }
  const ready = (H) => !!(H && Object.keys(H.traf).length + Object.keys(H.txn).length + Object.keys(H.sub).length);
  const stores = (H) => [...new Set([...Object.keys(H.traf), ...Object.keys(H.txn), ...Object.keys(H.sub)])].filter((s) => !/результат/i.test(s)).sort();

  // ---------------------------------------------------------------- позиция чека → подкатегория
  // сопоставляем позиции с подкатегориями по сумме оборота в каждом часе (точное разбиение), материал запоминается
  function assignSubs(H) {
    if (H._asg) return H._asg;
    const KNOWN = {}, out = {};
    const jobs = [];
    for (const [s, hs] of Object.entries(H.txn)) for (const [h, ds] of Object.entries(hs)) ds.forEach((items, d) => { if (items.length) jobs.push([s, h, d, items]); });
    jobs.sort((a, b) => a[3].length - b[3].length);
    for (const [s, h, d, items] of jobs) {
      const caps = {}; const S = H.sub[s] && H.sub[s][h] && H.sub[s][h][d];
      if (S) for (const [k, o] of Object.entries(S)) if (o.rev) caps[k] = o.rev;
      const it = items.map((x, i) => ({ i, m: x.m, v: x.rev })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
      const n = it.length, pos = new Array(n + 1).fill(0), neg = new Array(n + 1).fill(0);
      for (let i = n - 1; i >= 0; i--) { pos[i] = pos[i + 1] + Math.max(it[i].v, 0); neg[i] = neg[i + 1] + Math.min(it[i].v, 0); }
      const keys = Object.keys(caps), rem = Object.assign({}, caps), asg = new Array(n);
      let cnt = 0;
      const bt = (i) => {
        if (++cnt > 200000) return false;
        if (i === n) return keys.every((k) => Math.abs(rem[k]) < 0.5);
        for (const k of keys) if (rem[k] > pos[i] + 0.5 || rem[k] < neg[i] - 0.5) return false;
        const { m, v } = it[i];
        const cand = KNOWN[m] && KNOWN[m] in rem ? [KNOWN[m]] : keys.slice().sort((a, b) => (Math.abs(rem[a] - v) > 0.5) - (Math.abs(rem[b] - v) > 0.5) || Math.abs(rem[b]) - Math.abs(rem[a]));
        for (const k of cand) { const r0 = rem[k]; rem[k] = r0 - v; asg[i] = k; if (bt(i + 1)) return true; rem[k] = r0; }
        return false;
      };
      const ok = keys.length && bt(0);
      const res = new Array(n);
      it.forEach((x, j) => { res[x.i] = ok ? asg[j] : KNOWN[x.m] || null; if (ok) KNOWN[x.m] = asg[j]; });
      ((out[s] = out[s] || {})[h] = out[s][h] || [null, null])[d] = res;
    }
    // второй проход: что не разобралось — по уже известным материалам
    for (const [s, hs] of Object.entries(out)) for (const [h, ds] of Object.entries(hs)) ds.forEach((res, d) => { if (!res) return; H.txn[s][h][d].forEach((x, i) => { if (!res[i]) res[i] = KNOWN[x.m] || null; }); });
    H._asg = out;
    return out;
  }

  // ---------------------------------------------------------------- расчёт
  function sellersAt(sch, dayNum, h) {
    if (!sch) return null;
    let s = 0;
    for (const p of sch.staff) {
      if (!/продав/i.test(p.role)) continue;
      const v = p.days[dayNum]; if (!Array.isArray(v)) continue;
      const ov = Math.max(0, Math.min(v[1], h + 1) - Math.max(v[0], h));
      s += ov;
    }
    return s;
  }
  // чеки одного дня: {t: {lines: [{sub, role, fam, rev, h}], h}}
  function checks(H, s, d) {
    const A = assignSubs(H), T = {};
    for (const [h, ds] of Object.entries(H.txn[s] || {})) {
      const items = ds[d] || [], subs = (A[s] && A[s][h] && A[s][h][d]) || [];
      items.forEach((x, i) => { const sub = subs[i]; const role = sub ? roleOf(sub) : "other";
        const o = (T[x.t] = T[x.t] || { lines: [], h: +h }); o.lines.push({ sub, role, fam: role === "main" ? FAM_OF[+sub] : null, rev: x.rev, name: x.name }); });
    }
    return T;
  }
  function kitStats(H, codes, d) {
    const F = {}; FAM.forEach(([k, n]) => (F[k] = { k, name: n, main: 0, acc: 0, srv: 0, empty: 0, mainRev: 0, accRev: 0, srvRev: 0, emptyRev: 0, subs: {} }));
    const tot = { main: 0, acc: 0, srv: 0, empty: 0, mainRev: 0, accRev: 0, srvRev: 0, checks: 0, accOnly: 0, accOnlyRev: 0, byHour: {} };
    for (const s of codes) {
      const T = checks(H, s, d);
      for (const c of Object.values(T)) {
        const sum = c.lines.reduce((a, l) => a + l.rev, 0); if (sum <= 0) continue;   // возвраты
        tot.checks++;
        const mains = c.lines.filter((l) => l.role === "main" && l.rev > 0);
        if (!mains.length) { if (c.lines.some((l) => l.role === "acc" && l.rev > 0)) { tot.accOnly++; tot.accOnlyRev += c.lines.filter((l) => l.role === "acc").reduce((a, l) => a + l.rev, 0); } continue; }
        const accR = c.lines.filter((l) => l.role === "acc" && l.rev > 0).reduce((a, l) => a + l.rev, 0);
        const srvR = c.lines.filter((l) => l.role === "srv" && l.rev > 0).reduce((a, l) => a + l.rev, 0);
        const mainR = mains.reduce((a, l) => a + l.rev, 0);
        const top = mains.slice().sort((a, b) => b.rev - a.rev)[0], f = F[top.fam];
        const emp = !accR && !srvR;
        const hb = (tot.byHour[c.h] = tot.byHour[c.h] || { main: 0, empty: 0 }); hb.main++; if (emp) hb.empty++;
        tot.main++; tot.mainRev += mainR; tot.accRev += accR; tot.srvRev += srvR; if (accR) tot.acc++; if (srvR) tot.srv++; if (emp) tot.empty++;
        f.main++; f.mainRev += mainR; f.accRev += accR; f.srvRev += srvR; if (accR) f.acc++; if (srvR) f.srv++;
        if (emp) { f.empty++; f.emptyRev += mainR; const nm = (H.subName && H.subName[top.sub]) || top.sub; const o = (f.subs[nm] = f.subs[nm] || { n: 0, rev: 0 }); o.n++; o.rev += top.rev; }
      }
    }
    return { F, tot };
  }

  function analyze(H, code, opt) {
    opt = opt || {};
    const dates = [opt.d1 || null, opt.d2 || null];
    const sch = H.sched[code] || null;
    const dayNum = dates.map((dt) => (dt && sch && dt.getUTCFullYear() === sch.Y && dt.getUTCMonth() === sch.Mo ? dt.getUTCDate() : null));
    const T = H.traf[code] || {};
    // рабочие часы: 7–22, где хоть в один день был заметный трафик (шум вроде 00:00 отбрасываем)
    const hours = Object.keys(T).map(Number).filter((h) => h >= 7 && h <= 22 && T[h].some((x) => x.trf >= 3)).sort((a, b) => a - b);
    const all = stores(H);
    const regH = {};
    for (const s of Object.keys(H.traf)) for (const [h, ds] of Object.entries(H.traf[s])) ds.forEach((x, d) => { const o = ((regH[h] = regH[h] || [{ trf: 0, chk: 0 }, { trf: 0, chk: 0 }])[d]); o.trf += x.trf; o.chk += x.chk; });
    const rows = hours.map((h) => {
      const v = T[h];
      return { h, d: [0, 1].map((d) => { const x = v[d], sl = dayNum[d] ? sellersAt(sch, dayNum[d], h) : null;
        return { trf: x.trf, chk: x.chk, rev: x.rev, conv: x.trf > 0 ? (x.chk / x.trf) * 100 : null, sel: sl, tps: sl ? x.trf / sl : null }; }),
        reg: [0, 1].map((d) => (regH[h] && regH[h][d].trf > 0 ? (regH[h][d].chk / regH[h][d].trf) * 100 : null)) };
    });
    const sumR = (f, d) => rows.filter(f).reduce((a, r) => ({ trf: a.trf + r.d[d].trf, chk: a.chk + r.d[d].chk, rev: a.rev + r.d[d].rev, sel: a.sel + (r.d[d].sel || 0), n: a.n + 1 }), { trf: 0, chk: 0, rev: 0, sel: 0, n: 0 });
    const EV = (r) => r.h >= 18, DAY = (r) => r.h < 18, ALL = () => true;
    const part = (f) => [0, 1].map((d) => { const x = sumR(f, d); return Object.assign(x, { conv: x.trf ? (x.chk / x.trf) * 100 : null, avgSel: x.n && dayNum[d] ? x.sel / x.n : null, avg: x.chk ? x.rev / x.chk : null }); });
    const tot = part(ALL), ev = part(EV), day = part(DAY);
    const regTot = [0, 1].map((d) => { let t = 0, c = 0; for (const x of Object.values(regH)) { t += x[d].trf; c += x[d].chk; } return t ? (c / t) * 100 : null; });
    const regEv = [0, 1].map((d) => { let t = 0, c = 0; for (const [h, x] of Object.entries(regH)) if (+h >= 18) { t += x[d].trf; c += x[d].chk; } return t ? (c / t) * 100 : null; });
    // недобранные чеки во 2-й день: если бы конверсия каждого часа была как в 1-й день
    let lost = 0; const lostH = [];
    rows.forEach((r) => { const a = r.d[0], b = r.d[1]; if (isn(a.conv) && isn(b.conv) && a.conv > b.conv && b.trf > 0) { const l = ((a.conv - b.conv) / 100) * b.trf; lost += l; lostH.push([r.h, l]); } });
    const avgChk = tot[1].avg || tot[0].avg || 0;
    // график на месяц: продавцов по часам на каждый день
    let month = null;
    if (sch) {
      const hs = hours.length ? R(Math.min(...hours), Math.max(...hours)) : R(9, 21);
      month = { hours: hs, days: sch.days.map((dn) => ({ d: dn, wd: new Date(Date.UTC(sch.Y, sch.Mo, dn)).getUTCDay(), v: hs.map((h) => sellersAt(sch, dn, h)) })), Y: sch.Y, Mo: sch.Mo };
      month.weakEv = month.days.filter((x) => x.v.some((v, i) => hs[i] >= 19 && v < 1.5)).map((x) => x.d);
      month.sellers = sch.staff.filter((p) => /продав/i.test(p.role)).length;
    }
    // доля аксессуаров и услуг в обороте (по подкатегориям, все чеки): аксессуары на 100 ₽ основного товара
    const mix = (codes, d) => { const o = { main: 0, acc: 0, srv: 0 }; for (const s of codes) for (const ds of Object.values(H.sub[s] || {})) for (const [sub, x] of Object.entries(ds[d] || {})) { const ro = roleOf(sub); if (o[ro] != null) o[ro] += x.rev; } return o; };
    const subMix = H.sub[code] ? { st: [0, 1].map((d) => mix([code], d)), reg: [0, 1].map((d) => mix(Object.keys(H.sub), d)) } : null;
    // комплекты
    let kits = null;
    if (Object.keys(H.txn).length && H.txn[code]) {
      kits = [0, 1].map((d) => kitStats(H, [code], d));
      const reg = [0, 1].map((d) => kitStats(H, Object.keys(H.txn), d));
      kits.reg = reg;
      // лучшие магазины региона по доле чеков с аксессуаром (верхняя четверть, где ≥3 чеков с основным товаром)
      kits.best = [0, 1].map((d) => { const out = {}; FAM.forEach(([k]) => { const rates = [];
        for (const s2 of Object.keys(H.txn)) { const f = kitStats(H, [s2], d).F[k]; if (f.main >= 3) rates.push(f.acc / f.main); }
        rates.sort((a, b) => a - b); out[k] = rates.length >= 4 ? rates[Math.floor(rates.length * 0.75)] : null; }); return out; });
    }
    const res = { type: "hours", code, name: H.names[code] || "", dates, dayNum, sch: !!sch, schCode: Object.keys(H.sched), rows, tot, ev, day, regTot, regEv, lost, lostH, avgChk, month, kits, subMix, nStores: all.length };
    res.findings = findings(res);
    return res;
  }

  const pc = (v, d = 1) => (isn(v) ? v.toFixed(d).replace(".", ",") : "—");
  const sg = (v, d = 1) => (isn(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d).replace(".", ",") : "—");
  const rub = (v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1).replace(".", ",")} млн ₽` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)} тыс ₽` : `${Math.round(v)} ₽`);
  function findings(r) {
    const F = { cov: [], kit: [] }, a = r.tot[0], b = r.tot[1];
    if (isn(a.conv) && isn(b.conv)) F.cov.push(`Конверсия ${pc(a.conv)}% → ${pc(b.conv)}% (${sg(b.conv - a.conv)} п.п.): трафик ${a.trf} → ${b.trf}, чеков ${a.chk} → ${b.chk}.` + (isn(r.regTot[1]) ? ` В регионе во второй день ${pc(r.regTot[1])}%.` : ""));
    const e0 = r.ev[0], e1 = r.ev[1];
    if (e1.trf) F.cov.push(`Вечер с 18:00: ${e1.trf} посетителей (${pc((e1.trf / (b.trf || 1)) * 100, 0)}% дня), чеков ${e1.chk}, конверсия ${pc(e1.conv)}%` + (isn(e0.conv) ? ` (в первый день ${pc(e0.conv)}%)` : "") + (isn(r.regEv[1]) ? `, в регионе вечером ${pc(r.regEv[1])}%` : "") + "." +
      (isn(e1.avgSel) ? ` Продавцов вечером в среднем ${pc(e1.avgSel)}${isn(e0.avgSel) ? ` (в первый день ${pc(e0.avgSel)})` : ""}.` : ""));
    if (r.lost >= 0.5 && isn(a.conv) && isn(b.conv) && b.conv < a.conv) {
      const top = r.lostH.slice().sort((x, y) => y[1] - x[1]).slice(0, 3).map(([h, l]) => `${h}:00 (${pc(l, 1)})`);
      F.cov.push(`Если бы конверсия по часам осталась как в первый день, во второй было бы ещё ≈${Math.round(r.lost)} чек. (≈${rub(r.lost * r.avgChk)}). Больше всего потеряно: ${top.join(", ")}.`);
    }
    const thin = r.rows.filter((x) => isn(x.d[1].tps) && x.d[1].tps >= 12 && isn(x.d[1].conv) && isn(x.reg[1]) && x.d[1].conv < x.reg[1]);
    if (thin.length) F.cov.push(`Не хватает людей на трафик: ${thin.map((x) => `${x.h}:00 — ${Math.round(x.d[1].tps)} посет. на продавца`).join(", ")}; конверсия в эти часы ниже региона.`);
    const zero = r.rows.filter((x) => x.d[1].trf >= 5 && x.d[1].chk === 0);
    if (zero.length) F.cov.push(`Часы без единого чека при трафике: ${zero.map((x) => `${x.h}:00 (${x.d[1].trf} чел.)`).join(", ")}.`);
    if (r.month && r.month.weakEv.length) F.cov.push(`По графику месяца после 19:00 в зале один продавец или никого: ${r.month.weakEv.length} дн. (${r.month.weakEv.slice(0, 12).join(", ")}${r.month.weakEv.length > 12 ? "…" : ""}).`);
    if (!r.sch) F.cov.push(`Графика работы этого магазина нет — продавцы по часам не показаны.${r.schCode.length ? ` Загружен график: ${r.schCode.join(", ")}.` : ""}`);
    if (r.kits) {
      const [k0, k1] = r.kits, rg = r.kits.reg[1].tot, t0 = k0.tot, t1 = k1.tot;
      const p = (t, k) => (t.main ? (t[k] / t.main) * 100 : null);
      F.kit.push(`Чеков с основным товаром: ${t0.main} → ${t1.main}. С аксессуаром ${pc(p(t0, "acc"), 0)}% → ${pc(p(t1, "acc"), 0)}% (регион ${pc(p(rg, "acc"), 0)}%), с услугой ${pc(p(t0, "srv"), 0)}% → ${pc(p(t1, "srv"), 0)}% (регион ${pc(p(rg, "srv"), 0)}%).`);
      F.kit.push(`«Пустых» чеков (только основной товар, без аксессуаров и услуг): ${t0.empty} → ${t1.empty} — ${pc(p(t1, "empty"), 0)}% чеков с основным товаром.` + (t1.mainRev ? ` Аксессуары в тех же чеках на 100 ₽ основного товара: ${pc((t0.accRev / (t0.mainRev || 1)) * 100)} → ${pc((t1.accRev / t1.mainRev) * 100)} ₽ (регион ${pc((rg.accRev / (rg.mainRev || 1)) * 100)} ₽).` : ""));
      if (t1.accOnly) F.kit.push(`Отдельных чеков только с аксессуарами: ${t0.accOnly} → ${t1.accOnly} (${rub(t1.accOnlyRev)}). ${p(t1, "acc") < 5 && t1.accOnly >= 3 ? "Аксессуары пробиваются отдельно от основного товара — комплект в чек не собирается, проверьте, как продают и пробивают." : "Часть аксессуаров покупают отдельно, без основного товара."}`);
      const opp = oppList(r);
      const sm = r.subMix;
      if (sm && sm.st[1].main) F.kit.push(`Аксессуары на 100 ₽ основного товара по всем чекам дня: ${pc((sm.st[0].acc / (sm.st[0].main || 1)) * 100)} → ${pc((sm.st[1].acc / sm.st[1].main) * 100)} ₽ (регион ${pc((sm.reg[1].acc / (sm.reg[1].main || 1)) * 100)} ₽); услуги ${pc((sm.st[1].srv / sm.st[1].main) * 100)} ₽ (регион ${pc((sm.reg[1].srv / (sm.reg[1].main || 1)) * 100)} ₽).`);
      opp.filter((o) => o.empty > 0).slice(0, 4).forEach((o) => F.kit.push(`${o.name}: ${o.empty} из ${o.main} чеков без аксессуаров и услуг${o.top.length ? ` (${o.top.join(", ")})` : ""}. Предлагать: ${o.tip}.` + (o.kits >= 1 ? ` При доле комплектов как у лучших магазинов региона — ещё ≈${Math.round(o.kits)} компл. (≈${rub(o.rub)}).` : "")));
      const ev1 = Object.entries(t1.byHour).filter(([h]) => +h >= 18).reduce((a, [, x]) => ({ m: a.m + x.main, e: a.e + x.empty }), { m: 0, e: 0 });
      if (ev1.m) F.kit.push(`Вечером (с 18:00) ${ev1.e} из ${ev1.m} чеков с основным товаром «пустые».`);
    }
    return F;
  }
  // потенциал комплектов по семьям (второй день): пустые чеки × доля чеков с аксессуаром в регионе × средний аксессуар в регионе
  function oppList(r) {
    if (!r.kits) return [];
    const S = r.kits[1].F, G2 = r.kits.reg[1].F, B = r.kits.best ? r.kits.best[1] : {};
    return Object.values(S).filter((f) => f.main > 0).map((f) => {
      const g = G2[f.k], rate = g.main ? g.acc / g.main : 0, avgAcc = g.acc ? g.accRev / g.acc : 0;
      const tgt = isn(B[f.k]) ? Math.max(B[f.k], rate) : rate, kits = Math.max(0, tgt * f.main - f.acc);
      const top = Object.entries(f.subs).sort((a, b) => b[1].n - a[1].n).slice(0, 3).map(([n, o]) => `${n} (${o.n})`);
      return { k: f.k, name: f.name, main: f.main, empty: f.empty, accP: f.main ? (f.acc / f.main) * 100 : null, srvP: f.main ? (f.srv / f.main) * 100 : null, regAccP: rate * 100, regSrvP: g.main ? (g.srv / g.main) * 100 : null, bestP: tgt * 100, kits, rub: kits * avgAcc, top, tip: TIPS[f.k] || "" };
    }).sort((a, b) => b.empty - a.empty || b.rub - a.rub);
  }

  KPI.hours = { empty, tryLoad, ready, stores, analyze, oppList, roleOf, FAM, _assign: assignSubs, fmt: { pc, sg, rub } };
})(typeof globalThis !== "undefined" ? globalThis : this);
