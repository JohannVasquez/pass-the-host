import assert from "node:assert/strict";
import { test } from "node:test";
import { pickLocale } from "./i18n.ts";
import { formatDownloadCount } from "./links.ts";

test("pickLocale", () => {
  assert.equal(pickLocale("es-CL,es;q=0.9,en;q=0.8", undefined), "es");
  assert.equal(pickLocale("en-US,en;q=0.9,es;q=0.8", undefined), "en");
  assert.equal(pickLocale("pt-BR,es;q=0.8,en;q=0.9", undefined), "en");
  assert.equal(pickLocale("fr-FR,fr;q=0.9", undefined), "en");
  assert.equal(pickLocale(null, undefined), "en");
  assert.equal(pickLocale("es-ES", "en"), "en");
  assert.equal(pickLocale("en-US", "es"), "es");
  assert.equal(pickLocale("es-ES", "fr"), "es");
  assert.equal(pickLocale("estonian", undefined), "en");
});

test("formatDownloadCount", () => {
  assert.equal(formatDownloadCount(0), undefined);
  assert.equal(formatDownloadCount(999), undefined);
  assert.equal(formatDownloadCount(1000), "1k+");
  assert.equal(formatDownloadCount(1999), "1k+");
  assert.equal(formatDownloadCount(12345), "12k+");
});
