import { z } from "zod";
import { database } from "./db.ts";
import { roomState, Problem } from "./rooms.ts";
export async function setRecording(
  room: string,
  person: string,
  input: unknown,
) {
  const { recording, key } = z
    .object({ recording: z.boolean(), key: z.uuid() })
    .parse(input);
  const db = await database();
  return db.transaction(async (q) => {
    const state = await roomState(q, room, person, true);
    if (!recording) {
      await q(
        "update sahva.participants set recording_until=null,recording_key=null where id=$1 and room_id=$2 and recording_key=$3",
        [person, room, key],
      );
      return state;
    }
    if (!state.canRecord)
      throw new Problem(
        403,
        "CONSENT",
        "Recording requires two consenting participants.",
      );
    const occupied = await q(
      "select id from sahva.participants where room_id=$1 and recording_until>now() and recording_key is distinct from $2",
      [room, key],
    );
    if (occupied.length)
      throw new Problem(
        409,
        "MIC_BUSY",
        "Another turn is being recorded. Wait for it to finish.",
      );
    await q(
      "update sahva.participants set recording_until=now()+interval '30 seconds',recording_key=$2 where id=$1",
      [person, key],
    );
    return state;
  });
}
