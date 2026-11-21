import { Entry } from "../components/entry";
export const dynamic = "force-dynamic";
export default function Home() {
  const offerMeeting = !!(
    process.env.SAHVA_LIVEKIT === "1" &&
    process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET
  );
  const interpreted = offerMeeting &&
    process.env.SAHVA_LIVE_MEDIA_INTERPRETATION === "1" &&
    !process.env.SAHVA_LIVE_MEDIA_ROOM_ID;
  return <Entry offerMeeting={offerMeeting} meeting={interpreted} />;
}
