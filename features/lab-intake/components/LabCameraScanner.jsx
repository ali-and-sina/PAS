"use client";

import { useEffect, useRef } from "react";

/**
 * Camera-only QR scanner. Loaded on demand by LabIntakeScanner so camera APIs
 * and scanning loop are not part of the initial page interaction bundle.
 */
export default function LabCameraScanner({ onDetected, onError }) {
  const videoRef = useRef(null);

  useEffect(() => {
    let stopped = false;
    let stream = null;
    let timeoutId = null;
    let cancelWait = null;

    async function run() {
      try {
        if (!("BarcodeDetector" in window)) {
          onError("این مرورگر اسکن مستقیم را پشتیبانی نمی‌کند؛ متن کد یا نشانی QR را در کادر زیر وارد کنید.");
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("CAMERA_UNAVAILABLE");
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) return;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (stopped) return;

        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        while (!stopped) {
          const codes = await detector.detect(video);
          if (stopped) break;
          const rawValue = codes.find((item) => item?.rawValue)?.rawValue;
          if (rawValue) {
            onDetected(rawValue);
            break;
          }

          await new Promise((resolve) => {
            cancelWait = resolve;
            timeoutId = window.setTimeout(resolve, 250);
          });
          timeoutId = null;
          cancelWait = null;
        }
      } catch (error) {
        if (!stopped) {
          onError(
            error?.name === "NotAllowedError"
              ? "اجازهٔ دسترسی به دوربین داده نشد."
              : "دوربین در دسترس نیست؛ کد را به‌صورت دستی وارد کنید.",
          );
        }
      } finally {
        if (stream) stream.getTracks().forEach((track) => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      }
    }

    void run();
    return () => {
      stopped = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      cancelWait?.();
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [onDetected, onError]);

  return (
    <div className="mt-4 max-w-lg overflow-hidden rounded-xl border bg-black">
      <video
        ref={videoRef}
        className="aspect-video w-full object-cover"
        muted
        playsInline
        aria-label="نمای دوربین برای خواندن کد QR"
      />
    </div>
  );
}
