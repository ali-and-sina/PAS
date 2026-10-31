"use client";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth/client";
export default function UnavailableCenter(){return <Button type="button" onClick={async()=>{await auth.signOut();window.location.replace("/login");}}>خروج و بازگشت به ورود</Button>;}
