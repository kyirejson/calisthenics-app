const { zipSync, strToU8 } = require('fflate');
exports.docx = (body = '附件测试：豆腐 & 鸡蛋') => Buffer.from(zipSync({
  'word/document.xml': strToU8(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${body.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p><w:p><w:r><w:t>第二段：保留原文。</w:t></w:r></w:p></w:body></w:document>`),
  'word/media/image.png': new Uint8Array([1, 2, 3]),
}));
exports.pdf = (text = 'Actual PDF attachment text') => {
  const stream = text ? `BT /F1 16 Tf 40 180 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET` : '';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 240] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let body = '%PDF-1.4\n', offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(body)); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(body);
  body += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(body);
};
