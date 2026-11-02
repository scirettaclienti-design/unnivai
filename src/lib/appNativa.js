// Dentro l'app iOS (Capacitor) niente pagine «Prossimamente»: Apple, linea
// guida 2.1, non vuole funzioni non finite. Sul web restano «in arrivo».
import { Capacitor } from '@capacitor/core';

export function isAppNativa() {
    try {
        return Capacitor.isNativePlatform() === true;
    } catch {
        return false;
    }
}
