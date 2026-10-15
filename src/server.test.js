import request from "supertest";
import { app } from "./server.js";

describe("Server-Side Privacy Upload", () => {
  it("should successfully upload a file and return a CID", async () => {
    const res = await request(app)
      .post("/api/upload")
      .attach("evidence", Buffer.from("test evidence"), "evidence.bin");
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.cid).toBeDefined();
    // Verify it doesn't leak secrets or infrastructure details
    expect(res.body.apiKey).toBeUndefined();
    expect(res.body.secret).toBeUndefined();
  });

  it("should fail gracefully when no file is provided", async () => {
    const res = await request(app).post("/api/upload");
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toBeDefined();
  });

  it("health check should pass", async () => {
    const res = await request(app).get("/api/health");
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual("ok");
  });
});
