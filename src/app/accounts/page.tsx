"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function AccountsRoute() {
  const router = useRouter();
  useEffect(() => { router.replace("/operations?tab=purchases"); }, [router]);
  return <div className="p-8 text-sm font-bold">Opening Purchases…</div>;
}
