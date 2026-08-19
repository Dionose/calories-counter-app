// constants/auth.ts
// Every conversation with Supabase Auth lives here, so no screen ever calls
// supabase.auth directly. That keeps the error handling in one place and
// means swapping providers later touches one file.
//
// EVERY function returns { error } rather than throwing. Auth fails for
// ordinary reasons — wrong password, email already taken, no signal — and
// those aren't exceptions, they're outcomes the UI has to show.
import { supabase } from "./supabase";

/* Supabase's messages are written for developers. These are the ones a user
   should actually read. Anything unmapped falls through unchanged rather than
   being swallowed — a mystery message beats no message. */
function humanize(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "That email and password don't match. Check both and try again.";
  }
  if (m.includes("user already registered")) {
    return "There's already an account with that email. Try signing in instead.";
  }
  if (m.includes("password should be at least")) {
    return "Your password needs to be at least 6 characters.";
  }
  if (m.includes("unable to validate email")) {
    return "That doesn't look like a valid email address.";
  }
  if (m.includes("email not confirmed")) {
    return "Check your email for a confirmation link before signing in.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Couldn't reach MOTION. Check your connection and try again.";
  }
  return message;
}

/** create an account. Returns the new user's id on success. */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) return { userId: null, error: humanize(error.message) };
  return { userId: data.user?.id ?? null, error: null };
}

/** sign in an existing account */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { userId: null, error: humanize(error.message) };
  return { userId: data.user?.id ?? null, error: null };
}

/** sign out. Clears the stored session, so the next launch lands on sign-in. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error: error ? humanize(error.message) : null };
}

/** send a reset link. Always reports success, even for an unknown email —
    telling someone "no account with that address" hands an attacker a way to
    discover which emails are registered. */
export async function sendReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  return { error: error ? humanize(error.message) : null };
}

/** who's signed in right now, if anyone. Reads the session AsyncStorage kept
    from last launch — this is what lets the app skip sign-in on reopen. */
export async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}