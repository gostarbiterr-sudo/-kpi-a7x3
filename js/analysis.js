/* Анализ магазина и его сотрудников по нормам: выводы и план действий для дня, недели и месяца. Порт analysis.py. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const { PERIODS, PERIOD_RU, normCode } = KPI.loader;

  const DEFAULT_NORMS = {
    attach_min: 15.0, srv_share_min: 3.5, chdu_min: 5.0, compl_emp_min: 35.0, srv_emp_min: 5.5,
    emp_relative_low: 0.8, info_drop_pct: -5.0,
  };

  // ---------------------------------------------------------------- форматирование (как fmt в Python)
  const isn = (v) => typeof v === "number" && isFinite(v);
  function roundHalfEven(x, d) {
    const m = Math.pow(10, d), y = x * m, r = Math.round(y);
    // банковское округление для точных половин, как round() в Python
    if (Math.abs(y % 1) === 0.5) return (r % 2 === 0 ? r : r - 1) / m;
    return r / m;
  }
  function fmt(v, d = 1, signed = false) {
    if (!isn(v)) return "—";
    let r = roundHalfEven(Number(v), d);
    if (r === 0) r = 0;
    const [ip, fp] = Math.abs(r).toFixed(d).split(".");
    const out = ip.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (fp != null ? "," + fp : "");
    if (r < 0) return "-" + out;
    return signed && r > 0 ? "+" + out : out;
  }
  const val = (row, cid) => (row && cid && isn(row[cid]) ? row[cid] : null);

  const TERM = { "Высокий": "на этой неделе", "Средний": "в течение 2 недель", "Низкий": "в течение месяца" };
  const PRIO = { "Высокий": 0, "Средний": 1, "Низкий": 2 };

  // ---------------------------------------------------------------- статистика
  const hasCol = (recs, c) => recs && recs.length > 0 && Object.prototype.hasOwnProperty.call(recs[0], c);
  function nums(recs, c) { return recs.map((r) => r[c]).filter(isn); }
  function quantile(sorted, q) {          // как pandas (linear)
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  function median(arr) { const s = [...arr].sort((a, b) => a - b); return quantile(s, 0.5); }

  // ---------------------------------------------------------------- поиск магазина
  function allCodes(loaded) {
    const codes = new Set();
    for (const p of PERIODS) {
      (loaded.kpi[p] || []).forEach((r) => codes.add(r.code));
      (loaded.emp[p] || []).forEach((r) => { if (r.store_code) codes.add(r.store_code); });
    }
    return codes;
  }
  function liveCodes(loaded) {
    const codes = new Set();
    for (const p of PERIODS) {
      (loaded.kpi[p] || []).forEach((r) => { if (!hasCol(loaded.kpi[p], "revenue") || isn(r.revenue)) codes.add(r.code); });
      (loaded.emp[p] || []).forEach((r) => { if (r.store_code) codes.add(r.store_code); });
    }
    return codes;
  }
  function findStore(loaded, query) {
    const q = normCode(query);
    const codes = allCodes(loaded), meta = {};
    for (const p of PERIODS) (loaded.kpi[p] || []).forEach((r) => { meta[r.code] = ["city", "tc", "asm"].map((c) => r[c] || "").join(" "); });
    if (codes.has(q)) return [q];
    if (/^\d+$/.test(q)) {
      const hit = [...codes].filter((c) => { const dg = c.replace(/\D/g, ""); return dg === q.replace(/^0+/, "") || dg === q; }).sort();
      if (hit.length) return hit;
    }
    let hit = [...codes].filter((c) => q && c.includes(q)).sort();
    if (hit.length) return hit;
    const ql = String(query).trim().toLowerCase();
    if (ql.length >= 3) return Object.keys(meta).filter((c) => meta[c].toLowerCase().includes(ql)).sort();
    return [];
  }
  function storeLabel(loaded, code) {
    for (const p of ["month", "week", "day"]) {
      const r = (loaded.kpi[p] || []).find((x) => x.code === code);
      if (r) return { "ASM": r.asm || "", "Город": r.city || "", "ТЦ": r.tc || "", "Формат": r.format || "", "Статус": r.status || "" };
    }
    return {};
  }

  // ---------------------------------------------------------------- таблица показателей магазина
  const STORE_ROWS = [
    ["Оборот", "revenue", ["rev_p", "rev_y", "rev_l"], "₽", "%", 0, 1, "growth"],
    ["Оборот розницы", null, ["revr_p", "revr_y", "revr_l"], "", "%", 0, 1, "info"],
    ["Эффективность розницы", null, ["eff_p", "eff_y", "eff_l"], "", "п.п.", 0, 1, "growth"],
    ["Эффективность офлайн", null, ["effo_p", "effo_y", "effo_l"], "", "п.п.", 0, 1, "growth"],
    ["Конверсия офлайн", "conv", ["conv_p", "conv_y", "conv_l"], "%", "п.п.", 1, 1, "growth"],
    ["Трафик офлайн", "traffic", ["tr_p", "tr_y", "tr_l"], "чел.", "%", 0, 1, "info"],
    ["Чеки", "checks", ["checks_p", "checks_y", "checks_l"], "шт.", "%", 0, 1, "info"],
    ["Средний чек", "avg", ["avg_p", "avg_y", "avg_l"], "₽", "%", 0, 1, "info"],
    ["Штуки в чеке", "upt", ["upt_p", "upt_y", "upt_l"], "шт.", "%", 2, 1, "info"],
    ["Аттач аксессуаров", "acc_att", ["acc_att_p", "acc_att_y", null], "%", "п.п.", 1, 1, "min:attach_min"],
    ["Оборот аксессуаров", "acc_rev", ["acc_rev_p", "acc_rev_y", "acc_rev_l"], "₽", "%", 0, 1, "info"],
    ["Доля АКС в обороте", "acc_sh", ["acc_sh_p", "acc_sh_y", null], "%", "п.п.", 1, 1, "info"],
    ["Оборот услуг", "srv_rev", ["srv_rev_p", "srv_rev_y", "srv_rev_l"], "₽", "%", 0, 1, "info"],
    ["Доля услуг", "srv_sh", ["srv_sh_p", "srv_sh_y", null], "%", "п.п.", 1, 1, "min:srv_share_min"],
    ["ЧДУ (чистая доля услуг)", "chdu", [null, null, null], "%", "", 1, 1, "min:chdu_min"],
  ];
  const MET_COLS = ["Показатель", "Ед. (значение / прирост)", "Значение", "К периоду", "К году", "LfL", "Сеть (медиана)", "Норма", "Статус"];
  const DCOLS = ["К периоду", "К году", "LfL"];

  function buildMetrics(row, kdf, norms) {
    const view = [], bad = new Set(), warn = new Set();
    for (const [label, vid, dids, vu, du, vd, dd, kind] of STORE_ROWS) {
      const v = val(row, vid), ds = dids.map((d) => val(row, d));
      if (v == null && ds.every((d) => d == null)) continue;
      let status = "", normtxt = "";
      const ri = view.length, badc = [], warnc = [];
      if (kind === "growth") {
        normtxt = label === "Оборот" ? "рост ≥ 0" : label.startsWith("Конверсия") ? "прирост ≥ 0" : "≥ 0";
        if (ds.some((x) => x != null)) {
          DCOLS.forEach((name, i) => { if (ds[i] != null && ds[i] < 0) badc.push(name); });
          status = badc.length ? "Плохо" : "Хорошо";
        }
      } else if (kind.startsWith("min:")) {
        const thr = norms[kind.slice(4)];
        normtxt = `≥ ${fmt(thr, 1)}%`;
        if (v != null) { if (v < thr) badc.push("Значение"); status = badc.length ? "Плохо" : "Хорошо"; }
      } else {
        DCOLS.forEach((name, i) => { if (ds[i] != null && ds[i] < norms.info_drop_pct) warnc.push(name); });
        status = warnc.length ? "Внимание" : "";
      }
      let med = null;
      if (vid && hasCol(kdf, vid)) { const a = nums(kdf, vid); if (a.length) med = median(a); }
      const unit = vu || du ? `${vu} / ${du}`.replace(/^[ /]+|[ /]+$/g, "") : "";
      view.push([label, unit, fmt(v, vd), ...ds.map((x) => fmt(x, dd, true)), fmt(med, vd), normtxt, status]);
      badc.forEach((c) => bad.add(`${ri}|${c}`));
      warnc.forEach((c) => warn.add(`${ri}|${c}`));
    }
    return { cols: MET_COLS, view, bad, warn };
  }

  // ---------------------------------------------------------------- проверки магазина (светофор)
  function buildChecks(row, norms) {
    const out = [];
    const add = (group, label, v, ok, text, norm) => out.push({ group, label, v, ok, text, norm });
    for (const [lab, cid] of [["Оборот к периоду", "rev_p"], ["Оборот к году", "rev_y"], ["Оборот LfL", "rev_l"]]) {
      const v = val(row, cid);
      if (v != null) add("rev", lab, v, v >= 0, fmt(v, 1, true) + "%", "рост ≥ 0");
    }
    for (const [lab, ids] of [["Эффективность розницы", ["eff_p", "eff_y", "eff_l"]], ["Эффективность офлайн", ["effo_p", "effo_y", "effo_l"]]]) {
      const pr = ids.map((c) => val(row, c)).filter((x) => x != null);
      if (pr.length) { const m = Math.min(...pr); add("eff", lab + " (худший из периода/года/LfL)", m, m >= 0, fmt(m, 1, true) + " п.п.", "≥ 0"); }
    }
    for (const [lab, cid] of [["Конверсия: прирост к периоду", "conv_p"], ["Конверсия: прирост к году", "conv_y"], ["Конверсия: прирост LfL", "conv_l"]]) {
      const v = val(row, cid);
      if (v != null) add("conv", lab, v, v >= 0, fmt(v, 1, true) + " п.п.", "≥ 0");
    }
    for (const [grp, lab, cid, k] of [["att", "Аттач аксессуаров", "acc_att", "attach_min"], ["srv", "Доля услуг", "srv_sh", "srv_share_min"], ["chdu", "ЧДУ", "chdu", "chdu_min"]]) {
      const v = val(row, cid);
      if (v != null) { const thr = norms[k]; add(grp, `${lab} (≥ ${fmt(thr, 1)}%)`, v, v >= thr, fmt(v, 1) + "%", `≥ ${fmt(thr, 1)}%`); }
    }
    return out;
  }
  const GROUP_NAME = { rev: "Оборот", eff: "Эффективность", conv: "Конверсия", att: "Аттач аксессуаров", srv: "Доля услуг", chdu: "ЧДУ" };

  // ---------------------------------------------------------------- сотрудники
  const EMP_VIEW = [["name", "Сотрудник", null], ["revenue", "Оборот", 0], ["avg", "Средний чек", 0], ["att", "Аттач АКС, %", 1],
    ["compl", "Доля компл. чеков, %", 1], ["cps", "Чеки в смену", 1], ["upt", "ШтВЧ", 2], ["acc_rev", "Оборот АКС", 0],
    ["acc_sh", "Доля АКС, %", 1], ["srv_rev", "Оборот УСЛ", 0], ["srv_sh", "Доля УСЛ, %", 1]];

  function analyzeEmp(emp, norms) {
    const res = { flagged: [], n: 0, skipped: 0, median: {}, top: [], e: [], grades: {} };
    if (!emp || !emp.length) return res;
    let e = emp.slice();
    if (hasCol(e, "revenue")) {
      res.skipped = e.filter((r) => !(isn(r.revenue) && r.revenue > 0)).length;
      e = e.filter((r) => isn(r.revenue) && r.revenue > 0);
    }
    if (!e.length) return res;
    if (hasCol(e, "revenue")) e.sort((a, b) => b.revenue - a.revenue);
    res.n = e.length;
    const med = {};
    for (const c of ["avg", "att", "cps", "upt"]) if (hasCol(e, c)) { const a = nums(e, c); if (a.length) med[c] = median(a); }
    res.median = med;
    const rel = norms.emp_relative_low;
    const good = [];
    for (const r of e) {
      const vals = { name: r.name };
      EMP_VIEW.forEach(([c]) => { if (c !== "name" && hasCol(e, c)) vals[c] = val(r, c); });
      const fails = [], lows = [], parts = [];
      const compl = vals.compl, srv = vals.srv_sh;
      if (compl != null && compl < norms.compl_emp_min) { fails.push("compl"); parts.push(`компл. чеки ${fmt(compl, 1)}% (норма ≥ ${fmt(norms.compl_emp_min, 1)}%)`); }
      if (srv != null && srv < norms.srv_emp_min) { fails.push("srv_sh"); parts.push(`доля услуг ${fmt(srv, 1)}% (норма ≥ ${fmt(norms.srv_emp_min, 1)}%)`); }
      if (e.length >= 3) {
        for (const [c, lab] of [["avg", "средний чек"], ["att", "аттач АКС"], ["cps", "чеков в смену"], ["upt", "штук в чеке"]]) {
          const x = vals[c];
          if (x != null && c in med && med[c] > 0 && x < rel * med[c]) {
            lows.push(c);
            const [d_, u_] = { avg: [0, " ₽"], att: [1, "%"], cps: [1, ""], upt: [2, ""] }[c];
            parts.push(`${lab} ${fmt(x, d_)}${u_} — ниже медианы магазина (${fmt(med[c], d_)}${u_})`);
          }
        }
      }
      const grade = fails.length ? "Плохо" : lows.length ? "Внимание" : "Хорошо";
      res.grades[r.name] = { grade, note: parts.join("; ") };
      if (grade === "Хорошо") good.push(r.name);
      if (fails.length || lows.length) res.flagged.push({ name: r.name, fails, lows, vals, grade });
    }
    res.top = good.slice(0, 3);
    res.e = e;
    return res;
  }

  function lowest(e, col, n = 3, thr = null) {
    if (!e || !e.length || !hasCol(e, col) || !nums(e, col).length) return [];
    const s = e.filter((r) => isn(r[col])).sort((a, b) => a[col] - b[col]);
    const lim = thr != null ? thr : median(nums(e, col));
    const [unit, dec] = { att: ["%", 1], srv_sh: ["%", 1], avg: [" ₽", 0], cps: [" чеков в смену", 1] }[col] || ["", 1];
    return s.filter((r) => r[col] < lim).map((r) => `${r.name} (${fmt(r[col], dec)}${unit})`).slice(0, n);
  }

  // ---------------------------------------------------------------- план по магазину
  const T_TRAFFIC = "Нарастить поток покупателей: локальные активности (реклама рядом с магазином, push/SMS и звонки по базе клиентов, приглашения в мессенджерах), проверить вывеску, витрину и график работы.";
  const T_CONV = "Поднять конверсию: контакт с каждым зашедшим клиентом в первые секунды, выявление потребности, демонстрация товара, работа с возражениями; закрепить продавцов по зонам, не оставлять зал без внимания в часы пик; ежедневный разбор диалогов на планёрке.";
  const T_CHECK = "Поднять средний чек: комплектные продажи (основной товар + аксессуар + услуга), предложение более высокой комплектации, рассрочка/кредит на крупные чеки.";
  const T_ATT = "Довести аттач аксессуаров до нормы: предлагать аксессуар к каждому основному товару (защита, зарядка, чехол и т.п.), держать ходовые аксессуары у кассы и рядом с витриной, ввести правило «аксессуар в каждом чеке» с ежедневным контролем по сотрудникам.";
  const T_SRV = "Поднять долю услуг: предлагать услуги (защита, настройка, сервисные пакеты и т.п.) на каждую продажу основного товара, встроить предложение в скрипт, ежедневно показывать долю услуг по сотрудникам.";
  const T_CHDU = "Поднять ЧДУ: он считается без интернет-заказов и безналичных продаж (юрлица), поэтому усилить предложение услуг именно в розничных чеках физлиц: услуга в каждом чеке на основной товар, отработка отказов, контроль у кассы.";
  const T_ACC = "Вернуть рост аксессуаров: наличие ходовых позиций, выкладка у кассы и рядом с основными товарами, аксессуар в каждый чек, акции на комплекты.";
  const T_SRVREV = "Вернуть рост оборота услуг: предлагать услуги на каждый основной товар, проверить наличие услуг в кассовой системе и подготовку продавцов, ежедневный контроль услуг по сотрудникам.";
  const T_REV = "Выяснить причины падения оборота: наличие и остатки ходовых товаров, цены относительно конкурентов, участие в акциях, состав и график смен, работа касс.";

  function storeActions(row, checks, er, norms, pf, who) {
    const acts = new Map();
    const e = er.e;
    who = who || "Руководитель магазина";
    function add(key, prio, what, why, kpi, names) {
      if (names && names.length) what += " В первую очередь: " + names.join("; ") + ".";
      if (acts.has(key)) {
        const a = acts.get(key);
        a.why += " " + why;
        if (PRIO[prio] < PRIO[a.prio]) a.prio = prio;
        if (names && names.length && !a.what.includes("В первую очередь")) a.what += " В первую очередь: " + names.join("; ") + ".";
      } else acts.set(key, { key, prio, who, what, why, kpi });
    }
    const grp = (g) => checks.filter((c) => c.group === g);
    const fails = (g) => grp(g).filter((c) => c.ok === false);
    const joined = (cs) => cs.map((c) => `${c.label}: ${c.text}`).join("; ");
    const trNeg = [[val(row, "tr_p"), "к периоду"], [val(row, "tr_y"), "к году"]].filter(([v]) => v != null && v < 0).map(([v, l]) => `${l} ${fmt(v, 1, true)}%`);
    const avNeg = [[val(row, "avg_p"), "к периоду"], [val(row, "avg_y"), "к году"]].filter(([v]) => v != null && v < 0).map(([v, l]) => `${l} ${fmt(v, 1, true)}%`);

    if (fails("rev").length) {
      const why = "Оборот ниже нормы — " + joined(fails("rev")) + ".";
      if (trNeg.length) add("traffic", "Высокий", T_TRAFFIC, "Трафик офлайн снижается: " + trNeg.join(", ") + ".", "Трафик офлайн растёт к периоду и к году");
      if (fails("conv").length) add("conversion", "Высокий", T_CONV, "Конверсия падает: " + joined(fails("conv")) + ".", "Прирост конверсии ≥ 0", lowest(e, "cps"));
      if (avNeg.length) add("check", "Высокий", T_CHECK, "Средний чек снижается: " + avNeg.join(", ") + ".", "Средний чек растёт к периоду и к году", lowest(e, "avg"));
      if (!(trNeg.length || fails("conv").length || avNeg.length)) add("revenue", "Высокий", T_REV, why, "Оборот растёт к периоду, к году и LfL");
      else add("revenue_info", "Высокий", "Держать оборот на ежедневном контроле: план/факт по дням, причины отклонений фиксировать на планёрке.", why, "Оборот растёт к периоду, к году и LfL");
    }
    if (fails("eff").length) {
      const why = "Эффективность ниже нуля — " + joined(fails("eff")) + ": оборот растёт медленнее трафика (или падает быстрее него).";
      if (fails("conv").length) add("conversion", "Высокий", T_CONV, why + " Конверсия при этом падает.", "Эффективность ≥ 0", lowest(e, "cps"));
      if (avNeg.length) add("check", "Высокий", T_CHECK, why + " Причина — снижение среднего чека: " + avNeg.join(", ") + ".", "Эффективность ≥ 0, рост среднего чека", lowest(e, "avg"));
      if (!fails("conv").length && !avNeg.length) add("check", "Средний", T_CHECK, why, "Эффективность ≥ 0, рост среднего чека", lowest(e, "avg"));
    }
    if (fails("conv").length && !fails("rev").length) add("conversion", "Высокий", T_CONV, "Конверсия падает: " + joined(fails("conv")) + ".", "Прирост конверсии ≥ 0", lowest(e, "cps"));
    else if (fails("conv").length) add("conversion", "Высокий", T_CONV, "", "Прирост конверсии ≥ 0", lowest(e, "cps"));

    const gapPrio = (c) => (c.v < 0.7 * parseFloat(c.norm.replace("≥", "").replace("%", "").replace(",", ".").trim()) ? "Высокий" : "Средний");
    for (const c of fails("att"))
      add("attach", gapPrio(c), T_ATT,
        `Аттач аксессуаров ${c.text}, норма ${c.norm}.`, "Аттач аксессуаров ≥ нормы", lowest(e, "att", 3, norms.attach_min));
    for (const c of fails("srv"))
      add("services", gapPrio(c), T_SRV,
        `Доля услуг ${c.text}, норма ${c.norm}.`, "Доля услуг ≥ нормы", lowest(e, "srv_sh", 3, norms.srv_emp_min));
    for (const c of fails("chdu")) {
      const srvOk = grp("srv").length > 0 && !fails("srv").length;
      const extra = srvOk ? " Общая доля услуг в норме, значит услуги продаются в основном через интернет-заказы и безналичные счета — розница физлиц отстаёт." : "";
      add("chdu", gapPrio(c), T_CHDU,
        `ЧДУ ${c.text}, норма ${c.norm}.${extra}`, "ЧДУ ≥ нормы", lowest(e, "srv_sh", 3, norms.srv_emp_min));
    }
    const drops = (ids) => ids.map((cid, i) => [val(row, cid), ["к периоду", "к году", "LfL"][i]]).filter(([v]) => v != null && v < norms.info_drop_pct).map(([v, l]) => `${l} ${fmt(v, 1, true)}%`);
    const dAcc = drops(["acc_rev_p", "acc_rev_y", "acc_rev_l"]);
    const shNeg = [[val(row, "acc_sh_p"), "к периоду"], [val(row, "acc_sh_y"), "к году"]].filter(([v]) => v != null && v < 0).map(([v, l]) => `${l} ${fmt(v, 1, true)} п.п.`);
    if (dAcc.length || shNeg.length === 2) {
      const why = [];
      if (dAcc.length) why.push("Оборот аксессуаров снижается: " + dAcc.join(", ") + ".");
      if (shNeg.length === 2) why.push("Доля АКС в обороте падает: " + shNeg.join(", ") + ".");
      add("acc_rev", "Средний", T_ACC,
        why.join(" "), "Оборот и доля аксессуаров растут к периоду и к году", lowest(e, "att", 3, norms.attach_min));
    }
    const dSrv = drops(["srv_rev_p", "srv_rev_y", "srv_rev_l"]);
    if (dSrv.length)
      add("srv_rev", "Средний", T_SRVREV,
        "Оборот услуг снижается: " + dSrv.join(", ") + ".", "Оборот услуг растёт к периоду и к году", lowest(e, "srv_sh", 3, norms.srv_emp_min));
    // ---- планы: что делать, если показатель отстаёт от плана
    for (const t of pf || []) {
      if (t.status !== "bad" && t.status !== "warn") continue;
      const pr = t.status === "bad" ? "Высокий" : "Средний";
      const why = planWhy(t);
      if (t.id === "revenue") {
        const need = t.remaining > 0 && t.need > 0
          ? `чтобы выполнить план периода, нужно в среднем ${fmt(t.need, 0)} ₽ в день в оставшиеся ${t.remaining} дн. (сейчас ${fmt(t.fact / t.elapsed, 0)} ₽ в день).`
          : `отставание от плана ${fmt(Math.abs(t.gap), 0)} ₽.`;
        add("plan_revenue", pr, "Догнать план по обороту: " + need + " Разобрать отставание на планёрке, проверить наличие ходового товара, усилить работу в часы пик и выходные.", why, "Оборот на дату не ниже плана");
      } else {
        const map = { traffic: ["traffic", T_TRAFFIC], checks: ["conversion", T_CONV], conv: ["conversion", T_CONV], avg: ["check", T_CHECK], upt: ["check", T_CHECK],
          acc_att: ["attach", T_ATT], acc_sh: ["acc_rev", T_ACC], acc_rev: ["acc_rev", T_ACC], srv_sh: ["services", T_SRV], srv_rev: ["srv_rev", T_SRVREV], chdu: ["chdu", T_CHDU] }[t.id];
        if (map) add(map[0], pr, map[1], why, `${t.label}: выполнение плана ≥ 100%`);
      }
    }
    const out = [...acts.values()];
    out.forEach((a) => (a.why = a.why.trim()));
    return out;
  }

  const capFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);
  function empActions(er, norms) {
    return er.flagged.map((f) => {
      const v = f.vals, todo = [], why = [], med = er.median;
      if (f.fails.includes("compl")) { todo.push("продавать связку основной товар + аксессуар + услуга в каждом чеке (разбор скрипта и тренировка на смене)"); why.push(`доля комплектных чеков ${fmt(v.compl, 1)}% при норме ≥ ${fmt(norms.compl_emp_min, 1)}%`); }
      if (f.fails.includes("srv_sh")) { todo.push("предлагать услугу на каждый основной товар, отрабатывать отказ"); why.push(`доля услуг ${fmt(v.srv_sh, 1)}% при норме ≥ ${fmt(norms.srv_emp_min, 1)}%`); }
      if (f.lows.includes("avg")) { todo.push("допродажи и более высокая комплектация"); why.push(`средний чек ${fmt(v.avg, 0)} против медианы ${fmt(med.avg, 0)}`); }
      if (f.lows.includes("cps")) { todo.push("активнее выходить к клиентам, сократить простой в зале"); why.push(`чеков в смену ${fmt(v.cps, 1)} против ${fmt(med.cps, 1)}`); }
      if (f.lows.includes("att")) { todo.push("предлагать аксессуар в каждом чеке"); why.push(`аттач АКС ${fmt(v.att, 1)}% против ${fmt(med.att, 1)}%`); }
      if (f.lows.includes("upt")) { todo.push("предлагать второй товар в чек"); why.push(`штук в чеке ${fmt(v.upt, 2)} против ${fmt(med.upt, 2)}`); }
      const prio = f.fails.length === 2 ? "Высокий" : f.fails.length ? "Средний" : "Низкий";
      return { key: `emp:${f.name}`, prio, who: `Сотрудник ${f.name}`, what: capFirst(todo.join("; ")) + ".", why: why.join("; ") + ".",
        kpi: `Выход на нормы: компл. чеки ≥ ${fmt(norms.compl_emp_min, 0)}%, услуги ≥ ${fmt(norms.srv_emp_min, 1)}%` };
    });
  }

  // ---------------------------------------------------------------- распределение по сети (для графиков)
  const DIST_IDS = ["revenue", "rev_p", "rev_y", "rev_l", "eff_p", "eff_y", "eff_l", "traffic", "tr_p", "tr_y", "tr_l", "conv", "conv_p", "conv_y", "conv_l",
    "checks", "avg", "avg_p", "avg_y", "avg_l", "upt", "acc_att", "acc_sh", "acc_rev", "srv_sh", "srv_rev", "chdu"];
  function stats(arr, v) {
    if (!arr.length || v == null) return null;
    const s = [...arr].sort((a, b) => a - b);
    return { n: s.length, rank: s.filter((x) => x > v).length + 1, better: (s.filter((x) => x < v).length / s.length) * 100,
      q: [0.1, 0.25, 0.5, 0.75, 0.9].map((q) => quantile(s, q)), min: s[0], max: s[s.length - 1] };
  }
  function buildDist(kdf, row) {
    const out = {};
    const live = hasCol(kdf, "revenue") ? kdf.filter((r) => isn(r.revenue)) : kdf;
    const asm = row ? row.asm || "" : "";
    const peers = asm && hasCol(live, "asm") ? live.filter((r) => r.asm === asm) : null;
    for (const cid of DIST_IDS) {
      if (!hasCol(live, cid)) continue;
      const v = val(row, cid);
      const st = stats(nums(live, cid), v);
      if (!st) continue;
      st.v = v;
      if (peers && peers.length >= 3) { const a = stats(nums(peers, cid), v); if (a) st.asm = { n: a.n, rank: a.rank, med: a.q[2] }; }
      out[cid] = st;
    }
    return out;
  }

  // ---------------------------------------------------------------- один период
  const TEXT_COLS = new Set(["store_raw", "code", "asm", "city", "status", "tc", "format"]);
  function analyzePeriod(loaded, code, p, norms, planVals, opts) {
    const kdf = loaded.kpi[p] || null, edf = loaded.emp[p] || null;
    let row = kdf ? kdf.find((r) => r.code === code) || null : null;
    let closedNote = null;
    if (row && val(row, "revenue") == null) {
      const st = String(row.status || "").trim();
      closedNote = `У магазина ${code} нет оборота за этот период` + (st ? ` (статус в выгрузке: «${st}»)` : "") + " — анализ магазина не выполняется.";
      row = null;
    }
    const emp = edf ? edf.filter((r) => r.store_code === code) : null;
    const out = { planFact: [], period: p, has_store: !!row, has_emp: !!(emp && emp.length), date_kpi: loaded.dates[`kpi|${p}`] || null,
      date_emp: loaded.dates[`emp|${p}`] || null, kpi: [], checks: [], findings: [], actions: [], notes: [] };
    const F = (level, area, text) => out.findings.push({ level, area, text });

    if (row) {
      out.row = {}; Object.keys(row).forEach((c) => { if (!TEXT_COLS.has(c)) out.row[c] = val(row, c); });
      out.dist = buildDist(kdf, row);
      out.checks = buildChecks(row, norms);
      out.metrics = buildMetrics(row, kdf, norms);
      out.planFact = planFact(row, planVals, p, out.date_kpi, opts);
      const rev = val(row, "revenue");
      out.kpi.push(["Оборот", fmt(rev, 0) + " ₽"]);
      if (rev != null && hasCol(kdf, "revenue")) {
        const liveRev = nums(kdf, "revenue");
        out.kpi.push(["Место по обороту в сети", `${liveRev.filter((x) => x > rev).length + 1} из ${liveRev.length}`]);
        const asm = row.asm || "";
        if (asm) {
          const peers = kdf.filter((r) => r.asm === asm && isn(r.revenue));
          out.kpi.push([`Место у ASM «${asm}»`, `${peers.filter((r) => r.revenue > rev).length + 1} из ${peers.length}`]);
        }
      }
      for (const [lab, cid, d] of [["Средний чек", "avg", 0], ["Конверсия офлайн", "conv", 1], ["Трафик офлайн", "traffic", 0]]) {
        const v = val(row, cid);
        if (v != null) out.kpi.push([lab, fmt(v, d) + (cid === "conv" ? " %" : "")]);
      }
      for (const g of Object.keys(GROUP_NAME)) {
        const cs = out.checks.filter((c) => c.group === g);
        if (!cs.length) continue;
        const bad = cs.filter((c) => c.ok === false);
        if (bad.length) F("Плохо", GROUP_NAME[g], bad.map((c) => `${c.label}: ${c.text}`).join("; ") + ` (норма: ${bad[0].norm}).`);
        else F("Хорошо", GROUP_NAME[g], "в норме — " + cs.map((c) => `${c.label}: ${c.text}`).join("; ") + ".");
      }
      planFindings(out.planFact, F);
    } else out.notes.push(closedNote || `Магазин ${code} не найден в KPI-файле за этот период.`);

    const er = (out.emp = analyzeEmp(out.has_emp ? emp : null, norms));
    if (out.has_emp && er.n) {
      const n = er.n;
      const f1 = er.flagged.filter((f) => f.fails.includes("compl")).map((f) => f.name);
      const f2 = er.flagged.filter((f) => f.fails.includes("srv_sh")).map((f) => f.name);
      if (f1.length) F("Плохо", "Сотрудники", `Доля комплектных чеков ниже ${fmt(norms.compl_emp_min, 0)}%: ${f1.length} из ${n} — ` + f1.slice(0, 6).join("; ") + (f1.length > 6 ? "…" : "") + ".");
      else F("Хорошо", "Сотрудники", `Доля комплектных чеков у всех ${n} сотрудников не ниже ${fmt(norms.compl_emp_min, 0)}%.`);
      if (f2.length) F("Плохо", "Сотрудники", `Доля услуг ниже ${fmt(norms.srv_emp_min, 1)}%: ${f2.length} из ${n} — ` + f2.slice(0, 6).join("; ") + (f2.length > 6 ? "…" : "") + ".");
      else F("Хорошо", "Сотрудники", `Доля услуг у всех ${n} сотрудников не ниже ${fmt(norms.srv_emp_min, 1)}%.`);
      if (er.top.length) F("Хорошо", "Сотрудники", "Выполняют обе нормы (пример для коллег): " + er.top.join("; ") + ".");
      if (er.skipped) out.notes.push(`Сотрудников без оборота за период (не оцениваются): ${er.skipped}.`);
      out.kpi.push(["Сотрудников с продажами", String(n)]);
    } else if (!out.has_emp) out.notes.push(`Сотрудники магазина ${code} не найдены на вкладке за этот период.`);
    if (p === "day") out.notes.push("За один день проценты по сотрудникам и магазину «шумят» — для выводов ориентируйтесь на неделю и месяц.");

    const actions = out.actions;
    if (row) actions.push(...storeActions(row, out.checks, er, norms, out.planFact));
    actions.push(...empActions(er, norms));
    if (out.has_emp && er.flagged.length && er.top.length && er.flagged.some((f) => f.fails.length))
      actions.push({ key: "mentor", prio: "Низкий", who: "Руководитель магазина", what: "Поставить в пары с отстающими тех, кто выполняет обе нормы (" + er.top.join("; ") + "), провести разбор их приёмов на планёрке.",
        why: "В магазине есть сильные сотрудники и сотрудники ниже нормы.", kpi: "Рост доли комплектных чеков и услуг у отстающих" });
    if (row && !out.checks.some((c) => c.ok === false) && !er.flagged.length)
      actions.push({ key: "hold", prio: "Низкий", who: "Руководитель магазина", what: "Нормы выполнены: закрепить результат, ежедневно сверять план/факт и держать темп.",
        why: "Нарушений норм не найдено.", kpi: "Нормы сохраняются в следующих выгрузках" });
    actions.push({ key: "recheck", prio: "Низкий", who: "Руководитель магазина", what: "Загрузить свежие выгрузки через 1–2 недели и сравнить с этим отчётом.",
      why: "Нужно проверить, сработали ли меры.", kpi: "Динамика показателей из таблицы «Магазин»" });
    actions.forEach((a, i) => (a._i = i));
    actions.sort((a, b) => PRIO[a.prio] - PRIO[b.prio] || (a.key.startsWith("emp:") ? 1 : 0) - (b.key.startsWith("emp:") ? 1 : 0) || a._i - b._i);
    actions.forEach((a) => delete a._i);
    return out;
  }

  // ---------------------------------------------------------------- планы
  const PLAN_METRICS = [
    { id: "revenue", label: "Оборот", unit: "₽", sum: true, d: 0 },
    { id: "traffic", label: "Трафик офлайн", unit: "чел.", sum: true, d: 0 },
    { id: "checks", label: "Чеки", unit: "шт.", sum: true, d: 0 },
    { id: "conv", label: "Конверсия офлайн", unit: "%", d: 1 },
    { id: "avg", label: "Средний чек", unit: "₽", d: 0 },
    { id: "upt", label: "Штуки в чеке", unit: "шт.", d: 2 },
    { id: "acc_rev", label: "Оборот аксессуаров", unit: "₽", sum: true, d: 0 },
    { id: "acc_att", label: "Аттач аксессуаров", unit: "%", d: 1 },
    { id: "acc_sh", label: "Доля АКС в обороте", unit: "%", d: 1 },
    { id: "srv_rev", label: "Оборот услуг", unit: "₽", sum: true, d: 0 },
    { id: "srv_sh", label: "Доля услуг", unit: "%", d: 1 },
    { id: "chdu", label: "ЧДУ", unit: "%", d: 1 },
  ];
  function planKey(obj) { return obj.type === "store" ? "S:" + obj.code : "R:" + KPI.loader.key(obj.name); }

  /* Сколько дней периода прошло на дату выгрузки. includeDay — выгрузка включает сам день выгрузки. */
  function progress(p, date, includeDay) {
    if (p === "day" || !date) return { elapsed: 1, total: 1 };
    const inc = includeDay !== false;
    if (p === "month") {
      const total = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      return { elapsed: Math.min(total, Math.max(1, date.getUTCDate() - (inc ? 0 : 1))), total };
    }
    const wd = ((date.getUTCDay() + 6) % 7) + 1;             // пн = 1 … вс = 7
    return { elapsed: Math.min(7, Math.max(1, wd - (inc ? 0 : 1))), total: 7 };
  }
  const STATUS = (pct) => (pct == null ? "na" : pct >= 100 ? "good" : pct >= 95 ? "warn" : "bad");

  function planFact(row, planVals, p, date, opts) {
    const out = [];
    if (!planVals) return out;
    const pr = progress(p, date, (opts || {}).includeDay);
    for (const m of PLAN_METRICS) {
      const plan = planVals[m.id];
      if (!isn(plan) || plan <= 0) continue;
      const fact = val(row, m.id);
      const t = Object.assign({}, m, { plan, fact, elapsed: pr.elapsed, total: pr.total });
      if (fact == null) { t.status = "na"; out.push(t); continue; }
      if (m.sum) {
        t.planDate = (plan * pr.elapsed) / pr.total;
        t.pctDate = (fact / t.planDate) * 100;
        t.forecast = (fact / pr.elapsed) * pr.total;
        t.pctFc = (t.forecast / plan) * 100;
        t.pct = (fact / plan) * 100;
        t.gap = fact - t.planDate;
        t.remaining = pr.total - pr.elapsed;
        t.need = t.remaining > 0 ? Math.max(0, (plan - fact) / t.remaining) : 0;
        t.status = STATUS(t.pctDate);
      } else {
        t.pct = (fact / plan) * 100;
        t.diff = fact - plan;
        t.status = STATUS(t.pct);
      }
      out.push(t);
    }
    return out;
  }
  const pv = (t, v) => `${fmt(v, t.d)}${t.unit === "%" ? "%" : " " + t.unit}`;
  function planWhy(t) {
    if (t.sum) return `${t.label}: факт ${pv(t, t.fact)} — ${fmt(t.pctDate, 0)}% плана на дату (${pv(t, t.planDate)}, день ${t.elapsed} из ${t.total}); прогноз на конец периода ${fmt(t.pctFc, 0)}% плана (${pv(t, t.plan)}).`;
    return `${t.label}: факт ${pv(t, t.fact)} при плане ${pv(t, t.plan)} — ${fmt(t.pct, 0)}% плана.`;
  }
  function planFindings(pf, F) {
    if (!pf || !pf.length) return;
    const bad = pf.filter((t) => t.status === "bad" || t.status === "warn");
    const good = pf.filter((t) => t.status === "good");
    const short = (t) => `${t.label} — ${fmt(t.sum ? t.pctDate : t.pct, 0)}%${t.sum ? " плана на дату" : " плана"}`;
    if (bad.length) F("Плохо", "План", "Отстают от плана: " + bad.map(short).join("; ") + ".");
    if (good.length) F("Хорошо", "План", "План выполняется: " + good.map(short).join("; ") + ".");
  }

  // ---------------------------------------------------------------- регионы
  const SUM_IDS = ["revenue", "traffic", "checks", "acc_rev", "srv_rev"];
  const GROWTH_OF = { revenue: ["rev_p", "rev_y", "rev_l"], traffic: ["tr_p", "tr_y", "tr_l"], checks: ["checks_p", "checks_y", "checks_l"],
    acc_rev: ["acc_rev_p", "acc_rev_y", "acc_rev_l"], srv_rev: ["srv_rev_p", "srv_rev_y", "srv_rev_l"] };
  /* Итог по набору магазинов, если в файле нет итоговой строки: суммы складываются, приросты пересчитываются через базу прошлого периода,
     доли и проценты — средневзвешенные. Эффективность = прирост оборота − прирост трафика. */
  function aggregate(stores) {
    const live = stores.filter((r) => isn(r.revenue));
    const out = {};
    const sum = (c) => live.reduce((s, r) => s + (isn(r[c]) ? r[c] : 0), 0);
    const wavg = (c, w) => { let a = 0, b = 0; live.forEach((r) => { if (isn(r[c]) && isn(r[w])) { a += r[c] * r[w]; b += r[w]; } }); return b ? a / b : null; };
    for (const c of SUM_IDS) if (hasCol(live, c)) out[c] = sum(c);
    const prevOf = (c, g) => { let cur = 0, prev = 0; live.forEach((r) => { if (isn(r[c]) && isn(r[g]) && r[g] > -100) { cur += r[c]; prev += r[c] / (1 + r[g] / 100); } }); return prev > 0 ? (cur / prev - 1) * 100 : null; };
    for (const c of Object.keys(GROWTH_OF)) GROWTH_OF[c].forEach((g) => { if (hasCol(live, g) && hasCol(live, c)) out[g] = prevOf(c, g); });
    if (out.revenue != null && out.checks) out.avg = out.revenue / out.checks;
    ["p", "y", "l"].forEach((s) => {
      const rg = out["rev_" + s], cg = out["checks_" + s], tg = out["tr_" + s];
      if (rg != null && cg != null) out["avg_" + s] = ((1 + rg / 100) / (1 + cg / 100) - 1) * 100;
      if (rg != null && tg != null) { out["eff_" + s] = rg - tg; out["effo_" + s] = rg - tg; }
    });
    if (out.revenue) { if (out.acc_rev != null) out.acc_sh = (out.acc_rev / out.revenue) * 100; if (out.srv_rev != null) out.srv_sh = (out.srv_rev / out.revenue) * 100; }
    const W = { conv: "traffic", conv_p: "traffic", conv_y: "traffic", conv_l: "traffic", acc_att: "checks", acc_att_p: "checks", acc_att_y: "checks", upt: "checks",
      chdu: "revenue", acc_sh_p: "revenue", acc_sh_y: "revenue", srv_sh_p: "revenue", srv_sh_y: "revenue", credit: "revenue", ecom: "revenue", b2b: "revenue",
      revr_p: "revenue", revr_y: "revenue", revr_l: "revenue" };
    for (const c of Object.keys(W)) if (hasCol(live, c)) out[c] = wavg(c, W[c]);
    return out;
  }
  const rkey = (s) => KPI.loader.key(s || "");
  function regionList(loaded) {
    const out = [], seen = new Set();
    const add = (name, level) => { const k = rkey(name); if (k && !seen.has(k)) { seen.add(k); out.push({ name, level }); } };
    for (const p of ["month", "week", "day"]) (loaded.regions[p] || []).filter((r) => r.level === "total").forEach((r) => add(r.name, "total"));
    if (!out.length) add(loaded.regionName || "Вся сеть", "total");
    for (const p of ["month", "week", "day"]) {
      (loaded.regions[p] || []).filter((r) => r.level === "asm").forEach((r) => add(r.name, "asm"));
      (loaded.kpi[p] || []).forEach((r) => { if (r.asm && isn(r.revenue)) add(r.asm, "asm"); });
    }
    return out;
  }
  function regionData(loaded, name, level, p) {
    const kdf = loaded.kpi[p] || [];
    const live = kdf.filter((r) => isn(r.revenue));
    const stores = level === "total" ? live : live.filter((r) => rkey(r.asm) === rkey(name));
    const list = loaded.regions[p] || [];
    let r = list.find((x) => rkey(x.name) === rkey(name));
    let source = "file", row = r ? Object.assign({}, r.rec) : null;
    if (!row && stores.length) { row = aggregate(stores); source = "calc"; }
    if (row) row.asm = level === "asm" ? name : "";
    // соседи по уровню (другие ASM) — для сравнения
    const asmNames = [...new Set(live.map((x) => x.asm).filter(Boolean))];
    const peers = asmNames.map((a) => {
      const fr = list.find((x) => x.level === "asm" && rkey(x.name) === rkey(a));
      const rec = fr ? Object.assign({}, fr.rec) : aggregate(live.filter((x) => x.asm === a));
      rec.name = a;
      return rec;
    }).filter((x) => isn(x.revenue));
    const totalRow = list.find((x) => x.level === "total");
    const total = totalRow ? totalRow.rec : (live.length ? aggregate(live) : null);
    return { row, source, stores, peers, total, kdf };
  }

  function storeSummary(st, norms) {
    const checks = buildChecks(st, norms);
    const fails = checks.filter((c) => !c.ok);
    const dY = isn(st.rev_y) && st.rev_y > -100 ? st.revenue - st.revenue / (1 + st.rev_y / 100) : null;
    const dP = isn(st.rev_p) && st.rev_p > -100 ? st.revenue - st.revenue / (1 + st.rev_p / 100) : null;
    const mn = (ids) => { const a = ids.map((c) => val(st, c)).filter((x) => x != null); return a.length ? Math.min(...a) : null; };
    return { code: st.code, city: st.city || "", tc: st.tc || "", asm: st.asm || "", revenue: st.revenue, rev_l: val(st, "rev_l"), rev_y: val(st, "rev_y"),
      revMin: mn(["rev_p", "rev_y", "rev_l"]), effMin: mn(["eff_p", "eff_y", "eff_l", "effo_p", "effo_y", "effo_l"]), convMin: mn(["conv_p", "conv_y", "conv_l"]),
      conv: val(st, "conv"), acc_att: val(st, "acc_att"), srv_sh: val(st, "srv_sh"), chdu: val(st, "chdu"), avg: val(st, "avg"),
      checks, failGroups: [...new Set(fails.map((c) => c.group))], nFail: fails.length, nChecks: checks.length, dY, dP };
  }

  function analyzeRegionPeriod(loaded, name, level, p, norms, planVals, opts) {
    const D = regionData(loaded, name, level, p);
    const who = level === "asm" ? `ASM «${name}»` : `Руководство «${name}»`;
    const out = { planFact: [], period: p, has_store: !!D.row, has_emp: false, date_kpi: loaded.dates[`kpi|${p}`] || null, date_emp: null,
      kpi: [], checks: [], findings: [], actions: [], notes: [], emp: { flagged: [], n: 0, e: [], top: [], median: {}, grades: {} }, source: D.source };
    const F = (level_, area, text) => out.findings.push({ level: level_, area, text });
    if (!D.row) { out.notes.push(`Нет данных по «${name}» за этот период.`); return out; }
    const row = D.row;
    out.row = {}; Object.keys(row).forEach((c) => { if (!TEXT_COLS.has(c) && c !== "name") out.row[c] = val(row, c); });
    const peersList = level === "asm" ? D.peers : [];
    out.dist = peersList.length >= 3 ? buildDist(peersList.map((x) => Object.assign({}, x, { asm: "" })), Object.assign({}, row, { asm: "" })) : {};
    out.checks = buildChecks(row, norms);
    out.metrics = buildMetrics(row, peersList, norms);
    out.metrics.cols = out.metrics.cols.map((c) => (c === "Сеть (медиана)" ? (level === "asm" ? "Медиана ASM" : "Медиана") : c));
    out.planFact = planFact(row, planVals, p, out.date_kpi, opts);
    if (D.source === "calc") out.notes.push("В файле нет итоговой строки по этому региону — показатели рассчитаны по магазинам (суммы и средневзвешенные значения).");
    const rev = val(row, "revenue");
    out.kpi.push(["Оборот", fmt(rev, 0) + " ₽"]);
    if (level === "asm" && D.peers.length) {
      out.kpi.push(["Место среди ASM по обороту", `${D.peers.filter((x) => x.revenue > rev).length + 1} из ${D.peers.length}`]);
      if (D.total && isn(D.total.revenue) && D.total.revenue > 0) out.kpi.push([`Доля в обороте «${loaded.regionName || "сети"}»`, fmt((rev / D.total.revenue) * 100, 1) + "%"]);
    }
    if (level === "total") out.kpi.push(["ASM в выгрузке", String(D.peers.length)]);
    out.kpi.push(["Работающих магазинов", String(D.stores.length)]);
    for (const [lab, cid, d] of [["Средний чек", "avg", 0], ["Конверсия офлайн", "conv", 1], ["Трафик офлайн", "traffic", 0]]) {
      const v = val(row, cid);
      if (v != null) out.kpi.push([lab, fmt(v, d) + (cid === "conv" ? " %" : "")]);
    }
    for (const g of Object.keys(GROUP_NAME)) {
      const cs = out.checks.filter((c) => c.group === g);
      if (!cs.length) continue;
      const bad = cs.filter((c) => c.ok === false);
      if (bad.length) F("Плохо", GROUP_NAME[g], bad.map((c) => `${c.label}: ${c.text}`).join("; ") + ` (норма: ${bad[0].norm}).`);
      else F("Хорошо", GROUP_NAME[g], "в норме — " + cs.map((c) => `${c.label}: ${c.text}`).join("; ") + ".");
    }
    planFindings(out.planFact, F);

    // ---- магазины региона
    const S = D.stores.map((st) => storeSummary(st, norms));
    out.stores = S;
    const n = S.length;
    const GL = { rev: "оборот не растёт", eff: "эффективность ниже 0", conv: "конверсия падает", att: `аттач ниже ${fmt(norms.attach_min, 0)}%`,
      srv: `доля услуг ниже ${fmt(norms.srv_share_min, 1)}%`, chdu: `ЧДУ ниже ${fmt(norms.chdu_min, 0)}%` };
    const VAL = { att: "acc_att", srv: "srv_sh", chdu: "chdu", conv: "convMin", rev: "revMin", eff: "effMin" };
    const VU = { att: "%", srv: "%", chdu: "%", conv: " п.п.", rev: "%", eff: " п.п." };
    out.failCounts = Object.keys(GL).map((g) => ({ g, label: GL[g], n: S.filter((x) => x.failGroups.includes(g)).length, total: n }));
    for (const fc of out.failCounts.filter((x) => x.n)) {
      const lst = S.filter((x) => x.failGroups.includes(fc.g));
      if (VAL[fc.g]) lst.sort((a, b) => (a[VAL[fc.g]] ?? Infinity) - (b[VAL[fc.g]] ?? Infinity));
      const signed = ["rev", "conv", "eff"].includes(fc.g);
      const names = lst.slice(0, 6).map((x) => x.code + (x[VAL[fc.g]] != null ? ` (${fmt(x[VAL[fc.g]], 1, signed)}${VU[fc.g]})` : ""));
      F("Плохо", "Магазины", `${fc.label}: ${fc.n} из ${n} — ${names.join("; ")}${fc.n > 6 ? "…" : ""}.`);
    }
    const allOk = S.filter((x) => x.nChecks && !x.nFail).map((x) => x.code);
    if (allOk.length) F("Хорошо", "Магазины", `Выполняют все нормы: ${allOk.length} из ${n} — ${allOk.slice(0, 8).join("; ")}${allOk.length > 8 ? "…" : ""}.`);
    const decl = S.filter((x) => x.dY != null && x.dY < 0).sort((a, b) => a.dY - b.dY);
    if (decl.length) F("Плохо", "Магазины", "Сильнее всего тянут оборот вниз (к году): " + decl.slice(0, 5).map((x) => `${x.code} (${fmt(x.dY, 0)} ₽)`).join("; ") + ".");

    // ---- действия
    out.actions.push(...storeActions(row, out.checks, out.emp, norms, out.planFact, who));
    for (const fc of out.failCounts.filter((x) => x.n)) {
      const lst = S.filter((x) => x.failGroups.includes(fc.g));
      if (VAL[fc.g]) lst.sort((a, b) => (a[VAL[fc.g]] ?? Infinity) - (b[VAL[fc.g]] ?? Infinity));
      const share = fc.n / n;
      out.actions.push({ key: `stores:${fc.g}`, prio: share >= 0.5 ? "Высокий" : share >= 0.25 ? "Средний" : "Низкий", who,
        what: `Разобрать с директорами магазинов, где ${fc.label}: ${lst.slice(0, 8).map((x) => x.code).join(", ")}${fc.n > 8 ? " и др." : ""}. Поставить каждому магазину цель и проверить через неделю.`,
        why: `${fc.label}: ${fc.n} из ${n} магазинов.`, kpi: "Все магазины региона выполняют норму" });
    }
    if (decl.length) out.actions.push({ key: "stores:decline", prio: "Высокий", who,
      what: "Разобрать падение оборота в магазинах, которые сильнее всего тянут регион вниз: " + decl.slice(0, 5).map((x) => `${x.code} (${fmt(x.dY, 0)} ₽ к году)`).join("; ") + ".",
      why: `Оборот к году падает в ${decl.length} из ${n} магазинов.`, kpi: "Оборот этих магазинов растёт к году" });
    if (!out.checks.some((c) => !c.ok) && !out.failCounts.some((x) => x.n))
      out.actions.push({ key: "hold", prio: "Низкий", who, what: "Нормы выполнены во всех магазинах: закрепить результат и держать темп.", why: "Нарушений норм не найдено.", kpi: "Нормы сохраняются" });
    out.actions.push({ key: "recheck", prio: "Низкий", who, what: "Загрузить свежие выгрузки через 1–2 недели и сравнить с этим отчётом.", why: "Нужно проверить, сработали ли меры.", kpi: "Динамика показателей региона" });
    out.actions.forEach((a, i) => (a._i = i));
    out.actions.sort((a, b) => PRIO[a.prio] - PRIO[b.prio] || a._i - b._i);
    out.actions.forEach((a) => delete a._i);

    // ---- для уровня «весь регион»: сравнение ASM между собой
    if (level === "total") {
      out.asmTable = D.peers.map((x) => {
        const ch = buildChecks(x, norms);
        return { name: x.name, revenue: x.revenue, rev_l: val(x, "rev_l"), conv: val(x, "conv"), acc_att: val(x, "acc_att"), srv_sh: val(x, "srv_sh"), chdu: val(x, "chdu"),
          nFail: ch.filter((c) => !c.ok).length, nChecks: ch.length, failGroups: [...new Set(ch.filter((c) => !c.ok).map((c) => c.group))] };
      }).sort((a, b) => b.revenue - a.revenue);
      const worst = out.asmTable.filter((x) => x.nFail).sort((a, b) => b.nFail - a.nFail);
      if (worst.length) F("Плохо", "ASM", "Больше всего нарушений норм: " + worst.slice(0, 4).map((x) => `${x.name} (${x.nFail} из ${x.nChecks})`).join("; ") + ".");
    }
    return out;
  }

  function analyzeRegion(loaded, name, norms, plans, opts) {
    norms = Object.assign({}, DEFAULT_NORMS, norms || {});
    const rl = regionList(loaded).find((r) => rkey(r.name) === rkey(name)) || { name, level: "asm" };
    const pl = (plans || {})[planKey({ type: "region", name: rl.name })] || {};
    const periods = {};
    for (const p of PERIODS) periods[p] = analyzeRegionPeriod(loaded, rl.name, rl.level, p, norms, pl[p], opts);
    const info = { "Уровень": rl.level === "asm" ? "ASM" : "весь регион" };
    return { type: "region", level: rl.level, code: rl.name, name: rl.name, info, periods, plan: buildPlan(periods), files: loaded.files, warnings: loaded.warnings.slice(), norms };
  }
  function findRegion(loaded, query) {
    const q = rkey(query);
    const all = regionList(loaded);
    const exact = all.filter((r) => rkey(r.name) === q);
    if (exact.length) return exact;
    return q ? all.filter((r) => rkey(r.name).includes(q)) : [];
  }

  // ---------------------------------------------------------------- план на день для продавцов
  /* Логика:
     1) Розница (то, на что влияют продавцы) = оборот × (1 − доля Е-ком − доля B2B). Доли берутся из KPI месяца.
     2) Если задан план месяца по обороту: розничный план месяца = план × тот же коэффициент; остаток = розничный план − розничный факт;
        план дня магазина = остаток / оставшиеся дни. Без плана — обычная выработка смены (сколько продавцы делают за смену).
     3) Услуги — по чистой доле услуг (ЧДУ, без Е-ком и B2B): цель = ЧДУ из плана или норма; догоняем отставание за оставшиеся дни.
     4) Аксессуары — цель по доле АКС (из плана: доля или оборот АКС / оборот; иначе текущая доля магазина); тоже с догоном.
     5) План дня магазина делится между продавцами на смене пропорционально их выработке за смену (средний чек × чеки в смену). */
  function dayPlan(loaded, code, norms, planMonth, opts, Pm, Pd) {
    const out = { ok: false, notes: [] };
    const row = Pm && Pm.row;
    if (!row) { out.reason = "Нет KPI месяца по этому магазину — план дня считать не от чего."; return out; }
    const staff = (loaded.emp.month || []).filter((r) => r.store_code === code && isn(r.revenue) && r.revenue > 0);
    if (!staff.length) { out.reason = "Нет данных по продавцам этого магазина за месяц (вкладка «Сотрудники»)."; return out; }
    const date = Pm.date_kpi;
    const pr = progress("month", date, (opts || {}).includeDay);
    const remDays = pr.total - pr.elapsed;
    const ecom = val(row, "ecom") || 0, b2b = val(row, "b2b") || 0;
    const f = Math.min(1, Math.max(0.3, 1 - ecom / 100 - b2b / 100));
    const rev = val(row, "revenue"), factRetail = rev * f;
    const accSh = val(row, "acc_sh"), chdu = val(row, "chdu");
    const pm = planMonth || {};
    // плановая дата: день после последнего дня в выгрузке
    let planDate = null;
    if (date) { planDate = new Date(date.getTime()); if ((opts || {}).includeDay !== false) planDate.setUTCDate(planDate.getUTCDate() + 1); }
    // выработка продавцов за смену
    const sellers = staff.map((r) => {
      const avg = val(r, "avg"), cps = val(r, "cps");
      const shifts = avg && cps ? r.revenue / avg / cps : null;
      const cap = avg && cps ? avg * cps : null;
      const dayRow = (loaded.emp.day || []).find((d) => d.store_code === code && d.name === r.name);
      return { name: r.name, revenue: r.revenue, avg, cps, shifts: shifts ? Math.round(shifts * 10) / 10 : null, cap,
        accSh: val(r, "acc_sh"), srvSh: val(r, "srv_sh"), compl: val(r, "compl"), att: val(r, "att"),
        day: dayRow ? { revenue: val(dayRow, "revenue"), acc: val(dayRow, "acc_rev"), srv: val(dayRow, "srv_rev") } : null };
    }).sort((a, b) => b.revenue - a.revenue);
    const capKnown = sellers.filter((s) => s.cap);
    const medCap = capKnown.length ? median(capKnown.map((s) => s.cap)) : null;
    sellers.forEach((s) => { if (!s.cap) { s.cap = medCap || (factRetail / Math.max(1, pr.elapsed)) / sellers.length; s.capGuess = true; } });

    // ---- оборот (розница)
    const st = { ecom, b2b, f, rev, factRetail, elapsed: pr.elapsed, total: pr.total, remDays };
    if (isn(pm.revenue) && pm.revenue > 0) {
      st.planRev = pm.revenue; st.planRetail = pm.revenue * f;
      st.remRetail = st.planRetail - factRetail;
      st.R = remDays > 0 ? Math.max(0, st.remRetail) / remDays : 0;
      st.mode = "plan";
      if (st.remRetail <= 0) out.notes.push("Розничный план месяца уже выполнен — план дня равен обычной выработке смены.");
    } else {
      st.mode = "capacity";
      out.notes.push("План месяца по обороту не задан — план дня = обычная выработка продавцов за смену. Задайте план (кнопка «Планы»), чтобы считать от остатка плана.");
    }
    if (remDays <= 0) out.notes.push("По данным выгрузки месяц закончился — оставшихся дней нет.");

    // ---- услуги по ЧДУ
    const tS = isn(pm.chdu) && pm.chdu > 0 ? pm.chdu : norms.chdu_min;
    st.tS = tS; st.tSsrc = isn(pm.chdu) && pm.chdu > 0 ? "план" : "норма";
    st.chdu = chdu;
    st.srvRetailFact = chdu != null ? (chdu / 100) * factRetail : null;
    if (st.planRetail && st.srvRetailFact != null && remDays > 0) st.Scatch = Math.max(0, (tS / 100) * st.planRetail - st.srvRetailFact) / remDays;
    // ---- аксессуары по доле АКС
    let tA = null, tAsrc = "";
    if (isn(pm.acc_sh) && pm.acc_sh > 0) { tA = pm.acc_sh; tAsrc = "план"; }
    else if (isn(pm.acc_rev) && pm.acc_rev > 0 && isn(pm.revenue) && pm.revenue > 0) { tA = (pm.acc_rev / pm.revenue) * 100; tAsrc = "план"; }
    else if (accSh != null) { tA = accSh; tAsrc = "текущая доля магазина"; }
    st.tA = tA; st.tAsrc = tAsrc; st.accSh = accSh;
    if (tA != null && st.planRetail && accSh != null && remDays > 0) st.Acatch = Math.max(0, (tA / 100) * st.planRetail - (accSh / 100) * factRetail) / remDays;
    out.ok = true;
    out.store = st;
    out.sellers = sellers;
    out.planDate = planDate ? planDate.toISOString().slice(0, 10) : null;
    out.norms = { srv_emp_min: norms.srv_emp_min, compl_emp_min: norms.compl_emp_min };
    out.code = code;
    return out;
  }

  // ---------------------------------------------------------------- общий план
  function buildPlan(periods) {
    const groups = new Map();
    for (const p of ["month", "week", "day"]) {
      for (const a of periods[p].actions) {
        if (!groups.has(a.key)) groups.set(a.key, { a: { ...a }, periods: [], why: {} });
        const g = groups.get(a.key);
        g.periods.push(p);
        g.why[p] = a.why;
        if (PRIO[a.prio] < PRIO[g.a.prio]) { g.a.prio = a.prio; g.a.what = a.what; }
      }
    }
    const rows = [];
    for (const [k, g] of groups) {
      const a = g.a, ps = PERIODS.filter((p) => g.periods.includes(p));
      let prio = a.prio;
      if (!["recheck", "hold", "mentor"].includes(k)) {
        if (ps.length >= 2 && prio === "Средний") prio = "Высокий";
        else if (ps.length === 3 && prio === "Низкий") prio = "Средний";
      }
      const why = PERIODS.filter((p) => g.why[p]).map((p) => `${PERIOD_RU[p]}: ${g.why[p]}`).join("  ");
      rows.push({ key: k, prio, emp: k.startsWith("emp:"), who: a.who, what: a.what, why,
        where: ps.map((p) => PERIOD_RU[p]).join(", ") + (ps.length === 3 && !["recheck", "hold"].includes(k) ? " — системная проблема" : ""),
        term: TERM[prio], kpi: a.kpi });
    }
    rows.forEach((r, i) => (r._i = i));
    rows.sort((a, b) => PRIO[a.prio] - PRIO[b.prio] || (a.emp ? 1 : 0) - (b.emp ? 1 : 0) || a._i - b._i);
    rows.forEach((r, i) => { delete r._i; r.n = i + 1; });
    return rows;
  }

  function analyze(loaded, code, norms, plans, opts) {
    norms = Object.assign({}, DEFAULT_NORMS, norms || {});
    const pl = (plans || {})[planKey({ type: "store", code })] || {};
    const periods = {};
    for (const p of PERIODS) periods[p] = analyzePeriod(loaded, code, p, norms, pl[p], opts);
    const dp = dayPlan(loaded, code, norms, pl.month, opts, periods.month, periods.day);
    return { type: "store", code, info: storeLabel(loaded, code), periods, plan: buildPlan(periods), files: loaded.files, warnings: loaded.warnings.slice(), norms, dayPlan: dp };
  }

  KPI.analysis = { DEFAULT_NORMS, fmt, isn, TERM, PRIO, GROUP_NAME, findStore, storeLabel, liveCodes, analyze,
    PLAN_METRICS, planKey, progress, planFact, regionList, findRegion, analyzeRegion, aggregate, dayPlan };
})(typeof globalThis !== "undefined" ? globalThis : this);
