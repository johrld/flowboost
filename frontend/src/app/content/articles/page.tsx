"use client";

import { ContentLibrary } from "@/components/content-library";

export default function ArticlesPage() {
  return <ContentLibrary contentTypeFilter="article" hideChannelTabs />;
}
