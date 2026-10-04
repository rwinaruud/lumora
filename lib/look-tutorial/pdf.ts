import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { MakeupTutorial } from "./types";

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 56;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const FOOTER_SPACE = 52;

const colour = (hex: string) => {
  const value = parseInt(hex.slice(1), 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
};
const ink = colour("#33231f");
const muted = colour("#84736d");
const wine = colour("#672c3b");
const rose = colour("#b98f88");
const line = colour("#e8ded7");

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

export async function buildTutorialPdf(tutorial: MakeupTutorial, imageJpeg: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Your Lumora makeup tutorial - ${safe(tutorial.title)}`);
  pdf.setAuthor("Lumora Beauty");
  pdf.setCreator("Lumora Beauty");
  pdf.setProducer("Lumora Beauty");

  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const sansItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const photo = await pdf.embedJpg(imageJpeg);

  const pages: PDFPage[] = [];
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  pages.push(page);
  let y = PAGE.height - MARGIN;

  const label = (target: PDFPage, text: string, x: number, atY: number, tone = wine) =>
    spaced(target, safe(text).toUpperCase(), x, atY, 7.5, sansBold, tone, 1.6);

  const newPage = () => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    y = PAGE.height - MARGIN;
  };
  const ensure = (height: number) => { if (y - height < MARGIN + FOOTER_SPACE) newPage(); };

  // Masthead
  spaced(page, "LUMORA", MARGIN, y - 14, 18, serif, wine, 3);
  spaced(page, "BEAUTY", MARGIN, y - 26, 6.5, sansBold, wine, 3.2);
  const tag = "BEAUTY, MADE PERSONAL";
  spaced(page, tag, PAGE.width - MARGIN - sans.widthOfTextAtSize(tag, 7) - (tag.length - 1) * 1.2, y - 14, 7, sans, muted, 1.2);
  page.drawLine({ start: { x: MARGIN, y: y - 40 }, end: { x: PAGE.width - MARGIN, y: y - 40 }, thickness: 0.6, color: line });
  y -= 76;

  // Title block with the result image alongside the summary
  label(page, "Your makeup tutorial", MARGIN, y, rose);
  y -= 8;
  const titleLines = wrap(tutorial.title, serif, 34, CONTENT_WIDTH);
  for (const text of titleLines) { y -= 36; page.drawText(text, { x: MARGIN, y, size: 34, font: serif, color: ink }); }
  y -= 22;

  const imageWidth = 188;
  const imageHeight = Math.min(250, imageWidth * (photo.height / photo.width));
  const drawnWidth = imageHeight * (photo.width / photo.height);
  page.drawImage(photo, { x: MARGIN, y: y - imageHeight, width: drawnWidth, height: imageHeight });

  const columnX = MARGIN + Math.max(drawnWidth, 150) + 28;
  const columnWidth = PAGE.width - MARGIN - columnX;
  let columnY = y - 10;
  for (const text of wrap(tutorial.summary, serif, 15, columnWidth)) { columnY -= 20; page.drawText(text, { x: columnX, y: columnY, size: 15, font: serif, color: ink }); }
  columnY -= 26;
  const difficulty = { easy: "Easy", intermediate: "Intermediate", advanced: "Advanced" }[tutorial.difficulty];
  for (const [name, value] of [["Time", `~${tutorial.estimatedMinutes} min`], ["Level", difficulty], ["Steps", String(tutorial.steps.length)]]) {
    page.drawLine({ start: { x: columnX, y: columnY + 12 }, end: { x: columnX + columnWidth, y: columnY + 12 }, thickness: 0.5, color: line });
    label(page, name, columnX, columnY - 3, rose);
    page.drawText(safe(value), { x: columnX + 70, y: columnY - 5, size: 14, font: serif, color: ink });
    columnY -= 30;
  }
  if (tutorial.highlights.length) {
    const text = wrap(tutorial.highlights.join(" · "), sansItalic, 9.5, columnWidth);
    for (const row of text) { page.drawText(row, { x: columnX, y: columnY - 4, size: 9.5, font: sansItalic, color: muted }); columnY -= 14; }
  }
  y = Math.min(y - imageHeight, columnY) - 34;

  // Palette
  if (tutorial.palette.length) {
    ensure(110);
    label(page, "The palette", MARGIN, y, rose);
    y -= 14;
    const gap = 12;
    const perRow = Math.min(tutorial.palette.length, 5);
    const swatchWidth = (CONTENT_WIDTH - gap * (perRow - 1)) / perRow;
    tutorial.palette.slice(0, 5).forEach((swatch, index) => {
      const x = MARGIN + index * (swatchWidth + gap);
      page.drawRectangle({ x, y: y - 40, width: swatchWidth, height: 40, color: colour(swatch.colour ?? "#e3d3ca"), borderColor: line, borderWidth: 0.5 });
      page.drawText(safe(swatch.label), { x, y: y - 56, size: 9.5, font: sansBold, color: ink });
      const detail = safe(capitalise([swatch.colourFamily, swatch.finish].filter(Boolean).join(" · ")));
      page.drawText(wrap(detail, sans, 8, swatchWidth)[0] ?? "", { x, y: y - 68, size: 8, font: sans, color: muted });
    });
    y -= 94;
  }

  // Steps
  // The cover page carries the overview; the routine starts on a fresh page so no step is split from its heading.
  newPage();
  label(page, "Step by step", MARGIN, y, rose);
  y -= 10;
  const textX = MARGIN + 42;
  const textWidth = PAGE.width - MARGIN - textX;

  tutorial.steps.forEach((step, index) => {
    const instruction = wrap(step.instruction, sans, 10.5, textWidth);
    const attributes = safe(capitalise([step.attributes.colour, step.attributes.finish, step.attributes.intensity].filter(Boolean).join(" · ")));
    const needs = step.tools.length ? wrap(step.tools.map((item) => item.label).join(" · "), sans, 10, textWidth) : [];
    const tip = step.tip ? wrap(step.tip, sansItalic, 9.5, textWidth - 14) : [];
    const height = 34 + instruction.length * 15.5 + (attributes ? 20 : 0) + (needs.length ? 22 + needs.length * 14 : 0) + (tip.length ? 24 + tip.length * 13.5 : 0) + 22;

    ensure(height);
    y -= 14;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.5, color: line });
    y -= 30;
    page.drawText(String(index + 1).padStart(2, "0"), { x: MARGIN, y: y - 2, size: 24, font: serif, color: rose });
    page.drawText(safe(step.title), { x: textX, y, size: 17, font: serif, color: ink });
    y -= 10;
    for (const row of instruction) { y -= 15.5; page.drawText(row, { x: textX, y, size: 10.5, font: sans, color: ink }); }
    if (attributes) { y -= 20; spaced(page, attributes, textX, y, 8.5, sansBold, wine, 0.4); }
    if (needs.length) {
      y -= 22;
      label(page, "You'll need", textX, y, rose);
      for (const row of needs) { y -= 14; page.drawText(row, { x: textX, y, size: 10, font: sans, color: ink }); }
    }
    if (tip.length) {
      y -= 24;
      const top = y + 14;
      label(page, "Lumora tip", textX + 12, y, rose);
      for (const row of tip) { y -= 13.5; page.drawText(row, { x: textX + 12, y, size: 9.5, font: sansItalic, color: muted }); }
      page.drawLine({ start: { x: textX, y: top }, end: { x: textX, y: y - 3 }, thickness: 1.2, color: colour("#e4cfc6") });
    }
    y -= 8;
  });

  // Closing disclaimer
  const disclaimer = wrap(tutorial.disclaimer, sansItalic, 8.5, CONTENT_WIDTH);
  ensure(30 + disclaimer.length * 12);
  y -= 22;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.5, color: line });
  y -= 16;
  for (const row of disclaimer) { page.drawText(row, { x: MARGIN, y, size: 8.5, font: sansItalic, color: muted }); y -= 12; }

  pages.forEach((target, index) => {
    spaced(target, "LUMORA BEAUTY  ·  lumorabeauty.ai", MARGIN, 34, 7, sans, muted, 1.2);
    const number = `${index + 1} / ${pages.length}`;
    target.drawText(number, { x: PAGE.width - MARGIN - sans.widthOfTextAtSize(number, 7.5), y: 34, size: 7.5, font: sans, color: muted });
  });

  return pdf.save();
}
