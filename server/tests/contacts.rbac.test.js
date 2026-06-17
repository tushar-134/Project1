/**
 * RBAC integration tests – Contact Directory
 *
 * Verifies:
 *   - admin/manager can GET /contacts       → 200
 *   - associate    can GET /contacts       → 200  (view-only)
 *   - associate    cannot POST /contacts   → 403
 *   - associate    cannot PUT  /contacts/:id → 403
 *   - associate    cannot DELETE /contacts/:id → 403
 *
 * Uses supertest for HTTP assertions and mocks out auth so we don't need
 * a running Mongo instance. JWT verification is stubbed at the middleware
 * level via jest.mock so the tests stay fast and offline.
 */
"use strict";

const request = require("supertest");

// ── Stub out JWT & DB ──────────────────────────────────────────────────────────
jest.mock("jsonwebtoken", () => ({
  verify: (token) => {
    // Tokens are just JSON-encoded role objects in tests
    return JSON.parse(Buffer.from(token, "base64").toString("utf8"));
  },
  decode: (token) => JSON.parse(Buffer.from(token, "base64").toString("utf8")),
}));

jest.mock("../models/User", () => ({
  findById: (id) => ({
    select: () =>
      Promise.resolve({
        _id: id,
        isActive: true,
        role: id, // we use the role string as the id in tests
        authToken: null,
        save: jest.fn(),
      }),
  }),
}));

jest.mock("../models/Contact", () => {
  const contacts = [{ _id: "c1", authorityName: "Test Auth" }];
  return {
    find: () => ({ populate: () => ({ sort: () => Promise.resolve(contacts) }) }),
    findById: () => Promise.resolve(contacts[0]),
    findByIdAndUpdate: () => Promise.resolve(contacts[0]),
    findOne: () => Promise.resolve(null),
    create: jest.fn().mockResolvedValue({}),
  };
});

// ── Load app after mocks ───────────────────────────────────────────────────────
const app = require("../server");

/** Build a minimal Bearer token encoding the given role */
function tokenFor(role) {
  return "Bearer " + Buffer.from(JSON.stringify({ id: role, exp: 9999999999 })).toString("base64");
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const adminToken     = tokenFor("admin");
const managerToken   = tokenFor("manager");
const associateToken = tokenFor("associate");

describe("GET /api/contacts – contact directory reads", () => {
  it("admin receives 200", async () => {
    const res = await request(app).get("/api/contacts").set("Authorization", adminToken);
    expect(res.status).toBe(200);
  });

  it("manager receives 200", async () => {
    const res = await request(app).get("/api/contacts").set("Authorization", managerToken);
    expect(res.status).toBe(200);
  });

  it("associate receives 200 (view-only access)", async () => {
    const res = await request(app).get("/api/contacts").set("Authorization", associateToken);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/contacts – mutation restricted to admin/manager", () => {
  const body = {
    authorityName: "New Auth",
    contactPersonName: "John",
    mobile: { countryCode: "+971", number: "501234567" },
  };

  it("admin can create a contact", async () => {
    const res = await request(app).post("/api/contacts").set("Authorization", adminToken).send(body);
    // May be 201 or 400 (validation) — both prove the request was not 403 Forbidden
    expect(res.status).not.toBe(403);
  });

  it("associate is forbidden from creating a contact (403)", async () => {
    const res = await request(app).post("/api/contacts").set("Authorization", associateToken).send(body);
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/contacts/:id – mutation restricted to admin/manager", () => {
  it("associate is forbidden from updating a contact (403)", async () => {
    const res = await request(app)
      .put("/api/contacts/c1")
      .set("Authorization", associateToken)
      .send({ authorityName: "Updated" });
    expect(res.status).toBe(403);
  });

  it("admin is allowed to update a contact", async () => {
    const res = await request(app)
      .put("/api/contacts/c1")
      .set("Authorization", adminToken)
      .send({ authorityName: "Updated" });
    expect(res.status).not.toBe(403);
  });
});

describe("DELETE /api/contacts/:id – mutation restricted to admin/manager", () => {
  it("associate is forbidden from deleting a contact (403)", async () => {
    const res = await request(app)
      .delete("/api/contacts/c1")
      .set("Authorization", associateToken);
    expect(res.status).toBe(403);
  });

  it("admin is allowed to delete a contact", async () => {
    const res = await request(app)
      .delete("/api/contacts/c1")
      .set("Authorization", adminToken);
    expect(res.status).not.toBe(403);
  });
});
