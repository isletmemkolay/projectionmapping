// getUserMedia camera helper.
import { attachStream } from "./video-source";

export async function createCameraSource(): Promise<HTMLVideoElement> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  return attachStream(stream);
}
