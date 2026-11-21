/** The existing LiveKit meeting switch enables Gemini duplex audio for every group room. */
export function interpretedRoom() {
  return process.env.SAHVA_LIVEKIT === "1";
}
export const radioRoom = interpretedRoom;
