/* One physical-coordinate renderer shared by preview, print and DOCX. */
window.LabelRenderer = (() => {
  const logo = new Image();
  logo.src = 'logo.png';
  const ready = logo.decode();
  const MM_PER_PT = 25.4 / 72;
  function render(product, s, barcodeCanvas) {
    const canvas = document.createElement('canvas');
    // 600 dpi, physical dimensions independent of the screen and browser zoom.
    const scale = 600 / 25.4;
    canvas.width = Math.round(50 * scale);
    canvas.height = Math.round(75 * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 50, 75);
    // Two distinct boxes: the outer label edge and the barcode/details section.
    // Keep the outer stroke slightly inset so it survives image and printer clipping.
    ctx.strokeStyle = '#000'; ctx.lineWidth = .2;
    ctx.strokeRect(.35, .35, 49.3, 74.3);
    const font = (pt, bold) => { ctx.font = `${bold ? 'bold' : 'normal'} ${pt * MM_PER_PT}px Arial`; };
    const text = (value, pt, y, bold = false, color = '000000', width = 44, condensed = 1) => {
      font(pt, bold);
      if (ctx.measureText(value).width * condensed > width) throw new Error(`“${value}” is too wide. Reduce its font or shorten the text.`);
      ctx.fillStyle = `#${color}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const ascent = ctx.measureText(value).actualBoundingBoxAscent;
      ctx.save(); ctx.translate(25, y + ascent); ctx.scale(condensed, 1); ctx.fillText(value, 0, 0); ctx.restore();
    };
    const wrap = (value, pt, width) => {
      font(pt, true);
      const lines = []; let line = '';
      for (const word of value.split(/\s+/)) {
        if (ctx.measureText(word).width > width) throw new Error('Product name contains a word too wide for the label. Reduce Product font.');
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > width && line) { lines.push(line); line = word; } else line = next;
      }
      if (line) lines.push(line);
      if (lines.length > 2) throw new Error('Product name needs more than two lines. Reduce Product font or shorten the name.');
      return lines;
    };
    // Fixed 17 × 30 mm logo. Offset affects only this image, never the layout.
    if (!logo.complete || !logo.naturalWidth) throw new Error('Logo is still loading. Please try again.');
    ctx.save(); ctx.globalAlpha = .20;
    ctx.drawImage(logo, 205, 65, 755, 1245, 16.5, 1.5 + s.logoOffset, 17, 30); ctx.restore();
    const shopY = 3;
    const designsY = shopY + s.shopFont * MM_PER_PT * 1.1 + 1;
    const ruleY = designsY + s.designsFont * MM_PER_PT * 1.1 + 1.2;
    const taglineY = ruleY + 1.3;
    if (taglineY + s.taglineFont * MM_PER_PT * 1.15 > 29) throw new Error('Shop fonts are too tall together. Reduce one of the three branding fonts.');
    text('Yes We', s.shopFont, shopY, true, '37349B', 44, .8);
    text('Authentic Designs', s.designsFont, designsY, true, '37349B', 44, .8);
    ctx.strokeStyle = '#19B6D5'; ctx.lineWidth = .35;
    ctx.beginPath(); ctx.moveTo(4, ruleY); ctx.lineTo(46, ruleY); ctx.stroke();
    text('Trust. Quality. Style.', s.taglineFont, taglineY, true, '19B6D5');
    ctx.strokeStyle = '#000'; ctx.lineWidth = .2;
    ctx.strokeRect(2, 30, 46, 43);
    const nameLines = wrap(product.name, s.nameFont, 42);
    const nameLineHeight = s.nameFont * MM_PER_PT * 1.15;
    if (nameLines.length * nameLineHeight > 10.2) throw new Error('Product font is too tall for this name. Reduce Product font.');
    nameLines.forEach((line, i) => text(line, s.nameFont, 32 + i * nameLineHeight, true, '000000', 42));
    // Barcode stays at a fixed position even when optional size or logo changes.
    const barcodeY = 43, barcodeH = s.barcodeHeightCm * 10, barcodeW = s.barcodeWidthCm * 10;
    ctx.fillStyle = '#fff'; ctx.fillRect((50 - barcodeW) / 2 - .5, barcodeY - .4, barcodeW + 1, barcodeH + .8);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(barcodeCanvas(product.code, 8, 160), (50 - barcodeW) / 2, barcodeY, barcodeW, barcodeH);
    let y = barcodeY + barcodeH + .8;
    const detail = (value, pt, bold, color) => {
      if (y + pt * MM_PER_PT * 1.15 > 71.8) throw new Error('Label details are too tall. Reduce barcode height or line spacing.');
      text(value, pt, y, bold, color, 42);
      y += pt * MM_PER_PT * s.lineSpacing + .25;
    };
    detail(product.code, s.codeFont, false, '000000');
    if (product.size) detail(`Size: ${product.size}`, s.sizeFont, false, s.sizeColor);
    detail(`${s.pricePrefix} ${product.price}/-`, s.priceFont, true, s.priceColor);
    detail(s.brand, s.brandFont, false, '000000');
    return canvas;
  }
  return { ready, render };
})();
