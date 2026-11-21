import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { database, dataDir, local, type Query } from "./db.ts";
import { consentVersion, type Member, type Room } from "../shared.ts";

export class Problem extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const lang = z.enum(["en-IN", "te-IN"]);
const profile = z.object({
  name: z.string().trim().min(1).max(60),
  listeningLanguage: lang,
  speakingLanguage: lang,
  acceptedConsent: z.literal(true),
  consentVersion: z.literal(consentVersion),
});
const hash = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");
async function sessionKey() {
  const key = process.env.SAHVA_SESSION_SIGNING_KEY;
  if (key && Buffer.byteLength(key) >= 32) return key;
  if (!local())
    throw new Problem(503, "CONFIG", "Room signing is unavailable.");
  await mkdir(dataDir(), { recursive: true });
  const path = join(dataDir(), "session-key");
  try {
    await writeFile(path, randomBytes(48).toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  return readFile(path, "utf8");
}
async function sign(room: string, participant: string, expiry: number) {
  const payload = [room, participant, expiry].join(".");
  const mac = createHmac("sha256", await sessionKey())
    .update(payload)
    .digest("base64url");
  return payload + "." + mac;
}
export async function authenticate(room: string, token?: string) {
  const [bound, participant, expiry] = token?.split(".") ?? [];
  if (
    !z.uuid().safeParse(room).success ||
    bound !== room ||
    !z.uuid().safeParse(participant).success ||
    !(Number(expiry) > Date.now())
  ) {
    throw new Problem(401, "SESSION", "Join this room to continue.");
  }
  const expected = Buffer.from(await sign(room, participant, Number(expiry)));
  const supplied = Buffer.from(token!);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new Problem(401, "SESSION", "Invalid room session.");
  return participant;
}
export async function roomState(
  q: Query,
  id: string,
  participant: string,
  lock = false,
) {
  const [room] = await q<Room>(
    "select id,title,status,created_at,ended_at,expires_at from sahva.rooms where id=$1 and expires_at>now()" +
      (lock ? " for update" : ""),
    [id],
  );
  const members = await q<Member>(
    "select id,name,seat,listening,speaking,consented_at,last_seen,(recording_until>now()) is true as recording from sahva.participants where room_id=$1 order by seat",
    [id],
  );
  const me = members.find((m) => m.id === participant);
  if (!room || !me)
    throw new Problem(404, "ROOM", "Room unavailable or expired.");
  return {
    room,
    members,
    me,
    canRecord:
      room.status === "active" &&
      members.length === 2 &&
      members.every((m) => m.consented_at !== null),
  };
}
export async function enter(input: unknown, existing?: string) {
  const form = profile
    .extend({
      title: z.string().trim().min(1).max(80).default("Conversation"),
      invite: z.string().max(96).optional(),
    })
    .parse(input);
  const db = await database();
  const id = existing ?? randomUUID(),
    member = randomUUID(),
    invite = randomBytes(32).toString("base64url");
  const token = await sign(id, member, Date.now() + 86_400_000);
  await db.transaction(async (q) => {
    if (existing) {
      const [room] = await q(
        "select id,status from sahva.rooms where id=$1 and invite_hash=$2 and expires_at>now() for update",
        [id, hash(form.invite ?? "")],
      );
      if (!room)
        throw new Problem(
          404,
          "INVITE",
          "This invitation is invalid or expired.",
        );
      if (
        room.status !== "active" ||
        (
          await q(
            "select id from sahva.participants where room_id=$1 and seat=2",
            [id],
          )
        ).length
      )
        throw new Problem(409, "CLOSED", "This room is full or has ended.");
    } else {
      await q("lock table sahva.rooms in share row exclusive mode");
      const [{ count }] = await q(
        "select count(*)::int as count from sahva.rooms where expires_at>now()",
      );
      if (Number(count) >= 100)
        throw new Problem(429, "LIMIT", "All demo rooms are in use.");
      await q(
        "insert into sahva.rooms(id,title,invite_hash) values($1,$2,$3)",
        [id, form.title, hash(invite)],
      );
    }
    await q(
      "insert into sahva.participants(id,room_id,seat,name,listening,speaking,consented_at,consent_version) values($1,$2,$3,$4,$5,$6,now(),$7)",
      [
        member,
        id,
        existing ? 2 : 1,
        form.name,
        form.listeningLanguage,
        form.speakingLanguage,
        form.consentVersion,
      ],
    );
  });
  return { id, token, invite: existing ? undefined : invite };
}
