import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Preview, type Concept } from "../preview";

export async function generateMetadata({ params }: { params: Promise<{ concept: string }> }): Promise<Metadata> { const names: Record<string,string> = { "private-club": "Private Club", lobby: "Lobby", "street-archive": "Street Archive" }; return { title: `LONDO · ${names[(await params).concept] || "Design preview"}`, robots: { index: false, follow: false } }; }
export function generateStaticParams() { return ["private-club", "lobby", "street-archive"].map(concept => ({ concept })); }
export default async function Page({ params }: { params: Promise<{ concept: string }> }) {
 const { concept } = await params;
 if (!["private-club", "lobby", "street-archive"].includes(concept)) notFound();
 return <Preview concept={concept as Concept}/>;
}
