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

// A canvas that only holds the template has a near-uniform photo area; sample it to catch that.
function photoAreaHasContent(ctx: CanvasRenderingContext2D) {
  const { data } = ctx.getImageData(240, 520, 600, 800);
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

// Right-aligned text with letter spacing leaves a trailing gap; compensate so edges line up.
function spacedAt(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(text, ctx.textAlign === "right" ? x + spacing : x, y);
  ctx.letterSpacing = "0px";
}

// Renders the branded 1080x1920 Story from the free preview only.
export async function createStoryFile(previewSrc: string): Promise<File> {
  const image = await loadImage(previewSrc);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported.");

  const scale = Math.max(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  const focusY = 0.34;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#e9d6cf";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const drawPhoto = () => ctx.drawImage(image, (WIDTH - w) / 2, -(h - HEIGHT) * focusY, w, h);
  drawPhoto();
  if (!photoAreaHasContent(ctx)) {
    drawPhoto();
    if (!photoAreaHasContent(ctx)) throw new Error("The Lumora image could not be drawn into the Story.");
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "rgba(35,20,20,.24)");
  gradient.addColorStop(0.3, "rgba(35,20,20,0)");
  gradient.addColorStop(0.48, "rgba(35,20,20,0)");
  gradient.addColorStop(1, "rgba(35,20,20,.68)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Top row mirrors the in-app Story preview: logo left, tagline right, on one line.
  const margin = 67;
  const topY = 100;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = `400 48px ${SERIF}`;
  spacedAt(ctx, "LUMORA", margin, topY, 7);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "500 26px system-ui, -apple-system, sans-serif";
  spacedAt(ctx, "BEAUTY, MADE PERSONAL", WIDTH - margin, topY, 4.5);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "500 28px system-ui, -apple-system, sans-serif";
  spaced(ctx, "MADE WITH LUMORA", WIDTH / 2, 1460, 5);
  ctx.fillStyle = "#fff";
  ctx.font = `600 112px ${SERIF}`;
  ctx.fillText("See the look.", WIDTH / 2, 1600);
  ctx.fillStyle = "#f1d9d2";
  ctx.font = `italic 600 112px ${SERIF}`;
  ctx.fillText("On you.", WIDTH / 2, 1722);
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "500 30px system-ui, -apple-system, sans-serif";
  spaced(ctx, "lumorabeauty.ai", WIDTH / 2, 1820, 3);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("Story image could not be created.");
  return new File([blob], "lumora-story.jpg", { type: "image/jpeg" });
}
