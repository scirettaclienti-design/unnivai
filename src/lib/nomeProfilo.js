/**
 * ACCESSO-1 — il nome del profilo si modifica e si salva.
 * Due posti, come alla registrazione: `profiles.first_name` (tabella) e i metadati
 * dell'account (`full_name`, `first_name`), che il saluto legge per primi.
 */
import { NomeProfiloSchema, validateForm } from './validationSchemas';

export async function salvaNomeProfilo(supabase, userId, nomeGrezzo) {
    const v = validateForm(NomeProfiloSchema, { nome: nomeGrezzo });
    if (!v.ok) return { ok: false, errore: v.errors.nome };
    const nome = v.data.nome;

    const { error: errProfilo } = await supabase.from('profiles').update({ first_name: nome }).eq('id', userId);
    if (errProfilo) return { ok: false, errore: 'Non sono riuscito a salvare il nome. Riprova tra poco.' };

    const { error: errAccount } = await supabase.auth.updateUser({ data: { full_name: nome, first_name: nome } });
    if (errAccount) return { ok: false, errore: 'Non sono riuscito a salvare il nome. Riprova tra poco.' };

    return { ok: true, nome };
}
