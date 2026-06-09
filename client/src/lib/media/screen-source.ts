// getDisplayMedia screen capture helper.
import { attachStream } from "./video-source";

export async function createScreenSource(): Promise<HTMLVideoElement> {
  // @ts-ignore older TS libdom typing
  const stream: MediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  return attachStream(stream);
}
