import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF8F5] text-zinc-900 p-4 font-sans text-center">
      <div className="p-8 border-3 border-black bg-[#FFC300] shadow-[6px_6px_0px_0px_#000000] text-center max-w-sm space-y-4">
        <h2 className="text-sm font-black uppercase text-black tracking-wider font-mono">
          404 - Register Not Found
        </h2>
        <p className="text-[10px] text-zinc-700 font-mono font-bold uppercase leading-normal">
          The requested system route or localized storage register does not exist.
        </p>
        <div className="pt-2 border-t border-dashed border-black/30">
          <Link
            href="/dashboard"
            className="block w-full py-2.5 bg-black text-[#FFC300] hover:bg-zinc-800 border-2 border-black text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          >
            ⚡ Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
