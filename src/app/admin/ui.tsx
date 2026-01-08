"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminLoginClient() {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) {
        alert("Sai mật khẩu admin");
        return;
      }
      router.push("/admin/gallery");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Input
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="Mật khẩu admin"
        type="password"
      />
      <Button variant="primary" onClick={submit} disabled={loading || !pw}>
        {loading ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
    </div>
  );
}
