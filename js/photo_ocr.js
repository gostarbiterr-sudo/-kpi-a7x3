/* Распознавание таблицы по фото (Tesseract.js, всё на устройстве). Библиотека и русский языковой файл лежат в репозитории. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const PATHS = {
    workerPath: "js/lib/worker.min.js",
    corePath: "js/lib/tesseract-core-simd-lstm.wasm.js",
    langPath: "tessdata/",
    gzip: false,
  };
  const MAX_SIDE = 2400;
  let worker = null, loading = null;

  async function getWorker(onProgress) {
    if (worker) return worker;
    if (!G.Tesseract) throw new Error("не загружена библиотека распознавания");
    if (!loading) {
      loading = G.Tesseract.createWorker("rus", 1, Object.assign({}, PATHS, {
        logger: (m) => { if (onProgress && m && typeof m.progress === "number") onProgress(m.status, m.progress); },
      })).then((w) => (worker = w)).catch((e) => { loading = null; throw e; });
    }
    return loading;
  }

  // Фото → canvas: уменьшаем большие снимки, переводим в оттенки серого и растягиваем контраст.
  async function toCanvas(file) {
    let src, w, h;
    if (G.createImageBitmap) {
      src = await createImageBitmap(file);
      w = src.width; h = src.height;
    } else {
      src = await new Promise((ok, bad) => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = () => bad(new Error("не удалось открыть фото"));
        img.src = URL.createObjectURL(file);
      });
      w = src.naturalWidth || src.width; h = src.naturalHeight || src.height;
    }
    const k = Math.min(1, MAX_SIDE / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const x = c.getContext("2d");
    x.drawImage(src, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height), px = d.data;
    let lo = 255, hi = 0;
    for (let i = 0; i < px.length; i += 4) {
      const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
      px[i] = px[i + 1] = px[i + 2] = g;
      if (g < lo) lo = g; if (g > hi) hi = g;
    }
    const span = Math.max(1, hi - lo);
    for (let i = 0; i < px.length; i += 4) {
      const v = Math.max(0, Math.min(255, Math.round(((px[i] - lo) * 255) / span)));
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    x.putImageData(d, 0, 0);
    if (src.close) src.close();
    return c;
  }

  // Исправления распознавания: коды магазинов (латиница/кириллица) и числа с пробелами между тысячами.
  const LAT = { "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X" };
  function fixCell(s) {
    const t = String(s).trim();
    const digits = (t.match(/\d/g) || []).length;
    if (/^[A-Za-zА-Яа-яЁё0-9]{3,8}$/.test(t) && digits >= 2 && /[A-Za-zА-Яа-яЁё]/.test(t)) {
      return t.split("").map((ch) => (LAT[ch.toUpperCase()] && /[А-Яа-яЁё]/.test(ch) ? LAT[ch.toUpperCase()] : ch === "З" || ch === "з" ? "3" : ch)).join("");
    }
    if (/^[-+\u2212]?[\d\s\u00A0]+$/.test(t) && digits >= 4) {
      const sign = t[0] === "+" || t[0] === "-" || t[0] === "\u2212" ? t[0] : "";
      const n = t.replace(/[^\d]/g, "");
      return sign + n.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }
    return t;
  }

  // Строки текста из распознавания → колонки: слова разделяются, если между ними большой зазор.
  function linesToTsv(lines) {
    const out = [];
    for (const ln of lines || []) {
      const words = (ln.words || []).filter((w) => w.text && w.text.trim() && w.confidence > 0).sort((a, b) => a.bbox.x0 - b.bbox.x0);
      if (!words.length) continue;
      const lh = Math.max(8, ln.bbox.y1 - ln.bbox.y0);
      const cells = [];
      let cur = words[0].text;
      for (let i = 1; i < words.length; i++) {
        const gap = words[i].bbox.x0 - words[i - 1].bbox.x1;
        if (gap > 0.5 * lh) { cells.push(cur.trim()); cur = words[i].text; }
        else cur += " " + words[i].text;
      }
      cells.push(cur.trim());
      // Знак ₽ часто распознаётся как отдельная «Р»: приклеиваем его к предыдущей ячейке.
      for (let i = cells.length - 1; i > 0; i--) if (/^(Р|P|₽)$/.test(cells[i])) { cells[i - 1] = (cells[i - 1] + " ₽").trim(); cells.splice(i, 1); }
      out.push(cells.map(fixCell).join("\t"));
    }
    return out.join("\n");
  }

  // Главная функция: файл фото → { text, lines, conf } (text — таблица с табуляцией).
  async function recognize(file, onProgress) {
    const canvas = await toCanvas(file);
    const w = await getWorker(onProgress);
    await w.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
    const res = await w.recognize(canvas);
    const data = res.data || {};
    const lines = data.lines || [];
    return { text: linesToTsv(lines), lines: lines.length, conf: Math.round(data.confidence || 0) };
  }

  KPI.photoOcr = { recognize, PATHS };
})(typeof window !== "undefined" ? window : globalThis);
