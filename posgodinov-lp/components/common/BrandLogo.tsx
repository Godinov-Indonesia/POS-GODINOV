import Image from "next/image";

export interface BrandLogoProps {
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

export function BrandLogo({ width, height, className, priority }: BrandLogoProps) {
  return (
    <>
      <Image
        src="/images/logo-transparent.webp"
        alt="Godinov POS"
        width={width}
        height={height}
        priority={priority}
        className={`hidden dark:block ${className ?? ""}`}
      />
      <Image
        src="/images/logo-transparent-dark.webp"
        alt="Godinov POS"
        width={width}
        height={height}
        priority={priority}
        className={`block dark:hidden ${className ?? ""}`}
      />
    </>
  );
}
