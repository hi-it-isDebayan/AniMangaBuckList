import { Readable } from "node:stream";
import fs from "node:fs";

export async function openTarGzFromUrl(url: string): Promise<Readable> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  }
  return Readable.fromWeb(res.body as any);
}

export async function extractTarGzMember(
  input: NodeJS.ReadableStream,
  name: string,
): Promise<NodeJS.ReadableStream | null> {
  const { createGunzip } = await import("node:zlib");
  const tar = await import("tar-stream");
  const gunzip = createGunzip();
  const extract = tar.extract();

  return new Promise((resolve, reject) => {
    let resolved = false;

    extract.on("entry", (header: any, stream: NodeJS.ReadableStream, next: () => void) => {
      if (!resolved && (header.name === name || header.name.endsWith("/" + name) || header.name.endsWith(name))) {
        resolved = true;
        // attach close handler for pipeline cleanup
        stream.on("close", () => next());
        stream.on("end", () => next());
        stream.on("error", (e) => next());
        resolve(stream);
        return;
      }
      stream.resume();
      stream.on("end", next);
      stream.on("error", next);
    });

    extract.on("finish", () => {
      if (!resolved) resolve(null);
    });

    extract.on("error", (e) => reject(e));
    gunzip.on("error", (e) => reject(e));

    // pipe
    (input as any).pipe(gunzip).pipe(extract);
  });
}