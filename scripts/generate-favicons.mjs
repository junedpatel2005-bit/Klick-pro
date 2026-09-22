import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

async function makeFavicons() {
  const root = process.cwd();
  const iconInput = path.join(root, "public", "logo-icon.png");

  const roundedCorners = (size, radius) =>
    Buffer.from(
      `<svg><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
    );

  async function generateSize(size, radius) {
    const resized = await sharp(iconInput).resize(size, size).png().toBuffer();
    return await sharp(resized)
      .composite([
        {
          input: roundedCorners(size, radius),
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();
  }

  const png16 = await generateSize(16, 3);
  const png32 = await generateSize(32, 6);
  const png48 = await generateSize(48, 9);
  const png180 = await generateSize(180, 36);

  fs.writeFileSync(path.join(root, "public", "icon.png"), png32);
  fs.writeFileSync(path.join(root, "app", "icon.png"), png32);
  fs.writeFileSync(path.join(root, "public", "apple-touch-icon.png"), png180);
  fs.writeFileSync(path.join(root, "app", "apple-icon.png"), png180);

  // Generate multi-size ICO binary with 16, 32, 48
  const images = [
    { size: 16, buf: png16 },
    { size: 32, buf: png32 },
    { size: 48, buf: png48 },
  ];

  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * images.length;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  for (const img of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.size, 0);
    entry.writeUInt8(img.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += img.buf.length;
  }

  const icoBuffer = Buffer.concat([header, ...entries, ...images.map((i) => i.buf)]);
  fs.writeFileSync(path.join(root, "public", "favicon.ico"), icoBuffer);
  fs.writeFileSync(path.join(root, "app", "favicon.ico"), icoBuffer);
  console.log("Successfully generated all favicons from logo-icon.png!");
}

makeFavicons().catch((err) => {
  console.error(err);
  process.exit(1);
});

