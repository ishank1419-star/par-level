import type { ObsStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: ObsStatus }) {
  const isOpen = status === "Open";
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 999,
        border: "1px solid #333",
        color: isOpen ? "#ff6b6b" : "#51cf66",
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      {status}
    </span>
  );
}
