"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function HomePage() {
  const [code, setCode] = useState("");
  const router = useRouter();

  const handleSubmit = () => {
    if (code.length === 6) {
      router.push(`/viewer?code=${code}`);
    } else {
      alert("Enter a valid 6-digit code");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-4">
      <div className="max-w-md w-full space-y-8 bg-[#121212] p-8 rounded-lg border border-gray-800">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6">
            <Image
              src="/window.svg"
              width={56}
              height={56}
              alt="Logo"
              className="opacity-80"
            />
          </div>
          <h1 className="text-3xl font-medium mb-2">InterView</h1>
          <p className="text-gray-400 mb-8">
            Monitor interview screens securely
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Enter 6-digit Session Code
            </label>{" "}
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(val) => setCode(val)}
              className="justify-center"
            >
              <InputOTPGroup>
                {[...Array(6)].map((_, i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="bg-[#1A1A1A] border-gray-700 focus:border-gray-500 text-white"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full bg-[#3D5AFE] hover:bg-[#536DFE] text-white"
          >
            Connect
          </Button>

          <p className="text-xs text-center text-gray-500">
            Get the code from the client application
          </p>
        </div>
      </div>
    </main>
  );
}
