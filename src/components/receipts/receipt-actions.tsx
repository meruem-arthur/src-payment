"use client";
import { useState } from "react";

/**
 * "View & Download Receipt (PDF)": opens the receipt in a new tab so the
 * student can read it, and also saves a copy to their device.
 */
export function ReceiptActions({ downloadUrl, fileName }: { downloadUrl: string; fileName: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    // Open the tab synchronously, inside the click, so mobile browsers don't
    // treat it as a popup once the fetch below finishes. It is pointed at the
    // real PDF as soon as we have it.
    const viewer = window.open("", "_blank");
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error("Could not load your receipt. Please try again.");
      const blobUrl = URL.createObjectURL(await res.blob());
      if (viewer) viewer.location.href = blobUrl;
      else window.open(blobUrl, "_blank"); // popup blocked outright

      // Also save a copy to the device.
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Give the new tab and the download time to read the file before releasing it.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      viewer?.close();
      setError(err instanceof Error ? err.message : "Could not open your receipt.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={handleClick} disabled={loading} className="portal-btn-primary inline-block">
        {loading ? "Opening…" : "View & Download Receipt (PDF)"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
