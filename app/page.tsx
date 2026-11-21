import { Entry } from "../components/entry";
export const dynamic = "force-dynamic";
export default function Home() {
  return (
    <Entry
      offerMeeting={
        !!(
          process.env.SAHVA_LIVEKIT === "1" &&
          process.env.LIVEKIT_URL &&
          process.env.LIVEKIT_API_KEY &&
          process.env.LIVEKIT_API_SECRET
        )
      }
    />
  );
}
