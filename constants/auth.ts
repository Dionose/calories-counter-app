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
  if (m.includes("email address already in use") || m.includes("email_exists")) {
    return "Another account already uses that email.";
  }
  if (m.includes("same password") || m.includes("should be different")) {
    return "That's already your password. Choose a different one.";
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

/* ===================== CHANGING WHAT YOU SIGN IN WITH =====================
   ⚠️ NEITHER OF THESE EXISTED, and the Profile screens that called for them
   were writing to the profile ROW instead — so "Password updated" appeared on
   screen and the password you actually sign in with never changed.

   The risk there wasn't someone breaking in; it was the FALSE ASSURANCE.
   Somebody who believes they've changed their password after sharing it, or
   after losing a phone, is more exposed than somebody who knows they
   haven't. */

/** Change the password.

    ⚠️ THE CURRENT PASSWORD IS CHECKED FIRST, and that check is the whole
    point. Supabase's updateUser({ password }) does NOT verify anything — it
    changes the password of whoever holds the session. So an unlocked phone
    left on a table is enough for someone to change the password, sign in
    elsewhere, and lock the owner out of their own account.

    Re-authenticating costs one extra field and closes that entirely. It's the
    same thing every bank and every Apple ID prompt does, for the same reason.

    Signing in again also REFRESHES THE SESSION, which is a quiet second
    benefit: a stale token can't fail the update halfway through. */
export async function updatePassword(currentPassword: string, nextPassword: string) {
  const user = await currentUser();
  if (!user?.email) {
    return { error: "You're not signed in. Sign in again and try once more." };
  }

  /* the check. A wrong password comes back as "invalid login credentials",
     which humanize() turns into wording about the email too — so it's replaced
     here with something true for THIS screen: the email isn't in question. */
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (authError) {
    return { error: "That's not your current password." };
  }

  const { error } = await supabase.auth.updateUser({ password: nextPassword });
  return { error: error ? humanize(error.message) : null };
}

/** Start an email change.

    ⚠️ IT DOESN'T TAKE EFFECT HERE. Supabase sends a confirmation link to the
    NEW address, and the change only completes when that link is clicked — so
    this function returning without an error means "we've sent it", never
    "it's done".

    That behaviour is worth keeping rather than working around. A typo in an
    email address would otherwise lock someone out of their own account
    permanently, with no way back in: they can't sign in with the old address
    because it's been replaced, and they can't receive a reset at the new one
    because it doesn't exist.

    Until the link is clicked, THE OLD ADDRESS KEEPS WORKING. The screen has
    to say so, or someone will sign out and find themselves stuck. */
export async function requestEmailChange(nextEmail: string) {
  const { error } = await supabase.auth.updateUser({ email: nextEmail.trim() });
  return { error: error ? humanize(error.message) : null };
}