import { describe, it, expect, vi } from 'vitest';
import { LoginSchema, SignupSchema, NuovaPasswordSchema, EmailSchema, validateForm } from '@/lib/validationSchemas';
import { erroreAuthItaliano, ERRORE_AUTH_GENERICO } from '@/lib/erroriAuth';
import { salvaNomeProfilo } from '@/lib/nomeProfilo';

describe('ACCESSO-1 difetto 1 — il login non controlla la complessità', () => {
    it('una password corta e minuscola passa al login (decide Supabase)', () => {
        expect(validateForm(LoginSchema, { email: 'a@b.it', password: 'abc' }).ok).toBe(true);
    });
    it('solo i campi vuoti fermano il login', () => {
        const r = validateForm(LoginSchema, { email: 'a@b.it', password: '' });
        expect(r.ok).toBe(false);
        expect(r.errors.password).toBe('Scrivi la password.');
        expect(validateForm(LoginSchema, { email: '', password: 'x' }).errors.email).toBe('Scrivi la tua email.');
    });
    it('la registrazione invece le pretende', () => {
        const base = { email: 'a@b.it', fullName: 'Mario Rossi', role: 'tourist' };
        expect(validateForm(SignupSchema, { ...base, password: 'abc' }).errors.password).toMatch(/almeno 8/);
        expect(validateForm(SignupSchema, { ...base, password: 'abcdefgh1' }).errors.password).toMatch(/maiuscola/);
        expect(validateForm(SignupSchema, { ...base, password: 'Abcdefgh' }).errors.password).toMatch(/numero/);
        expect(validateForm(SignupSchema, { ...base, password: 'Abcdefg1' }).ok).toBe(true);
    });
});

describe('ACCESSO-1 difetto 2 — cambio password: stesse regole della registrazione', () => {
    it('6 minuscole non bastano più', () => {
        expect(validateForm(NuovaPasswordSchema, { password: 'abcdef' }).ok).toBe(false);
    });
    it('8 caratteri, maiuscola e numero passano', () => {
        expect(validateForm(NuovaPasswordSchema, { password: 'Abcdefg1' }).ok).toBe(true);
    });
});

describe('ACCESSO-1 difetto 3 — errori di Supabase in italiano', () => {
    const casi = [
        [{ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'Email o password non corrette.'],
        [{ message: 'Invalid login credentials' }, 'Email o password non corrette.'],
        [{ code: 'user_already_exists', message: 'User already registered' }, 'Email già registrata. Prova ad accedere.'],
        [{ message: 'User already registered' }, 'Email già registrata. Prova ad accedere.'],
        [{ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }, 'Troppe email inviate. Riprova tra qualche minuto.'],
        [{ message: 'For security purposes, you can only request this after 52 seconds.' }, 'Troppi tentativi. Riprova tra qualche minuto.'],
        [{ code: 'weak_password', message: 'Password should be at least 6 characters' }, 'Password troppo debole. Scegline una più lunga e meno comune.'],
        [{ code: 'same_password', message: 'New password should be different from the old password.' }, 'Scegli una password diversa da quella di prima.'],
        [{ code: 'email_not_confirmed', message: 'Email not confirmed' }, 'Prima conferma l\'email: ti abbiamo scritto un link.'],
        [{ message: 'Failed to fetch' }, 'Connessione assente. Riprova tra poco.'],
        [{ message: 'Auth session missing!' }, 'Il link non è più valido. Richiedine uno nuovo.'],
    ];
    it.each(casi)('%j → frase italiana', (err, frase) => {
        expect(erroreAuthItaliano(err)).toBe(frase);
    });
    it('un errore sconosciuto non esce mai in inglese', () => {
        expect(erroreAuthItaliano({ message: 'Database error saving new user' })).toBe(ERRORE_AUTH_GENERICO);
        expect(erroreAuthItaliano(null)).toBe(ERRORE_AUTH_GENERICO);
    });
});

describe('ACCESSO-1 difetto 4 — email non valida: il messaggio è dell\'app', () => {
    it('lo schema dice cosa non va, in italiano', () => {
        expect(validateForm(LoginSchema, { email: 'mario@', password: 'x' }).errors.email).toBe('Email non valida. Controlla come l\'hai scritta.');
        expect(validateForm(EmailSchema, { email: 'senza chiocciola' }).errors.email).toMatch(/^Email non valida/);
    });
});

describe('ACCESSO-1 difetto 5 — il nome si salva', () => {
    const finto = (esito = {}) => {
        const eq = vi.fn().mockResolvedValue({ error: esito.profilo || null });
        const update = vi.fn(() => ({ eq }));
        const from = vi.fn(() => ({ update }));
        const updateUser = vi.fn().mockResolvedValue({ error: esito.account || null });
        return { sb: { from, auth: { updateUser } }, from, update, eq, updateUser };
    };
    it('scrive profiles.first_name e i metadati dell\'account', async () => {
        const f = finto();
        const r = await salvaNomeProfilo(f.sb, 'u1', '  Mario  ');
        expect(r).toEqual({ ok: true, nome: 'Mario' });
        expect(f.from).toHaveBeenCalledWith('profiles');
        expect(f.update).toHaveBeenCalledWith({ first_name: 'Mario' });
        expect(f.eq).toHaveBeenCalledWith('id', 'u1');
        expect(f.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Mario', first_name: 'Mario' } });
    });
    it('un nome vuoto o troppo corto non arriva al database', async () => {
        const f = finto();
        expect((await salvaNomeProfilo(f.sb, 'u1', '   ')).ok).toBe(false);
        expect((await salvaNomeProfilo(f.sb, 'u1', 'M')).errore).toBe('Inserisci almeno 2 caratteri');
        expect(f.from).not.toHaveBeenCalled();
    });
    it('se il database rifiuta lo dice, in italiano', async () => {
        const f = finto({ profilo: { message: 'permission denied' } });
        const r = await salvaNomeProfilo(f.sb, 'u1', 'Mario');
        expect(r.ok).toBe(false);
        expect(r.errore).toBe('Non sono riuscito a salvare il nome. Riprova tra poco.');
        expect(f.updateUser).not.toHaveBeenCalled();
    });
});
