import { Button } from "@/components/ui/button";

export default function PDFDownloadButton({ href }) {
  if (!href) return null;
  return <Button asChild variant="outline" size="sm"><a href={href} target="_blank" rel="noreferrer">مشاهده فایل گزارش</a></Button>;
}
