"use client";

import { LiteratureDetailPage } from "@/components/Library/LiteratureDetailPage";
import { use } from "react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LiteratureDetailPageRoute(props: PageProps) {
  const params = use(props.params);
  
  return <LiteratureDetailPage itemId={params.id} />;
}