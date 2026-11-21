import { extract, localize } from "../lib/providers/meeting.ts";
const turns = [
  {
    id: "a76ad20c-adbd-49ec-9ef0-b86f33761af2",
    revision: 0,
    speaker: "A",
    text: "I will send the revised plan. Sarah might arrange pickup, but she hasn't agreed and there is no deadline.",
  },
  {
    id: "28cd1881-439b-49e4-9890-fab2ef52958b",
    revision: 0,
    speaker: "B",
    text: "What pickup time should we propose?",
  },
];
async function main() {
  const facts = await extract(turns);
  if (
    !facts.some((f) => f.kind === "question") ||
    !facts.some((f) => f.kind === "commitment" || f.kind === "action") ||
    facts.some(
      (f) =>
        f.owner === "Sarah" ||
        f.deadline !== null ||
        (f.status === "agreed" && /pickup/i.test(f.text)),
    )
  )
    throw new Error("AMBIGUITY_CHECK_FAILED");
  const projection = await localize(facts);
  if (Object.values(projection).some((text) => !/[\u0c00-\u0c7f]/.test(text)))
    throw new Error("TELUGU_SCRIPT_CHECK_FAILED");
  console.log(
    JSON.stringify({
      input: "two synthetic text turns",
      facts: facts.length,
      localized: Object.keys(projection).length,
      unknownDeadlinesPreserved: true,
      unacceptedOwnerOmitted: true,
    }),
  );
}
main().catch((e) => {
  console.error(
    /^LLM_[A-Z0-9_]+$|^(INVALID_EVIDENCE|AMBIGUITY_CHECK_FAILED|TELUGU_SCRIPT_CHECK_FAILED|LOCALIZATION_MISMATCH|ACCEPTANCE_EVIDENCE_REQUIRED)$/.test(
      e.message,
    )
      ? e.message
      : "Report validation or connection failed",
  );
  process.exitCode = 1;
});
