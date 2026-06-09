import { useEffect } from "react";
import { Toolbar } from "@/components/Toolbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { Timeline } from "@/components/Timeline";
import { CanvasView } from "@/components/CanvasView";
import { useStore, getActiveScene } from "@/lib/store";
import { createBroadcaster } from "@/lib/broadcast";

export default function Editor() {
  const setWarpEdit = useStore((s) => s.setWarpEditMode);
  const warpEdit = useStore((s) => s.warpEditMode);

  // Broadcast active scene to any open output window.
  // Strategy:
  //  - on every store change → send
  //  - on output 'request' message → send immediately (handshake)
  //  - heartbeat every 1s as a safety net
  useEffect(() => {
    const bc = createBroadcaster();

    const sendCurrent = () => {
      const scene = getActiveScene(useStore.getState());
      if (scene) bc.sendScene(scene);
    };

    const unsub = useStore.subscribe(sendCurrent);
    bc.onRequest(sendCurrent);
    sendCurrent();
    const heartbeat = window.setInterval(sendCurrent, 1000);

    return () => {
      unsub();
      window.clearInterval(heartbeat);
      bc.close();
    };
  }, []);

  // F11 -> projection mode, Tab -> toggle handles.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        window.open(
          `${window.location.origin}${window.location.pathname}#/output`,
          "pmap-output",
          "width=1280,height=720"
        );
      } else if (e.key === "Tab" && !(e.target as HTMLElement)?.matches?.("input,textarea")) {
        e.preventDefault();
        setWarpEdit(!warpEdit);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [warpEdit, setWarpEdit]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <LeftSidebar />
        <div className="flex min-w-0 flex-1 flex-col bg-[#0a0a0c]">
          <CanvasView />
        </div>
        <RightSidebar />
      </div>
      <Timeline />
    </div>
  );
}
