import Image from "next/image";
import { cn } from "@/lib/utils";

export default function Brand({ compact = false, inverse = false, className }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", inverse && "bg-white ring-1 ring-white/25")}>
        <Image
          src="/brand/pas-logo.png"
          alt=""
          width={44}
          height={44}
          className="size-11 object-contain p-1"
          loading="eager"
        />
      </span>
      <span className="text-start">
        <span className={cn("block text-2xl font-extrabold leading-8", inverse ? "text-white" : "text-foreground")}>پاس</span>
        {!compact && <span className={cn("block text-xs leading-5", inverse ? "text-white" : "text-muted-foreground")}>پلتفرم ارزیابی سلامت</span>}
      </span>
    </span>
  );
}
