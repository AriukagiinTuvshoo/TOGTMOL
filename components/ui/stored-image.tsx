import type { ImgHTMLAttributes } from "react";
/** Local data URLs stay offline and never pass through a remote image optimizer. */
export function StoredImage({
  alt,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- portable private data URLs need native rendering
  return <img loading="lazy" decoding="async" {...props} alt={alt} />;
}
