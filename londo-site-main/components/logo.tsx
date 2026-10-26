import Image from "next/image";
import Link from "next/link";

type LogoProps = { className?: string };

export function Logo({ className = "" }: LogoProps) {
  return (
    <Link
      href="/about"
      className={`group flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
      aria-label="LONDO — о сообществе"
    >
      <Image
        src="/branding/londo-logo.png"
        alt=""
        width={1500}
        height={1500}
        sizes="36px"
        className="h-9 w-9 object-contain"
      />
      <span className="max-[420px]:hidden text-[1.05rem] font-black tracking-[0.16em] text-white">
        LONDO
      </span>
    </Link>
  );
}
