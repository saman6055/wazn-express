import { describe, it, expect } from "vitest";
import { youTubeVideoId } from "./db/tutorials.db";

/**
 * Tutorials store only the YouTube link the admin pasted. The video id is
 * pulled back out of it to build both the embed and the thumbnail, so this
 * parser is what stands between "paste a link" and a working card — and it has
 * to cope with every shape YouTube hands out when you press Share.
 */
describe("youTubeVideoId", () => {
  it("reads the standard watch link", () => {
    expect(youTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("reads a share (youtu.be) link", () => {
    expect(youTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("reads an embed link", () => {
    expect(youTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("reads a Shorts link — how a phone-recorded tutorial is usually shared", () => {
    expect(youTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("reads a live link", () => {
    expect(youTubeVideoId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("survives the tracking junk Share appends", () => {
    expect(youTubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=AbCdEf123")).toBe("dQw4w9WgXcQ");
    expect(youTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLxyz")).toBe("dQw4w9WgXcQ");
  });

  it("finds the id when v= is not the first parameter", () => {
    expect(youTubeVideoId("https://www.youtube.com/watch?list=PLxyz&v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("ignores surrounding whitespace from a paste", () => {
    expect(youTubeVideoId("  https://youtu.be/dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for a link with no video, so the save is rejected up front", () => {
    expect(youTubeVideoId("https://www.youtube.com/")).toBeNull();
    expect(youTubeVideoId("https://www.youtube.com/@waznexpress")).toBeNull();
    expect(youTubeVideoId("https://example.com/video.mp4")).toBeNull();
  });

  it("returns null for nothing at all rather than throwing", () => {
    expect(youTubeVideoId("")).toBeNull();
    expect(youTubeVideoId(null)).toBeNull();
    expect(youTubeVideoId(undefined)).toBeNull();
    expect(youTubeVideoId("   ")).toBeNull();
  });
});
