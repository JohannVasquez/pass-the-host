import assert from "node:assert/strict";
import { test } from "node:test";
import { pickLocale } from "./i18n.ts";

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
