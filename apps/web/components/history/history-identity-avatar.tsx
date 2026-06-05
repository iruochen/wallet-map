"use client";

import { useMemo } from "react";

export function HistoryIdentityAvatar({
  variant,
  seed,
}: {
  variant: "wallet" | "session";
  seed: string;
}) {
  const avatarUrl = useMemo(() => {
    const style = variant === "wallet" ? "glass" : "notionists";
    const params = new URLSearchParams({
      seed,
      radius: "10",
      size: "34",
    });

    return `https://api.dicebear.com/9.x/${style}/svg?${params.toString()}`;
  }, [seed, variant]);

  return (
    <img
      src={avatarUrl}
      alt=""
      className={`historyIdentityAvatar historyIdentityAvatar-${variant}`}
      width={34}
      height={34}
      decoding="async"
    />
  );
}
