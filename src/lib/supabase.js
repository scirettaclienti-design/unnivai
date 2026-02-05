import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create a single instance of the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Helper function to sign up a new user
 * @param {string} email
 * @param {string} password
 * @param {object} userData - additional profile data
 */
export const signUp = async (email, password, userData = {}) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: userData,
        },
    });
    return { data, error };
};

/**
 * Helper function to sign in a user
 * @param {string} email
 * @param {string} password
 */
export const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
};

/**
 * Helper function to sign out
 */
export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
};

/**
 * Helper function to get current session
 */
export const getSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
};
