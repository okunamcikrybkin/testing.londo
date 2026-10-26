import type { Metadata } from "next";
import Preview from "./preview";

export const metadata: Metadata = {
  title: "LONDO — концепт профиля",
  robots: { index: false, follow: false },
};

export default function Page() { return <Preview />; }
