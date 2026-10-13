import { describe, expect, it } from "vitest";

describe("searchable select", () => {
  it("searches the label, the description, extra words and the id", () => {
    const text = searchText({ value: "id-7", label: "Al-Noor Pharmacy", description: "info@alnoor.test", keywords: "صيدلية النور" });
    expect(text).toContain("Al-Noor Pharmacy");
    expect(text).toContain("info@alnoor.test");
    expect(text).toContain("صيدلية النور");
    expect(text).toContain("id-7");
  });

  it("keeps rows with the same label distinct", () => {
    const a = searchText({ value: "1", label: "Acme" });
    const b = searchText({ value: "2", label: "Acme" });
    expect(a).not.toBe(b);
  });
});

import { searchText, clientOptions, listOptions, personName, projectOptions, userOptions } from "../client/src/lib/select-options";

describe("select option builders", () => {
  it("shows a person's name with the email underneath, falling back to the email", () => {
    expect(userOptions([{ id: "1", email: "sara@x.test", firstName: "Sara", lastName: "Ali" }])).toEqual([{ value: "1", label: "Sara Ali", description: "sara@x.test", keywords: "" }]);
    expect(userOptions([{ id: "2", email: "a@x.test" }])[0]).toMatchObject({ label: "a@x.test", description: undefined });
    expect(personName({ employee: { firstName: "Omar", lastName: "K" } })).toBe("Omar K");
    expect(userOptions(undefined)).toEqual([]);
  });

  it("offers active clients only, searchable by phone and city", () => {
    const o = clientOptions([{ id: "1", name: "Acme", phone: "0100", city: "Cairo" }, { id: "2", name: "Old", status: "archived" }]);
    expect(o.map((x) => x.value)).toEqual(["1"]);
    expect(o[0].keywords).toContain("Cairo");
  });

  it("builds project and plain lists", () => {
    expect(projectOptions([{ id: "p", name: "Site" }])).toEqual([{ value: "p", label: "Site" }]);
    expect(listOptions(["A", "", null, "B"]).map((x) => x.value)).toEqual(["A", "B"]);
  });
});
