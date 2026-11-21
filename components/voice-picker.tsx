import { languages, type Language } from "../lib/shared";
import { supportsVoice, voices } from "../lib/voices";

export function storedVoice(room: string, person: string, target: Language) {
  try {
    const value = localStorage.getItem(
      ["sahva-voice", room, person, target].join("/"),
    );
    if (supportsVoice(target, value)) return value;
  } catch {
    /* Browser storage may be disabled. */
  }
  return voices[target][0].id;
}

export function rememberVoice(
  room: string,
  person: string,
  target: Language,
  value: string,
) {
  try {
    localStorage.setItem(
      ["sahva-voice", room, person, target].join("/"),
      value,
    );
  } catch {
    /* The current call can still use a selection in memory. */
  }
}

export function VoicePicker({
  target,
  value,
  onChange,
}: {
  target: Language;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="voice-picker">
      <label>
        My translated voice in {languages[target]}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {voices[target].map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))}
        </select>
      </label>
      <audio
        aria-label={"Preview voice in " + languages[target]}
        controls
        preload="none"
        src={"/voice-previews/" + value + ".mp3"}
      />
    </div>
  );
}
