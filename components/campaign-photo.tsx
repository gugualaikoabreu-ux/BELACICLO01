import Image from "next/image";

type CampaignPhotoProps = {
  src: string;
  alt: string;
  movement?: "zoom" | "pan";
  priority?: boolean;
};

/** Static campaign photography with a restrained CSS camera move. Keep catalog photos outside this component. */
export function CampaignPhoto({ src, alt, movement = "zoom", priority = false }: CampaignPhotoProps) {
  return <div className={`campaign-photo campaign-photo--${movement}`}>
    <Image
      className={`campaign-photo__image campaign-photo__image--${movement}`}
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 720px) 100vw, 55vw"
      unoptimized
      priority={priority}
    />
  </div>;
}
