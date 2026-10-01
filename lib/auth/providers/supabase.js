"use client";

import { createClient } from "@/lib/supabase/client";

import {
  requestLoginOtp as requestLoginOtpAction,
  verifyLoginOtp as verifyLoginOtpAction,
} from "@/features/auth/actions";

import {
  loginTestUser as loginTestUserAction,
  logoutTestUser as logoutTestUserAction,
} from "@/features/auth/test-actions";

export const supabaseAuthProvider = {
  requestLoginOtp({ role, identifier, phone }) {
    return requestLoginOtpAction({
      role,
      identifier,
      phone,
    });
  },

  verifyLoginOtp({ role, identifier, phone, code }) {
    return verifyLoginOtpAction({
      role,
      identifier,
      phone,
      code,
    });
  },

  loginTestUser({ identifier, password }) {
    return loginTestUserAction({
      identifier,
      password,
    });
  },

  async signOut() {
    await logoutTestUserAction();

    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  },

  async getSession() {
    const supabase = createClient();

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return session;
  },

  async getCurrentUser() {
    const supabase = createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return user;
  },

  onAuthStateChange(callback) {
    const supabase = createClient();

    const { data } = supabase.auth.onAuthStateChange(callback);

    return () => data.subscription.unsubscribe();
  },
};
