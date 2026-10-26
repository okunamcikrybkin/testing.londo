import Image from "next/image";

const serverImages = [
  { file: "ru14 1.png", mobile: true, tablet: true },
  { file: "ru3 1.png", mobile: false, tablet: true },
  { file: "ru19 1.png", mobile: true, tablet: true },
  { file: "ru7 1.png", mobile: false, tablet: false },
  { file: "ru1 10.png", mobile: true, tablet: true },
  { file: "ru11 1.png", mobile: false, tablet: true },
  { file: "ru5 1.png", mobile: false, tablet: false },
  { file: "ru16 1.png", mobile: true, tablet: true },
  { file: "ru2 1.png", mobile: false, tablet: true },
  { file: "ru9 1.png", mobile: false, tablet: false },
  { file: "ru18 1.png", mobile: true, tablet: true },
  { file: "ru6 1.png", mobile: false, tablet: true },
  { file: "ru13 1.png", mobile: true, tablet: true },
  { file: "ru4 1.png", mobile: false, tablet: false },
  { file: "ru17 1.png", mobile: false, tablet: true },
  { file: "ru8 1.png", mobile: true, tablet: true },
  { file: "ru12 1.png", mobile: false, tablet: false },
  { file: "ru15 1.png", mobile: false, tablet: true },
  { file: "ru10 1.png", mobile: true, tablet: false },
] as const;

export function ServerArtwork() {
  return (
    <div className="server-artwork" aria-hidden="true">
      {serverImages.map(({ file, mobile, tablet }, index) => (
        <span
          key={file}
          className={`server-art server-art-${index + 1}${tablet ? "" : " server-art-tablet-hidden"}${mobile ? "" : " server-art-mobile-hidden"}`}
        >
          <Image
            src={`/servers/${encodeURIComponent(file)}`}
            alt=""
            width={200}
            height={200}
            sizes="(max-width: 639px) 72px, (max-width: 1023px) 100px, 140px"
            loading={index === 7 ? "eager" : "lazy"}
            fetchPriority={index === 7 ? "auto" : "low"}
            className="h-full w-full object-contain"
          />
        </span>
      ))}
    </div>
  );
}
