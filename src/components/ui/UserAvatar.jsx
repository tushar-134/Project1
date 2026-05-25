import { useEffect, useMemo, useState } from "react";
import { resolveMediaUrl } from "../../utils/mediaUrl.js";

export default function UserAvatar({ user, size = "md", className = "" }) {
  const [broken, setBroken] = useState(false);
  const initials = (user?.name || "User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sizeClass = size === "lg"
    ? "h-20 w-20 text-[24px]"
    : size === "sm"
      ? "h-9 w-9 text-[12px]"
      : "h-12 w-12 text-[16px]";

  const imageUrl = useMemo(() => resolveMediaUrl(user?.profilePhotoUrl), [user?.profilePhotoUrl]);

  useEffect(() => {
    setBroken(false);
  }, [imageUrl]);

  if (imageUrl && !broken) {
    return (
      <img
        src={imageUrl}
        alt={user.name || "User profile photo"}
        className={`block shrink-0 rounded-full border border-slate-200 bg-white p-1 object-contain ${sizeClass} ${className}`.trim()}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div className={`grid shrink-0 place-items-center rounded-full bg-[#1e3a8a] font-black text-white ${sizeClass} ${className}`.trim()}>
      {initials}
    </div>
  );
}
