/* «Итоги месяца»: расчёт показателей магазина или региона, «за счёт чего», выводы и план действий. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const M_ = () => KPI.month;
  const isn = (v) => typeof v === "number" && isFinite(v);
  const fmt = (v, d = 1, s = false) => KPI.analysis.fmt(v, d, s);
  const div = (a, b) => (isn(a) && isn(b) && b !== 0 ? a / b : null);
  const pct = (a, b) => (isn(a) && isn(b) && b > 0 ? (a / b - 1) * 100 : null);
  const pp = (a, b) => (isn(a) && isn(b) ? a - b : null);
  // компактные рубли для текста: 1,43 млн ₽, 735 тыс ₽
  function rubS(v, signed) {
    if (!isn(v)) return "—";
    const a = Math.abs(v), sg = v < 0 ? "−" : signed && v > 0 ? "+" : "";
    if (a >= 1e9) return `${sg}${fmt(a / 1e9, 2)} млрд ₽`;
    if (a >= 1e6) return `${sg}${fmt(a / 1e6, a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2)} млн ₽`;
    if (a >= 1e3) return `${sg}${fmt(a / 1e3, 0)} тыс ₽`;
    return `${sg}${fmt(a, 0)} ₽`;
  }
  const pctS = (v, d = 1) => (isn(v) ? `${fmt(v, d, true)}%` : "—");
  const ppS = (v, d = 1) => (isn(v) ? `${fmt(v, d, true)} п.п.` : "—");

  // ---------------------------------------------------------------- историческая справка: суммы за период
  const HB = { rev: "Оборот", traffic: "Трафик", checks: "Кол-во чеков", items: "Кол-во товаров", acc: "Оборот Акс", srv: "Оборот услуги",
    credit: "Оборот Кредита", pickup: "Оборот PickUP", b2b: "Оборот B2B", sellers: "Кол-во продавцов с чеками" };
  const HP = { plan: ["Вып. плана оборот", "rev"], planAcc: ["Вып. плана акс", "acc"], planSrv: ["Вып. плана услуги", "srv"] };
  function histPeriod(M, codes, y, months) {
    const o = { n: 0 }; Object.keys(HB).forEach((k) => (o[k] = 0)); o.plan = 0; o.planAcc = 0; o.planSrv = 0; o.dig = 0; o.digBase = 0;
    const has = {};
    if (!M.hist) return null;
    for (const c of codes) {
      const st = M.hist.stores[c]; const Y = st && st.y[y]; if (!Y) continue;
      let any = false;
      for (const m of months) {
        for (const [k, nm] of Object.entries(HB)) { const a = Y[nm]; if (a && isn(a[m])) { o[k] += a[m]; has[k] = true; if (k === "rev" && a[m] !== 0) any = true; } }
        for (const [k, [nm, base]] of Object.entries(HP)) {
          const a = Y[nm], b = Y[HB[base]];
          if (a && b && isn(a[m]) && a[m] > 0 && isn(b[m])) { o[k] += b[m] / (a[m] / 100); o[k + "Base"] = (o[k + "Base"] || 0) + b[m]; has[k] = true; }
        }
        const d = Y["Доля Digital"], r = Y["Оборот"];
        if (d && r && isn(d[m]) && isn(r[m])) { o.dig += (d[m] / 100) * r[m]; o.digBase += r[m]; has.dig = true; }
      }
      if (any) o.n++;
    }
    if (!o.n) return null;
    const d = (k) => (has[k] ? o[k] : null);
    const R = { n: o.n, rev: d("rev"), traffic: d("traffic"), checks: d("checks"), items: d("items"), acc: d("acc"), srv: d("srv"), credit: d("credit"),
      pickup: d("pickup"), b2b: d("b2b"), sellers: months.length === 1 ? d("sellers") : null };
    R.conv = div(R.checks, R.traffic); if (R.conv != null) R.conv *= 100;
    R.avg = div(R.rev, R.checks); R.price = div(R.rev, R.items); R.upt = div(R.items, R.checks);
    const sh = (a) => { const x = div(a, R.rev); return x == null ? null : x * 100; };
    R.accSh = sh(R.acc); R.srvSh = sh(R.srv); R.creditSh = sh(R.credit); R.pickupSh = sh(R.pickup); R.b2bSh = sh(R.b2b);
    R.planPct = has.plan ? div(o.planBase, o.plan) * 100 : null;
    R.accPlanPct = has.planAcc ? div(o.planAccBase, o.planAcc) * 100 : null;
    R.srvPlanPct = has.planSrv ? div(o.planSrvBase, o.planSrv) * 100 : null;
    R.dig = has.dig ? div(o.dig, o.digBase) * 100 : null;
    R.planRub = has.plan ? o.plan : null;
    return R;
  }
  const KPI_ROWS = [  // [ключ, название, тип: sum|avg|pct, знаков]
    ["rev", "Оборот", "sum", 0], ["traffic", "Трафик", "sum", 0], ["checks", "Чеки", "sum", 0], ["conv", "Конверсия", "pct", 1],
    ["eff", "Эффективность", "eff", 1], ["avg", "Средний чек", "avg", 0], ["price", "Средняя цена", "avg", 0], ["upt", "Штук в чеке", "avg", 2],
    ["acc", "Оборот аксессуаров", "sum", 0], ["accSh", "Доля аксессуаров", "pct", 1], ["srv", "Оборот услуг", "sum", 0], ["srvSh", "Доля услуг", "pct", 1],
    ["creditSh", "Доля кредита", "pct", 1], ["pickupSh", "Доля PickUp (интернет)", "pct", 1], ["b2bSh", "Доля B2B", "pct", 1], ["dig", "Доля Digital", "pct", 1],
  ];
  function deltaOf(type, k, a, b) {
    if (!a || !b) return null;
    if (type === "eff") { const r = pct(a.rev, b.rev), t = pct(a.traffic, b.traffic); return r != null && t != null ? r - t : null; }
    if (type === "pct") return pp(a[k], b[k]);
    return pct(a[k], b[k]);
  }
  // разложение изменения оборота: трафик × конверсия × средний чек (и чек = цена × штуки в чеке), в рублях
  function decompose(a, b) {
    if (!a || !b || !(a.rev > 0) || !(b.rev > 0) || !(a.traffic > 0) || !(b.traffic > 0) || !(a.checks > 0) || !(b.checks > 0)) return null;
    const dR = a.rev - b.rev, L = Math.log(a.rev / b.rev);
    const parts = { traffic: Math.log(a.traffic / b.traffic), conv: Math.log(a.conv / b.conv), price: Math.log(a.price / b.price), upt: Math.log(a.upt / b.upt) };
    const out = { dR };
    if (Math.abs(L) < 1e-9) { Object.keys(parts).forEach((k) => (out[k] = 0)); return out; }
    Object.entries(parts).forEach(([k, v]) => (out[k] = (v / L) * dR));
    out.avg = out.price + out.upt;
    return out;
  }

  // магазин работал полный месяц: оборот не меньше четверти от его обычного месячного (медиана за 12 месяцев до этого)
  function fullMonth(M, code, y, m) {
    const st = M.hist && M.hist.stores[code]; if (!st) return false;
    const get = (yy, mm) => { const a = st.y[yy] && st.y[yy]["Оборот"]; return a && isn(a[mm]) ? a[mm] : null; };
    const v = get(y, m); if (!(v > 0)) return false;
    const hist = [];
    for (let k = 1; k <= 12; k++) { let mm = m - k, yy = y; while (mm < 0) { mm += 12; yy--; } const x = get(yy, mm); if (x > 0) hist.push(x); }
    if (hist.length < 3) return false;           // новый магазин — не сравниваем
    hist.sort((a, b) => a - b);
    return v >= hist[Math.floor(hist.length / 2)] * 0.25;
  }

  // ---------------------------------------------------------------- анализ выбранного объекта
  function analyze(M, sel, norms) {
    norms = Object.assign({}, KPI.analysis.DEFAULT_NORMS, norms || {});
    const MM = M_();
    const codes = MM.codesFor(M, sel);
    const Y = M.Y, Mo = M.Mo, pm = (Mo + 11) % 12, pY = Mo === 0 ? Y - 1 : Y;
    const mName = MM.MONTHS[Mo], prevName = MM.MONTHS[pm];
    const res = { type: "month", level: sel.level, sel, code: sel.level === "store" ? sel.code : sel.name, M, Y, Mo, norms, codes,
      monthLabel: `${mName[0].toUpperCase() + mName.slice(1)} ${Y}`, prevLabel: prevName, pyLabel: `${mName} ${Y - 1}`, notes: [] };
    if (sel.level === "store") {
      const a = MM.attrs(M, sel.code); res.attrs = a;
      res.name = `Магазин ${sel.code}`; res.sub = [a.city, a.asm ? `ASM ${a.asm}` : "", a.dsm].filter(Boolean).join(" · ");
      res.bench = a.asm ? { level: "asm", name: a.asm, codes: MM.codesFor(M, { level: "asm", name: a.asm }) } : null;
    } else if (sel.level === "group") {
      res.code = codes.length <= 4 ? codes.join("_") : `${codes.slice(0, 3).join("_")}_i_dr`;
      res.name = codes.length <= 4 ? `Магазины ${codes.join(", ")}` : `Магазины ${codes.slice(0, 3).join(", ")} и ещё ${codes.length - 3}`;
      const asms = [...new Set(codes.map((c) => MM.attrs(M, c).asm).filter(Boolean))], dsms = [...new Set(codes.map((c) => MM.attrs(M, c).dsm).filter(Boolean))];
      res.sub = `выбрано магазинов: ${codes.length}${asms.length ? " · " + asms.join(", ") : ""}`;
      res.bench = asms.length === 1 ? { level: "asm", name: asms[0], codes: MM.codesFor(M, { level: "asm", name: asms[0] }) }
        : dsms.length === 1 ? { level: "dsm", name: dsms[0], codes: MM.codesFor(M, { level: "dsm", name: dsms[0] }) } : null;
    } else {
      res.name = sel.name; res.sub = sel.level === "asm" ? `ASM · магазинов ${codes.length}` : sel.level === "dsm" ? `Дивизион · магазинов ${codes.length}` : `магазинов ${codes.length}`;
      const d = codes.length ? MM.attrs(M, codes[0]).dsm : "";
      res.bench = sel.level === "asm" && d ? { level: "dsm", name: d, codes: MM.codesFor(M, { level: "dsm", name: d }) } : null;
    }
    const ytdM = []; for (let m = 0; m <= Mo; m++) ytdM.push(m);
    // ---- KPI из справки
    if (M.hist) {
      const P = { cur: histPeriod(M, codes, Y, [Mo]), prev: histPeriod(M, codes, pY, [pm]), py: histPeriod(M, codes, Y - 1, [Mo]),
        ytd: histPeriod(M, codes, Y, ytdM), ytdPy: histPeriod(M, codes, Y - 1, ytdM) };
      // LfL: магазины с оборотом и в этом, и в прошлом году
      const lfl = codes.filter((c) => fullMonth(M, c, Y, Mo) && fullMonth(M, c, Y - 1, Mo));
      P.lflCur = lfl.length ? histPeriod(M, lfl, Y, [Mo]) : null; P.lflPy = lfl.length ? histPeriod(M, lfl, Y - 1, [Mo]) : null;
      res.lflN = lfl.length; res.P = P;
      res.kpi = KPI_ROWS.map(([k, label, type, d]) => {
        const cur = type === "eff" ? null : P.cur ? P.cur[k] : null;
        return { k, label, type, d, cur, ytd: type === "eff" ? null : P.ytd ? P.ytd[k] : null,
          dPrev: deltaOf(type, k, P.cur, P.prev), dPy: deltaOf(type, k, P.cur, P.py), dLfl: deltaOf(type, k, P.lflCur, P.lflPy), dYtd: deltaOf(type, k, P.ytd, P.ytdPy) };
      }).filter((r) => r.cur != null || r.dPy != null || r.dPrev != null);
      res.decPy = decompose(P.cur, P.py); res.decPrev = decompose(P.cur, P.prev);
      // помесячная динамика оборота: этот и прошлый год
      res.series = [Y - 1, Y].map((yy) => ({ year: yy, rev: Array.from({ length: 12 }, (_, m) => { const p = histPeriod(M, codes, yy, [m]); return p ? p.rev : null; }),
        conv: Array.from({ length: 12 }, (_, m) => { const p = histPeriod(M, codes, yy, [m]); return p ? p.conv : null; }) }));
      if (res.bench) { const b = histPeriod(M, res.bench.codes, Y, [Mo]); res.benchCur = b; res.benchPy = histPeriod(M, res.bench.codes, Y - 1, [Mo]); }
    } else res.notes.push("Нет исторической справки — оборот, трафик, конверсия и чек не рассчитаны.");
    // ---- гросс-маржа
    if (M.g && (M.g.month || M.g.prev || M.g.ytd)) {
      const g = {};
      for (const k of ["month", "prev", "ytd"]) {
        const G2 = M.g[k]; if (!G2) continue;
        let rev = 0, gm = 0, n = 0;
        for (const c of codes) { const v = G2.stores[c]; if (v) { rev += v.rev; gm += v.gm; n++; } }
        if (n) g[k] = { rev, gm, pct: rev ? (gm / rev) * 100 : null, n };
      }
      if (g.month) {
        g.dPrevGm = g.prev ? pct(g.month.gm, g.prev.gm) : null; g.dPrevPct = g.prev ? pp(g.month.pct, g.prev.pct) : null;
        g.dYtdPct = g.ytd ? pp(g.month.pct, g.ytd.pct) : null;
      }
      if (res.bench && M.g.month) {
        let rev = 0, gm = 0; for (const c of res.bench.codes) { const v = M.g.month.stores[c]; if (v) { rev += v.rev; gm += v.gm; } }
        g.benchPct = rev ? (gm / rev) * 100 : null;
      }
      if (Object.keys(g).length) res.gross = g;
    }
    if (M.ggroup) {
      const A = {};
      for (const c of codes) for (const x of M.ggroup.stores[c] || []) { const o = A[x.id] || (A[x.id] = { id: x.id, name: x.name, rev: 0, gm: 0 }); o.rev += x.rev; o.gm += x.gm; }
      const L = Object.values(A).map((o) => ({ ...o, pct: o.rev > 0 ? (o.gm / o.rev) * 100 : null }));
      if (L.length) res.ggroups = { top: [...L].sort((a, b) => b.gm - a.gm).slice(0, 10), neg: L.filter((o) => o.gm < 0).sort((a, b) => a.gm - b.gm).slice(0, 10), total: L.reduce((a, o) => a + o.gm, 0) };
    }
    // ---- подкатегории: топ-15 роста и падения к прошлому месяцу
    if (M.cat) {
      const A = {};
      for (const c of codes) for (const x of M.cat.stores[c] || []) {
        const o = A[x.id] || (A[x.id] = { id: x.id, name: x.name, rev: [0, 0, 0], qty: [0, 0, 0], checks: [0, 0, 0] });
        for (let k = 0; k < 3; k++) { o.rev[k] += x.rev[k]; o.qty[k] += x.qty[k]; o.checks[k] += x.checks[k]; }
      }
      const tot = Object.values(A).reduce((a, o) => a + o.rev[2], 0);
      const L = Object.values(A).filter((o) => o.rev[1] || o.rev[2]).map((o) => {
        const pr = (k) => (o.qty[k] > 0 ? o.rev[k] / o.qty[k] : null), ch = (k) => (o.checks[k] > 0 ? o.rev[k] / o.checks[k] : null);
        return { id: o.id, name: o.name, rev: o.rev[2], revPrev: o.rev[1], revYtd: o.rev[0], d: o.rev[2] - o.rev[1], dPct: pct(o.rev[2], o.rev[1]),
          qty: o.qty[2], qtyPrev: o.qty[1], dQty: pct(o.qty[2], o.qty[1]), price: pr(2), dPrice: pct(pr(2), pr(1)), chk: ch(2), dChk: pct(ch(2), ch(1)), share: tot ? (o.rev[2] / tot) * 100 : null };
      });
      res.cats = { top: L.filter((o) => o.d > 0).sort((a, b) => b.d - a.d).slice(0, 15), anti: L.filter((o) => o.d < 0).sort((a, b) => a.d - b.d).slice(0, 15), total: tot,
        totalPrev: Object.values(A).reduce((a, o) => a + o.rev[1], 0), n: L.length };
    }
    // ---- аксессуары (отчётный месяц, к прошлому году)
    const accAgg = (cs) => {
      if (!M.acc) return null;
      const E = {}, T = {};
      for (const c of cs) { const st = M.acc.stores[c]; const mm = st && st.m[Mo]; if (!mm) continue;
        for (const [eco, o] of Object.entries(mm)) { const e = E[eco] || (E[eco] = {}); for (const [k, v] of Object.entries(o)) { e[k] = (e[k] || 0) + v; T[k] = (T[k] || 0) + v; } } }
      if (!Object.keys(T).length) return null;
      const der = (o, name) => ({ name, acc: o.acc || 0, rev: o.rev || 0, accPY: o.accPY || 0, revPY: o.revPY || 0, sh: o.rev ? ((o.acc || 0) / o.rev) * 100 : null,
        shPY: o.revPY ? ((o.accPY || 0) / o.revPY) * 100 : null, yoy: pct(o.acc, o.accPY), d: (o.acc || 0) - (o.accPY || 0),
        att: o.chkGoodsR ? ((o.chkAccR || 0) / o.chkGoodsR) * 100 : null, attPY: o.chkGoodsPYR ? ((o.chkAccPYR || 0) / o.chkGoodsPYR) * 100 : null,
        plan: o.planAcc ? ((o.acc || 0) / o.planAcc) * 100 : null, price: o.accQty ? o.acc / o.accQty : null });
      const t = der(T, "Всего");
      t.dSh = pp(t.sh, t.shPY); t.dAtt = pp(t.att, t.attPY);
      const eco = Object.entries(E).map(([n, o]) => { const x = der(o, n); x.dSh = pp(x.sh, x.shPY); x.dAtt = pp(x.att, x.attPY); return x; }).filter((x) => x.rev || x.acc).sort((a, b) => b.acc - a.acc);
      return { t, eco };
    };
    res.acc = accAgg(codes);
    if (res.acc && res.bench) res.accBench = accAgg(res.bench.codes);
    if (M.acc && M.acc.cover[Mo] != null && M.acc.cover[Mo] < M.dim * 0.9) res.notes.push(`В отчёте по аксессуарам за ${MM.MONTHS[Mo]} не все дни (${M.acc.cover[Mo]} из ${M.dim}).`);
    // ---- сервисы по категориям
    const srvAgg = (cs, m) => {
      if (!M.srvCat) return null;
      const E = {}, T = {};
      for (const c of cs) { const st = M.srvCat.stores[c]; const mm = st && st.m[m]; if (!mm) continue;
        for (const [eco, o] of Object.entries(mm)) { const e = E[eco] || (E[eco] = {}); for (const [k, v] of Object.entries(o)) { e[k] = (e[k] || 0) + v; T[k] = (T[k] || 0) + v; } } }
      if (!Object.keys(T).length) return null;
      const der = (o, name) => ({ name, srv: o.srv || 0, rev: o.rev || 0, srvPY: o.srvPY || 0, revPY: o.revPY || 0, sh: o.rev ? ((o.srv || 0) / o.rev) * 100 : null,
        shPY: o.revPY ? ((o.srvPY || 0) / o.revPY) * 100 : null, yoy: pct(o.srv, o.srvPY), d: (o.srv || 0) - (o.srvPY || 0),
        plan: o.planSrv ? ((o.srv || 0) / o.planSrv) * 100 : null, pen: o.goodsQty ? ((o.srvQty || 0) / o.goodsQty) * 100 : null, price: o.srvQty ? o.srv / o.srvQty : null });
      const t = der(T, "Всего"); t.dSh = pp(t.sh, t.shPY);
      const eco = Object.entries(E).map(([n, o]) => { const x = der(o, n); x.dSh = pp(x.sh, x.shPY); return x; }).filter((x) => x.rev || x.srv || x.srvPY).sort((a, b) => b.srv - a.srv);
      return { t, eco };
    };
    res.srv = srvAgg(codes, Mo);
    if (res.srv && res.bench) res.srvBench = srvAgg(res.bench.codes, Mo);
    if (M.srvCat && M.srvCat.cover[Mo] != null && M.srvCat.cover[Mo] < M.dim * 0.9) res.notes.push(`В отчёте по сервисам за ${MM.MONTHS[Mo]} не все дни (${M.srvCat.cover[Mo]} из ${M.dim}).`);
    // ---- виды сервисов
    const typeAgg = (cs, m) => {
      if (!M.srvType) return null;
      const T = {};
      for (const c of cs) { const o = M.srvType.stores[c] && M.srvType.stores[c][m]; if (!o) continue; for (const [k, v] of Object.entries(o)) T[k] = (T[k] || 0) + v; }
      if (!Object.keys(T).length) return null;
      const types = MM.SRVT.filter(([k]) => M.srvType.has[k]).map(([k, name]) => ({ k, name, rub: T[k] || 0, qty: T[k + "Q"] || 0,
        sh: T.srv ? ((T[k] || 0) / T.srv) * 100 : null, pen: T.goodsQty ? ((T[k + "Q"] || 0) / T.goodsQty) * 100 : null, price: T[k + "Q"] > 0 ? T[k] / T[k + "Q"] : null }));
      const ext = ["ext2", "ext3", "ext5"].map((k, i) => ({ name: ["2 года", "3 года", "5 лет"][i], rub: T[k] || 0, qty: T[k + "q"] || 0 }));
      return { types, ext, srv: T.srv || 0, rev: T.rev || 0, goodsQty: T.goodsQty || 0, chdu: T.netBase ? ((T.net || 0) / T.netBase) * 100 : null, net: T.net || 0 };
    };
    res.types = typeAgg(codes, Mo);
    if (res.types && res.bench) {
      res.typesBench = typeAgg(res.bench.codes, Mo);
      if (res.typesBench) for (const t of res.types.types) {
        const b = res.typesBench.types.find((x) => x.k === t.k);
        t.benchPen = b ? b.pen : null;
        if (b && isn(b.pen) && isn(t.pen) && b.pen > t.pen && res.types.goodsQty > 0) t.potential = ((b.pen - t.pen) / 100) * res.types.goodsQty * (t.price || b.price || 0);
      }
    }
    // ---- полнота данных по магазинам выбора
    if (sel.level !== "store" && codes.length) {
      const cov = [["Гросс-маржа", M.g && (M.g.month || M.g.ytd) ? (c) => !!((M.g.month && M.g.month.stores[c]) || (M.g.ytd && M.g.ytd.stores[c])) : null],
        ["Категории", M.cat ? (c) => !!M.cat.stores[c] : null], ["Аксессуары", M.acc ? (c) => !!M.acc.stores[c] : null], ["Сервисы", M.srvCat ? (c) => !!M.srvCat.stores[c] : null]];
      for (const [nm, f] of cov) {
        if (!f) continue;
        const k = codes.filter(f).length;
        if (k && k < codes.length) res.notes.push(`${nm}: данные есть по ${k} из ${codes.length} магазинов — итоги по этому блоку только по ним.`);
        else if (!k) res.notes.push(`${nm}: в загруженном файле нет магазинов этого региона.`);
      }
    }
    // ---- магазины региона
    if (sel.level !== "store") res.stores = storeRows(M, codes, Y, Mo, pY, pm);
    // ---- выводы и действия
    insights(res);
    return res;
  }

  function storeRows(M, codes, Y, Mo, pY, pm) {
    return codes.map((c) => {
      const a = M_().attrs(M, c);
      const cur = histPeriod(M, [c], Y, [Mo]), py = histPeriod(M, [c], Y - 1, [Mo]), prev = histPeriod(M, [c], pY, [pm]);
      const g = M.g && M.g.month && M.g.month.stores[c];
      const tt = M.srvType && M.srvType.stores[c] && M.srvType.stores[c][Mo];
      const part = !fullMonth(M, c, Y, Mo) ? "неполный месяц" : !fullMonth(M, c, Y - 1, Mo) ? "новый" : "";
      return { code: c, part, city: a.city, asm: a.asm, rev: cur ? cur.rev : g ? g.rev : null, dPy: cur && py ? pct(cur.rev, py.rev) : null, dPrev: cur && prev ? pct(cur.rev, prev.rev) : null,
        conv: cur ? cur.conv : null, dConv: cur && py ? pp(cur.conv, py.conv) : null, eff: cur && py ? deltaOf("eff", "", cur, py) : null,
        avg: cur ? cur.avg : null, dAvg: cur && py ? pct(cur.avg, py.avg) : null, plan: cur ? cur.planPct : null,
        gmPct: g && g.rev ? (g.gm / g.rev) * 100 : null, gm: g ? g.gm : null, accSh: cur ? cur.accSh : null, srvSh: cur ? cur.srvSh : null,
        chdu: tt && tt.netBase ? (tt.net / tt.netBase) * 100 : null };
    }).filter((r) => r.rev != null).sort((a, b) => (b.rev || 0) - (a.rev || 0));
  }

  // ---------------------------------------------------------------- выводы
  function insights(res) {
    const good = [], bad = [], act = [];
    const fix = (t) => t.replace(/\.\.$/, ".").replace(/п\.п\.\)\./g, "п.п.).");
    const G_ = (area, text) => good.push({ area, text: fix(text) }), B = (area, text) => bad.push({ area, text: fix(text) });
    const A = (prio, area, what, why) => act.push({ prio, area, what, why });
    const who = res.level === "store" ? "магазин" : "регион";
    const P = res.P || {}, cur = P.cur, py = P.py, prev = P.prev;
    const row = (k) => (res.kpi || []).find((r) => r.k === k) || {};
    const MM = M_(), pmName = MM.MONTHS_GEN[(res.Mo + 11) % 12];
    if (cur) {
      const r = row("rev");
      const dd = [["к " + pmName.replace(/я$/, "ю").replace(/а$/, "у"), r.dPrev], ["к прошлому году", r.dPy], ["LfL", res.level !== "store" ? r.dLfl : null], ["с начала года", r.dYtd]].filter((x) => isn(x[1]));
      const neg = dd.filter((x) => x[1] < 0);
      const txt = dd.map((x) => `${x[0]} ${pctS(x[1])}`).join(", ");
      if (neg.length) B("Оборот", `Оборот ${rubS(cur.rev)}: ${txt}.`); else if (dd.length) G_("Оборот", `Оборот ${rubS(cur.rev)} растёт: ${txt}.`);
      // за счёт чего (к прошлому году)
      const dec = res.decPy;
      if (dec && py) {
        const parts = [["трафик", dec.traffic], ["конверсия", dec.conv], ["средняя цена", dec.price], ["штуки в чеке", dec.upt]].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
        const s = parts.map(([n, v]) => `${n} ${rubS(v, true)}`).join(", ");
        (dec.dR < 0 ? B : G_)("За счёт чего", `Изменение оборота к прошлому году ${rubS(dec.dR, true)}: ${s}.`);
        const worst = parts.filter((p) => p[1] < 0)[0];
        if (dec.dR < 0 && worst) {
          const W = { "трафик": ["Трафик", "Вернуть поток: локальная реклама, акции выходного дня, работа с ТЦ, проверить график и витрину"],
            "конверсия": ["Конверсия", "Поднять конверсию: выход продавцов к каждому покупателю, разбор отказов, наличие ходовых моделей, кредит как инструмент закрытия сделки"],
            "средняя цена": ["Средняя цена", "Поднять среднюю цену: смещение в средний и премиальный сегмент, демонстрация старших моделей, трейд-ин"],
            "штуки в чеке": ["Штуки в чеке", "Поднять штуки в чеке: комплексная продажа (товар + аксессуар + услуга) в каждом чеке, допродажа на кассе"] }[worst[0]];
          A("Высокий", W[0], W[1] + ".", `${worst[0][0].toUpperCase() + worst[0].slice(1)} дал ${rubS(worst[1], true)} к прошлому году.`);
        }
      }
      const cv = row("conv"), ef = row("eff");
      if (isn(cv.dPy) && cv.dPy < 0) B("Конверсия", `Конверсия ${fmt(cur.conv, 1)}% упала к прошлому году на ${fmt(-cv.dPy, 1)} п.п.${isn(cv.dPrev) ? ` (к прошлому месяцу ${ppS(cv.dPrev)})` : ""}.`);
      else if (isn(cv.dPy)) G_("Конверсия", `Конверсия ${fmt(cur.conv, 1)}%, к прошлому году ${ppS(cv.dPy)}.`);
      if (isn(ef.dPy) && ef.dPy < 0) { B("Эффективность", `Эффективность ${ppS(ef.dPy)} к прошлому году: оборот падает быстрее трафика — теряем на каждом посетителе.`);
        A("Высокий", "Эффективность", "Разобрать работу с посетителем: встреча в зале, выявление потребности, презентация, закрытие. Ежедневные пятиминутки по конверсии и чеку.", `Эффективность ${ppS(ef.dPy)}.`); }
      else if (isn(ef.dPy)) G_("Эффективность", `Эффективность ${ppS(ef.dPy)} к прошлому году.`);
      const av = row("avg");
      if (isn(av.dPy) && av.dPy < -2 && dec) B("Средний чек", `Средний чек ${fmt(cur.avg, 0)} ₽ (${pctS(av.dPy)} к прошлому году): ${Math.abs(dec.price) > Math.abs(dec.upt) ? "в основном из-за средней цены" : "в основном из-за штук в чеке"} (цена ${pctS(row("price").dPy)}, штуки в чеке ${pctS(row("upt").dPy)}).`);
      const pl = row("planPct");
      if (isn(cur.srvSh) && cur.srvSh < res.norms.srv_share_min) B("Услуги", `Доля услуг ${fmt(cur.srvSh, 1)}% — ниже нормы ${fmt(res.norms.srv_share_min, 1)}%.`);
      if (res.benchCur && isn(res.benchCur.conv) && isn(cur.conv) && (res.level === "store" || res.level === "group")) {
        const d = cur.conv - res.benchCur.conv;
        if (d < -1) B("Сравнение с регионом", `Конверсия на ${fmt(-d, 1)} п.п. ниже, чем в среднем по ${res.bench.name} (${fmt(res.benchCur.conv, 1)}%).`);
        else if (d > 1) G_("Сравнение с регионом", `Конверсия на ${fmt(d, 1)} п.п. выше, чем в среднем по ${res.bench.name}.`);
      }
    }
    // гросс
    const g = res.gross;
    if (g && g.month) {
      const t = `Гросс-маржа ${rubS(g.month.gm)} (${fmt(g.month.pct, 1)}% оборота)`;
      if (isn(g.dPrevPct) && g.dPrevPct < -0.3) { B("Гросс-маржа", `${t}: маржинальность ${ppS(g.dPrevPct)} к прошлому месяцу${isn(g.dPrevGm) ? `, в рублях ${pctS(g.dPrevGm)}` : ""}.`);
        A("Средний", "Гросс-маржа", "Проверить скидки и продажи ниже рекомендованной цены, сместить продажи в маржинальные категории и аксессуары, услуги.", `Маржинальность ${ppS(g.dPrevPct)} к прошлому месяцу.`); }
      else G_("Гросс-маржа", `${t}${isn(g.dPrevPct) ? `, к прошлому месяцу ${ppS(g.dPrevPct)}` : ""}.`);
      if (isn(g.benchPct) && (res.level === "store" || res.level === "group") && g.month.pct < g.benchPct - 1) B("Гросс-маржа", `Маржинальность на ${fmt(g.benchPct - g.month.pct, 1)} п.п. ниже средней по ${res.bench.name} (${fmt(g.benchPct, 1)}%).`);
    }
    if (res.ggroups && res.ggroups.neg.length) {
      const n = res.ggroups.neg.slice(0, 3).map((x) => `${x.name} (${rubS(x.gm)})`).join(", ");
      B("Гросс-маржа", `Отрицательная маржа: ${n}.`);
    }
    // категории
    if (res.cats) {
      const c = res.cats;
      if (c.anti.length) {
        const n = c.anti.slice(0, 3).map((x) => `${x.name} ${rubS(x.d, true)}${isn(x.dQty) && isn(x.dPrice) ? ` (штуки ${pctS(x.dQty, 0)}, цена ${pctS(x.dPrice, 0)})` : ""}`).join("; ");
        B("Категории", `Сильнее всего упали к прошлому месяцу: ${n}.`);
        const x = c.anti[0];
        A("Высокий", "Категории", `Разобрать падение «${x.name}»: наличие и выкладка ходовых моделей, цены против конкурентов, акции, обучение продавцов по категории.`, `«${x.name}» ${rubS(x.d, true)} к прошлому месяцу.`);
      }
      if (c.top.length) G_("Категории", "Больше всего выросли: " + c.top.slice(0, 3).map((x) => `${x.name} ${rubS(x.d, true)}`).join("; ") + ".");
    }
    // аксессуары
    if (res.acc) {
      const t = res.acc.t;
      const s = `Доля аксессуаров ${fmt(t.sh, 1)}%${isn(t.dSh) ? ` (${ppS(t.dSh)} к прошлому году)` : ""}, оборот АКС ${rubS(t.acc)}${isn(t.yoy) ? ` (${pctS(t.yoy)})` : ""}`;
      ((isn(t.dSh) && t.dSh < 0) ? B : G_)("Аксессуары", s + (isn(t.att) ? `, аттач ${fmt(t.att, 1)}%${isn(t.dAtt) ? ` (${ppS(t.dAtt)})` : ""}` : "") + ".");
      const dn = res.acc.eco.filter((e) => e.d < 0).sort((a, b) => a.d - b.d);
      if (dn.length && t.d < 0) {
        B("Аксессуары", "Аксессуары падают за счёт: " + dn.slice(0, 3).map((e) => `${e.name} ${rubS(e.d, true)}`).join(", ") + ".");
        A("Средний", "Аксессуары", `Комплексная продажа в «${dn[0].name}»: аксессуар к каждому основному товару, выкладка у товара, мотивация на аттач.`, `«${dn[0].name}» ${rubS(dn[0].d, true)} по аксессуарам к прошлому году.`);
      }
      const bn = res.accBench && res.accBench.t;
      if (bn && isn(bn.sh) && isn(t.sh) && (res.level === "store" || res.level === "group") && t.sh < bn.sh - 0.5) B("Аксессуары", `Доля аксессуаров на ${fmt(bn.sh - t.sh, 1)} п.п. ниже средней по ${res.bench.name} (${fmt(bn.sh, 1)}%).`);
    }
    // сервисы
    if (res.srv) {
      const t = res.srv.t;
      const s = `Услуги ${rubS(t.srv)}, доля ${fmt(t.sh, 1)}%${isn(t.dSh) ? ` (${ppS(t.dSh)} к прошлому году)` : ""}`;
      ((isn(t.dSh) && t.dSh < 0) ? B : G_)("Услуги", s + ".");
      const up = res.srv.eco.filter((e) => e.d > 0).sort((a, b) => b.d - a.d), dn = res.srv.eco.filter((e) => e.d < 0).sort((a, b) => a.d - b.d);
      if (up.length) G_("Услуги", "Растут за счёт: " + up.slice(0, 3).map((e) => `${e.name} ${rubS(e.d, true)}`).join(", ") + " (к прошлому году).");
      if (dn.length) { B("Услуги", "Падают за счёт: " + dn.slice(0, 3).map((e) => `${e.name} ${rubS(e.d, true)}`).join(", ") + " (к прошлому году).");
        A("Высокий", "Услуги", `Вернуть услуги в «${dn[0].name}»: предлагать установку, расширенную гарантию и страховку к каждому товару категории, разбор отказов.`, `«${dn[0].name}» ${rubS(dn[0].d, true)} по услугам к прошлому году.`); }
    }
    if (res.types) {
      if (isn(res.types.chdu)) (res.types.chdu >= res.norms.chdu_min ? G_ : B)("Услуги", `Чистая доля услуг (без Е-ком и B2B) ${fmt(res.types.chdu, 1)}% (норма ${fmt(res.norms.chdu_min, 0)}%).`);
      const pot = res.types.types.filter((t) => t.potential > 0).sort((a, b) => b.potential - a.potential);
      if (pot.length) {
        B("Виды услуг", "Проникновение ниже среднего по " + res.bench.name + ": " + pot.slice(0, 3).map((t) => `${t.name} ${fmt(t.pen, 1)}% против ${fmt(t.benchPen, 1)}%`).join("; ") + ".");
        A("Средний", "Виды услуг", `Подтянуть «${pot[0].name}» до уровня ${res.bench.name}: скрипт предложения, цель на смену, ежедневный контроль проникновения.`, `Потенциал около ${rubS(pot[0].potential)} в месяц.`);
      }
    }
    // регион: отстающие магазины
    if (res.stores && res.stores.length > 1) {
      const part = res.stores.filter((s) => s.part === "неполный месяц");
      if (part.length) res.notes.push(`Неполный месяц (закрытие или пауза): ${part.map((s) => s.code).join(", ")} — в выводах по падению не учитываются.`);
      const neg = res.stores.filter((s) => !s.part && isn(s.dPy) && s.dPy < 0).sort((a, b) => a.dPy - b.dPy);
      if (neg.length) {
        B("Магазины", `Оборот к прошлому году падает в ${neg.length} из ${res.stores.filter((s) => !s.part).length} сопоставимых магазинов. Сильнее всего: ` + neg.slice(0, 5).map((s) => `${s.code} (${pctS(s.dPy, 0)})`).join(", ") + ".");
        A("Высокий", "Магазины", `Провести разбор с директорами ${neg.slice(0, 5).map((s) => s.code).join(", ")}: причины падения, план на месяц по трафику, конверсии и чеку.`, `Падение оборота к прошлому году до ${pctS(neg[0].dPy, 0)}.`);
      }
      const effNeg = res.stores.filter((s) => isn(s.eff) && s.eff < 0).length;
      if (effNeg) B("Магазины", `Отрицательная эффективность в ${effNeg} из ${res.stores.length} магазинов.`);
      const growth = res.stores.filter((s) => !s.part && isn(s.dPy) && s.dPy > 0).sort((a, b) => b.dPy - a.dPy);
      if (growth.length) G_("Магазины", "Лидеры роста к прошлому году: " + growth.slice(0, 5).map((s) => `${s.code} (${pctS(s.dPy, 0)})`).join(", ") + ".");
    }
    A("Низкий", "Контроль", "Загрузить выгрузки за следующий месяц и сравнить с этим отчётом: сработали ли меры.", "Нужно проверить динамику.");
    const PR = { "Высокий": 0, "Средний": 1, "Низкий": 2 };
    act.sort((a, b) => PR[a.prio] - PR[b.prio]);
    res.good = good; res.bad = bad; res.actions = act;
  }

  // несколько магазинов: каждый считается отдельно, без суммирования
  function analyzeMulti(M, codes, norms) {
    const list = codes.map((c) => analyze(M, { level: "store", code: c }, norms));
    const MM = M_(), mName = MM.MONTHS[M.Mo];
    return { type: "monthMulti", level: "multi", sel: { level: "multi", codes }, list, M, Y: M.Y, Mo: M.Mo, norms: list[0] ? list[0].norms : norms,
      code: codes.length <= 4 ? codes.join("_") : `${codes.slice(0, 3).join("_")}_i_dr`,
      name: codes.length <= 4 ? `Магазины ${codes.join(", ")}` : `Магазины ${codes.slice(0, 3).join(", ")} и ещё ${codes.length - 3}`,
      sub: `магазинов: ${codes.length} · результаты каждого магазина отдельно`, monthLabel: `${mName[0].toUpperCase() + mName.slice(1)} ${M.Y}`, prevLabel: MM.MONTHS[(M.Mo + 11) % 12] };
  }
  // строки показателей для вида «магазины рядом»: [название, (res) => {v: текст, d: [[подпись, изменение, единица]]}]
  function multiRows(kind) {
    const row = (r, k) => (r.kpi || []).find((x) => x.k === k);
    const kp = (k, f) => (r) => { const x = row(r, k); if (!x || (x.cur == null && x.type !== "eff")) return null;
      return { v: f(x), d: x.type === "eff" ? [["к прошл. мес.", x.dPrev, " п.п."], ["с начала года", x.dYtd, " п.п."]] : [["к прошл. мес.", x.dPrev, x.type === "pct" ? " п.п." : "%"], ["к прошл. году", x.dPy, x.type === "pct" ? " п.п." : "%"]] }; };
    const money = (v) => rubS(v);
    if (kind === "kpi") return [
      ["Оборот", kp("rev", (x) => money(x.cur))], ["Трафик", kp("traffic", (x) => fmt(x.cur, 0))], ["Конверсия", kp("conv", (x) => `${fmt(x.cur, 1)}%`)],
      ["Эффективность", kp("eff", (x) => (isn(x.dPy) ? `${fmt(x.dPy, 1, true)}%` : "—"))], ["Средний чек", kp("avg", (x) => `${fmt(x.cur, 0)} ₽`)],
      ["Средняя цена", kp("price", (x) => `${fmt(x.cur, 0)} ₽`)], ["Штук в чеке", kp("upt", (x) => fmt(x.cur, 2))]];
    if (kind === "mix") return [
      ["Гросс-маржа", (r) => (r.gross && r.gross.month ? { v: `${fmt(r.gross.month.pct, 1)}% · ${rubS(r.gross.month.gm)}`, d: [["к прошл. мес.", r.gross.dPrevPct, " п.п."], ["гросс, ₽", r.gross.dPrevGm, "%"]] } : null)],
      ["Оборот аксессуаров", (r) => (r.acc ? { v: rubS(r.acc.t.acc), d: [["к прошл. году", r.acc.t.yoy, "%"]] } : null)],
      ["Доля аксессуаров", (r) => (r.acc ? { v: `${fmt(r.acc.t.sh, 1)}%`, d: [["к прошл. году", r.acc.t.dSh, " п.п."]] } : kp("accSh", (x) => `${fmt(x.cur, 1)}%`)(r))],
      ["Аттач (розница)", (r) => (r.acc && isn(r.acc.t.att) ? { v: `${fmt(r.acc.t.att, 1)}%`, d: [["к прошл. году", r.acc.t.dAtt, " п.п."]] } : null)],
      ["Оборот услуг", (r) => (r.srv ? { v: rubS(r.srv.t.srv), d: [["к прошл. году", r.srv.t.yoy, "%"]] } : null)],
      ["Доля услуг", (r) => (r.srv ? { v: `${fmt(r.srv.t.sh, 1)}%`, d: [["к прошл. году", r.srv.t.dSh, " п.п."]] } : kp("srvSh", (x) => `${fmt(x.cur, 1)}%`)(r))],
      ["ЧДУ", (r) => (r.types && isn(r.types.chdu) ? { v: `${fmt(r.types.chdu, 1)}%`, d: [[`к норме ${fmt(r.norms.chdu_min, 0)}%`, r.types.chdu - r.norms.chdu_min, " п.п."]] } : null)]];
    if (kind === "dec") return [["Трафик", "traffic"], ["Конверсия", "conv"], ["Средняя цена", "price"], ["Штуки в чеке", "upt"], ["Итого", "dR"]].map(([l, k]) =>
      [l, (r) => (r.decPy ? { v: rubS(r.decPy[k], true), sign: r.decPy[k], d: [] } : null)]);
    return [];
  }

  KPI.monthAn = { analyze, analyzeMulti, multiRows, histPeriod, rubS, pctS, ppS, KPI_ROWS };
})(typeof globalThis !== "undefined" ? globalThis : this);
