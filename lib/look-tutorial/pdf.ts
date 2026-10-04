import "server-only";

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { MakeupTutorial } from "./types";

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 56;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const FOOTER_SPACE = 52;

const colour = (hex: string) => {
  const value = parseInt(hex.slice(1), 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
};
const ink = colour("#3b1f29");
const muted = colour("#7d6b6b");
const wine = colour("#642c3b");
const pink = colour("#ff4dc4");
const coral = colour("#ff6b4a");
const lilac = colour("#b79cff");
const peach = colour("#f8c6b9");
const cream = colour("#f8f3ed");
const card = colour("#fffaf5");
const line = colour("#e6d9d0");

// The standard PDF fonts only cover WinAnsi; anything outside it is dropped rather than failing the whole document.
function safe(text: string): string {
  return text.replace(/[→←]/g, "-").replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/g, "").replace(/\s+/g, " ").trim();
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of safe(text).split(" ").filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(next, size) > width) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// pdf-lib has no letter-spacing option, so spaced capitals are drawn glyph by glyph.
function spaced(target: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>, spacing: number): number {
  let cursor = x;
  for (const char of text) {
    target.drawText(char, { x: cursor, y, size, font, color });
    cursor += font.widthOfTextAtSize(char, size) + spacing;
  }
  return cursor - spacing;
}

const capitalise = (value: string) => value.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

// Rounded rectangle; x/top are PDF coordinates of the top-left corner (drawSvgPath flips the y axis).
function roundRect(target: PDFPage, x: number, top: number, width: number, height: number, radius: number, fill?: ReturnType<typeof rgb>, border?: ReturnType<typeof rgb>, opacity = 1) {
  const r = Math.min(radius, height / 2, width / 2);
  const path = `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width} ${r} V ${height - r} A ${r} ${r} 0 0 1 ${width - r} ${height} H ${r} A ${r} ${r} 0 0 1 0 ${height - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  target.drawSvgPath(path, { x, y: top, color: fill, borderColor: border, borderWidth: border ? 0.6 : 0, opacity, borderOpacity: 1 });
}

function sparkle(target: PDFPage, cx: number, cy: number, size: number, fill: ReturnType<typeof rgb>) {
  const s = size;
  const path = `M 0 ${-s} C ${s * 0.12} ${-s * 0.28} ${s * 0.28} ${-s * 0.12} ${s} 0 C ${s * 0.28} ${s * 0.12} ${s * 0.12} ${s * 0.28} 0 ${s} C ${-s * 0.12} ${s * 0.28} ${-s * 0.28} ${s * 0.12} ${-s} 0 C ${-s * 0.28} ${-s * 0.12} ${-s * 0.12} ${-s * 0.28} 0 ${-s} Z`;
  target.drawSvgPath(path, { x: cx, y: cy, color: fill });
}

// A glossy blob: a tilted ellipse with a soft highlight.
function blob(target: PDFPage, cx: number, cy: number, rx: number, ry: number, tilt: number, fill: ReturnType<typeof rgb>, opacity = 0.9) {
  target.drawEllipse({ x: cx, y: cy, xScale: rx, yScale: ry, rotate: degrees(tilt), color: fill, opacity });
  const lift = tilt * (Math.PI / 180);
  target.drawEllipse({ x: cx - ry * 0.18 * Math.sin(lift) - rx * 0.12, y: cy + ry * 0.3, xScale: rx * 0.5, yScale: ry * 0.2, rotate: degrees(tilt), color: rgb(1, 1, 1), opacity: 0.28 });
}

export async function buildTutorialPdf(tutorial: MakeupTutorial, imageJpeg: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Your Lumora makeup tutorial - ${safe(tutorial.title)}`);
  pdf.setAuthor("Lumora Beauty");
  pdf.setCreator("Lumora Beauty");
  pdf.setProducer("Lumora Beauty");

  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const sansItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const photo = await pdf.embedJpg(imageJpeg);

  const pages: PDFPage[] = [];
  const addPage = () => {
    const created = pdf.addPage([PAGE.width, PAGE.height]);
    created.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: cream });
    pages.push(created);
    return created;
  };
  const label = (target: PDFPage, text: string, x: number, atY: number, tone = wine, size = 7.5) =>
    spaced(target, safe(text).toUpperCase(), x, atY, size, sansBold, tone, 1.6);
  const centered = (target: PDFPage, text: string, centerX: number, atY: number, size: number, font: PDFFont, tone: ReturnType<typeof rgb>) =>
    target.drawText(text, { x: centerX - font.widthOfTextAtSize(text, size) / 2, y: atY, size, font, color: tone });
  const difficulty = { easy: "Easy", intermediate: "Intermediate", advanced: "Advanced" }[tutorial.difficulty];

  // ---------- Cover ----------
  let page = addPage();
  const centreX = PAGE.width / 2;
  spaced(page, "LUMORA", MARGIN, PAGE.height - 70, 20, serif, wine, 4);
  sparkle(page, MARGIN + 124, PAGE.height - 62, 6, pink);

  const maxPhotoWidth = 282;
  const maxPhotoHeight = 372;
  const photoScale = Math.min(maxPhotoWidth / photo.width, maxPhotoHeight / photo.height);
  const photoWidth = photo.width * photoScale;
  const photoHeight = photo.height * photoScale;
  const photoLeft = centreX - photoWidth / 2;
  const photoTop = PAGE.height - 118;
  const photoBottom = photoTop - photoHeight;
  blob(page, photoLeft - 36, photoBottom + photoHeight * 0.68, 118, 78, 24, pink, 0.9);
  blob(page, photoLeft + photoWidth + 40, photoBottom + photoHeight * 0.3, 92, 62, -28, lilac, 0.85);
  blob(page, photoLeft + photoWidth * 0.78, photoBottom - 14, 96, 36, 8, coral, 0.85);
  const frame = 9;
  roundRect(page, photoLeft - frame + 4, photoTop + frame - 6, photoWidth + frame * 2, photoHeight + frame * 2, 3, wine, undefined, 0.12);
  roundRect(page, photoLeft - frame, photoTop + frame, photoWidth + frame * 2, photoHeight + frame * 2, 3, rgb(1, 1, 1));
  page.drawImage(photo, { x: photoLeft, y: photoBottom, width: photoWidth, height: photoHeight });
  sparkle(page, photoLeft + photoWidth + 58, photoTop - 26, 15, pink);

  let coverY = Math.min(photoBottom - 62, 330);
  const titleSize = 38;
  centered(page, "YOUR PERSONAL", centreX, coverY, titleSize, serif, wine);
  coverY -= 44;
  centered(page, "MAKEUP TUTORIAL", centreX, coverY, titleSize, serif, pink);
  coverY -= 14;
  for (const text of wrap(tutorial.title, serifItalic, 21, CONTENT_WIDTH - 40)) {
    coverY -= 28;
    centered(page, text, centreX, coverY, 21, serifItalic, wine);
  }
  coverY -= 24;
  centered(page, "Beauty, made personal.", centreX, coverY, 10, sansItalic, muted);

  const statsY = 112;
  const statWidth = CONTENT_WIDTH / 3;
  page.drawLine({ start: { x: MARGIN, y: statsY + 34 }, end: { x: PAGE.width - MARGIN, y: statsY + 34 }, thickness: 0.6, color: line });
  [["Time", `~${tutorial.estimatedMinutes} min`], ["Level", difficulty], ["Steps", String(tutorial.steps.length)]].forEach(([name, value], index) => {
    const x = MARGIN + statWidth * index + statWidth / 2;
    const nameWidth = sansBold.widthOfTextAtSize(name.toUpperCase(), 7.5) + (name.length - 1) * 1.6;
    label(page, name, x - nameWidth / 2, statsY + 10, pink);
    centered(page, value, x, statsY - 14, 19, serif, wine);
  });

  // ---------- Inner pages ----------
  let y = 0;
  const startPage = () => {
    page = addPage();
    blob(page, PAGE.width - 30, PAGE.height + 6, 62, 34, -18, lilac, 0.55);
    spaced(page, "LUMORA", MARGIN, PAGE.height - 50, 11, serif, wine, 2.6);
    sparkle(page, MARGIN + 74, PAGE.height - 45, 3.6, pink);
    y = PAGE.height - 92;
  };
  const ensure = (height: number) => { if (y - height < MARGIN + FOOTER_SPACE) startPage(); };
  startPage();

  // Overview
  label(page, "The look", MARGIN, y, pink);
  y -= 10;
  for (const text of wrap(tutorial.summary, serif, 19, CONTENT_WIDTH)) { y -= 26; page.drawText(text, { x: MARGIN, y, size: 19, font: serif, color: wine }); }
  if (tutorial.highlights.length) {
    let chipX = MARGIN;
    y -= 30;
    for (const text of tutorial.highlights.map((item) => safe(capitalise(item))).filter(Boolean)) {
      const width = sans.widthOfTextAtSize(text, 8.5) + 20;
      if (chipX + width > PAGE.width - MARGIN) { chipX = MARGIN; y -= 24; }
      roundRect(page, chipX, y + 14, width, 20, 10, rgb(1, 1, 1), peach);
      page.drawText(text, { x: chipX + 10, y: y + 1.5, size: 8.5, font: sans, color: wine });
      chipX += width + 8;
    }
    y -= 6;
  }
  y -= 38;

  // Palette
  if (tutorial.palette.length) {
    ensure(120);
    label(page, "The palette", MARGIN, y, pink);
    y -= 16;
    const swatches = tutorial.palette.slice(0, 5);
    const cell = CONTENT_WIDTH / swatches.length;
    const radius = 24;
    swatches.forEach((swatch, index) => {
      const cx = MARGIN + cell * index + cell / 2;
      const cy = y - radius - 4;
      page.drawCircle({ x: cx, y: cy, size: radius, color: colour(swatch.colour ?? "#e3d3ca"), borderColor: rgb(1, 1, 1), borderWidth: 2 });
      page.drawCircle({ x: cx, y: cy, size: radius + 1, borderColor: line, borderWidth: 0.6 });
      page.drawEllipse({ x: cx - 7, y: cy + 10, xScale: 9, yScale: 4.5, rotate: degrees(24), color: rgb(1, 1, 1), opacity: 0.3 });
      centered(page, safe(swatch.label), cx, cy - radius - 16, 9.5, sansBold, ink);
      const detail = safe(capitalise([swatch.colourFamily, swatch.finish].filter(Boolean).join(" · ")));
      centered(page, wrap(detail, sans, 8, cell - 6)[0] ?? "", cx, cy - radius - 28, 8, sans, muted);
    });
    y -= radius * 2 + 62;
  }

  // Steps
  ensure(140);
  label(page, "Step by step", MARGIN, y, pink);
  y -= 8;
  const textX = MARGIN + 52;
  const textWidth = PAGE.width - MARGIN - textX;
  const innerWidth = textWidth - 28;

  tutorial.steps.forEach((step, index) => {
    const titleLines = wrap(step.title, serif, 20, textWidth);
    const instruction = wrap(step.instruction, sans, 10.5, textWidth);
    const chips = [step.attributes.colour, step.attributes.finish, step.attributes.intensity].filter((value): value is string => !!value).map((value) => safe(capitalise(value))).filter(Boolean);
    const needs = step.tools.length ? wrap(step.tools.map((item) => item.label).join(" · "), sans, 10, innerWidth) : [];
    const tip = step.tip ? wrap(step.tip, sansItalic, 10, innerWidth) : [];
    const needsHeight = needs.length ? 34 + needs.length * 14 : 0;
    const tipHeight = tip.length ? 34 + tip.length * 14 : 0;
    const height = 18 + titleLines.length * 24 + 8 + instruction.length * 15.5 + (chips.length ? 36 : 0) + (needs.length ? 14 + needsHeight : 0) + (tip.length ? 12 + tipHeight : 0) + 30;

    ensure(height);
    page.drawLine({ start: { x: MARGIN, y: y - 8 }, end: { x: PAGE.width - MARGIN, y: y - 8 }, thickness: 0.5, color: line });
    y -= 18;
    page.drawText(String(index + 1).padStart(2, "0"), { x: MARGIN, y: y - 24, size: 30, font: serif, color: pink });
    for (const text of titleLines) { y -= 24; page.drawText(text, { x: textX, y: y + 2, size: 20, font: serif, color: wine }); }
    y -= 8;
    for (const row of instruction) { y -= 15.5; page.drawText(row, { x: textX, y, size: 10.5, font: sans, color: ink }); }
    if (chips.length) {
      y -= 14;
      let chipX = textX;
      for (const text of chips) {
        const width = sans.widthOfTextAtSize(text, 8.5) + 20;
        if (chipX + width > PAGE.width - MARGIN) break;
        roundRect(page, chipX, y, width, 20, 10, rgb(1, 1, 1), wine);
        page.drawText(text, { x: chipX + 10, y: y - 13.5, size: 8.5, font: sans, color: wine });
        chipX += width + 7;
      }
      y -= 22;
    }
    if (needs.length) {
      y -= 14;
      roundRect(page, textX, y, textWidth, needsHeight, 10, card, line);
      label(page, "You'll need", textX + 14, y - 20, wine);
      needs.forEach((row, rowIndex) => page.drawText(row, { x: textX + 14, y: y - 38 - rowIndex * 14, size: 10, font: sans, color: ink }));
      y -= needsHeight;
    }
    if (tip.length) {
      y -= 12;
      roundRect(page, textX, y, textWidth, tipHeight, 10, peach, undefined, 0.55);
      label(page, "Lumora tip", textX + 14, y - 20, coral);
      tip.forEach((row, rowIndex) => page.drawText(row, { x: textX + 14, y: y - 38 - rowIndex * 14, size: 10, font: sansItalic, color: wine }));
      y -= tipHeight;
    }
    y -= 12;
  });

  // Closing disclaimer
  const disclaimer = wrap(tutorial.disclaimer, sansItalic, 8.5, CONTENT_WIDTH);
  ensure(50 + disclaimer.length * 12);
  y -= 22;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.5, color: line });
  y -= 18;
  for (const row of disclaimer) { page.drawText(row, { x: MARGIN, y, size: 8.5, font: sansItalic, color: muted }); y -= 12; }

  pages.forEach((target, index) => {
    if (index === 0) return;
    spaced(target, "LUMORA BEAUTY  ·  lumorabeauty.ai", MARGIN, 34, 7, sans, muted, 1.2);
    const number = `${index + 1} / ${pages.length}`;
    target.drawText(number, { x: PAGE.width - MARGIN - sans.widthOfTextAtSize(number, 7.5), y: 34, size: 7.5, font: sans, color: muted });
  });

  return pdf.save();
}
