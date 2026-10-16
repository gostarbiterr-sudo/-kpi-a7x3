/* Лёгкий читатель .xlsx без внешних библиотек.
   Распаковывает zip встроенным DecompressionStream, читает общие строки, стили (чтобы узнать «процентный» формат) и листы.
   Результат: [{name, rows, pctCols}] — rows: массив строк, в каждой значения (число | строка | null);
   проценты в формате % приводятся к «процентным пунктам» (0,25 -> 25), как в версии для ПК. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const dec = new TextDecoder("utf-8");

  // ---------------------------------------------------------------- zip
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 16777216; }

  async function inflateRaw(data) {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([data]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function zipEntries(buf) {
    const b = new Uint8Array(buf);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
      if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("файл повреждён или это не .xlsx");
    const count = u16(b, eocd + 10);
    let p = u32(b, eocd + 16);
    const out = {};
    for (let n = 0; n < count; n++) {
      if (u32(b, p) !== 0x02014b50) break;
      const method = u16(b, p + 10), csize = u32(b, p + 20), nlen = u16(b, p + 28), elen = u16(b, p + 30), clen = u16(b, p + 32);
      const local = u32(b, p + 42);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
      out[name.replace(/^\/+/, "")] = { method, csize, local };
      p += 46 + nlen + elen + clen;
    }
    return { b, out };
  }

  async function readEntry(z, name) {
    const e = z.out[name];
    if (!e) return null;
    const b = z.b, p = e.local;
    const start = p + 30 + u16(b, p + 26) + u16(b, p + 28);
    const raw = b.subarray(start, start + e.csize);
    const data = e.method === 0 ? raw : await inflateRaw(raw);
    // некоторые программы пишут теги с префиксом пространства имён (<x:row>, <x:c>) — убираем префиксы у тегов
    return dec.decode(data).replace(/<(\/?)[A-Za-z_][\w.-]*:(?=[A-Za-z_])/g, "<$1");
  }

  // ---------------------------------------------------------------- xml helpers
  const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  function unesc(s) {
    if (s.indexOf("&") < 0) return s;
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, g) =>
      g[0] === "#" ? String.fromCodePoint(g[1] === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10)) : ENT[g]);
  }
  function attr(s, name) {
    const m = new RegExp("(?:^|\\s)" + name + '="([^"]*)"').exec(s);
    return m ? unesc(m[1]) : null;
  }
  function texts(s) {           // склейка всех <t>…</t> (без фонетики <rPh>)
    s = s.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
    let out = "", m;
    const re = /<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g;
    while ((m = re.exec(s))) out += m[1] ? unesc(m[1]) : "";
    return out;
  }

  function colIndex(ref) {
    let n = 0;
    for (let i = 0; i < ref.length; i++) {
      const c = ref.charCodeAt(i);
      if (c < 65 || c > 90) break;
      n = n * 26 + (c - 64);
    }
    return n - 1;
  }

  // ---------------------------------------------------------------- значение ячейки (как conv_cell в версии для ПК)
  const NUM = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)$/;
  function convText(t) {
    t = t.replace(/ /g, " ").trim();
    if (!t || t[0] === "#") return [null, false];
    let t2 = t.replace(/[−–]/g, "-").replace(/ /g, "");
    const pct = t2.endsWith("%");
    if (pct) t2 = t2.slice(0, -1);
    if (NUM.test(t2)) return [parseFloat(t2.replace(",", ".")), pct];
    return [t, false];
  }

  // ---------------------------------------------------------------- книга
  async function readWorkbook(buf) {
    const z = zipEntries(buf);
    const wbXml = await readEntry(z, "xl/workbook.xml");
    if (!wbXml) throw new Error("в файле нет книги Excel");
    const relXml = (await readEntry(z, "xl/_rels/workbook.xml.rels")) || "";
    const rels = {};
    relXml.replace(/<Relationship\b([^>]*)\/?>/g, (m, a) => { rels[attr(a, "Id")] = attr(a, "Target"); return m; });

    const shared = [];
    const ssXml = await readEntry(z, "xl/sharedStrings.xml");
    if (ssXml) { const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\s*\/>/g; let m; while ((m = re.exec(ssXml))) shared.push(m[1] ? texts(m[1]) : ""); }

    // стили: индекс стиля -> «формат процентный?»
    const pctStyle = [];
    const stXml = await readEntry(z, "xl/styles.xml");
    if (stXml) {
      const custom = {};
      stXml.replace(/<numFmt\b([^>]*)\/?>/g, (m, a) => { custom[attr(a, "numFmtId")] = attr(a, "formatCode") || ""; return m; });
      const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stXml);
      if (xfs) {
        const re = /<xf\b([^>]*?)(?:\/>|>)/g; let m;
        while ((m = re.exec(xfs[1]))) {
          const id = attr(m[1], "numFmtId") || "0";
          const code = custom[id];
          pctStyle.push(id === "9" || id === "10" || (code != null && /%/.test(code.replace(/"[^"]*"/g, "").replace(/\\%/g, ""))));
        }
      }
    }

    const sheets = [];
    const re = /<sheet\b([^>]*)\/?>/g; let m;
    while ((m = re.exec(wbXml))) {
      const name = attr(m[1], "name");
      const rid = attr(m[1], "r:id") || attr(m[1], "id");
      let target = rels[rid] || "";
      target = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
      sheets.push({ name, path: target });
    }
    return { z, shared, pctStyle, sheets };
  }

  async function readSheet(book, sheet, limit = 300000) {
    const xml = await readEntry(book.z, sheet.path);
    const rows = [], pctCols = new Set();
    if (!xml) return { rows, pctCols };
    const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
    const cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let rm, autoRow = 0;
    while ((rm = rowRe.exec(xml))) {
      const rAttr = attr(rm[1], "r");
      const ri = rAttr ? parseInt(rAttr, 10) - 1 : autoRow;
      autoRow = ri + 1;
      while (rows.length < ri) rows.push([]);
      const vals = [];
      if (rm[2]) {
        cRe.lastIndex = 0;
        let cm, autoCol = 0;
        while ((cm = cRe.exec(rm[2]))) {
          const a = cm[1], inner = cm[2] || "";
          const ref = attr(a, "r");
          const ci = ref ? colIndex(ref) : autoCol;
          autoCol = ci + 1;
          const t = attr(a, "t") || "n";
          const s = parseInt(attr(a, "s") || "0", 10);
          let v = null, pct = false;
          const vm = /<v>([\s\S]*?)<\/v>/.exec(inner);
          if (t === "s") { if (vm) [v, pct] = convText(book.shared[parseInt(vm[1], 10)] || ""); }
          else if (t === "inlineStr") { [v, pct] = convText(texts(inner)); }
          else if (t === "str") { if (vm) [v, pct] = convText(unesc(vm[1])); }
          else if (t === "b" || t === "e" || t === "d") { v = null; }
          else if (vm) {
            const x = parseFloat(vm[1]);
            if (!isNaN(x)) { if (book.pctStyle[s]) { v = x * 100; pct = true; } else v = x; }
          }
          while (vals.length < ci) vals.push(null);
          vals[ci] = v;
          if (pct) pctCols.add(ci);
        }
      }
      while (vals.length && vals[vals.length - 1] == null) vals.pop();
      rows.push(vals);
      if (rows.length >= limit) break;
    }
    return { rows, pctCols };
  }

  KPI.xlsx = { readWorkbook, readSheet };
})(typeof globalThis !== "undefined" ? globalThis : this);
