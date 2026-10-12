const QR_SIZE = 41; // Version 6-L: 136 data codewords, 18 ECC codewords per block.
const DATA_CODEWORDS = 136;
const ECC_CODEWORDS_PER_BLOCK = 18;

function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function reedSolomonGenerator(degree) {
  let result = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(result.length + 1).fill(0);
    for (let j = 0; j < result.length; j += 1) {
      next[j] ^= result[j];
      next[j + 1] ^= gfMultiply(result[j], gfPower(i));
    }
    result = next;
  }
  return result;
}

function gfPower(exponent) {
  let result = 1;
  for (let i = 0; i < exponent; i += 1) result = gfMultiply(result, 2);
  return result;
}

function reedSolomonRemainder(data, degree) {
  const generator = reedSolomonGenerator(degree);
  const result = [...data, ...new Array(degree).fill(0)];
  for (let i = 0; i < data.length; i += 1) {
    const factor = result[i];
    if (factor === 0) continue;
    for (let j = 0; j < generator.length; j += 1) {
      result[i + j] ^= gfMultiply(generator[j], factor);
    }
  }
  return result.slice(data.length);
}

function appendBits(target, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) target.push((value >>> i) & 1);
}

function makeCodewords(value) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 134) {
    throw new RangeError("طول نشانی کد پذیرش برای ساخت تصویر رمز دوبعدی بیش از حد مجاز است.");
  }

  const bits = [];
  appendBits(bits, 0b0100, 4); // Byte mode
  appendBits(bits, bytes.length, 8); // Versions 1–9 use an 8-bit byte count.
  for (const byte of bytes) appendBits(bits, byte, 8);

  const capacity = DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }
  for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);

  // Version 6-L uses two equal blocks of 68 data bytes and 18 ECC bytes.
  const blockA = data.slice(0, 68);
  const blockB = data.slice(68, 136);
  const eccA = reedSolomonRemainder(blockA, ECC_CODEWORDS_PER_BLOCK);
  const eccB = reedSolomonRemainder(blockB, ECC_CODEWORDS_PER_BLOCK);
  const codewords = [];
  for (let i = 0; i < 68; i += 1) codewords.push(blockA[i], blockB[i]);
  for (let i = 0; i < ECC_CODEWORDS_PER_BLOCK; i += 1) codewords.push(eccA[i], eccB[i]);
  return codewords;
}

function formatBits(mask) {
  // Error correction level L is encoded as 01.
  const data = (0b01 << 3) | mask;
  let remainder = data << 10;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if ((remainder >>> bit) & 1) remainder ^= 0x537 << (bit - 10);
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

export function generateQrMatrix(value) {
  const codewords = makeCodewords(String(value || ""));
  const modules = Array.from({ length: QR_SIZE }, () => new Array(QR_SIZE).fill(false));
  const reserved = Array.from({ length: QR_SIZE }, () => new Array(QR_SIZE).fill(false));

  function setFunction(row, col, dark) {
    if (row < 0 || row >= QR_SIZE || col < 0 || col >= QR_SIZE) return;
    modules[row][col] = Boolean(dark);
    reserved[row][col] = true;
  }

  function drawFinder(top, left) {
    for (let row = -1; row <= 7; row += 1) {
      for (let col = -1; col <= 7; col += 1) {
        const r = top + row;
        const c = left + col;
        const inside = row >= 0 && row <= 6 && col >= 0 && col <= 6;
        const dark = inside && (row === 0 || row === 6 || col === 0 || col === 6 || (row >= 2 && row <= 4 && col >= 2 && col <= 4));
        setFunction(r, c, dark);
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, QR_SIZE - 7);
  drawFinder(QR_SIZE - 7, 0);

  // The only non-overlapping alignment pattern in version 6 is centered at (34,34).
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setFunction(34 + dy, 34 + dx, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  for (let i = 8; i < QR_SIZE - 8; i += 1) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  const format = formatBits(0); // Fixed mask 0; any mask is valid when its format bits match.
  for (let i = 0; i <= 5; i += 1) setFunction(i, 8, ((format >>> i) & 1) !== 0);
  setFunction(7, 8, ((format >>> 6) & 1) !== 0);
  setFunction(8, 8, ((format >>> 7) & 1) !== 0);
  setFunction(8, 7, ((format >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i += 1) setFunction(8, 14 - i, ((format >>> i) & 1) !== 0);
  for (let i = 0; i < 8; i += 1) setFunction(8, QR_SIZE - 1 - i, ((format >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i += 1) setFunction(QR_SIZE - 15 + i, 8, ((format >>> i) & 1) !== 0);
  setFunction(QR_SIZE - 8, 8, true); // Fixed dark module.

  const stream = [];
  for (const byte of codewords) appendBits(stream, byte, 8);
  let bitIndex = 0;
  let upward = true;
  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < QR_SIZE; vert += 1) {
      const row = upward ? QR_SIZE - 1 - vert : vert;
      for (let offset = 0; offset < 2; offset += 1) {
        const col = right - offset;
        if (reserved[row][col]) continue;
        const rawBit = bitIndex < stream.length ? stream[bitIndex] === 1 : false;
        bitIndex += 1;
        modules[row][col] = rawBit !== ((row + col) % 2 === 0);
      }
    }
    upward = !upward;
  }

  return modules;
}
