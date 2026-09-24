"use client";

import { createClient } from "@/lib/supabase/client";
import {
  requestLoginOtp as requestLoginOtpAction,
  verifyLoginOtp as verifyLoginOtpAction,
} from "@/features/auth/actions";

/**
 * Auth provider backed by Supabase.
 * UI code talks to this only through `auth` from "@/lib/auth/client".
 *
 * OTP request / verification run as Server Actions (features/auth/actions.js)
 * so the session cookie is set on the server and no secret reaches the client.
 */
export const supabaseAuthProvider = {
  /** → { ok: true } | { ok: false, code } */
  requestLoginOtp({ role, identifier, phone }) {
    return requestLoginOtpAction({ role, identifier, phone });
  },

  /** → { ok: true, redirectTo, isNewUser? } | { ok: false, code } */
  verifyLoginOtp({ role, identifier, phone, code }) {
    return verifyLoginOtpAction({ role, identifier, phone, code });
  },

  async signOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /** Presentation only. Never use the result for authorization. */
  async getSession() {
    const supabase = createClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  /** Presentation only. Never use the result for authorization. */
  async getCurrentUser() {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  onAuthStateChange(callback) {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(callback);
    return () => data.subscription.unsubscribe();
  },
};
