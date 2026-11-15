import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEvidenceFile, evidencePath, safeFileName, sameEvidenceFamily, sniffEvidenceType } from "../../src/lib/evidence";

const bytes = (...parts: (number[] | string)[]) => {
  const out: number[] = [];
  for (const p of parts) out.push(...(typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p));
  while (out.length < 16) out.push(0);
  return new Uint8Array(out);
};

test("detects real file types from their first bytes", () => {
  assert.equal(sniffEvidenceType(bytes([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffEvidenceType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(sniffEvidenceType(bytes("RIFF", [1, 2, 3, 4], "WEBP")), "image/webp");
  assert.equal(sniffEvidenceType(bytes("%PDF-1.7")), "application/pdf");
  assert.equal(sniffEvidenceType(bytes([0, 0, 0, 0x18], "ftypheic")), "image/heic");
});

test("rejects disguised or dangerous content", () => {
  assert.equal(sniffEvidenceType(bytes("<svg xmlns=")), null, "SVG (can carry scripts) is not allowed");
  assert.equal(sniffEvidenceType(bytes("<html><script>")), null);
  assert.equal(sniffEvidenceType(bytes("MZ\x90\x00")), null, "Windows executables");
  assert.equal(sniffEvidenceType(new Uint8Array([0xff, 0xd8])), null, "too short to judge");
});

test("pre-upload checks: size, type and extension", () => {
  assert.equal(checkEvidenceFile("a.jpg", "image/jpeg", 1000).ok, true);
  assert.equal(checkEvidenceFile("a.jpg", "image/jpeg", 11 * 1024 * 1024).ok, false);
  assert.equal(checkEvidenceFile("a.jpg", "image/jpeg", 0).ok, false);
  assert.equal(checkEvidenceFile("a.svg", "image/svg+xml", 100).ok, false);
  assert.equal(checkEvidenceFile("a.exe", "application/pdf", 100).ok, false);
});

test("file names are made storage-safe", () => {
  assert.equal(safeFileName("../../etc/passwd"), "passwd");
  assert.equal(safeFileName("Dock 4 — damage photo!!.JPG"), "Dock_4_damage_photo_.jpg");
  assert.equal(safeFileName("..hidden"), "hidden");
  assert.ok(safeFileName("x".repeat(500) + ".pdf").length <= 90);
});

test("evidence paths are always scoped to org/incident", () => {
  assert.equal(evidencePath("org", "inc", "id", "../a.png"), "org/inc/id-a.png");
  assert.ok(sameEvidenceFamily("image/heic", "image/heif"));
  assert.ok(!sameEvidenceFamily("image/png", "image/jpeg"));
});
