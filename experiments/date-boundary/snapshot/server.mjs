// Keep the VPS systemd entrypoint while loading the existing TypeScript server.
import "tsx/esm";
await import("./server/index.ts");
