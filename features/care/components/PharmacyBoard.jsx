"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PHARMACY_STATUS } from "@/lib/care/constants";
import { useCareAction, CareFeedback, CommandButton } from "@/components/care/ActionControls";
import { normalizePhone } from "./AccountSettings";

function DeliveryReview({ request, prescription }) {
  const [pharmacy, setPharmacy] = useState(request.pharmacy_name || "");
  const [tracking, setTracking] = useState(request.tracking_reference || "");
  const [quantities, setQuantities] = useState({});
  const { run, pending, feedback } = useCareAction();
  const next = { submitted: "reviewing", reviewing: "preparing", preparing: "dispatched", dispatched: "delivered" }[request.status];
  if (!next) return null;
  const items = prescription?.prescription_items || [];
  return <form className="space-y-3 rounded-xl bg-muted/30 p-4" onSubmit={(e) => { e.preventDefault(); run("pharmacy.advance", { id: request.id, status: next, pharmacy_name: pharmacy, tracking_reference: tracking, ...(next === "delivered" ? { items: items.filter((i) => Number(quantities[i.id]) > 0).map((i) => ({ item_id: i.id, quantity_units: Number(quantities[i.id]) })) } : {}) }); }}>
    <label className="block space-y-2 text-sm"><span>نام داروخانهٔ تأمین‌کننده</span><Input value={pharmacy} onChange={(e) => setPharmacy(e.target.value)} maxLength={150} required={["preparing", "dispatched", "delivered"].includes(next)} disabled={pending} /></label>
    <label className="block space-y-2 text-sm"><span>شناسهٔ پیگیری ارسال، اختیاری</span><Input value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={150} disabled={pending} /></label>
    {next === "delivered" && <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold">مقدار واقعاً تحویل‌شده از هر دارو</legend>{items.map((item) => <label key={item.id} className="block space-y-2 text-sm"><span>{item.medication_name}، بر حسب {item.unit_label || "عدد"}</span><Input type="number" inputMode="decimal" min="0" max="1000000" step="0.001" value={quantities[item.id] || ""} placeholder="برای داروی تحویل‌نشده خالی بگذارید" onChange={(e) => setQuantities((old) => ({ ...old, [item.id]: e.target.value }))} disabled={pending} /></label>)}</fieldset>}
    <Button type="submit" loading={pending} disabled={pending}>{PHARMACY_STATUS[next]}</Button><CareFeedback value={feedback} />
    {["submitted", "reviewing", "preparing"].includes(request.status) && <CommandButton action="pharmacy.advance" payload={{ id: request.id, status: "rejected", note: "داروخانه امکان تأمین نداشت." }}>ثبت عدم تأمین</CommandButton>}
  </form>;
}
export default function PharmacyBoard({ data, availablePrescriptions = [] }) {
  const [prescription, setPrescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(data.user.phone || "");
  const [consent, setConsent] = useState(false);
  const { run, pending, feedback } = useCareAction();
  const admin = data.user.role === "admin";
  return <div className="space-y-6">
    {!admin && <form className="space-y-4 rounded-2xl border bg-card p-5" onSubmit={(e) => { e.preventDefault(); run("pharmacy.request", { prescription_id: prescription, address, phone: normalizePhone(phone), consent }, () => { setPrescription(""); setAddress(""); setConsent(false); }); }}><h2 className="font-semibold">درخواست تهیه و ارسال نسخه</h2><p className="text-sm leading-7 text-muted-foreground">درخواست برای هماهنگی با داروخانه ثبت می‌شود. موجودی، هزینه و زمان ارسال پس از بررسی اعلام می‌شود.</p><label className="block space-y-2 text-sm"><span>نسخه</span><select value={prescription} onChange={(e) => setPrescription(e.target.value)} required disabled={pending} className="min-h-11 w-full rounded-xl border bg-card px-3"><option value="">انتخاب نسخه</option>{availablePrescriptions.filter((p) => p.status === "active").map((p) => <option key={p.id} value={p.id}>{p.doctor_profiles?.full_name || "نسخهٔ پزشک"} · {(p.prescription_items || []).map((i) => i.medication_name).join("، ")}</option>)}</select></label><label className="block space-y-2 text-sm"><span>نشانی دقیق تحویل</span><Textarea value={address} onChange={(e) => setAddress(e.target.value)} required minLength={10} maxLength={1200} rows={3} disabled={pending} /></label><label className="block space-y-2 text-sm"><span>شمارهٔ تماس تحویل</span><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" dir="ltr" maxLength={16} required disabled={pending} /></label><label className="flex min-h-11 items-start gap-3 text-sm leading-7"><input type="checkbox" className="mt-1.5 size-4 shrink-0 accent-teal-700" checked={consent} onChange={(e) => setConsent(e.target.checked)} required disabled={pending} /><span>با ارسال اطلاعات همین نسخه، نشانی و شمارهٔ تماس به مسئول هماهنگی و داروخانهٔ تأمین‌کننده موافقم.</span></label><Button type="submit" loading={pending} disabled={pending || !consent}>ثبت درخواست تهیه و ارسال</Button><CareFeedback value={feedback} /></form>}
    <section className="space-y-4"><h2 className="text-lg font-semibold">{admin ? "صف هماهنگی داروخانه و ارسال" : "پیگیری درخواست‌ها"}</h2>{!data.requests.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">درخواستی ثبت نشده است.</p>}{data.requests.map((request) => <article key={request.id} className="space-y-3 rounded-2xl border bg-card p-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{request.pharmacy_name || "درخواست تهیهٔ نسخه"}</h3><span className="rounded-full bg-muted px-3 py-1 text-xs">{PHARMACY_STATUS[request.status]}</span></div><ol className="flex flex-wrap gap-2 text-xs text-muted-foreground">{["submitted", "reviewing", "preparing", "dispatched", "delivered"].map((step) => <li key={step} className={"rounded-lg border px-2 py-2 " + (step === request.status ? "border-primary bg-primary/5 text-primary" : "")} aria-current={step === request.status ? "step" : undefined}>{PHARMACY_STATUS[step]}</li>)}</ol><p className="whitespace-pre-line text-sm leading-7">{request.delivery_address}</p><p dir="ltr" className="text-start text-sm">{request.contact_phone}</p>{request.tracking_reference && <p className="text-sm">پیگیری ارسال: {request.tracking_reference}</p>}{request.review_note && <p className="text-sm text-muted-foreground">{request.review_note}</p>}{admin ? <DeliveryReview request={request} prescription={data.prescriptions.find((p) => p.id === request.prescription_id)} /> : ["submitted", "reviewing"].includes(request.status) && <CommandButton action="pharmacy.cancel" payload={{ id: request.id }}>لغو درخواست</CommandButton>}</article>)}</section>
  </div>;
}
