import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LayersPanel } from "./LayersPanel";
import { ScenesPanel } from "./ScenesPanel";

export function LeftSidebar() {
  return (
    <div className="flex w-72 shrink-0 flex-col border-r border-border bg-sidebar">
      <Tabs defaultValue="layers" className="flex h-full flex-col">
        <TabsList className="m-2 grid grid-cols-2">
          <TabsTrigger value="layers" data-testid="tab-layers" className="text-xs">
            Katmanlar
          </TabsTrigger>
          <TabsTrigger value="scenes" data-testid="tab-scenes" className="text-xs">
            Sahneler
          </TabsTrigger>
        </TabsList>
        <TabsContent value="layers" className="m-0 flex-1 overflow-hidden">
          <LayersPanel />
        </TabsContent>
        <TabsContent value="scenes" className="m-0 flex-1 overflow-hidden">
          <ScenesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
