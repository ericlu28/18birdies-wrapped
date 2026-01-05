import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "18Birdies Wrapped",
  description: "Wrapped for 18Birdies golf history",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

