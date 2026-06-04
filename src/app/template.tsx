"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { startMockService } from "@/mocks";
import { queryClient } from "@/api/client";

export default function Template({ children }: { children: React.ReactNode }) {
  const [mswReady, setMswReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      startMockService()
        .then(() => {
          console.log("MSW started successfully");
          setMswReady(true);
        })
        .catch((err) => {
          console.error("Failed to start MSW:", err);
          setMswReady(true);
        });
    } else {
      setMswReady(true);
    }
  }, []);

  if (!mswReady) {
    return <div className="flex-center full-size">Loading...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
    </QueryClientProvider>
  );
}
