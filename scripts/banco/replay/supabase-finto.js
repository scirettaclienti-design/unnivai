// C10c-replay — il client Supabase del replay: in memoria, mai in rete. La sessione e' finta (il motore la usa solo per
// l'intestazione delle chiamate ai proxy, che il replay serve dal tracciato); ogni lettura o scrittura sul database
// risponde «niente database» e si segna in `accessi` (nel giro del motore la usano solo il registro degli errori e la cache
// dei fatti, che in replay viene dal tracciato).
export const accessi = [];
const NIENTE = Object.freeze({ data: null, error: { message: 'replay: niente database' } });

const builder = (tabella) => {
    const b = new Proxy({}, {
        get(_, k) {
            if (k === 'then') return (ok, ko) => Promise.resolve(NIENTE).then(ok, ko);
            if (k === 'catch' || k === 'finally') return (f) => Promise.resolve(NIENTE)[k](f);
            return (...args) => { if (['insert', 'upsert', 'update', 'delete'].includes(k)) accessi.push({ tabella, cosa: k }); void args; return b; };
        },
    });
    return b;
};

const sessione = { access_token: 'replay', token_type: 'bearer', user: { id: '00000000-0000-0000-0000-00000000replay', user_metadata: {} } };

export const supabase = {
    auth: {
        getSession: async () => ({ data: { session: sessione }, error: null }),
        getUser: async () => ({ data: { user: sessione.user }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signInWithPassword: async () => ({ data: null, error: { message: 'replay: niente login' } }),
        signOut: async () => ({ error: null }),
    },
    from: (tabella) => { accessi.push({ tabella, cosa: 'from' }); return builder(tabella); },
    rpc: async (nome) => { accessi.push({ tabella: `rpc:${nome}`, cosa: 'rpc' }); return NIENTE; },
    functions: { invoke: async (nome) => { accessi.push({ tabella: `functions:${nome}`, cosa: 'invoke' }); return NIENTE; } },
    channel: () => { const c = { on: () => c, subscribe: () => c, unsubscribe: () => {} }; return c; },
    removeChannel: () => {},
};

export const signUp = async () => ({ data: null, error: NIENTE.error });
export const signIn = async () => ({ data: null, error: NIENTE.error });
export const signOut = async () => ({ error: null });
export const getSession = async () => sessione;
