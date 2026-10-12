import Image from "next/image";
import mark from "../../../public/images/brand/nexovate-mark.png";
import wordmark from "../../../public/images/brand/nexovate-logo.png";

export function Brand() {
  return <span className="brand" aria-label="Nexovate">
    <Image src={mark} alt="" width={32} height={32} className="brand-mark" />
    <Image src={wordmark} alt="" width={140} height={32} className="brand-wordmark" />
  </span>;
}
