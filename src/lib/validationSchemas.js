/**
 * DVAI-019 — Schemi di validazione Zod per i form principali.
 * Centralizza le regole in un unico file importabile da Login, BecomeGuide, TourBuilder.
 */
import { z } from 'zod';

// ─── HELPER ───────────────────────────────────────────────────────────────────
const nonEmptyString = (label) =>
    z.string({ required_error: `${label} è obbligatorio` })
     .trim()
     .min(1, `${label} non può essere vuoto`);

// ─── LOGIN / SIGNUP ───────────────────────────────────────────────────────────
export const LoginSchema = z.object({
    email: z
        .string({ required_error: 'Email obbligatoria' })
        .trim()
        .email('Email non valida'),
    password: z
        .string({ required_error: 'Password obbligatoria' })
        .min(8, 'La password deve avere almeno 8 caratteri')
        .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
        .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
});

export const SignupSchema = LoginSchema.extend({
    fullName: nonEmptyString('Nome completo').min(3, 'Inserisci almeno 3 caratteri'),
    role: z.enum(['tourist', 'guide', 'business'], {
        required_error: 'Seleziona un ruolo',
    }),
    businessName: z.string().trim().optional(),
}).refine(
    (data) => data.role !== 'business' || (data.businessName && data.businessName.length >= 2),
    { message: 'Nome attività obbligatorio per account business', path: ['businessName'] }
);

// ─── BECOME GUIDE APPLICATION ─────────────────────────────────────────────────
export const BecomeGuideSchema = z.object({
    name: nonEmptyString('Nome').min(2, 'Nome troppo corto'),
    surname: nonEmptyString('Cognome').min(2, 'Cognome troppo corto'),
    email: z.string().trim().email('Email non valida'),
    phone: z
        .string()
        .trim()
        .regex(/^[+\d\s\-()]{7,20}$/, 'Numero di telefono non valido')
        .optional()
        .or(z.literal('')),
    city: nonEmptyString('Città').min(2, 'Città troppo corta'),
    experience: z
        .string()
        .trim()
        .min(30, 'Descrivi la tua esperienza in almeno 30 caratteri')
        .max(1000, 'Massimo 1000 caratteri'),
    motivation: z
        .string()
        .trim()
        .min(20, 'Scrivi la tua motivazione in almeno 20 caratteri')
        .max(800, 'Massimo 800 caratteri'),
    languages: z
        .array(z.string())
        .min(1, 'Seleziona almeno una lingua'),
});

// ─── TOUR BUILDER ─────────────────────────────────────────────────────────────
export const TourBuilderSchema = z.object({
    title: nonEmptyString('Titolo tour').min(5, 'Titolo troppo corto').max(100, 'Titolo troppo lungo'),
    description: z
        .string()
        .trim()
        .min(50, 'Descrizione: almeno 50 caratteri')
        .max(2000, 'Descrizione: massimo 2000 caratteri'),
    city: nonEmptyString('Città'),
    price: z
        .number({ invalid_type_error: 'Il prezzo deve essere un numero' })
        .min(0, 'Prezzo non può essere negativo')
        .max(5000, 'Prezzo massimo €5000'),
    duration_minutes: z
        .number({ invalid_type_error: 'Durata deve essere un numero' })
        .min(30, 'Durata minima 30 minuti')
        .max(1440, 'Durata massima 24 ore'),
    max_participants: z
        .number()
        .int()
        .min(1, 'Almeno 1 partecipante')
        .max(100, 'Massimo 100 partecipanti')
        .optional(),
    language: z.string().trim().optional(),
    category: z.string().trim().optional(),
});

// ─── HELPER: parse con errori user-friendly ───────────────────────────────────
/**
 * Valida `data` contro `schema`.
 * @returns {{ ok: true, data } | { ok: false, errors: Record<string, string> }}
 */
export function validateForm(schema, data) {
    const result = schema.safeParse(data);
    if (result.success) {
        return { ok: true, data: result.data };
    }
    const errors = {};
    for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_form';
        if (!errors[key]) errors[key] = issue.message;
    }
    return { ok: false, errors };
}
