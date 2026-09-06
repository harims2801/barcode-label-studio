(() => {
  "use strict";

  const MAX_LABELS = 1000;
  const PRODUCT_COLUMNS = ["code", "name", "quantity", "size", "price"];
  const CODE128_PATTERNS = [
    "212222","222122","222221","121223","121322","131222","122213","122312","132212",
    "221213","221312","231212","112232","122132","122231","113222","123122","123221",
    "223211","221132","221231","213212","223112","312131","311222","321122","321221",
    "312212","322112","322211","212123","212321","232121","111323","131123","131321",
    "112313","132113","132311","211313","231113","231311","112133","112331","132131",
    "113123","113321","133121","313121","211331","231131","213113","213311","213131",
    "311123","311321","331121","312113","312311","332111","314111","221411","431111",
    "111224","111422","121124","121421","141122","141221","112214","112412","122114",
    "122411","142112","142211","241211","221114","413111","241112","134111","111242",
    "121142","121241","114212","124112","124211","411212","421112","421211","212141",
    "214121","412121","111143","111341","131141","114113","114311","411113","411311",
    "113141","114131","311141","411131","211412","211214","211232","2331112"
  ];

  const sampleProducts = [
    { code: "600070", name: "kanjivaram silk", quantity: 1, size: "", price: "525" },
    { code: "600071", name: "kanoda aqua", quantity: 1, size: "", price: "485" },
    { code: "600072", name: "kanoda brown", quantity: 1, size: "", price: "465" },
    { code: "600073", name: "kanoda style", quantity: 1, size: "L", price: "485" }
  ];

  let products = sampleProducts.map(item => ({ ...item }));
  const $ = selector => document.querySelector(selector);
  const rowsElement = $("#product-rows");
  const toast = $("#toast");
  const settingsIds = ["shop-font", "designs-font", "tagline-font", "logo-offset", "price-prefix", "brand", "price-color", "size-color", "start-position", "barcode-width", "barcode-height", "name-font", "line-spacing", "rows-per-page", "output-prefix"];

  const escapeXml = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
  const cleanNumber = value => {
    const text = String(value ?? "").trim();
    return /^-?\d+\.0+$/.test(text) ? text.split(".")[0] : text;
  };
  const localName = node => node.localName || node.nodeName.split(":").pop();

  function showToast(message, error = false) {
    toast.textContent = message;
    toast.className = `toast show${error ? " error" : ""}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.className = "toast"; }, 3600);
  }

  function iconTrash() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>';
  }

  function renderRows() {
    rowsElement.innerHTML = products.map((product, index) => `
      <tr data-index="${index}">
        <td><input data-field="code" aria-label="Code row ${index + 1}" value="${escapeXml(product.code)}" inputmode="numeric" /></td>
        <td><input data-field="name" aria-label="Product name row ${index + 1}" value="${escapeXml(product.name)}" /></td>
        <td><input data-field="quantity" aria-label="Quantity row ${index + 1}" value="${escapeXml(product.quantity)}" type="number" min="1" step="1" /></td>
        <td><input data-field="size" aria-label="Size row ${index + 1}" value="${escapeXml(product.size)}" /></td>
        <td><input data-field="price" aria-label="Price row ${index + 1}" value="${escapeXml(product.price)}" inputmode="decimal" /></td>
        <td><button class="delete-row" type="button" aria-label="Delete row ${index + 1}">${iconTrash()}</button></td>
      </tr>`).join("");
    updatePreview();
  }

  function expandedProducts(strict = false) {
    const expanded = [];
    products.forEach((product, index) => {
      const code = cleanNumber(product.code);
      const name = String(product.name ?? "").trim();
      const size = String(product.size ?? "").trim();
      const price = cleanNumber(String(product.price ?? "").replace("/-", "").trim());
      const quantity = Number(product.quantity);
      const empty = !code && !name && !price;
      if (empty) return;
      if (strict) {
        if (!code || !name || !price) throw new Error(`Row ${index + 1}: code, product name and price are required.`);
        if (!Number.isInteger(quantity) || quantity < 1) throw new Error(`Row ${index + 1}: quantity must be a whole number of 1 or more.`);
        if (!/^\d+(\.\d{1,2})?$/.test(price)) throw new Error(`Row ${index + 1}: price must be a non-negative number with up to two decimals.`);
        if ([...code].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) > 126)) throw new Error(`Row ${index + 1}: barcode contains unsupported characters.`);
      }
      const copies = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
      if (expanded.length + copies > MAX_LABELS) throw new Error(`Please generate no more than ${MAX_LABELS} labels at a time.`);
      for (let copy = 0; copy < copies; copy += 1) expanded.push({ code, name, size, price });
    });
    if (strict && !expanded.length) throw new Error("Add at least one complete product row.");
    if (expanded.length > MAX_LABELS) throw new Error(`Please generate no more than ${MAX_LABELS} labels at a time.`);
    return expanded;
  }

  function readSettings() {
    const rowsPerPage = Number($("#rows-per-page").value);
    const startPosition = Number($("#start-position").value);
    const settings = {
      pricePrefix: $("#price-prefix").value.trim() || "Yes WE Price",
      brand: $("#brand").value.trim() || "Yeswedesigns",
      priceColor: $("#price-color").value,
      sizeColor: $("#size-color").value,
      shopFont: Number($("#shop-font").value),
      designsFont: Number($("#designs-font").value),
      taglineFont: Number($("#tagline-font").value),
      logoOffset: Number($("#logo-offset").value),
      startPosition,
      rowsPerPage,
      barcodeWidthCm: Number($("#barcode-width").value),
      barcodeHeightCm: Number($("#barcode-height").value),
      nameFont: Number($("#name-font").value),
      lineSpacing: Number($("#line-spacing").value),
      outputPrefix: $("#output-prefix").value.trim() || "Barcode_Labels",
      labelsPerRow: 3,
      labelWidthCm: 5,
      labelHeightCm: 7.5,
      horizontalGapCm: .18,
      verticalGapCm: .18,
      codeFont: 8.5,
      sizeFont: 7.5,
      priceFont: 9,
      brandFont: 8
    };
    const within = (value, min, max, label) => {
      if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be between ${min} and ${max}.`);
    };
    within(settings.shopFont, 12, 40, "Yes We font");
    within(settings.designsFont, 8, 24, "Authentic Designs font");
    within(settings.taglineFont, 6, 18, "Tagline font");
    within(settings.logoOffset, -15, 30, "Logo vertical position");
    within(settings.rowsPerPage, 1, 3, "Rows per page");
    within(settings.startPosition, 1, settings.rowsPerPage * 3, "Starting label position");
    if (!Number.isInteger(rowsPerPage) || !Number.isInteger(startPosition)) throw new Error("Rows and starting position must be whole numbers.");
    within(settings.barcodeWidthCm, 1.5, 4.2, "Barcode width");
    within(settings.barcodeHeightCm, .4, 2, "Barcode height");
    within(settings.nameFont, 6, 20, "Product font");
    within(settings.lineSpacing, .8, 1.5, "Line spacing");
    if (settings.barcodeWidthCm > settings.labelWidthCm - .04) throw new Error("Barcode width is too large for the label width.");
    if (settings.rowsPerPage * settings.labelHeightCm + (settings.rowsPerPage - 1) * settings.verticalGapCm > 25.22) throw new Error("The selected rows are too tall for an A4 page.");
    const availablePoints = settings.labelHeightCm * 1440 / 2.54 / 20;
    const requiredPoints = Math.max(settings.nameFont + 1, settings.nameFont * 1.08) + 2.5 + settings.barcodeHeightCm * 28.3465 +
      (settings.codeFont + settings.sizeFont + settings.priceFont + settings.brandFont) * settings.lineSpacing;
    if (requiredPoints > availablePoints - 2) throw new Error("The barcode, fonts and line spacing are too tall. Reduce one of these settings.");
    return settings;
  }

  function code128Modules(code) {
    if (!code) throw new Error("A barcode code is empty.");
    if ([...code].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) > 126)) throw new Error("Barcode contains unsupported characters. Use letters, numbers or standard punctuation.");
    let values;
    if (/^\d+$/.test(code) && code.length % 2 === 0) {
      values = [105];
      for (let i = 0; i < code.length; i += 2) values.push(Number(code.slice(i, i + 2)));
    } else {
      values = [104, ...[...code].map(char => char.charCodeAt(0) - 32)];
    }
    const checksum = (values[0] + values.slice(1).reduce((sum, value, index) => sum + value * (index + 1), 0)) % 103;
    values.push(checksum, 106);
    let modules = "0000000000";
    values.forEach(value => {
      let isBar = true;
      for (const width of CODE128_PATTERNS[value]) {
        modules += (isBar ? "1" : "0").repeat(Number(width));
        isBar = !isBar;
      }
    });
    return `${modules}0000000000`;
  }

  function barcodeCanvas(code, modulePixels = 4, height = 100) {
    const modules = code128Modules(code);
    const canvas = document.createElement("canvas");
    canvas.width = modules.length * modulePixels;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black";
    modules.split("").forEach((module, index) => {
      if (module === "1") context.fillRect(index * modulePixels, 0, modulePixels, height);
    });
    return canvas;
  }

  function labelArtwork(product, settings) {
    return LabelRenderer.render(product, settings, barcodeCanvas);
  }
  function updatePreview() {
    const paper = $("#preview-paper");
    const message = $("#validation-message");
    try {
      const settings = readSettings();
      const labels = expandedProducts(false);
      const perPage = settings.rowsPerPage * settings.labelsPerRow;
      const pages = Math.max(1, Math.ceil((settings.startPosition - 1 + labels.length) / perPage));
      $("#label-count").textContent = `${labels.length} labels`;
      $("#page-count").textContent = `${pages} pages`;
      $("#preview-page").textContent = `Page 1 of ${pages}`;
      $("#start-position").max = String(perPage);
      const slots = [];
      for (let slot = 0; slot < perPage; slot++) {
        const p = labels[slot - settings.startPosition + 1];
        slots.push(p ? `<img class="label-artwork" alt="${escapeXml(p.name)}, code ${escapeXml(p.code)}${p.size ? ', Size: ' + escapeXml(p.size) : ''}, price ${escapeXml(p.price)}" src="${labelArtwork(p, settings).toDataURL('image/png')}">` : '<div class="label-artwork empty"></div>');
      }
      paper.innerHTML = slots.join("");
      message.textContent = "";
      $("#generate").disabled = false;
      $("#print-labels").disabled = false;
    } catch (error) {
      message.textContent = error.message;
      paper.innerHTML = '<p class="preview-error">Preview unavailable. Please check the message below Label settings.</p>';
      $("#generate").disabled = true;
      $("#print-labels").disabled = true;
    }
  }

  async function parseExcel(file) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const readXml = async path => {
      const entry = zip.file(path);
      if (!entry) throw new Error(`Excel file is missing ${path}.`);
      return new DOMParser().parseFromString(await entry.async("string"), "application/xml");
    };
    const workbook = await readXml("xl/workbook.xml");
    const rels = await readXml("xl/_rels/workbook.xml.rels");
    const targets = new Map([...rels.getElementsByTagNameNS("*", "Relationship")].map(node => [node.getAttribute("Id"), node.getAttribute("Target")]));
    const sheetPaths = new Map();
    [...workbook.getElementsByTagNameNS("*", "sheet")].forEach(sheet => {
      const relationId = sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || sheet.getAttribute("r:id");
      let target = targets.get(relationId);
      if (!target) return;
      target = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
      target = target.replace(/\/[^/]+\/\.\./g, "");
      sheetPaths.set(sheet.getAttribute("name"), target);
    });
    let shared = [];
    if (zip.file("xl/sharedStrings.xml")) {
      const sharedXml = await readXml("xl/sharedStrings.xml");
      shared = [...sharedXml.getElementsByTagNameNS("*", "si")].map(item => [...item.getElementsByTagNameNS("*", "t")].map(t => t.textContent || "").join(""));
    }
    const readSheet = async name => {
      if (!sheetPaths.has(name)) throw new Error(`The workbook does not contain a sheet named “${name}”.`);
      const xml = await readXml(sheetPaths.get(name));
      const result = [];
      [...xml.getElementsByTagNameNS("*", "row")].forEach(row => {
        const cells = {};
        [...row.children].filter(cell => localName(cell) === "c").forEach(cell => {
          const reference = cell.getAttribute("r") || "";
          const letters = (reference.match(/[A-Za-z]+/) || [""])[0].toUpperCase();
          let column = 0;
          for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64;
          const type = cell.getAttribute("t") || "";
          const valueNode = [...cell.children].find(node => localName(node) === "v");
          let value = "";
          if (type === "inlineStr") value = [...cell.getElementsByTagNameNS("*", "t")].map(t => t.textContent || "").join("");
          else if (valueNode) value = type === "s" ? (shared[Number(valueNode.textContent)] || "") : (valueNode.textContent || "");
          cells[column] = value;
        });
        result.push(cells);
      });
      return result;
    };
    const productRows = await readSheet("Products");
    const headerIndex = productRows.findIndex(row => PRODUCT_COLUMNS.every((name, index) => String(row[index + 1] || "").trim().toLowerCase() === name));
    if (headerIndex < 0) throw new Error("Could not find the columns: code, name, quantity, size, price.");
    const importedProducts = productRows.slice(headerIndex + 1).map(row => ({
      code: cleanNumber(row[1] || ""), name: String(row[2] || "").trim(), quantity: cleanNumber(row[3] || ""),
      size: String(row[4] || "").trim(), price: cleanNumber(String(row[5] || "").replace("/-", "").trim())
    })).filter(row => Object.values(row).some(Boolean));
    if (!importedProducts.length) throw new Error("No product rows were found in the Excel table.");
    let importedSettings = {};
    if (sheetPaths.has("Settings")) {
      const settingRows = await readSheet("Settings");
      settingRows.forEach(row => {
        const key = String(row[1] || "").trim().toLowerCase();
        if (key) importedSettings[key] = cleanNumber(row[2] || "");
      });
    }
    return { importedProducts, importedSettings };
  }

  function applyImportedSettings(values) {
    const mappings = {
      "price prefix": "price-prefix", "brand": "brand", "start label position": "start-position",
      "barcode width (cm)": "barcode-width", "barcode height (cm)": "barcode-height",
      "product name font size (pt)": "name-font", "detail line spacing": "line-spacing",
      "rows per page": "rows-per-page", "output file prefix": "output-prefix"
    };
    Object.entries(mappings).forEach(([key, id]) => { if (values[key] !== undefined && values[key] !== "") $(`#${id}`).value = values[key]; });
    const color = String(values["price and size color"] || "").toLowerCase().replace("#", "");
    const colors = { red: "C00000", black: "000000", blue: "0070C0", green: "008000", purple: "7030A0", orange: "E36C09" };
    const normalized = colors[color] || color.toUpperCase();
    for (const id of ["price-color", "size-color"]) {
      if ([...$(`#${id}`).options].some(option => option.value === normalized)) $(`#${id}`).value = normalized;
    }
  }

  function runProperties(fontSize, bold = false, color = "000000") {
    const halfPoints = Math.max(2, Math.round(fontSize * 2));
    return `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${bold ? "<w:b/>" : ""}<w:color w:val="${color}"/><w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/></w:rPr>`;
  }
  function paragraphProperties(linePoints) {
    return `<w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="${Math.round(linePoints * 20)}" w:lineRule="exact"/></w:pPr>`;
  }
  function textParagraph(text, fontSize, linePoints, bold = false, color = "000000") {
    const value = String(text);
    const preserve = /^\s|\s$/.test(value) ? ' xml:space="preserve"' : "";
    return `<w:p>${paragraphProperties(linePoints)}<w:r>${runProperties(fontSize, bold, color)}<w:t${preserve}>${escapeXml(value)}</w:t></w:r></w:p>`;
  }
  function imageParagraph(relationId, imageId, widthEmu, heightEmu) {
    const name = `Barcode ${imageId}`;
    const lineTwips = Math.max(20, Math.round(heightEmu / 12700 * 20));
    return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="50" w:after="0" w:line="${lineTwips}" w:lineRule="atLeast"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${imageId}" name="${name}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="0"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${name}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }
  function labelCell(product, relationId, imageId, layout) {
    const properties = `<w:tcPr><w:tcW w:w="${layout.labelWidthDxa}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>`;
    if (!product) return `<w:tc>${properties}<w:p/></w:tc>`;
    return `<w:tc>${properties}${imageParagraph(relationId, imageId, layout.labelWidthCm * 360000, layout.labelHeightCm * 360000).replace('w:before="50"', 'w:before="0"')}</w:tc>`;
  }
  const spacerCell = width => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p/></w:tc>`;

  function tableXml(pageProducts, relationIds, imageIds, layout) {
    const gridWidths = [];
    for (let column = 0; column < layout.labelsPerRow * 2 - 1; column += 1) gridWidths.push(column % 2 === 0 ? layout.labelWidthDxa : layout.horizontalGapDxa);
    const tableWidth = gridWidths.reduce((sum, value) => sum + value, 0);
    const properties = `<w:tblPr><w:tblW w:w="${tableWidth}" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
    const grid = `<w:tblGrid>${gridWidths.map(width => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>`;
    const rows = [];
    let labelIndex = 0;
    for (let visualRow = 0; visualRow < layout.rowsPerPage * 2 - 1; visualRow += 1) {
      const isLabelRow = visualRow % 2 === 0;
      const height = isLabelRow ? layout.labelHeightDxa : layout.verticalGapDxa;
      const cells = [];
      gridWidths.forEach((width, visualColumn) => {
        if (isLabelRow && visualColumn % 2 === 0) {
          cells.push(labelCell(pageProducts[labelIndex], relationIds[labelIndex], imageIds[labelIndex], layout));
          labelIndex += 1;
        } else cells.push(spacerCell(width));
      });
      rows.push(`<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${height}" w:hRule="exact"/></w:trPr>${cells.join("")}</w:tr>`);
    }
    return `<w:tbl>${properties}${grid}${rows.join("")}</w:tbl>`;
  }

  function buildDocumentXml(labels, settings) {
    const layout = {
      ...settings,
      labelWidthDxa: Math.round(settings.labelWidthCm * 1440 / 2.54), labelHeightDxa: Math.round(settings.labelHeightCm * 1440 / 2.54),
      horizontalGapDxa: Math.round(settings.horizontalGapCm * 1440 / 2.54), verticalGapDxa: Math.round(settings.verticalGapCm * 1440 / 2.54),
      barcodeWidthEmu: Math.round(settings.barcodeWidthCm * 360000), barcodeHeightEmu: Math.round(settings.barcodeHeightCm * 360000)
    };
    const perPage = layout.labelsPerRow * layout.rowsPerPage;
    const pageCount = Math.ceil((layout.startPosition - 1 + labels.length) / perPage);
    const body = [];
    let imageCounter = 1;
    const images = [];
    for (let page = 0; page < pageCount; page += 1) {
      const pageProducts = Array(perPage).fill(null);
      const relationIds = Array(perPage).fill(null);
      const imageIds = Array(perPage).fill(null);
      for (let slot = 0; slot < perPage; slot += 1) {
        const productIndex = page * perPage + slot - (layout.startPosition - 1);
        if (productIndex >= 0 && productIndex < labels.length) {
          pageProducts[slot] = labels[productIndex];
          relationIds[slot] = `rIdBarcode${imageCounter}`;
          imageIds[slot] = imageCounter;
          images.push({ imageId: imageCounter, product: labels[productIndex] });
          imageCounter += 1;
        }
      }
      if (page) body.push('<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>');
      body.push(tableXml(pageProducts, relationIds, imageIds, layout));
    }
    const section = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1247" w:right="1304" w:bottom="1247" w:left="1304" w:header="709" w:footer="709" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>';
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join("")}${section}</w:body></w:document>`;
    return { xml, images };
  }

  async function canvasPngBytes(product, settings) {
    const canvas = labelArtwork(product, settings);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not create label image.")), "image/png"));
    return blob.arrayBuffer();
  }

  async function createWordDocument(labels, settings) {
    const response = await fetch("Word_Label_Template.docx");
    if (!response.ok) throw new Error("The Word label template could not be loaded.");
    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    const { xml, images } = buildDocumentXml(labels, settings);
    zip.file("word/document.xml", xml);
    Object.keys(zip.files).filter(path => path.startsWith("word/media/")).forEach(path => zip.remove(path));
    let relationships = await zip.file("word/_rels/document.xml.rels").async("string");
    relationships = relationships.replace(/<Relationship\b[^>]*Type="[^"]*\/image"[^>]*\/>/g, "");
    const relXml = images.map(image => `<Relationship Id="rIdBarcode${image.imageId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/barcode${image.imageId}.png"/>`).join("");
    relationships = relationships.replace("</Relationships>", `${relXml}</Relationships>`);
    zip.file("word/_rels/document.xml.rels", relationships);
    const cache = new Map();
    for (const image of images) {
      const key = JSON.stringify(image.product);
      if (!cache.has(key)) cache.set(key, canvasPngBytes(image.product, settings));
      zip.file(`word/media/barcode${image.imageId}.png`, await cache.get(key));
    }
    return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE", compressionOptions: { level: 6 } });
  }

  function buildPrintSheets(labels, settings) {
    const perPage = settings.labelsPerRow * settings.rowsPerPage;
    const pageCount = Math.ceil((settings.startPosition - 1 + labels.length) / perPage);
    const pages = [];
    for (let page = 0; page < pageCount; page++) {
      const slots = [];
      for (let slot = 0; slot < perPage; slot++) {
        const product = labels[page * perPage + slot - settings.startPosition + 1];
        slots.push(product ? `<img class="label-artwork" alt="${escapeXml(product.name)}" src="${labelArtwork(product, settings).toDataURL('image/png')}">` : '<div class="label-artwork empty"></div>');
      }
      pages.push(`<section class="print-page"><div class="print-grid">${slots.join("")}</div></section>`);
    }
    $("#print-sheets").innerHTML = pages.join("");
  }

  function saveLocalState() {
    try {
      const settings = Object.fromEntries(settingsIds.map(id => [id, $(`#${id}`).value]));
      localStorage.setItem("barcode-label-studio-new-label", JSON.stringify({ products, settings }));
    } catch { /* Browser storage may be unavailable. */ }
  }

  function restoreLocalState() {
    try {
      const current = localStorage.getItem("barcode-label-studio-new-label");
      const saved = JSON.parse(current || localStorage.getItem("barcode-label-studio") || "null");
      if (Array.isArray(saved?.products) && saved.products.length) products = saved.products;
      const savedSettings = saved?.settings || {};
      if (!current) {
        delete savedSettings["rows-per-page"];
        delete savedSettings["start-position"];
      }
      const legacyColor = savedSettings["accent-color"];
      if (legacyColor) {
        if (!savedSettings["price-color"]) savedSettings["price-color"] = legacyColor;
        if (!savedSettings["size-color"]) savedSettings["size-color"] = legacyColor;
      }
      Object.entries(savedSettings).forEach(([id, value]) => {
        if (settingsIds.includes(id) && $(`#${id}`)) $(`#${id}`).value = value;
      });
    } catch { /* Start with sample rows if saved data is invalid. */ }
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }

  rowsElement.addEventListener("input", event => {
    const input = event.target.closest("input[data-field]");
    if (!input) return;
    const row = input.closest("tr");
    products[Number(row.dataset.index)][input.dataset.field] = input.value;
    saveLocalState();
    updatePreview();
  });
  rowsElement.addEventListener("click", event => {
    const button = event.target.closest(".delete-row");
    if (!button) return;
    products.splice(Number(button.closest("tr").dataset.index), 1);
    if (!products.length) products.push({ code: "", name: "", quantity: 1, size: "", price: "" });
    saveLocalState();
    renderRows();
  });
  $("#add-row").addEventListener("click", () => {
    products.push({ code: "", name: "", quantity: 1, size: "", price: "" });
    saveLocalState();
    renderRows();
    rowsElement.closest(".table-wrap").scrollTop = rowsElement.closest(".table-wrap").scrollHeight;
  });
  settingsIds.forEach(id => $(`#${id}`).addEventListener("input", () => { saveLocalState(); updatePreview(); }));

  $("#print-labels").addEventListener("click", async () => {
    try {
      const settings = readSettings();
      const labels = expandedProducts(true);
      buildPrintSheets(labels, settings);
      await Promise.all([...$("#print-sheets").querySelectorAll("img")].map(img => img.decode()));
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    } catch (error) {
      showToast(error.message || "Could not prepare the labels for printing.", true);
      if (/too tall|must be|too large/i.test(error.message || "")) $("#settings-card").open = true;
    }
  });

  $("#generate").addEventListener("click", async () => {
    const button = $("#generate");
    const original = button.innerHTML;
    try {
      button.disabled = true;
      button.textContent = "Creating Word document…";
      const settings = readSettings();
      const labels = expandedProducts(true);
      const blob = await createWordDocument(labels, settings);
      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
      const safePrefix = settings.outputPrefix.replace(/[\\/:*?"<>|]+/g, "_").replace(/^[. ]+|[. ]+$/g, "") || "Barcode_Labels";
      downloadBlob(blob, `${safePrefix}_${stamp}.docx`);
      showToast(`Created ${labels.length} barcode labels`);
    } catch (error) {
      showToast(error.message || "Could not create the Word document.", true);
      if (/too tall|must be|too large/i.test(error.message || "")) $("#settings-card").open = true;
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  });

  restoreLocalState();
  LabelRenderer.ready.then(renderRows).catch(() => {
    $("#validation-message").textContent = "Logo could not load. Reload the app before printing.";
    $("#generate").disabled = true;
    $("#print-labels").disabled = true;
  });
})();
