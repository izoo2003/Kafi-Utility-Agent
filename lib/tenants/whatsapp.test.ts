import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeWhatsappNumber,
  rentDueWhatsappHref,
  rentDueWhatsappText,
} from "./whatsapp";

describe("normalizeWhatsappNumber", () => {
  it("accepts local 03 and +92 forms", () => {
    assert.equal(normalizeWhatsappNumber("03001234567"), "923001234567");
    assert.equal(normalizeWhatsappNumber("+92 300 1234567"), "923001234567");
    assert.equal(normalizeWhatsappNumber("3001234567"), "923001234567");
  });

  it("rejects empty or short values", () => {
    assert.equal(normalizeWhatsappNumber(""), null);
    assert.equal(normalizeWhatsappNumber("123"), null);
  });
});

describe("rent due template", () => {
  it("names the tenant, amount, and due months", () => {
    const text = rentDueWhatsappText({
      tenant_name: "Waheed",
      monthly_total: 600_000,
      due_months: ["Apr-26", "May-26"],
    });
    assert.match(text, /Waheed/);
    assert.match(text, /600,000/);
    assert.match(text, /Apr-26, May-26/);
  });

  it("builds a wa.me href", () => {
    const href = rentDueWhatsappHref({
      whatsapp_number: "03001234567",
      tenant_name: "Waheed",
      monthly_total: 600_000,
    });
    assert.ok(href?.startsWith("https://wa.me/923001234567?text="));
  });
});
