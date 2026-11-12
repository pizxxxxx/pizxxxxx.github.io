import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/landing/page";

export const Route = createFileRoute("/")({ component: Landing });
