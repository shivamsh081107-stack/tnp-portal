async function extractPdfText(buffer) {
  const pdfParse = require('pdf-parse/lib/pdf-parse.js');
  const parsed = await pdfParse(buffer);
  return String(parsed.text || '')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 12000);
}

module.exports = { extractPdfText };
