const WIDTH = 1080;
const HEIGHT = 1920;
const SERIF = '"Iowan Old Style", Baskerville, Palatino, Georgia, serif';

async function loadImage(src: string) {
  const image = new window.Image();
  image.src = src;
  // decode() guarantees pixel data is ready; iOS Safari can otherwise draw an empty image.
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("Story image could not be loaded.");
  return image;
}

const WINE = "#642c3b";
const WINE_DEEP = "#3b1f29";
const PINK = "#ff4dc4";
const CREAM = "#f8f3ed";
const SANS = "system-ui, -apple-system, sans-serif";

type Box = { x: number; y: number; w: number; h: number };

// A canvas that only holds the template has a near-uniform photo area; sample it to catch that.
function photoAreaHasContent(ctx: CanvasRenderingContext2D, box: Box) {
  const { data } = ctx.getImageData(Math.round(box.x + box.w * 0.2), Math.round(box.y + box.h * 0.2), Math.round(box.w * 0.6), Math.round(box.h * 0.6));
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4 * 97) {
    const luma = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (luma < min) min = luma;
    if (luma > max) max = luma;
  }
  return max - min > 24;
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(text, x, y);
  ctx.letterSpacing = "0px";
}

function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, rotation: number, from: string, to: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotation * Math.PI) / 180);
  const gradient = ctx.createLinearGradient(-rx, -ry, rx, ry);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.34)";
  ctx.beginPath();
  ctx.ellipse(-rx * 0.18, -ry * 0.42, rx * 0.5, ry * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function sparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, fill: string) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.12, -s * 0.28, s * 0.28, -s * 0.12, s, 0);
  ctx.bezierCurveTo(s * 0.28, s * 0.12, s * 0.12, s * 0.28, 0, s);
  ctx.bezierCurveTo(-s * 0.12, s * 0.28, -s * 0.28, s * 0.12, -s, 0);
  ctx.bezierCurveTo(-s * 0.28, -s * 0.12, -s * 0.12, -s * 0.28, 0, -s);
  ctx.fill();
  ctx.restore();
}

// Framed photo: cover-cropped into the box without distortion, so only the edges are trimmed.
function framedPhoto(ctx: CanvasRenderingContext2D, image: HTMLImageElement, box: Box, focusY: number) {
  const frame = 16;
  ctx.save();
  ctx.shadowColor = "rgba(59,31,41,.28)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 22;
  ctx.fillStyle = "#fff";
  ctx.fillRect(box.x - frame, box.y - frame, box.w + frame * 2, box.h + frame * 2);
  ctx.restore();
  const scale = Math.max(box.w / image.naturalWidth, box.h / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  const draw = () => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, box.x + (box.w - w) / 2, box.y - (h - box.h) * focusY, w, h);
    ctx.restore();
  };
  draw();
  if (!photoAreaHasContent(ctx, box)) {
    draw();
    if (!photoAreaHasContent(ctx, box)) throw new Error("The Lumora image could not be drawn.");
  }
}

function footerCopy(ctx: CanvasRenderingContext2D, centreX: number, labelY: number, lines: Array<{ text: string; italic?: boolean; y: number }>, size: number, domainY: number) {
  ctx.textAlign = "center";
  ctx.fillStyle = WINE;
  ctx.font = `600 26px ${SANS}`;
  spaced(ctx, "MADE WITH LUMORA", centreX, labelY, 5);
  for (const line of lines) {
    ctx.fillStyle = line.italic ? PINK : WINE_DEEP;
    ctx.font = `${line.italic ? "italic " : ""}500 ${size}px ${SERIF}`;
    ctx.fillText(line.text, centreX, line.y);
  }
  ctx.fillStyle = WINE;
  ctx.font = `500 28px ${SANS}`;
  spaced(ctx, "lumorabeauty.ai", centreX, domainY, 3);
}

function header(ctx: CanvasRenderingContext2D, x: number, y: number, align: "left" | "center", width: number) {
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  ctx.fillStyle = WINE;
  ctx.font = `400 46px ${SERIF}`;
  ctx.letterSpacing = "8px";
  const text = "LUMORA";
  const textWidth = ctx.measureText(text).width;
  const startX = align === "center" ? x - (textWidth - 8) / 2 : x;
  ctx.textAlign = "left";
  ctx.fillText(text, startX, y);
  ctx.letterSpacing = "0px";
  sparkle(ctx, startX + textWidth + 14, y - 10, 12, PINK);
  ctx.textBaseline = "alphabetic";
  void width;
}

async function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported.");
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

async function toFile(canvas: HTMLCanvasElement, name: string) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("Share image could not be created.");
  return new File([blob], name, { type: "image/jpeg" });
}

// 1080x1920 Story. Instagram's UI covers roughly the top and bottom 250px, so key content sits between them.
export async function createStoryFile(previewSrc: string): Promise<File> {
  const image = await loadImage(previewSrc);
  const { canvas, ctx } = await createCanvas(WIDTH, HEIGHT);
  blob(ctx, 90, 520, 250, 170, -24, "#ff4dc4", "#ff7aa8");
  blob(ctx, 1010, 980, 200, 140, 28, "#c7b2ff", "#b79cff");
  blob(ctx, 930, 1290, 240, 80, 8, "#ff8c6b", "#ff4dc4");
  header(ctx, WIDTH / 2, 275, "center", WIDTH);
  framedPhoto(ctx, image, { x: 150, y: 350, w: 780, h: 975 }, 0.3);
  sparkle(ctx, 975, 330, 40, PINK);
  footerCopy(ctx, WIDTH / 2, 1405, [{ text: "See the look.", y: 1505 }, { text: "On you.", italic: true, y: 1600 }], 96, 1655);
  return toFile(canvas, "lumora-story.jpg");
}

// 1080x1350 (4:5) feed post that stands on its own.
export async function createPostFile(previewSrc: string): Promise<File> {
  const image = await loadImage(previewSrc);
  const { canvas, ctx } = await createCanvas(WIDTH, 1350);
  blob(ctx, 70, 420, 210, 150, -24, "#ff4dc4", "#ff7aa8");
  blob(ctx, 1020, 760, 170, 120, 28, "#c7b2ff", "#b79cff");
  blob(ctx, 880, 940, 230, 70, 8, "#ff8c6b", "#ff4dc4");
  header(ctx, WIDTH / 2, 92, "center", WIDTH);
  framedPhoto(ctx, image, { x: 220, y: 150, w: 640, h: 800 }, 0.3);
  sparkle(ctx, 960, 150, 34, PINK);
  footerCopy(ctx, WIDTH / 2, 1032, [{ text: "See the look.", y: 1122 }, { text: "On you.", italic: true, y: 1208 }], 84, 1282);
  return toFile(canvas, "lumora-post.jpg");
}
