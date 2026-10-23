/* Конкурс 1P: чтение выгрузки конкурса (листы «Магазины», «Территория», «Сотрудники»), расчёт выполнения трёх планов
   и отчёт: сводка, магазины / ASM, территории, продавцы. Всё считается на устройстве. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const isn = (v) => typeof v === "number" && isFinite(v);
  const key = (s) => String(s == null ? "" : s).toLowerCase().replace(/ё/g, "е").replace(/[\s ]+/g, " ").trim();
  const DAY = 86400000;
  // условия программы (из положения о конкурсе)
  const RULES = {
    growth: [30, 50, 70],               // прирост к историческому периоду, %
    fundStore: [0.2, 0.3, 1.0],         // ТУ / ДМ: % отчислений от оборота 1Р в фонд
    fundSeller: [0.4, 0.6, 0.8],        // РТЗ / продавцы: % от индивидуального оборота 1Р (если магазин выполнил план)
    prizeRegion: [50000, 75000, 100000],// директор региона
  };

  // ---------------------------------------------------------------- даты из названия файла
  function utc(y, m, d) { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t : null; }
  function namedDates(name) {
    const s = String(name).replace(/\.[^.]+$/, "").replace(/_/g, " ");
    const out = { start: null, end: null, exp: null };
    const iso = [...s.matchAll(/(20\d\d)-(\d\d)-(\d\d)/g)].map((m) => utc(+m[1], +m[2], +m[3])).filter(Boolean);
    if (iso.length) out.exp = iso[iso.length - 1];
    const s2 = s.replace(/(20\d\d)-(\d\d)-(\d\d)/g, " ");
    const dm = [...s2.matchAll(/(\d{1,2})\.(\d{1,2})\.(20\d\d|\d\d)(?!\d)/g)].map((m) => utc(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1])).filter(Boolean);
    if (dm.length >= 2) { out.start = dm[0]; out.end = dm[1]; if (!out.exp && dm[2]) out.exp = dm[2]; }
    return out;
  }

  // ---------------------------------------------------------------- разбор листов
  // блоки «План k → План фокусный товар (динамика) → Факт»: колонки ищем по заголовкам первой строки
  function planCols(h1) {
    const cols = [];
    for (let k = 1; k <= 3; k++) {
      for (let j = 0; j < h1.length - 2; j++) {
        if (key(h1[j]) === `план ${k}` && key(h1[j + 1]).startsWith("план фокусный") && key(h1[j + 2]) === "факт") { cols.push([j, j + 1, j + 2]); break; }
      }
    }
    return cols.length === 3 ? cols : null;
  }
  const num = (v) => (isn(v) ? v : typeof v === "string" && v.trim() !== "" && isFinite(+v.replace(/\s/g, "").replace(",", ".")) ? +v.replace(/\s/g, "").replace(",", ".") : null);
  function looksLike(rows) { return rows.length > 2 && !!planCols(rows[0] || []); }
  function parseBlocks(rows, nameCols) {
    const pc = planCols(rows[0] || []);
    const h2 = (rows[1] || []).map(key);
    const idx = {};
    for (const [k, title] of Object.entries(nameCols)) idx[k] = h2.findIndex((x) => x === key(title));
    const out = [];
    for (const r of rows.slice(2)) {
      if (!r) continue;
      const o = {};
      for (const k of Object.keys(nameCols)) o[k] = idx[k] >= 0 && r[idx[k]] != null ? String(r[idx[k]]).trim() : "";
      o.plans = pc.map(([a]) => num(r[a]));
      o.planDates = pc.map(([, b]) => num(r[b]));
      o.fact = num(r[pc[0][2]]);
      if (!o.plans.some(isn)) continue;
      out.push(o);
    }
    return out;
  }
  function parseEmp(rows) {
    const h = (rows[0] || []).map(key);
    const f = (t) => h.findIndex((x) => x === key(t));
    const c = { dsm: f("DSM"), asm: f("ASM"), code: f("Магазин"), name: f("ФИО"), role: f("Штатная должность"), qty: f("Фокусный товар, шт"), rub: f("Фокусный товар, руб"), place: f("Место") };
    if (c.code < 0 || c.name < 0 || c.rub < 0) return [];
    return rows.slice(1).filter((r) => r && r[c.code] && r[c.name]).map((r) => ({
      dsm: c.dsm >= 0 ? String(r[c.dsm] || "") : "", asm: c.asm >= 0 ? String(r[c.asm] || "") : "", code: String(r[c.code]).trim().toUpperCase(),
      name: String(r[c.name]).trim(), role: c.role >= 0 ? String(r[c.role] || "").replace(/руководитель торгового зала/i, "РТЗ") : "", qty: c.qty >= 0 ? num(r[c.qty]) : null, rub: num(r[c.rub]), place: c.place >= 0 ? num(r[c.place]) : null,
    }));
  }

  // разбор всей книги; null — если это не выгрузка конкурса
  async function parseBook(book, fileName, lastModified) {
    const sh = book.sheets.find((s) => key(s.name) === "магазины");
    if (!sh) return null;
    const { rows } = await KPI.xlsx.readSheet(book, sh);
    if (!looksLike(rows)) return null;
    const stores = parseBlocks(rows, { dsm: "DSM", asm: "ASM", code: "Магазин" }).filter((s) => s.code);
    stores.forEach((s) => (s.code = s.code.toUpperCase()));
    let terrs = [], emps = [];
    const st = book.sheets.find((s) => key(s.name).startsWith("территор"));
    if (st) { const r = (await KPI.xlsx.readSheet(book, st)).rows; if (looksLike(r)) terrs = parseBlocks(r, { name: "Территория" }).filter((t) => t.name); }
    const se = book.sheets.find((s) => key(s.name).startsWith("сотрудник"));
    if (se) emps = parseEmp((await KPI.xlsx.readSheet(book, se)).rows);
    const total = terrs.find((t) => key(t.name).includes("итог"));
    terrs = terrs.filter((t) => t !== total);
    // сроки: из названия файла; доля прошедших дней — из «плана на дату» в самом файле
    const nd = namedDates(fileName);
    const ratios = stores.map((s) => (s.plans[0] > 0 && isn(s.planDates[0]) ? s.planDates[0] / s.plans[0] : null)).filter((x) => x != null).sort((a, b) => a - b);
    const ratio = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
    const md = new Date(lastModified || Date.now());
    const exp = nd.exp || new Date(Date.UTC(md.getFullYear(), md.getMonth(), md.getDate()));
    let totalDays = null, elapsed = null;
    if (nd.start && nd.end && nd.end >= nd.start) {
      totalDays = Math.round((nd.end - nd.start) / DAY) + 1;
      elapsed = ratio != null ? Math.round(ratio * totalDays) : Math.max(0, Math.min(totalDays, Math.round((exp - nd.start) / DAY)));
    }
    const remDays = totalDays != null ? Math.max(0, totalDays - elapsed) : null;
    return { file: fileName, start: nd.start, end: nd.end, exp, expNamed: !!nd.exp, totalDays, elapsed, remDays, ratio, stores, terrs, emps, hasTotalRow: !!total };
  }

  // ---------------------------------------------------------------- расчёт
  function sum(list) {
    const o = { plans: [0, 0, 0], planDates: [0, 0, 0], fact: 0, n: list.length };
    for (const s of list) { for (let k = 0; k < 3; k++) { o.plans[k] += s.plans[k] || 0; o.planDates[k] += s.planDates[k] || 0; } o.fact += s.fact || 0; }
    return o;
  }
  // показатели по одному плану
  function m(o, k, C) {
    const plan = o.plans[k], pd = o.planDates[k], fact = o.fact || 0;
    const pct = plan > 0 ? (fact / plan) * 100 : null;
    const fc = pd > 0 ? (fact / pd) * 100 : null;                     // прогноз выполнения при текущем темпе
    const gap = plan > 0 ? Math.max(0, plan - fact) : null;          // не хватает до плана, ₽
    const lag = pd > 0 ? pd - fact : null;                           // отставание (+) / опережение (−) от плана на дату
    const perDay = gap != null && C.remDays ? gap / C.remDays : gap === 0 ? 0 : null;
    const pace = C.elapsed ? fact / C.elapsed : null;                 // сейчас в среднем в день
    const st = fc == null ? "na" : fc >= 100 ? "good" : fc >= 95 ? "warn" : "bad";
    return { k, plan, pd, fact, pct, fc, gap, lag, perDay, pace, st, up: pace && perDay != null ? (perDay / pace - 1) * 100 : null };
  }
  const allM = (o, C) => [0, 1, 2].map((k) => m(o, k, C));
  // какой план выходит при текущем темпе (0 — ни одного)
  const reach = (ms) => ms.reduce((a, x) => (x.fc != null && x.fc >= 100 ? x.k + 1 : a), 0);

  function levels(C) {
    const out = [{ level: "company", name: "Вся компания", label: "Вся компания" }];
    const dsms = [...new Set(C.stores.map((s) => s.dsm).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
    dsms.forEach((d) => out.push({ level: "dsm", name: d, label: `${d} — дивизион (DSM)` }));
    const asms = [...new Set(C.stores.map((s) => s.asm).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
    asms.forEach((a) => out.push({ level: "asm", name: a, label: `${a} (ASM)` }));
    return out;
  }
  function findStore(C, q) {
    const s = String(q || "").trim().toUpperCase().replace(/^А/, "A").replace(/^С/, "S");
    if (!s) return [];
    const exact = C.stores.filter((x) => x.code === s);
    if (exact.length) return exact.map((x) => x.code);
    return C.stores.filter((x) => x.code.includes(s)).map((x) => x.code);
  }
  const stem = (s) => key(s).replace(/[^а-яa-z0-9 ]/g, "").slice(0, 5);

  function analyze(C, sel) {
    let list, title, level = sel.level, store = null;
    if (level === "store") { store = C.stores.find((s) => s.code === sel.code); list = store ? [store] : []; title = `Магазин ${sel.code}`; }
    else if (level === "dsm") { list = C.stores.filter((s) => s.dsm === sel.name); title = sel.name; }
    else if (level === "asm") { list = C.stores.filter((s) => s.asm === sel.name); title = sel.name; }
    else { level = "company"; list = C.stores; title = "Вся компания"; }
    const tot = sum(list);
    const res = { type: "contest", level, code: level === "store" ? sel.code : title, name: title, C, total: tot, ms: allM(tot, C), store };
    res.reach = reach(res.ms);
    res.stores = list.map((s) => ({ code: s.code, dsm: s.dsm, asm: s.asm, ms: allM(s, C) }));
    res.stores.forEach((s) => (s.reach = reach(s.ms)));
    const groupBy = level === "company" ? "dsm" : level === "dsm" ? "asm" : null;
    res.groupBy = groupBy;
    if (groupBy) {
      const names = [...new Set(list.map((s) => s[groupBy]).filter(Boolean))];
      res.groups = names.map((g) => { const sub = list.filter((s) => s[groupBy] === g), o = sum(sub), ms = allM(o, C); return { name: g, n: sub.length, ms, reach: reach(ms) }; })
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));
      if (level === "company") {      // и все ASM — для сравнения
        const asms = [...new Set(list.map((s) => s.asm).filter(Boolean))];
        res.asms = asms.map((g) => { const sub = list.filter((s) => s.asm === g), o = sum(sub), ms = allM(o, C); return { name: g, dsm: sub[0].dsm, n: sub.length, ms, reach: reach(ms) }; })
          .sort((a, b) => a.name.localeCompare(b.name, "ru"));
      }
    }
    // территории: во всей компании — все; в ASM — с тем же началом названия («Нижегородский» → «Нижегородская территория N»)
    res.terrs = level === "company" ? C.terrs : level === "asm" ? C.terrs.filter((t) => stem(t.name) === stem(sel.name)) : [];
    res.terrs = res.terrs.map((t) => ({ name: t.name, ms: allM(t, C) })).sort((a, b) => a.name.localeCompare(b.name, "ru", { numeric: true }));
    // продавцы магазина
    if (level === "store") {
      const e = C.emps.filter((x) => x.code === sel.code).sort((a, b) => (b.rub || 0) - (a.rub || 0));
      const tot2 = e.reduce((a, x) => a + Math.max(0, x.rub || 0), 0);
      res.sellers = e.map((x) => ({ ...x, share: tot2 > 0 ? (Math.max(0, x.rub || 0) / tot2) * 100 : null }));
    } else res.sellers = [];
    res.warnings = [];
    if (!C.totalDays) res.warnings.push("В названии файла нет дат конкурса (например «10.10.2026 - 08.11.2026») — «нужно в день» не рассчитать.");
    if (C.remDays === 0) res.warnings.push("Конкурс закончился: дни для догона не остались.");
    return res;
  }

  // ---------------------------------------------------------------- отчёт (HTML)
  const esc = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf = (v, d = 0) => (v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const rub = (v) => (v == null ? "—" : nf(v, 0) + " ₽");
  const pc = (v) => (v == null ? "—" : nf(v, 1) + "%");
  const rd = (d) => (d ? `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}` : "—");
  const ST_TXT = { good: "на темпе", warn: "почти", bad: "отстаёт", na: "—" };
  const chip = (st, t) => `<span class="chip ${st}"><i>${{ good: "✓", warn: "!", bad: "✕", na: "–" }[st] || "–"}</i>${esc(t)}</span>`;
  const PL = (k) => `План ${k + 1} · +${RULES.growth[k]}%`;
  const reachTxt = (r) => (r ? `при текущем темпе выйдет план ${r}` : "при текущем темпе не выходит даже план 1");

  function daysLine(C) {
    const per = C.start ? `Конкурс ${rd(C.start)} – ${rd(C.end)}` : "Конкурс";
    const d = C.totalDays ? ` · прошло ${C.elapsed} из ${C.totalDays} дн., осталось ${C.remDays}` : "";
    return `${per} · выгрузка ${rd(C.exp)}${d}`;
  }
  function ring(p, st) {
    const v = Math.max(0, Math.min(100, p || 0)), L = 2 * Math.PI * 26;
    return `<svg class="ring" viewBox="0 0 66 66"><circle class="rbg" cx="33" cy="33" r="26"/><circle class="rfg ${st}" cx="33" cy="33" r="26" stroke-dasharray="${(L * v) / 100} ${L}" transform="rotate(-90 33 33)"/><text x="33" y="39" text-anchor="middle">${nf(p, 0)}%</text></svg>`;
  }
  function bar(x) {          // факт / план на дату / план
    const w = (v) => Math.max(0, Math.min(100, x.plan > 0 ? (v / x.plan) * 100 : 0));
    return `<div class="cbar2"><div class="cfill ${x.st}" style="width:${w(x.fact)}%"></div><i style="left:${w(x.pd)}%" title="план на дату"></i></div>`;
  }
  function summary(res) {
    const C = res.C;
    const tiles = res.ms.map((x) => `<div class="ctile ${x.st}"><div class="cth"><b>${PL(x.k)}</b>${chip(x.st, ST_TXT[x.st])}</div>
<div class="ctb">${ring(x.pct, x.st)}<div><div class="cbig">${rub(x.fact)}</div><small>из ${rub(x.plan)}</small></div></div>${bar(x)}
<div class="cgrid"><div><small>Не хватает</small><b>${x.gap === 0 ? "выполнен ✓" : rub(x.gap)}</b></div><div><small>Нужно в день</small><b>${x.gap === 0 ? "—" : rub(x.perDay)}</b></div>
<div><small>Прогноз на конец</small><b class="${x.st}">${pc(x.fc)}</b></div><div><small>${x.lag > 0 ? "Отставание от плана на дату" : "Опережение плана на дату"}</small><b>${rub(x.lag == null ? null : Math.abs(x.lag))}</b></div></div>
${x.gap > 0 && x.up != null ? `<p class="muted">Сейчас в среднем ${rub(x.pace)} в день — нужно ${x.up > 0 ? `на ${nf(x.up, 0)}% больше` : "столько же или меньше"}.</p>` : ""}</div>`).join("");
    const reachP = `<p class="lead"><b>${res.reach ? `Темп на план ${res.reach}` : "Темп ниже плана 1"}</b> — ${reachTxt(res.reach)}.${res.level !== "store" ? ` Магазинов: ${res.stores.length}.` : ""}</p>`;
    let cnt = "";
    if (res.level !== "store" && res.stores.length > 1) {
      cnt = `<section class="panel"><h3>Сколько магазинов идут на план</h3><div class="ccnt">${[0, 1, 2].map((k) => {
        const ok = res.stores.filter((s) => s.ms[k].fc >= 100).length, done = res.stores.filter((s) => s.ms[k].gap === 0).length;
        return `<div><small>${PL(k)}</small><b>${ok} из ${res.stores.length}</b><span>на темпе${done ? ` · уже выполнили: ${done}` : ""}</span></div>`;
      }).join("")}</div></section>`;
    }
    let fund = "";
    if (res.level === "store") {
      fund = `<section class="panel"><h3>Премия по условиям конкурса (оценка)</h3><p class="muted">${res.level === "store" ? "Директор магазина" : "Территориальный управляющий"}: процент от оборота 1Р в фонд при выполнении плана. Продавцы и РТЗ — процент от личного оборота 1Р, если магазин выполнил хотя бы план 1.</p>
<div class="tw"><table class="mt"><thead><tr><th>План</th><th>${res.level === "store" ? "ДМ" : "ТУ"}: % от оборота</th><th>Фонд при выполнении ровно плана</th><th>Продавцы: % от личного</th></tr></thead><tbody>${res.ms.map((x) =>
        `<tr><th class="rl">${PL(x.k)}</th><td>${nf(RULES.fundStore[x.k], 1)}%</td><td>${rub((x.plan * RULES.fundStore[x.k]) / 100)}</td><td>${nf(RULES.fundSeller[x.k], 1)}%</td></tr>`).join("")}</tbody></table></div></section>`;
    }
    return `${reachP}<div class="ctiles">${tiles}</div>${cnt}${fund}`;
  }
  // таблица (магазины / ASM / DSM / территории) по выбранному плану
  function table(rows, kind, res) {
    if (!rows.length) return '<p class="muted">Нет данных.</p>';
    const withAsm = kind === "store" && res.level !== "asm";
    return [0, 1, 2].map((k) => {
      const srt = [...rows].sort((a, b) => (a.ms[k].fc ?? 1e9) - (b.ms[k].fc ?? 1e9));
      const head = `<th>${{ store: "Магазин", asm: "ASM", dsm: "DSM", terr: "Территория" }[kind]}</th>${withAsm ? "<th>ASM</th>" : ""}<th>Факт</th><th>План</th><th>Выполнено</th><th>Прогноз</th><th>Не хватает</th><th>Нужно в день</th><th>От плана на дату</th>`;
      const body = srt.map((r) => {
        const x = r.ms[k];
        return `<tr><th class="rl">${esc(r.code || r.name)}${r.n ? `<small class="sub">магазинов: ${r.n}</small>` : ""}</th>${withAsm ? `<td class="tl">${esc(r.asm)}</td>` : ""}<td>${rub(x.fact)}</td><td>${rub(x.plan)}</td>` +
          `<td><div class="cellv">${pc(x.pct)}</div>${bar(x)}</td><td class="c-${x.st}"><b>${pc(x.fc)}</b></td><td>${x.gap === 0 ? "✓" : rub(x.gap)}</td><td><b>${x.gap === 0 ? "—" : rub(x.perDay)}</b></td><td class="${x.lag > 0 ? "neg" : "pos"}">${x.lag == null ? "—" : (x.lag > 0 ? "−" : "+") + rub(Math.abs(x.lag))}</td></tr>`;
      }).join("");
      const cards = srt.map((r) => {
        const x = r.ms[k];
        return `<article class="empcard ${x.st}"><div class="ech"><b>${esc(r.code || r.name)}${withAsm ? ` <small class="muted">${esc(r.asm)}</small>` : ""}</b>${chip(x.st, pc(x.fc) + " прогноз")}</div>${bar(x)}
<div class="ecg"><div class="ec"><small>Факт / план</small><b>${rub(x.fact)}</b><span>${pc(x.pct)} от ${rub(x.plan)}</span></div><div class="ec ${x.gap > 0 ? "c-bad" : ""}"><small>Не хватает</small><b>${x.gap === 0 ? "выполнен ✓" : rub(x.gap)}</b></div>
<div class="ec"><small>Нужно в день</small><b>${x.gap === 0 ? "—" : rub(x.perDay)}</b></div><div class="ec"><small>${x.lag > 0 ? "Отстаёт от плана на дату" : "Опережает план на дату"}</small><b>${rub(x.lag == null ? null : Math.abs(x.lag))}</b></div></div></article>`;
      }).join("");
      const ok = rows.filter((r) => r.ms[k].fc >= 100).length;
      return `<div class="cper" data-p="p${k + 1}"><p class="muted">${PL(k)} · на темпе ${ok} из ${rows.length} · сначала те, кто дальше всего от плана. «Нужно в день» — сколько делать каждый оставшийся день, чтобы выполнить план.</p>` +
        `<div class="wide-only"><div class="tw"><table class="mt sticky1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div><div class="narrow-only">${cards}</div></div>`;
    }).join("");
  }
  function sellersBlock(res) {
    const e = res.sellers;
    if (!e.length) return '<p class="muted">В файле конкурса нет продавцов этого магазина (лист «Сотрудники»).</p>';
    const reach0 = res.reach;
    const rows = e.map((x, i) => `<tr><td>${i + 1}</td><th class="rl">${esc(x.name)}<small class="sub">${esc(x.role)}</small></th><td>${nf(x.qty, 0)}</td><td>${rub(x.rub)}</td><td>${pc(x.share)}</td><td>${nf(x.place, 0)}</td>` +
      [0, 1, 2].map((k) => `<td>${x.rub > 0 ? rub((x.rub * RULES.fundSeller[k]) / 100) : "—"}</td>`).join("") + "</tr>").join("");
    const cards = e.map((x, i) => `<article class="empcard"><div class="ech"><b>${i + 1}. ${esc(x.name)}</b><span class="muted">${esc(x.role)}</span></div><div class="ecg">
<div class="ec"><small>Оборот 1Р</small><b>${rub(x.rub)}</b><span>${nf(x.qty, 0)} шт · ${pc(x.share)} магазина</span></div><div class="ec"><small>Место в рейтинге</small><b>${nf(x.place, 0)}</b></div>
${[0, 1, 2].map((k) => `<div class="ec"><small>Доплата при плане ${k + 1}</small><b>${x.rub > 0 ? rub((x.rub * RULES.fundSeller[k]) / 100) : "—"}</b><span>${nf(RULES.fundSeller[k], 1)}% от личного</span></div>`).join("")}</div></article>`).join("");
    return `<p class="lead">Продавцы и РТЗ получают процент от личного оборота 1Р, только если магазин выполнит план. Сейчас ${reach0 ? `магазин идёт на план ${reach0}` : "магазин не идёт даже на план 1"}.</p>` +
      `<p class="muted">В листе «Сотрудники» мотивационный оборот (с учётом S2S), он может немного отличаться от оборота в листе «Магазины». Доплата посчитана от текущего оборота — к концу конкурса она вырастет.</p>` +
      `<div class="wide-only"><div class="tw"><table class="mt"><thead><tr><th>№</th><th>Сотрудник</th><th>Штук 1Р</th><th>Оборот 1Р</th><th>Доля в магазине</th><th>Место</th><th>Доплата · план 1</th><th>· план 2</th><th>· план 3</th></tr></thead><tbody>${rows}</tbody></table></div></div><div class="narrow-only">${cards}</div>`;
  }

  function build(res, baseCss) {
    const C = res.C;
    const pbar = `<div class="perbar"><span>План:</span>${[0, 1, 2].map((k) => `<button class="plb" data-p="p${k + 1}">${PL(k)}</button>`).join("")}</div>`;
    const tabs = [["sum", "Сводка"]];
    if (res.groups && res.groups.length) tabs.push(["grp", res.groupBy === "dsm" ? "Дивизионы" : "ASM"]);
    if (res.asms && res.asms.length) tabs.push(["asm", "ASM"]);
    if (res.level !== "store") tabs.push(["st", "Магазины"]);
    if (res.terrs.length) tabs.push(["terr", "Территории"]);
    if (res.level === "store") tabs.push(["sel", "Продавцы"]);
    const sec = { sum: summary(res), grp: res.groups ? pbar + table(res.groups, res.groupBy, res) : "", asm: res.asms ? pbar + table(res.asms, "asm", res) : "",
      st: pbar + table(res.stores, "store", res), terr: pbar + table(res.terrs, "terr", res), sel: sellersBlock(res) };
    const info = res.store ? [res.store.dsm, res.store.asm].filter(Boolean).join(" · ") : res.level === "dsm" ? "Дивизион (DSM)" : res.level === "asm" ? "ASM" : "Все магазины в выгрузке";
    const warn = res.warnings.map((w) => `<div class="banner">⚠ ${esc(w)}</div>`).join("");
    const body = `<div class="rep" data-plan="p1"><header class="top"><div class="ttl"><h1>Конкурс 1P · ${esc(res.name)}</h1><p>${esc(info)}</p><p class="muted">${esc(daysLine(C))}</p></div></header>
<nav class="tabs">${tabs.map(([t, n], i) => `<button class="tb${i ? "" : " on"}" data-t="${t}">${n}</button>`).join("")}</nav><main>
${tabs.map(([t], i) => `<section class="tab${i ? "" : " on"}" data-tab="${t}">${i ? "" : warn}${sec[t]}</section>`).join("\n")}
<p class="muted">Прогноз — выполнение на конец конкурса, если продавать так же, как до сих пор (факт ÷ план на дату выгрузки). «Не хватает» — план минус факт. «Нужно в день» — недостающее делится на оставшиеся дни.</p>
</main><div class="tipbox" role="tooltip"></div></div>`;
    return { body, css: baseCss + CSS, title: `Конкурс 1P — ${res.name}` };
  }
  const CSS = `
.cper{display:none}.rep[data-plan=p1] .cper[data-p=p1],.rep[data-plan=p2] .cper[data-p=p2],.rep[data-plan=p3] .cper[data-p=p3]{display:block}
.plb{border:1px solid var(--line);background:var(--surface);color:var(--text);padding:7px 14px;border-radius:18px;cursor:pointer;font:600 13px/1 inherit;font-family:inherit}
.rep[data-plan=p1] .plb[data-p=p1],.rep[data-plan=p2] .plb[data-p=p2],.rep[data-plan=p3] .plb[data-p=p3]{background:var(--accent);color:var(--surface);border-color:var(--accent)}
.ctiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}
.ctile{background:var(--surface);border:1px solid var(--line);border-top:6px solid var(--line);border-radius:12px;padding:12px 14px}
.ctile.good{border-top-color:var(--good)}.ctile.warn{border-top-color:var(--warn)}.ctile.bad{border-top-color:var(--bad)}
.cth{display:flex;justify-content:space-between;align-items:center;gap:8px}.ctb{display:flex;align-items:center;gap:12px;margin:8px 0}.cbig{font-size:22px;font-weight:700}
.cgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin-top:10px}.cgrid small{display:block;color:var(--muted);font-size:12px}.cgrid b{font-size:15px}
.cgrid b.good{color:var(--good)}.cgrid b.bad{color:var(--bad)}.cgrid b.warn{color:#b07a00}
.cbar2{position:relative;height:8px;border-radius:4px;background:var(--b1);margin:6px 0 2px;min-width:70px}.cbar2 .cfill{height:100%;border-radius:4px;background:var(--info)}
.cbar2 .cfill.good{background:var(--good)}.cbar2 .cfill.warn{background:var(--warn)}.cbar2 .cfill.bad{background:var(--bad)}.cbar2 i{position:absolute;top:-3px;width:2px;height:14px;background:var(--text)}
.ccnt{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.ccnt small{display:block;color:var(--muted)}.ccnt b{font-size:20px;display:block}.ccnt span{color:var(--text2);font-size:12.5px}
td.c-good b{color:var(--good)}td.c-warn b{color:#b07a00}td.c-bad b{color:var(--bad)}td.tl{text-align:left}
.empcard.good{border-left-color:var(--good)}
@media (max-width:700px){.ctiles,.ccnt{grid-template-columns:1fr}}
`;

  KPI.contest = { RULES, namedDates, parseBook, levels, findStore, analyze, build, sum, metrics: m };
})(typeof globalThis !== "undefined" ? globalThis : this);
