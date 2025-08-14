"use client";
import { useState } from "react";

export default function Imagem({ className = "h-14 w-auto", src, alt }) {
  const [hide, setHide] = useState(false);
  if (!src || !alt || hide) return null;
  return <img src={src} alt={alt} className={className} onError={() => setHide(true)} />;
}
