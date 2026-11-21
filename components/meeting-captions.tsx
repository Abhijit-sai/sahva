import { languages, type Language, type Member } from "../lib/shared";
import type { Caption } from "./live-conversation";

export type RadioCaption = {
  speaker: string;
  source: Language;
  target: Language;
  original: string;
  translation: string;
};

export function MeetingCaptions({
  members,
  me,
  drafts,
  radio,
  radioCaptions = [],
}: {
  members: Member[];
  me: Member;
  drafts: Caption[];
  radio: boolean;
  radioCaptions?: RadioCaption[];
}) {
  const peers = members.filter((member) => member.id !== me.id);
  const captions = peers.flatMap((member) => {
    const draft = drafts.findLast((item) => item.speaker === member.id);
    const live =
      radio &&
      radioCaptions.find(
        (item) => item.speaker === member.id && item.target === me.listening,
      );
    const sameLanguage = member.speaking === me.listening;
    const original = live
      ? live.original
      : !radio || sameLanguage
        ? draft?.text
        : "";
    const translation = live
      ? live.translation
      : !radio && draft?.target === me.listening
        ? draft.translated
        : "";
    if (!original && !translation) return [];
    return [{ member, original, translation, sameLanguage }];
  });
  const own = drafts.findLast((item) => item.speaker === me.id);
  return (
    <>
      {captions.length ? (
        captions.map(({ member, original, translation, sameLanguage }) => (
          <div className="caption-pair" key={member.id}>
            <strong>{member.name}</strong>
            <div className="radio-captions">
              <div>
                <small>Original · {languages[member.speaking]}</small>
                <p lang={member.speaking}>{original || "Waiting for words…"}</p>
              </div>
              <div>
                <small>Interpretation · {languages[me.listening]}</small>
                <p lang={me.listening}>
                  {sameLanguage
                    ? "Speaking your language"
                    : translation || "Waiting for interpretation…"}
                </p>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="radio-captions empty-captions">
          <div>
            <small>
              Original
              {peers.length === 1 && " · " + languages[peers[0].speaking]}
            </small>
            <p>Waiting for speech…</p>
          </div>
          <div>
            <small>Interpretation · {languages[me.listening]}</small>
            <p>Waiting for interpretation…</p>
          </div>
        </div>
      )}
      {own && (
        <div className="own-caption">
          <small>You · {languages[me.speaking]}</small>
          <p lang={me.speaking}>{own.text}</p>
        </div>
      )}
    </>
  );
}
