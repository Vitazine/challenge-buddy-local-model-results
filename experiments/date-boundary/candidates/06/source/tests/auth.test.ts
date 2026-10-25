import test from "node:test";
import assert from "node:assert/strict";
import { validateInitData } from "../server/auth";
import { now, signedInitData, token } from "./helpers";

test("accepts signed Telegram identity", () =>
  assert.equal(validateInitData(signedInitData(), token, now), "42"));
test("rejects tampering, bad token, malformed hash and duplicate fields", () => {
  assert.throws(() =>
    validateInitData(signedInitData().replace("Test", "Fake"), token, now),
  );
  assert.throws(() => validateInitData(signedInitData(), "wrong-token", now));
  assert.throws(() => validateInitData("hash=nope", token, now));
  assert.throws(() =>
    validateInitData(`${signedInitData()}&auth_date=1`, token, now),
  );
});
test("rejects expired, future and invalid identity", () => {
  const timestamp = Math.floor(now.getTime() / 1000);
  assert.throws(() =>
    validateInitData(signedInitData(42, timestamp - 3601), token, now),
  );
  assert.throws(() =>
    validateInitData(signedInitData(42, timestamp + 60), token, now),
  );
  assert.throws(() => validateInitData(signedInitData(-1), token, now));
});
