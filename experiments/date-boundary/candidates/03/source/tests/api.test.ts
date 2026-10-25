import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../server/app";
import { challengeInput, now, signedInitData, token } from "./helpers";

test("API: create → mark → reload → undo; other users cannot read or change data", async (t) => {
  const app = await buildApp({
    databasePath: ":memory:",
    botToken: token,
    clock: () => now,
  });
  t.after(() => app.close());
  const headers = { authorization: `tma ${signedInitData()}` };
  const created = await app.inject({
    method: "POST",
    url: "/api/challenges",
    headers,
    payload: challengeInput,
  });
  assert.equal(created.statusCode, 201);
  const id = created.json().id;
  assert.equal(created.json().ownerId, undefined);
  const url = `/api/challenges/${id}/check-ins/today`;
  const marks = await Promise.all([
    app.inject({ method: "PUT", url, headers }),
    app.inject({ method: "PUT", url, headers }),
  ]);
  marks.forEach((mark) => {
    assert.equal(mark.statusCode, 200);
    assert.equal(mark.json().checkIns.length, 1);
  });
  const list = await app.inject({ url: "/api/challenges", headers });
  assert.equal(list.json().items[0].progress, 14);
  assert.equal(list.headers["cache-control"], "no-store");
  assert.equal(list.headers["x-content-type-options"], "nosniff");
  const other = { authorization: `tma ${signedInitData(43)}` };
  assert.equal(
    (await app.inject({ url: `/api/challenges/${id}`, headers: other }))
      .statusCode,
    404,
  );
  assert.equal(
    (await app.inject({ method: "DELETE", url, headers: other })).statusCode,
    404,
  );
  assert.equal(
    (await app.inject({ url: "/api/challenges", headers: other })).json().total,
    0,
  );
  assert.equal(
    (await app.inject({ method: "DELETE", url, headers })).json().progress,
    0,
  );
});
test("API rejects missing credentials, bad data and oversized payloads", async (t) => {
  const app = await buildApp({
    databasePath: ":memory:",
    botToken: token,
    clock: () => now,
  });
  t.after(() => app.close());
  assert.equal((await app.inject("/api/challenges")).statusCode, 401);
  const headers = { authorization: `tma ${signedInitData()}` };
  const bad = await app.inject({
    method: "POST",
    url: "/api/challenges",
    headers,
    payload: { ...challengeInput, title: " " },
  });
  assert.equal(bad.statusCode, 422);
  assert.equal(bad.json().error.code, "VALIDATION_ERROR");
  assert.equal(
    (await app.inject({ url: "/api/challenges?pageSize=500", headers }))
      .statusCode,
    422,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/challenges",
        headers,
        payload: { title: "a".repeat(20_000) },
      })
    ).statusCode,
    413,
  );
});
test("development identity fails closed in production and for cross-origin requests", async (t) => {
  await assert.rejects(
    buildApp({ databasePath: ":memory:", devAuth: true, production: true }),
    /forbidden/,
  );
  await assert.rejects(buildApp({ databasePath: ":memory:" }), /BOT_TOKEN/);
  const app = await buildApp({ databasePath: ":memory:", devAuth: true });
  t.after(() => app.close());
  assert.equal((await app.inject("/api/session")).statusCode, 401);
  assert.equal(
    (
      await app.inject({
        url: "/api/session",
        headers: {
          "x-local-development": "true",
          origin: "https://evil.example",
        },
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/session",
        headers: { "x-local-development": "true" },
      })
    ).statusCode,
    200,
  );
});
