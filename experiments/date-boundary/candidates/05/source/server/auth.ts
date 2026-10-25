import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "./errors";

const userSchema = z.object({ id: z.number().int().positive().safe() });
export function validateInitData(
  raw: string,
  token: string,
  now = new Date(),
): string {
  const fail = () =>
    new AppError(
      401,
      "UNAUTHORIZED",
      "Откройте приложение заново через Telegram.",
    );
  if (!raw || raw.length > 8192) throw fail();
  const params = new URLSearchParams(raw);
  if (new Set(params.keys()).size !== [...params.keys()].length) throw fail();
  const hash = params.get("hash") ?? "";
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw fail();
  params.delete("hash");
  params.sort();
  const checkString = [...params]
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) throw fail();
  const authDate = Number(params.get("auth_date"));
  const age = Math.floor(now.getTime() / 1000) - authDate;
  if (!Number.isInteger(authDate) || authDate <= 0 || age < -30 || age > 3600)
    throw fail();
  try {
    const user = userSchema.parse(JSON.parse(params.get("user") ?? "null"));
    return String(user.id);
  } catch {
    throw fail();
  }
}
