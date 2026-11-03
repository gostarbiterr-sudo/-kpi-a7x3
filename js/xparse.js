/* Потоковое чтение больших выгрузок: zip-записи распаковываются кусками, без загрузки целиком в память.
   Умеет читать кэш сводных таблиц (pivot cache) из .xlsx/.xlsm (XML) и .xlsb (двоичный формат),
   листы .xlsb и обычные таблицы. Всё — на устройстве, без внешних библиотек. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const dec = new TextDecoder("utf-8");

  // ---------------------------------------------------------------- zip
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 16777216;
  function zip(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
      if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("файл повреждён или это не файл Excel");
    const count = u16(b, eocd + 10);
    let p = u32(b, eocd + 16);
    const out = {};
    for (let n = 0; n < count; n++) {
      if (u32(b, p) !== 0x02014b50) break;
      const method = u16(b, p + 10), csize = u32(b, p + 20), usize = u32(b, p + 24), nlen = u16(b, p + 28), elen = u16(b, p + 30), clen = u16(b, p + 32);
      const local = u32(b, p + 42);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nlen)).replace(/^\/+/, "");
      out[name] = { method, csize, usize, local };
      p += 46 + nlen + elen + clen;
    }
    return { b, out, names: Object.keys(out) };
  }
  function rawEntry(z, name) {
    const e = z.out[name];
    if (!e) return null;
    const start = e.local + 30 + u16(z.b, e.local + 26) + u16(z.b, e.local + 28);
    return { e, raw: z.b.subarray(start, start + e.csize) };
  }
  // поток распакованных кусков Uint8Array
  function entryStream(z, name) {
    const r = rawEntry(z, name);
    if (!r) return null;
    if (r.e.method === 0) return new Blob([r.raw]).stream();
    return new Blob([r.raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  }
  async function entryBytes(z, name) {
    const s = entryStream(z, name);
    if (!s) return null;
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function entryText(z, name) {
    const b = await entryBytes(z, name);
    return b ? dec.decode(b) : null;
  }
  async function eachChunk(stream, fn) {
    const rd = stream.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; await fn(value); }
  }

  // ---------------------------------------------------------------- XML helpers
  const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  function unesc(s) {
    if (s.indexOf("&") < 0) return s;
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, g) =>
      g[0] === "#" ? String.fromCodePoint(g[1] === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10)) : ENT[g]).replace(/_x000a_/gi, "\n");
  }
  const attr = (s, n) => { const m = new RegExp("(?:^|\\s)" + n + '="([^"]*)"').exec(s); return m ? unesc(m[1]) : null; };
  const val = (tag, v) => (tag === "n" ? parseFloat(v) : tag === "m" || tag === "e" ? null : tag === "b" ? v === "1" : unesc(v == null ? "" : v));

  // ---------------------------------------------------------------- кэш сводных (XML)
  async function pivotCachesXml(z) {
    const out = [];
    for (const nm of z.names) {
      const m = /^xl\/pivotCache\/pivotCacheDefinition(\d+)\.xml$/.exec(nm);
      if (!m) continue;
      const xml = (await entryText(z, nm)).replace(/<(\/?)[A-Za-z_][\w.-]*:(?=[A-Za-z_])/g, "<$1");
      const fields = [];
      const re = /<cacheField\b([^>]*?)(\/>|>([\s\S]*?)<\/cacheField>)/g;
      let f;
      while ((f = re.exec(xml))) {
        const name = attr(f[1], "name"), db = attr(f[1], "databaseField") !== "0";
        const items = [];
        const si = f[3] ? /<sharedItems\b[^>]*?(?:\/>|>([\s\S]*?)<\/sharedItems>)/.exec(f[3]) : null;
        if (si && si[1]) { const ir = /<(s|n|m|b|d|e)\b(?:\s+v="([^"]*)")?[^>]*?\/?>/g; let it; while ((it = ir.exec(si[1]))) items.push(val(it[1], it[2])); }
        fields.push({ name, db, items });
      }
      const rec = `xl/pivotCache/pivotCacheRecords${m[1]}.xml`;
      out.push({ n: +m[1], kind: "xml", fields: fields.filter((x) => x.db), records: z.out[rec] ? rec : null, size: z.out[rec] ? z.out[rec].usize : 0 });
    }
    return out.sort((a, b) => a.n - b.n);
  }
  // onRow(values) — значения всех полей источника по порядку; progress(доля 0..1)
  async function pivotRowsXml(z, cache, onRow, progress) {
    const F = cache.fields, nf = F.length;
    let carry = "", row = new Array(nf), col = 0, done = 0;
    const td = new TextDecoder("utf-8");
    const tok = /<(x|n|s|m|b|d|e)\b(?:\s+v="([^"]*)")?[^>]*?\/>|<\/r>/g;
    const handle = (text) => {
      tok.lastIndex = 0;
      let t;
      while ((t = tok.exec(text))) {
        if (t[1] === undefined) { if (col) onRow(row); row = new Array(nf); col = 0; continue; }
        if (col < nf) row[col] = t[1] === "x" ? F[col].items[+t[2]] : val(t[1], t[2]);
        col++;
      }
    };
    await eachChunk(entryStream(z, cache.records), (chunk) => {
      done += chunk.length;
      const s = carry + td.decode(chunk, { stream: true });
      const cut = s.lastIndexOf("</r>");
      if (cut < 0) { carry = s; return; }
      handle(s.slice(0, cut + 4));
      carry = s.slice(cut + 4);
      if (progress && cache.size) progress(Math.min(1, done / cache.size));
    });
    if (carry) handle(carry);
  }

  // ---------------------------------------------------------------- XLSB (двоичные записи)
  // читает записи из буфера; возвращает позицию первой неполной записи
  function readRecords(b, start, fn) {
    let i = start; const n = b.length;
    while (i < n) {
      const s = i;
      let t = b[i++];
      if (t & 0x80) { if (i >= n) return s; t = (t & 0x7f) | ((b[i++] & 0x7f) << 7); }
      let sz = 0, sh = 0, ok = false;
      for (let k = 0; k < 4; k++) { if (i >= n) return s; const c = b[i++]; sz |= (c & 0x7f) << sh; sh += 7; if (!(c & 0x80)) { ok = true; break; } }
      if (!ok || i + sz > n) return s;
      fn(t, b, i, sz);
      i += sz;
    }
    return i;
  }
  const dv = (b) => new DataView(b.buffer, b.byteOffset, b.byteLength);
  function wstr(b, o) {           // XLWideString: длина (4 байта) + UTF-16LE
    const len = u32(b, o); let s = "";
    for (let k = 0; k < len; k++) s += String.fromCharCode(u16(b, o + 4 + 2 * k));
    return [s, o + 4 + 2 * len];
  }
  function f64(b, o) { return dv(b).getFloat64(o, true); }
  function binItem(t, b, o) {
    if (t === 24) return wstr(b, o)[0];
    if (t === 21) return f64(b, o);
    if (t === 22) return !!b[o];
    if (t === 25) return `${u16(b, o)}-${String(u16(b, o + 2)).padStart(2, "0")}-${String(b[o + 4]).padStart(2, "0")}`;
    return null;           // 20 — пусто, 23 — ошибка
  }
  async function pivotCachesBin(z) {
    const out = [];
    for (const nm of z.names) {
      const m = /^xl\/pivotCache\/pivotCacheDefinition(\d+)\.bin$/.exec(nm);
      if (!m) continue;
      const b = await entryBytes(z, nm);
      const fields = []; let cur = null, inAtbl = false;
      readRecords(b, 0, (t, bb, o, sz) => {
        if (t === 183) { cur = { name: wstr(bb, o + 20)[0], db: false, items: [], fl: 0, cnt: 0 }; fields.push(cur); }
        else if (t === 189 && cur) { inAtbl = true; cur.db = true; cur.fl = u16(bb, o); cur.cnt = u32(bb, o + 2); }
        else if (t === 190) inAtbl = false;
        else if (t === 191 && cur) {      // упакованный список значений
          const typ = u16(bb, o), cnt = u32(bb, o + 2); let p = o + 6;
          for (let k = 0; k < cnt; k++) {
            if (typ === 2) { const [s, q] = wstr(bb, p); cur.items.push(s); p = q; }
            else if (typ === 1) { cur.items.push(f64(bb, p)); p += 8; }
            else if (typ === 0x20) { cur.items.push(`${u16(bb, p)}-${String(u16(bb, p + 2)).padStart(2, "0")}-${String(bb[p + 4]).padStart(2, "0")}`); p += 8; }
            else break;
          }
        } else if (inAtbl && cur && t >= 20 && t <= 25) cur.items.push(binItem(t, bb, o));
      });
      const rec = `xl/pivotCache/pivotCacheRecords${m[1]}.bin`;
      out.push({ n: +m[1], kind: "bin", fields: fields.filter((x) => x.db), records: z.out[rec] ? rec : null, size: z.out[rec] ? z.out[rec].usize : 0 });
    }
    return out.sort((a, b) => a.n - b.n);
  }
  async function pivotRowsBin(z, cache, onRow, progress) {
    const F = cache.fields, nf = F.length;
    let row = null, col = 0, carry = new Uint8Array(0), done = 0;
    const emit = () => { if (row && col) onRow(row); };
    const onRec = (t, b, o, sz) => {
      if (t === 34) { emit(); row = new Array(nf); col = 0; return; }
      if (t === 33) {                    // компактная запись: все поля подряд
        emit(); row = null;
        const r = new Array(nf); let p = o;
        for (let k = 0; k < nf; k++) {
          const f = F[k];
          if (f.cnt > 0) { r[k] = f.items[u32(b, p)]; p += 4; }
          else if (f.fl & 0x08) { const [s, q] = wstr(b, p); r[k] = s; p = q; }
          else { r[k] = f64(b, p); p += 8; }
        }
        onRow(r); return;
      }
      if (!row || t < 20 || t > 26) return;
      if (col < nf) row[col] = t === 26 ? F[col].items[u32(b, o)] : binItem(t, b, o);
      col++;
    };
    await eachChunk(entryStream(z, cache.records), (chunk) => {
      done += chunk.length;
      let b = chunk;
      if (carry.length) { b = new Uint8Array(carry.length + chunk.length); b.set(carry); b.set(chunk, carry.length); }
      const pos = readRecords(b, 0, onRec);
      carry = b.slice(pos);
      if (progress && cache.size) progress(Math.min(1, done / cache.size));
    });
    emit();
  }

  // ---------------------------------------------------------------- листы .xlsb
  function rk(v) {
    let r;
    if (v & 2) { r = v >> 2; }
    else { const d = new DataView(new ArrayBuffer(8)); d.setUint32(4, (v & 0xfffffffc) >>> 0, true); d.setUint32(0, 0, true); r = d.getFloat64(0, true); }
    return v & 1 ? r / 100 : r;
  }
  async function xlsbBook(z) {
    const shared = [];
    const ss = await entryBytes(z, "xl/sharedStrings.bin");
    if (ss) readRecords(ss, 0, (t, b, o) => { if (t === 19) shared.push(wstr(b, o + 1)[0]); });
    const rels = (await entryText(z, "xl/_rels/workbook.bin.rels")) || "";
    const rid = {};
    rels.replace(/<Relationship\b([^>]*)\/?>/g, (m, a) => { rid[attr(a, "Id")] = attr(a, "Target"); return m; });
    const sheets = [];
    const wb = await entryBytes(z, "xl/workbook.bin");
    if (wb) readRecords(wb, 0, (t, b, o) => {
      if (t !== 156) return;
      const [r, p] = wstr(b, o + 8); const [name] = wstr(b, p);
      let target = rid[r] || ""; target = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
      sheets.push({ name, path: target });
    });
    return { z, shared, sheets };
  }
  async function xlsbSheet(book, sheet) {
    const b = await entryBytes(book.z, sheet.path);
    const rows = []; let r = -1;
    if (b) readRecords(b, 0, (t, bb, o) => {
      if (t === 0) { r = u32(bb, o); return; }
      if (t < 1 || t > 11 || r < 0) return;
      const c = u32(bb, o); let v = null;
      if (t === 2) v = rk(u32(bb, o + 8));
      else if (t === 5 || t === 9) v = f64(bb, o + 8);
      else if (t === 7) v = book.shared[u32(bb, o + 8)];
      else if (t === 6 || t === 8) v = wstr(bb, o + 8)[0];
      if (v == null) return;
      while (rows.length <= r) rows.push([]);
      const row = rows[r]; while (row.length < c) row.push(null); row[c] = v;
    });
    return rows;
  }

  KPI.xparse = { zip, entryText, entryBytes, entryStream, pivotCachesXml, pivotRowsXml, pivotCachesBin, pivotRowsBin, xlsbBook, xlsbSheet };
})(typeof globalThis !== "undefined" ? globalThis : this);
