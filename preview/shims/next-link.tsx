import type { AnchorHTMLAttributes } from "react";

// Stand-in for next/link in the static preview: in-app routes stay on the page.
export default function Link({
  href,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href.startsWith("/") ? "#" : href} {...rest} />;
}
