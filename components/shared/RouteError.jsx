"use client";

import { useEffect } from "react";

import ErrorState from "@/components/shared/ErrorState";

export default function RouteError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="مشکلی پیش آمد"
      description="در بارگذاری این بخش خطایی رخ داد. لطفاً دوباره تلاش کنید."
      onRetry={reset}
    />
  );
}
