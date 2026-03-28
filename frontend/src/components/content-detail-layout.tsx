"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, MessageSquare, ImageIcon } from "lucide-react";

interface ContentDetailLayoutProps {
  /** Full-width header (back button, status, actions) */
  header: React.ReactNode;
  /** Main content area (left column) */
  children: React.ReactNode;
  /** Content for the Metadata sidebar tab */
  metadataPanel: React.ReactNode;
  /** Content for the Media sidebar tab (optional — only shown when provided) */
  mediaPanel?: React.ReactNode;
  /** Content for the AI Chat sidebar tab (placeholder if absent) */
  chatPanel?: React.ReactNode;
  /** Which sidebar tab to show by default */
  defaultSidebarTab?: "metadata" | "media" | "chat";
}

export function ContentDetailLayout({
  header,
  children,
  metadataPanel,
  mediaPanel,
  chatPanel,
  defaultSidebarTab = "metadata",
}: ContentDetailLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b px-6 py-3">
        {header}
      </div>

      {/* Body: two columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>

        {/* Right sidebar with tabs */}
        <div className="w-80 shrink-0 flex flex-col border-l bg-muted/30">
          <Tabs
            defaultValue={defaultSidebarTab}
            className="flex flex-col flex-1 overflow-hidden gap-0"
          >
            <div className="shrink-0 border-b px-4 pt-4 pb-3">
              <TabsList className="w-full">
                <TabsTrigger value="metadata" className="flex-1 gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Metadata
                </TabsTrigger>
                {mediaPanel && (
                  <TabsTrigger value="media" className="flex-1 gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Media
                  </TabsTrigger>
                )}
                <TabsTrigger value="chat" className="flex-1 gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  AI Chat
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="metadata"
              className="flex-1 overflow-y-auto p-6 space-y-6"
            >
              {metadataPanel}
            </TabsContent>

            {mediaPanel && (
              <TabsContent
                value="media"
                className="flex-1 overflow-y-auto p-6 space-y-6"
              >
                {mediaPanel}
              </TabsContent>
            )}

            <TabsContent
              value="chat"
              forceMount
              className="flex-1 overflow-hidden data-[state=inactive]:hidden"
            >
              {chatPanel ?? <ChatPlaceholder />}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function ChatPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <MessageSquare className="h-8 w-8 text-muted-foreground mb-3" />
      <p className="text-sm font-medium">AI Chat</p>
      <p className="text-xs text-muted-foreground mt-1">
        Coming soon for content editing
      </p>
    </div>
  );
}
