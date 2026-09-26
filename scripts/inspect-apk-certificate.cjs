// Read APK v2/v3 signer certificates for comparison; this is NOT a signature verifier.
const fs = require('node:fs');
const { X509Certificate, createHash } = require('node:crypto');
const file = process.argv[2];
if (!file) throw Error('Usage: node scripts/inspect-apk-certificate.cjs <apk>');
const apk = fs.readFileSync(file);
let eocd = -1;
for (let i = apk.length - 22; i >= Math.max(0, apk.length - 65557); i--) {
  if (apk.readUInt32LE(i) === 0x06054b50 && i + 22 + apk.readUInt16LE(i + 20) === apk.length) { eocd = i; break; }
}
if (eocd < 0) throw Error('Missing ZIP end record');
const central = apk.readUInt32LE(eocd + 16);
if (central < 24 || !apk.subarray(central - 16, central).equals(Buffer.from('APK Sig Block 42'))) throw Error('Missing APK signing block');
const size = Number(apk.readBigUInt64LE(central - 24));
const start = central - size - 8;
if (start < 0 || Number(apk.readBigUInt64LE(start)) !== size) throw Error('Invalid signing block length');
function field(buffer, offset = 0) {
  if (offset + 4 > buffer.length) throw Error('Truncated field');
  const end = offset + 4 + buffer.readUInt32LE(offset);
  if (end > buffer.length) throw Error('Truncated field data');
  return { data: buffer.subarray(offset + 4, end), next: end };
}
const certs = [];
for (let offset = start + 8; offset < central - 24;) {
  const length = Number(apk.readBigUInt64LE(offset));
  const end = offset + 8 + length;
  if (length < 4 || end > central - 24) throw Error('Invalid signing pair');
  const id = apk.readUInt32LE(offset + 8);
  if ([0x7109871a, 0xf05368c0, 0x1b93ad61].includes(id)) {
    const signers = field(apk.subarray(offset + 12, end)).data;
    for (let cursor = 0; cursor < signers.length;) {
      const signer = field(signers, cursor);
      const signedData = field(signer.data).data;
      const digests = field(signedData);
      const certificates = field(signedData, digests.next).data;
      const leaf = new X509Certificate(field(certificates).data);
      certs.push({ scheme: id.toString(16), subject: leaf.subject, sha256: leaf.fingerprint256 });
      cursor = signer.next;
    }
  }
  offset = end;
}
if (!certs.length) throw Error('No supported APK signers');
console.log(JSON.stringify({ file, sha256: createHash('sha256').update(apk).digest('hex'), certificates: certs, cryptographicSignatureVerified: false }, null, 2));
