/* Чтение старого формата Excel .xls (BIFF8 внутри OLE-контейнера) — только значения ячеек первого листа и всех листов по запросу.
   Нужен для графика работы, который выгружается в .xls. Работает целиком на устройстве. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});

  // ---- OLE (Compound File Binary): находим поток Workbook
  function cfbStream(buf, want) {
    const b = new Uint8Array(buf), dv = new DataView(buf);
    const sig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    if (sig.some((x, i) => b[i] !== x)) throw new Error("это не файл .xls");
    const ss = 1 << dv.getUint16(30, true), mss = 1 << dv.getUint16(32, true);
    const nFat = dv.getUint32(44, true), dirStart = dv.getUint32(48, true), cutoff = dv.getUint32(56, true);
    const miniFatStart = dv.getUint32(60, true), difStart = dv.getUint32(68, true), nDif = dv.getUint32(72, true);
    const off = (s) => (s + 1) * ss;
    // список секторов FAT: 109 в заголовке + цепочка DIFAT
    const fatSecs = [];
    for (let i = 0; i < 109 && fatSecs.length < nFat; i++) fatSecs.push(dv.getUint32(76 + i * 4, true));
    let d = difStart;
    for (let k = 0; k < nDif && d < 0xfffffffa; k++) {
      for (let i = 0; i < ss / 4 - 1 && fatSecs.length < nFat; i++) fatSecs.push(dv.getUint32(off(d) + i * 4, true));
      d = dv.getUint32(off(d) + ss - 4, true);
    }
    const fat = new Uint32Array(fatSecs.length * ss / 4);
    fatSecs.forEach((s, i) => { for (let j = 0; j < ss / 4; j++) fat[i * ss / 4 + j] = dv.getUint32(off(s) + j * 4, true); });
    const chain = (s) => { const out = []; let g = 0; while (s < 0xfffffffa && g++ < 1e6) { out.push(s); s = fat[s]; } return out; };
    const read = (s, size) => { const secs = chain(s), o = new Uint8Array(secs.length * ss); secs.forEach((x, i) => o.set(b.subarray(off(x), off(x) + ss), i * ss)); return size != null ? o.subarray(0, size) : o; };
    const dir = read(dirStart), dd = new DataView(dir.buffer, dir.byteOffset, dir.byteLength), ents = [];
    for (let o = 0; o + 128 <= dir.length; o += 128) {
      const nl = dd.getUint16(o + 64, true); let name = "";
      for (let i = 0; i < nl / 2 - 1; i++) name += String.fromCharCode(dd.getUint16(o + i * 2, true));
      ents.push({ name, type: dir[o + 66], start: dd.getUint32(o + 116, true), size: dd.getUint32(o + 120, true) });
    }
    const root = ents[0];
    const e = ents.find((x) => x.type === 2 && want.includes(x.name));
    if (!e) throw new Error("в файле нет книги Excel");
    if (e.size >= cutoff) return read(e.start, e.size);
    // маленький поток — в mini stream
    const ministream = read(root.start, root.size);
    const mfat = read(miniFatStart), md = new DataView(mfat.buffer, mfat.byteOffset, mfat.byteLength);
    const out = new Uint8Array(Math.ceil(e.size / mss) * mss); let s = e.start, i = 0;
    while (s < 0xfffffffa && i * mss < out.length) { out.set(ministream.subarray(s * mss, s * mss + mss), i * mss); s = md.getUint32(s * 4, true); i++; }
    return out.subarray(0, e.size);
  }

  // ---- BIFF8
  function rk(v) {
    const div = v & 1, isInt = v & 2;
    let n;
    if (isInt) n = v >> 2;
    else { const t = new DataView(new ArrayBuffer(8)); t.setUint32(4, v & 0xfffffffc, true); t.setUint32(0, 0, true); n = t.getFloat64(0, true); }
    return div ? n / 100 : n;
  }
  function readXls(buf) {
    const w = cfbStream(buf, ["Workbook", "Book"]), dv = new DataView(w.buffer, w.byteOffset, w.byteLength);
    // записи
    const recs = []; let o = 0;
    while (o + 4 <= w.length) { const id = dv.getUint16(o, true), len = dv.getUint16(o + 2, true); recs.push({ id, o: o + 4, len }); o += 4 + len; }
    // SST (с продолжениями CONTINUE)
    const sst = []; const sheets = [];
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i];
      if (r.id === 0x0085) {               // BOUNDSHEET
        const pos = dv.getUint32(r.o, true), nl = w[r.o + 6], fl = w[r.o + 7];
        let name = ""; for (let k = 0; k < nl; k++) name += String.fromCharCode(fl & 1 ? dv.getUint16(r.o + 8 + k * 2, true) : w[r.o + 8 + k]);
        sheets.push({ name, pos, type: w[r.o + 5] });
      } else if (r.id === 0x00fc) {        // SST
        const parts = [r]; let j = i + 1; while (j < recs.length && recs[j].id === 0x003c) parts.push(recs[j++]);
        let pi = 0, p = parts[0].o + 8, end = parts[0].o + parts[0].len;
        const total = dv.getUint32(parts[0].o + 4, true);
        const need = (n) => { if (p + n > end && pi + 1 < parts.length && p >= end) { pi++; p = parts[pi].o; end = p + parts[pi].len; } };
        const u8 = () => { if (p >= end) { pi++; p = parts[pi].o; end = p + parts[pi].len; } return w[p++]; };
        const u16 = () => { need(2); const v = dv.getUint16(p, true); p += 2; return v; };
        const u32 = () => { need(4); const v = dv.getUint32(p, true); p += 4; return v; };
        for (let k = 0; k < total && pi < parts.length; k++) {
          if (p >= end) { pi++; if (pi >= parts.length) break; p = parts[pi].o; end = p + parts[pi].len; }
          const cch = u16(); let fl = u8();
          const rich = fl & 8 ? u16() : 0, ext = fl & 4 ? u32() : 0;
          let s = "", left = cch;
          while (left > 0) {
            if (p >= end) { pi++; p = parts[pi].o; end = p + parts[pi].len; fl = w[p++]; }   // новый кусок: снова флаг сжатия
            const wide = fl & 1, can = Math.min(left, wide ? (end - p) >> 1 : end - p);
            for (let c = 0; c < can; c++) { s += String.fromCharCode(wide ? dv.getUint16(p, true) : w[p]); p += wide ? 2 : 1; }
            left -= can;
          }
          // пропустить форматирование и расширения (могут переходить через CONTINUE)
          let skip = rich * 4 + ext;
          while (skip > 0) { if (p >= end) { pi++; if (pi >= parts.length) break; p = parts[pi].o; end = p + parts[pi].len; } const t = Math.min(skip, end - p); p += t; skip -= t; }
          sst.push(s);
        }
        i = j - 1;
      }
    }
    // ячейки каждого листа
    const out = [];
    for (const sh of sheets) {
      if (sh.type !== 0) continue;
      const cells = []; let maxR = -1;
      const put = (r, c, v) => { (cells[r] = cells[r] || [])[c] = v; if (r > maxR) maxR = r; };
      let k = recs.findIndex((x) => x.o - 4 === sh.pos); if (k < 0) continue;
      let lastF = null;
      for (k = k + 1; k < recs.length; k++) {
        const r = recs[k], q = r.o;
        if (r.id === 0x000a) break;        // EOF
        if (r.id === 0x00fd) put(dv.getUint16(q, true), dv.getUint16(q + 2, true), sst[dv.getUint32(q + 6, true)]);
        else if (r.id === 0x0203) put(dv.getUint16(q, true), dv.getUint16(q + 2, true), dv.getFloat64(q + 6, true));
        else if (r.id === 0x027e) put(dv.getUint16(q, true), dv.getUint16(q + 2, true), rk(dv.getInt32(q + 6, true)));
        else if (r.id === 0x00bd) {        // MULRK
          const row = dv.getUint16(q, true), c0 = dv.getUint16(q + 2, true), n = (r.len - 6) / 6;
          for (let c = 0; c < n; c++) put(row, c0 + c, rk(dv.getInt32(q + 4 + c * 6 + 2, true)));
        } else if (r.id === 0x0204) {      // LABEL
          const row = dv.getUint16(q, true), col = dv.getUint16(q + 2, true), n = dv.getUint16(q + 6, true), fl = w[q + 8];
          let s = ""; for (let c = 0; c < n; c++) s += String.fromCharCode(fl & 1 ? dv.getUint16(q + 9 + c * 2, true) : w[q + 9 + c]);
          put(row, col, s);
        } else if (r.id === 0x0006) {      // FORMULA: кэшированное значение
          const row = dv.getUint16(q, true), col = dv.getUint16(q + 2, true);
          if (dv.getUint16(q + 12, true) === 0xffff) { if (w[q + 6] === 0) lastF = [row, col]; }
          else put(row, col, dv.getFloat64(q + 6, true));
        } else if (r.id === 0x0207 && lastF) {   // STRING после FORMULA
          const n = dv.getUint16(q, true), fl = w[q + 2]; let s = "";
          for (let c = 0; c < n; c++) s += String.fromCharCode(fl & 1 ? dv.getUint16(q + 3 + c * 2, true) : w[q + 3 + c]);
          put(lastF[0], lastF[1], s); lastF = null;
        }
      }
      const rows = [];
      for (let i = 0; i <= maxR; i++) rows.push(cells[i] ? Array.from(cells[i], (v) => (v === undefined ? null : v)) : []);
      out.push({ name: sh.name, rows });
    }
    return { sheets: out };
  }
  KPI.xls = { readXls };
})(typeof globalThis !== "undefined" ? globalThis : this);
