function escapePdfText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildPageStream(lines = []) {
  const chunks = ["BT", "/F1 11 Tf", "50 790 Td", "14 TL"];
  lines.forEach((line, index) => {
    if (index === 0) {
      chunks.push(`(${escapePdfText(line)}) Tj`);
    } else {
      chunks.push(`T* (${escapePdfText(line)}) Tj`);
    }
  });
  chunks.push("ET");
  return chunks.join("\n");
}

function buildSimplePdf(title, lines = []) {
  const perPage = 46;
  const pages = [];
  const allLines = [title, "", ...lines];
  for (let index = 0; index < allLines.length; index += perPage) {
    pages.push(allLines.slice(index, index + perPage));
  }
  if (!pages.length) pages.push([title]);

  const objects = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");

  const pageObjectIds = [];
  const contentObjectIds = [];
  let nextId = 3;
  pages.forEach(() => {
    pageObjectIds.push(nextId++);
    contentObjectIds.push(nextId++);
  });
  const fontId = nextId++;

  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects.push(`2 0 obj << /Type /Pages /Count ${pages.length} /Kids [${kids}] >> endobj`);

  pages.forEach((pageLines, index) => {
    const pageId = pageObjectIds[index];
    const contentId = contentObjectIds[index];
    objects.push(
      `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >> endobj`
    );
    const stream = buildPageStream(pageLines);
    objects.push(`${contentId} 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream\nendobj`);
  });

  objects.push(`${fontId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);

  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(output, "utf8"));
    output += `${object}\n`;
  });

  const xrefOffset = Buffer.byteLength(output, "utf8");
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  output += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(output, "utf8");
}

module.exports = { buildSimplePdf };
