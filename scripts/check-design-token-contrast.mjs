import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const pairs = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "muted"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["success", "success-bg"],
  ["warning", "warning-bg"],
  ["info", "info-bg"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
  ["status-normal", "status-normal-bg"],
  ["status-low", "status-low-bg"],
  ["status-high", "status-high-bg"],
  ["status-critical", "status-critical-bg"],
  ["status-superseded", "status-superseded-bg"],
];

function blockFor(selector) {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`Missing CSS selector: ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") depth -= 1;
    if (depth === 0) return css.slice(open + 1, index);
  }
  throw new Error(`Unclosed CSS block: ${selector}`);
}

function parseTokens(block) {
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
  );
}

function parseHsl(value, tokenName) {
  const parts = value.replaceAll(",", " ").trim().split(/\s+/);
  if (parts.length !== 3 || !parts[1].endsWith("%") || !parts[2].endsWith("%")) {
    throw new Error(`Token --${tokenName} is not a literal HSL triplet: ${value}`);
  }
  return [Number(parts[0]) / 360, Number.parseFloat(parts[1]) / 100, Number.parseFloat(parts[2]) / 100];
}

function hslToRgb([h, s, l]) {
  const hue = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [hue(0), hue(8), hue(4)];
}

function linearize(channel) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(token) {
  const [r, g, b] = hslToRgb(parseHsl(token.value, token.name)).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const themes = [
  ["light", parseTokens(blockFor(":root"))],
  ["dark", parseTokens(blockFor(".dark"))],
];
let failed = false;
for (const [theme, tokens] of themes) {
  for (const [foregroundName, backgroundName] of pairs) {
    const foreground = tokens[foregroundName];
    const background = tokens[backgroundName];
    if (!foreground || !background) {
      throw new Error(`${theme}: missing contrast pair --${foregroundName} / --${backgroundName}`);
    }
    const ratio = contrastRatio(
      { name: foregroundName, value: foreground },
      { name: backgroundName, value: background },
    );
    const ok = ratio >= 4.5;
    if (!ok) failed = true;
    console.log(`${ok ? "PASS" : "FAIL"} ${theme.padEnd(5)} ${foregroundName}/${backgroundName}: ${ratio.toFixed(2)}:1`);
  }
}
if (failed) process.exit(1);
console.log("All checked semantic and clinical status text pairs meet WCAG AA (4.5:1) in light and dark themes.");
