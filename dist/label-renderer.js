/* One physical-coordinate renderer shared by preview, print and DOCX. */
window.LabelRenderer = (() => {
  const logo = new Image();
  logo.src = 'logo.png';
  const ready = logo.decode();
  const MM_PER_PT = 25.4 / 72;
  const LABEL_WIDTH = 48;
  const LABEL_HEIGHT = 69;
  const CENTER_X = LABEL_WIDTH / 2;
  function render(product, s, barcodeCanvas) {
    const canvas = document.createElement('canvas');
    // 600 dpi, physical dimensions independent of the screen and browser zoom.
    const scale = 600 / 25.4;
    canvas.width = Math.round(LABEL_WIDTH * scale);
    canvas.height = Math.round(LABEL_HEIGHT * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);
    const font = (pt, bold) => { ctx.font = `${bold ? 'bold' : 'normal'} ${pt * MM_PER_PT}px Arial`; };
    const text = (value, pt, y, bold = false, color = '000000', width = 44, condensed = 1) => {
      font(pt, bold);
      if (ctx.measureText(value).width * condensed > width) throw new Error(`“${value}” is too wide. Reduce its font or shorten the text.`);
      ctx.fillStyle = `#${color}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const ascent = ctx.measureText(value).actualBoundingBoxAscent;
      ctx.save(); ctx.translate(CENTER_X, y + ascent); ctx.scale(condensed, 1); ctx.fillText(value, 0, 0); ctx.restore();
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
    ctx.drawImage(logo, 205, 65, 755, 1245, 15.5, 1.5 + s.logoOffset, 17, 30); ctx.restore();
    const shopY = 3;
    const designsY = shopY + s.shopFont * MM_PER_PT * 1.1 + 1;
    const ruleY = designsY + s.designsFont * MM_PER_PT * 1.1 + 1.2;
    const taglineY = ruleY + 1.3;
    if (taglineY + s.taglineFont * MM_PER_PT * 1.15 > 29) throw new Error('Shop fonts are too tall together. Reduce one of the three branding fonts.');
    text('Yes We', s.shopFont, shopY, true, '37349B', 44, .8);
    text('Authentic Designs', s.designsFont, designsY, true, '37349B', 44, .8);
    ctx.strokeStyle = '#19B6D5'; ctx.lineWidth = .35;
    ctx.beginPath(); ctx.moveTo(3, ruleY); ctx.lineTo(45, ruleY); ctx.stroke();
    text('Trust. Quality. Style.', s.taglineFont, taglineY, true, '19B6D5');
    const nameLines = wrap(product.name, s.nameFont, 40);
    const nameLineHeight = s.nameFont * MM_PER_PT * 1.1;
    if (nameLines.length * nameLineHeight > 10.2) throw new Error('Product font is too tall for this name. Reduce Product font.');
    nameLines.forEach((line, i) => text(line, s.nameFont, 32 + i * nameLineHeight, true, '000000', 40));
    // Content flows without reserving blank lines. The barcode dimensions stay fixed;
    // only its vertical position follows the actual number of product-name lines.
    const barcodeY = 32 + nameLines.length * nameLineHeight + .8;
    const barcodeH = s.barcodeHeightCm * 10, barcodeW = s.barcodeWidthCm * 10;
    ctx.fillStyle = '#fff'; ctx.fillRect((LABEL_WIDTH - barcodeW) / 2 - .5, barcodeY - .4, barcodeW + 1, barcodeH + .8);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(barcodeCanvas(product.code, 8, 160), (LABEL_WIDTH - barcodeW) / 2, barcodeY, barcodeW, barcodeH);
    let y = barcodeY + barcodeH + .5;
    const detailPositions = {};
    const detail = (key, value, pt, bold, color, advance = s.lineSpacing, after = .25) => {
      if (y + pt * MM_PER_PT * 1.15 > 68) throw new Error('Label details are too tall. Reduce barcode height or line spacing.');
      detailPositions[key] = y;
      text(value, pt, y, bold, color, 40);
      y += pt * MM_PER_PT * advance + after;
    };
    detail('code', product.code, s.codeFont, false, '000000', product.size ? Math.max(.75, s.lineSpacing - .4) : Math.max(1, s.lineSpacing - .15), .1);
    if (product.size) detail('size', `Size: ${product.size}`, s.sizeFont, false, s.sizeColor, Math.max(1.25, s.lineSpacing + .1), .4);
    detail('price', `${s.pricePrefix} ${product.price}/-`, s.priceFont, true, s.priceColor, Math.max(1.05, s.lineSpacing - .1), .25);
    detailPositions.brand = y;
    text(s.brand, s.brandFont, y, false, '000000', 40);
    const panelBottom = y + s.brandFont * MM_PER_PT * Math.max(1.05, s.lineSpacing - .05) + .5;
    if (panelBottom > 67.8) throw new Error('Label details are too tall. Reduce a font, barcode height or line spacing.');
    ctx.strokeStyle = '#000'; ctx.lineWidth = .2;
    ctx.strokeRect(2, 30, 44, panelBottom - 30);
    // Close the complete-label border around the visible content. The canvas remains
    // 48 × 69 mm, so any unused row space is outside the border and rows still align.
    const outerBottom = panelBottom + .8;
    if (outerBottom > LABEL_HEIGHT - .35) throw new Error('Label details are too tall. Reduce a font, barcode height or line spacing.');
    ctx.strokeRect(.35, .35, LABEL_WIDTH - .7, outerBottom - .35);
    canvas.labelLayout = { barcodeY, barcodeH, barcodeW, nameLines: nameLines.length, panelBottom, outerBottom, detailPositions };
    return canvas;
  }
  return { ready, render };
})();
