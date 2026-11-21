import { Workspace } from "../../../components/workspace";
import { interpretedRoom, radioRoom } from "../../../lib/server/interpretation-flag";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Workspace id={id} liveVoiceAvailable={interpretedRoom()} radio={radioRoom()} />;
}
