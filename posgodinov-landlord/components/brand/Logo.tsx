import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  variant = "wordmark",
  className,
  priority,
}: {
  variant?: "wordmark" | "icon";
  className?: string;
  priority?: boolean;
}) {
  if (variant === "icon") {
    return (
      <Image
        src="/images/godinov_pos_favicon_app_icon.png"
        alt="POS Godinov"
        width={240}
        height={240}
        priority={priority}
        className={cn("size-8 shrink-0 object-contain", className)}
      />
    );
  }

  return (
    <Image
      src="/images/godinov_pos_primary_logo.png"
      alt="POS Godinov"
      width={1520}
      height={480}
      priority={priority}
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}
