import { expect, it } from "vitest";
import { validateFacts, validateProjection } from "../lib/providers/meeting";
const turns = [
  { id: "t1", speaker: "A", text: "We might dispatch Monday.", revision: 2 },
];
const fixture = {
  kind: "action",
  status: "proposed",
  text: "Dispatch is tentative",
  owner: null,
  deadline: null,
  acceptance: null,
  evidence: [{ turnId: "t1", quote: turns[0].text }],
};
it("drops unsupported owner and date and binds evidence to its revision", () => {
  const [fact] = validateFacts(
    { items: [{ ...fixture, owner: "Ravi", deadline: "2026-11-23" }] },
    turns,
  );
  expect(fact).toMatchObject({
    owner: null,
    deadline: null,
    status: "proposed",
    evidence: [{ revision: 2 }],
  });
});
it("rejects unknown evidence and absent explicit acceptance", () => {
  expect(() =>
    validateFacts(
      { items: [{ ...fixture, evidence: [{ turnId: "t2", quote: "other" }] }] },
      turns,
    ),
  ).toThrow("INVALID_EVIDENCE");
  expect(() =>
    validateFacts({ items: [{ ...fixture, status: "agreed" }] }, turns),
  ).toThrow("ACCEPTANCE_EVIDENCE_REQUIRED");
});
it("localizes prose by canonical identity and refuses missing, extra or changed IDs", () => {
  const facts = validateFacts({ items: [fixture] }, turns);
  expect(
    validateProjection(facts, { items: [{ id: facts[0].id, text: "తెలుగు" }] }),
  ).toEqual({ [facts[0].id]: "తెలుగు" });
  expect(() => validateProjection(facts, { items: [] })).toThrow();
  expect(() =>
    validateProjection(facts, { items: [{ id: "other", text: "text" }] }),
  ).toThrow();
});
