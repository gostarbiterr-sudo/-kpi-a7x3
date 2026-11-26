/* «Табличка»: вставленная таблица → картинка в стиле Excel (сетка, шапка, выравнивание чисел). Рисуется на canvas на устройстве. */
(function (G) {
  "use strict";
  const KPI = (G.KPI = G.KPI || {});
  const S = 2, PAD = 16, FONT = 14, LH = 18, ROW_H = 24, MAX_W = 1040, MIN_W = 480, MAX_ROWS = 300, MAX_COL_W = 320;
  const C = { ink: "#1F1F1F", grid: "#BFC5CE", head: "#DCE6F2", headInk: "#0B2A55", zebra: "#F5F7FA", total: "#FFF4D6", bg: "#FFFFFF", title: "#1F3864" };
  const font = (px, bold) => `${bold ? "700" : "400"} ${px}px Arial, "Helvetica Neue", "Segoe UI", sans-serif`;
  const NUM = /^[-+−]?\s?\d[\d\s ]*([.,]\d+)?\s?(%|₽|р\.?)?$/;
  const isNum = (s) => NUM.test(String(s).trim());

  // Разбор текста: строки → колонки. Разделители: Tab (из Excel), «;», два и более пробелов.
  function parse(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
    let rows = lines.map((l) => {
      let cells;
      if (l.includes("\t")) cells = l.split("\t");
      else if (l.includes(";")) cells = l.split(";");
      else if (/\s{2,}/.test(l.trim())) cells = l.trim().split(/\s{2,}/);
      else cells = [l.trim()];
      return cells.map((c) => c.trim());
    });
    const cut = rows.length > MAX_ROWS;
    rows = rows.slice(0, MAX_ROWS);
    const n = Math.max(0, ...rows.map((r) => r.length));
    rows = rows.map((r) => { const x = r.slice(); while (x.length < n) x.push(""); return x; });
    return { rows, cut };
  }

  function wrap(x, s, maxW) {
    const out = [];
    for (const para of String(s).split(/\n/)) {
      let line = "";
      for (const word of para.split(" ")) {
        const tr = line ? line + " " + word : word;
        if (line && x.measureText(tr).width > maxW) { out.push(line); line = word; } else line = tr;
      }
      out.push(line);
    }
    return out.length ? out : [""];
  }

  function colWidths(x, rows, head) {
    const n = rows[0].length, w = new Array(n).fill(70);
    rows.forEach((r, ri) => r.forEach((c, i) => {
      x.font = font(FONT, head && ri === 0);
      w[i] = Math.max(w[i], Math.min(MAX_COL_W, x.measureText(c).width + 20));
    }));
    const tot = w.reduce((a, b) => a + b, 0);
    if (tot > MAX_W) { const k = MAX_W / tot; for (let i = 0; i < n; i++) w[i] = Math.max(50, Math.floor(w[i] * k)); }
    return w;
  }

  // Отрисовка: возвращает canvas (уже в масштабе S).
  function render(rows, opt) {
    opt = opt || {};
    const head = !!opt.head, title = String(opt.title || "").trim();
    const mctx = document.createElement("canvas").getContext("2d");
    const w = colWidths(mctx, rows, head);
    const tableW = w.reduce((a, b) => a + b, 0);
    const titleH = title ? 40 : 0;
    const W = Math.max(MIN_W, tableW + 2 * PAD);

    // Считаем переносы и высоты строк.
    const cellLines = rows.map((r, ri) => r.map((c, i) => {
      mctx.font = font(FONT, head && ri === 0);
      return wrap(mctx, c, w[i] - 14);
    }));
    const heights = cellLines.map((cl) => Math.max(ROW_H, Math.max(...cl.map((l) => l.length)) * LH + 10));
    const tableH = heights.reduce((a, b) => a + b, 0);
    const H = PAD + titleH + tableH + PAD;

    const c = document.createElement("canvas");
    c.width = Math.round(W * S); c.height = Math.round(H * S);
    const x = c.getContext("2d");
    x.scale(S, S);
    x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
    x.textBaseline = "middle";

    if (title) { x.font = font(18, true); x.fillStyle = C.title; x.textAlign = "left"; x.fillText(title, PAD, PAD + 16); }

    const left = PAD, top0 = PAD + titleH;
    let y = top0;
    rows.forEach((r, ri) => {
      const isHead = head && ri === 0;
      const isTotal = /^итого/i.test(r[0] || "");
      const h = heights[ri];
      const dataIdx = head ? ri - 1 : ri;
      x.fillStyle = isHead ? C.head : isTotal ? C.total : dataIdx % 2 === 1 ? C.zebra : C.bg;
      x.fillRect(left, y, tableW, h);
      let cx = left;
      r.forEach((cell, i) => {
        x.strokeStyle = C.grid; x.lineWidth = 1;
        x.strokeRect(cx + 0.5, y + 0.5, w[i] - 1, h - 1);
        const lines = cellLines[ri][i];
        const bold = isHead || isTotal;
        const right = !isHead && isNum(cell);
        x.save();
        x.beginPath(); x.rect(cx, y, w[i], h); x.clip();
        x.font = font(FONT, bold);
        x.fillStyle = isHead ? C.headInk : C.ink;
        x.textAlign = right ? "right" : "left";
        const blockH = lines.length * LH;
        const ty = y + (h - blockH) / 2 + LH / 2;
        lines.forEach((ln, k) => x.fillText(ln, right ? cx + w[i] - 7 : cx + 7, ty + k * LH));
        x.restore();
        cx += w[i];
      });
      y += h;
    });
    return c;
  }

  function png(canvas) {
    return new Promise((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("не удалось сохранить картинку"))), "image/png"));
  }

  KPI.tablePic = { parse, render, png };
})(typeof window !== "undefined" ? window : globalThis);
