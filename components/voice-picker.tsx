import { languages, type Language } from "../lib/shared";
import { defaultIncomingVoice, supportsVoice, voicesFor } from "../lib/voices";

export function storedVoice(
  room: string,
  person: string,
  target: Language,
  incoming = false,
) {
  try {
    const value = localStorage.getItem(
      [
        incoming ? "sahva-incoming-voice" : "sahva-voice",
        room,
        person,
        target,
      ].join("/"),
    );
    if (supportsVoice(target, value)) return value;
  } catch {
    /* Browser storage may be disabled. */
  }
  return incoming ? defaultIncomingVoice(target) : (voicesFor(target)[0]?.id ?? "");
}

export function rememberVoice(
  room: string,
  person: string,
  target: Language,
  value: string,
  incoming = false,
) {
  try {
    localStorage.setItem(
      [
        incoming ? "sahva-incoming-voice" : "sahva-voice",
        room,
        person,
        target,
      ].join("/"),
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
  incoming = false,
  disabled = false,
}: {
  target: Language;
  value: string;
  onChange: (value: string) => void;
  incoming?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="voice-picker">
      <label>
        {incoming ? "Voice I hear in " : "My translated voice in "}
        {languages[target]}
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {voicesFor(target).map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))}
        </select>
      </label>
      {incoming && voicesFor(target).length === 1 && (
        <small>Shubh is the only available Hindi voice.</small>
      )}
      {incoming && (
        <small>
          Preview {voicesFor(target).find((voice) => voice.id === value)?.name}
        </small>
      )}
      <audio
        aria-label={"Preview voice in " + languages[target]}
        controls
        preload="none"
        src={"/voice-previews/" + value + ".mp3"}
      />
    </div>
  );
}
