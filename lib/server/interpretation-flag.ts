/** The server flag enables interpreted group audio. Operators can optionally restrict a rehearsal to one room. */
export function interpretedRoom(id: string) {
  if (process.env.SAHVA_LIVE_MEDIA_INTERPRETATION !== "1") return false;
  const selected = process.env.SAHVA_LIVE_MEDIA_ROOM_ID;
  return !selected || selected === id;
}
