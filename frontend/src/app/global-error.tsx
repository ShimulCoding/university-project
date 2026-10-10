"use client";

import PageError from "./error";
import "./globals.css";

export default function GlobalError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-canvas">
        <PageError {...props} />
      </body>
    </html>
  );
}
