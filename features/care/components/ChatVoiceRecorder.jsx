"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { faNumber } from "@/lib/care/dates";
export default function ChatVoiceRecorder({ onSend, disabled }) {
  const recorder = useRef(null);
  const mounted=useRef(true);
  const stream = useRef(null);
  const timer = useRef(null);
  const clock = useRef(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { mounted.current=true; return () => {
    mounted.current=false;
    clearTimeout(timer.current); clearInterval(clock.current);
    if (recorder.current?.state === "recording") { recorder.current.onstop = null; recorder.current.stop(); }
    stream.current?.getTracks().forEach((t) => t.stop());
  }; }, []);
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    clearTimeout(timer.current); clearInterval(clock.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }
  async function start() {
    setError(""); setBlob(null); setPreview(""); setSeconds(0);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("unsupported");
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if(!mounted.current){media.getTracks().forEach(t=>t.stop());return;}
      stream.current = media;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((v) => MediaRecorder.isTypeSupported(v));
      const instance = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      recorder.current = instance;
      const chunks = [];
      instance.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      instance.onstop = () => {
        const audio = new Blob(chunks, { type: instance.mimeType.split(";")[0] });
        if (audio.size > 2097152 || audio.size === 0) return setError("حجم ویس باید کمتر از دو مگابایت باشد.");
        setBlob(audio);
        setPreview(URL.createObjectURL(audio));
      };
      instance.start();
      setRecording(true);
      clock.current = setInterval(() => setSeconds((s) => Math.min(60, s + 1)), 1000);
      timer.current = setTimeout(stop, 60000);
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError("ضبط صدا در دسترس نیست؛ مجوز میکروفن و مرورگر را بررسی کنید.");
    }
  }
  return <div className="space-y-3 rounded-xl border p-3">
    <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" disabled={disabled && !recording} onClick={recording ? stop : start}>{recording ? "پایان ضبط" : blob ? "ضبط مجدد" : "ضبط پیام صوتی"}</Button><span role="status" className="text-xs text-muted-foreground">{recording ? faNumber(seconds) + " ثانیه از ۶۰ ثانیه" : "حداکثر یک دقیقه"}</span></div>
    {blob && preview && <div className="space-y-2"><audio controls src={preview} className="w-full" aria-label="پیش‌نمایش ویس" /><Button type="button" disabled={disabled} loading={disabled} onClick={() => onSend(blob, () => { setBlob(null); setPreview(""); })}>ارسال ویس</Button></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
