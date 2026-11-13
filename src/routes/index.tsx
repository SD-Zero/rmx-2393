import { createFileRoute } from "@tanstack/react-router";
import { DrawingApp } from "@/components/DrawingApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Glass Canvas — Drawing for iPad" },
      { name: "description", content: "A pressure-sensitive drawing studio for iPad with a liquid glass interface." },
      { property: "og:title", content: "Glass Canvas — Drawing for iPad" },
      { property: "og:description", content: "A pressure-sensitive drawing studio for iPad with a liquid glass interface." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DrawingApp,
});
