import Image from "next/image";

type Family = "MEMPHIS";

const iconSource: Record<Family, string> = {
  MEMPHIS: "/branding/memphis-server.png",
};

export function FamilyServerIcon({
  family,
  size = "small",
}: {
  family: Family;
  size?: "inline" | "small" | "large";
}) {
  const dimension = size === "large" ? 56 : size === "inline" ? 22 : 32;

  return (
    <span
      className={`family-server-icon family-server-icon-${family.toLowerCase()} family-server-icon-${size}`}
    >
      <Image
        src={iconSource[family]}
        alt={family}
        width={dimension}
        height={dimension}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
