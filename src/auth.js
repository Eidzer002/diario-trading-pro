/**
 * auth.js — Gestión de autenticación con Supabase
 */
import { supabase } from './lib/supabase.js';

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    // INITIAL_SESSION se maneja por getSession() en el arranque.
    // Aquí solo reaccionamos a cambios reales: login, logout, refresh.
    if (event === 'INITIAL_SESSION') return;
    callback(event, session);
  });
}
