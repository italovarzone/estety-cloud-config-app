"use client";
import { useEffect, useRef, useState } from "react";
import Imagem from "./Imagem";

export default function Header({ authed, username }) {
  return (
    <header className="border-b bg-white">
      <div className="container py-3 flex items-center justify-between">
        <a href="/" className="font-semibold">Config Service</a>
        {authed ? <HamburgerMenu username={username} /> : null}
      </div>
    </header>
  );
}

function HamburgerMenu({ username }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // fecha com ESC e clique fora
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onClick = (e) => {
      if (open && menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        className="p-2 rounded-lg hover:bg-zinc-100"
        aria-label="Abrir menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-zinc-800">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-12 z-50 w-64 rounded-2xl bg-white shadow-lg border border-zinc-100"
        >
          <div className="p-2">
            <div className="flex items-center gap-2 px-3 py-2">
              <Imagem className="h-8 w-auto" src="/logo.png" alt="Estety Cloud" />
              <span className="text-sm text-zinc-700 truncate">{username}</span>
            </div>

            <div className="h-px bg-zinc-100 my-1" />

            <a className="block px-3 py-2 rounded-lg hover:bg-zinc-50" href="/companies" role="menuitem">
              Empresas
            </a>
            <a className="block px-3 py-2 rounded-lg hover:bg-zinc-50" href="/tenants" role="menuitem">
              Tenants
            </a>

            <div className="h-px bg-zinc-100 my-1" />

            <a
              className="block px-3 py-2 rounded-lg hover:bg-zinc-50 text-red-600"
              href="/api/auth/logout"
              role="menuitem"
            >
              Sair
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
