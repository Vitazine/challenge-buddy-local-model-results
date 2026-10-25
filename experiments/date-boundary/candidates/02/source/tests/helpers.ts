import { createHmac } from "node:crypto";

export const token = "test-only-bot-token";
export const now = new Date("2026-10-24T10:00:00Z");
export function signedInitData(
  id = 42,
  authDate = Math.floor(now.getTime() / 1000),
): string {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    user: JSON.stringify({ id, first_name: "Test" }),
  });
  params.sort();
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret)
    .update([...params].map(([key, value]) => `${key}=${value}`).join("\n"))
    .digest("hex");
  params.set("hash", hash);
  return params.toString();
}
export const challengeInput = {
  title: "Читать каждый день",
  startDate: "2026-10-24",
  duration: 7,
  timeZone: "Asia/Manila",
};
