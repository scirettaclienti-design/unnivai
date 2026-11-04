// APP-NATIVA — il progetto iOS: posizione in background col solo «Durante l'uso», plugin locali registrati e nel
// target, icona 1024×1024 senza trasparenza, schermata di avvio. Si legge dai file: Xcode non serve.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const R = process.cwd();
const leggi = (p) => readFileSync(join(R, p), 'utf8');
const IOS = 'ios/App/App';

/** IHDR di un PNG: larghezza, altezza, profondità, tipo di colore (2 = RGB, 6 = RGBA). */
function ihdr(p) {
    const b = readFileSync(join(R, p));
    expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(b.subarray(12, 16).toString('ascii')).toBe('IHDR');
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bit: b[24], colore: b[25] };
}

describe('Info.plist', () => {
    const plist = leggi(`${IOS}/Info.plist`);
    const modi = plist.match(/<key>UIBackgroundModes<\/key>\s*<array>([\s\S]*?)<\/array>/)[1];
    it('UIBackgroundModes: audio e location', () => {
        expect(modi).toContain('<string>audio</string>');
        expect(modi).toContain('<string>location</string>');
    });
    it('solo «Durante l\'uso»: nessuna chiave Always', () => {
        expect(plist).toContain('NSLocationWhenInUseUsageDescription');
        expect(plist).not.toMatch(/NSLocationAlways/);
    });
    it('il testo del permesso dice che la posizione vale anche a schermo bloccato, in voce Unnivai', () => {
        const testo = plist.match(/<key>NSLocationWhenInUseUsageDescription<\/key>\s*<string>([^<]+)<\/string>/)[1];
        expect(testo).toMatch(/schermo bloccato/);
        expect(testo).toMatch(/indicatore blu/);
        expect(testo).not.toMatch(/Benvenut/i);
        expect(testo.length).toBeLessThan(220);
    });
});

describe('plugin locali', () => {
    const swiftPos = leggi(`${IOS}/PosizioneGiroPlugin.swift`);
    const swiftVoce = leggi(`${IOS}/VoceNativaPlugin.swift`);
    const vc = leggi(`${IOS}/UnnivaiViewController.swift`);
    it('i nomi JS dei plugin Swift sono quelli registrati dal client', () => {
        expect(swiftPos).toContain('public let jsName = "PosizioneGiro"');
        expect(swiftVoce).toContain('public let jsName = "VoceNativa"');
        expect(leggi('src/lib/posizioneNativa.js')).toContain("NOME_PLUGIN_POSIZIONE = 'PosizioneGiro'");
        expect(leggi('src/lib/voceNativa.js')).toContain("NOME_PLUGIN_VOCE = 'VoceNativa'");
        for (const m of ['avvia', 'ferma', 'stato']) expect(swiftPos).toContain(`CAPPluginMethod(name: "${m}"`);
        for (const m of ['parla', 'ferma']) expect(swiftVoce).toContain(`CAPPluginMethod(name: "${m}"`);
    });
    it('posizione: background acceso, indicatore blu, mai «Sempre»', () => {
        expect(swiftPos).toMatch(/allowsBackgroundLocationUpdates = true/);
        expect(swiftPos).toMatch(/showsBackgroundLocationIndicator = true/);
        expect(swiftPos).toMatch(/pausesLocationUpdatesAutomatically = false/);
        expect(swiftPos).toMatch(/requestWhenInUseAuthorization\(\)/);
        const codice = swiftPos.split('\n').filter(r => !r.trim().startsWith('//')).join('\n'); // i commenti lo nominano per dire che non c'è
        expect(codice).not.toMatch(/requestAlwaysAuthorization/);
        expect(swiftPos).toMatch(/CLBackgroundActivitySession\(\)/);
        expect(swiftPos).toMatch(/#available\(iOS 17\.0, \*\)/);
    });
    it('il controller registra i due plugin e lo storyboard lo usa', () => {
        expect(vc).toMatch(/class UnnivaiViewController: CAPBridgeViewController/);
        expect(vc).toContain('registerPluginInstance(PosizioneGiroPlugin())');
        expect(vc).toContain('registerPluginInstance(VoceNativaPlugin())');
        const sb = leggi(`${IOS}/Base.lproj/Main.storyboard`);
        expect(sb).toContain('customClass="UnnivaiViewController" customModule="App" customModuleProvider="target"');
        expect(sb).not.toContain('customClass="CAPBridgeViewController"');
    });
    it('i tre file Swift sono nel target App (fase Sources del progetto)', () => {
        const pbx = leggi('ios/App/App.xcodeproj/project.pbxproj');
        const sorgenti = pbx.match(/\/\* Sources \*\/ = \{\s*isa = PBXSourcesBuildPhase;[\s\S]*?files = \(([\s\S]*?)\);/)[1];
        for (const f of ['AppDelegate.swift', 'SceneDelegate.swift', 'PosizioneGiroPlugin.swift', 'VoceNativaPlugin.swift', 'UnnivaiViewController.swift']) {
            expect(sorgenti).toContain(`${f} in Sources`);
            expect(pbx).toMatch(new RegExp(`path = ${f.replace('.', '\\.')}; sourceTree = "<group>"`));
        }
    });
});

describe('icona e schermata di avvio', () => {
    const set = `${IOS}/Assets.xcassets/AppIcon.appiconset`;
    it('Contents.json: una icona universale 1024×1024 che esiste', () => {
        const c = JSON.parse(leggi(`${set}/Contents.json`));
        const img = c.images.find(i => i.size === '1024x1024');
        expect(img).toBeTruthy();
        expect(img.idiom).toBe('universal');
        expect(existsSync(join(R, set, img.filename))).toBe(true);
    });
    it('il PNG dell\'icona è 1024×1024, RGB a 8 bit, senza alfa (Apple rifiuta la trasparenza)', () => {
        const c = JSON.parse(leggi(`${set}/Contents.json`));
        const f = c.images.find(i => i.size === '1024x1024').filename;
        expect(ihdr(`${set}/${f}`)).toEqual({ w: 1024, h: 1024, bit: 8, colore: 2 });
    });
    it('schermata di avvio: i tre PNG 2732×2732 del Contents.json', () => {
        const s = `${IOS}/Assets.xcassets/Splash.imageset`;
        const c = JSON.parse(leggi(`${s}/Contents.json`));
        expect(c.images).toHaveLength(3);
        for (const i of c.images) expect(ihdr(`${s}/${i.filename}`)).toMatchObject({ w: 2732, h: 2732, colore: 2 });
    });
    it('avvio dallo script di APP-NATIVA, icona dal marchio (scripts/brand/genera-icone.mjs): riproducibili', () => {
        const avvio = execFileSync(process.execPath, ['scripts/ios/genera-icona.mjs', '--controlla'], { cwd: R, encoding: 'utf8' });
        expect(avvio).toContain('uguale');
        const icone = execFileSync(process.execPath, ['scripts/brand/genera-icone.mjs', '--controlla'], { cwd: R, encoding: 'utf8' });
        expect(icone).toContain('uguali');
    }, 60_000);
});
