import Image from "next/image";

export function Brand() {
  return <span className="brand" aria-label="Nexovate">
    <Image src="/images/brand/nexovate-mark.png" alt="" width={32} height={32} className="brand-mark" />
    <Image src="/images/brand/nexovate-logo.png" alt="" width={140} height={32} className="brand-wordmark" />
  </span>;
}
