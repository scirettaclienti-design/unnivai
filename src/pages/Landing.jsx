
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, Globe, Compass, Users, MapPin, Star, Play, X, ChevronRight, ChevronLeft, Search, Brain, MessageCircle, CheckCircle, Clock, Navigation, Sparkles, Wifi, Battery, Signal } from 'lucide-react';
import { supabase } from '../lib/supabase';

const CITIES = ['Roma', 'Venezia', 'Firenze', 'Napoli', 'Milano'];

const stagger = {
    container: { hidden: {}, show: { transition: { staggerChildren: 0.12 } } },
    item: { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] } } }
};

/* ─────────────────────────────────────────────
   PHONE SHELL — shared realistic wrapper
───────────────────────────────────────────── */
// Gate FF.1 — PhoneShell responsive. Prima w/h fissi 260/520 uscivano
// sotto la fold su iPhone 390x844 nel modal HowItWorks (l'utente vedeva
// mezzo mockup tagliato). Ora tre step: 190x380 mobile (~73% originale,
// resta visibile "quasi completo" come vuole Ivano) → 220x440 sm → 260x520
// md/lg. Le proporzioni interne (Dynamic Island, radius, side buttons)
// restano identiche perche' usano solo classi rem/tailwind non pixel fissi.
const PhoneShell = ({ children, accent = 'var(--brand-orange)', time = '9:41' }) => (
    <div className="relative w-[190px] h-[380px] sm:w-[220px] sm:h-[440px] md:w-[260px] md:h-[520px] flex-shrink-0">
        {/* Outer glow */}
        <div className="absolute inset-0 rounded-[44px] blur-3xl opacity-30" style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)`, transform: 'scale(1.1)' }} />
        {/* Phone body */}
        <div className="relative w-full h-full bg-obsidian-bg rounded-[44px] border border-obsidian-border shadow-2xl overflow-hidden">
            {/* Top shine */}
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-obsidian-border to-transparent" />
            {/* Dynamic Island */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-7 bg-obsidian-bg rounded-full z-20 flex items-center justify-center gap-2 border border-obsidian-border">
                <div className="w-2 h-2 bg-obsidian-bg rounded-full border border-obsidian-border" />
                <div className="w-3 h-3 rounded-full" style={{ background: accent }} />
            </div>
            {/* Status bar */}
            <div className="absolute top-0 left-0 right-0 h-14 flex items-end justify-between px-5 pb-1.5 z-10">
                <span className="text-obsidian-secondary text-[11px] font-bold">{time}</span>
                <div className="flex items-center gap-1.5">
                    <Signal className="w-3 h-3 text-obsidian-secondary" />
                    <Wifi className="w-3 h-3 text-obsidian-secondary" />
                    <Battery className="w-3.5 h-3.5 text-obsidian-secondary" />
                </div>
            </div>
            {/* Content area */}
            <div className="absolute inset-0 pt-14 pb-2">{children}</div>
        </div>
        {/* Side buttons */}
        <div className="absolute right-0 top-24 w-1 h-10 bg-obsidian-border rounded-l-full" />
        <div className="absolute left-0 top-20 w-1 h-7 bg-obsidian-border rounded-r-full" />
        <div className="absolute left-0 top-30 w-1 h-7 bg-obsidian-border rounded-r-full" />
    </div>
);

/* ─────────────────────────────────────────────
   STEP 1 — Città & Mappa
───────────────────────────────────────────── */
const Step1Phone = ({ active }) => {
    const pins = [
        { top: '22%', left: '38%', delay: 0.9, emoji: '🏛️', label: 'Colosseo', size: 'lg' },
        { top: '50%', left: '22%', delay: 1.2, emoji: '🍝', label: 'Trattoria', size: 'sm' },
        { top: '35%', left: '62%', delay: 1.5, emoji: '🎨', label: 'Galleria', size: 'sm' },
        { top: '65%', left: '52%', delay: 1.8, emoji: '🌅', label: 'Belvedere', size: 'sm' },
        { top: '45%', left: '80%', delay: 2.1, emoji: '☕', label: 'Bar', size: 'sm' },
    ];
    return (
        <div className="flex flex-col h-full">
            {/* Search */}
            <div className="px-3 pt-1 pb-2.5 bg-obsidian-bg">
                <motion.div initial={{ opacity: 0, y: -8 }} animate={active ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.3 }}
                    className="bg-obsidian-card rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 border border-obsidian-border backdrop-blur">
                    <div className="w-6 h-6 rounded-lg bg-terracotta-500 flex items-center justify-center flex-shrink-0">
                        <Search className="w-3 h-3 text-obsidian-bg" />
                    </div>
                    <div className="flex items-center flex-1">
                        <motion.span initial={{ width: 0 }} animate={active ? { width: 'auto' } : {}} transition={{ delay: 0.7, duration: 0.9 }}
                            className="text-obsidian-primary text-[13px] font-semibold overflow-hidden whitespace-nowrap">La tua città</motion.span>
                        <motion.div animate={active ? { opacity: [1, 0, 1] } : {}} transition={{ repeat: Infinity, duration: 0.9 }}
                            className="w-0.5 h-3.5 bg-terracotta-400 ml-0.5 rounded-full" />
                    </div>
                    <motion.div animate={active ? { scale: [1, 1.3, 1] } : {}} transition={{ repeat: Infinity, duration: 2, delay: 1.5 }}
                        className="w-2 h-2 bg-terracotta-400 rounded-full" />
                </motion.div>
            </div>
            {/* Map */}
            <div className="flex-1 relative overflow-hidden bg-obsidian-card">
                {/* SVG roads */}
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 260 350">
                    <path d="M0 120 Q80 100 130 140 Q180 180 260 160" stroke="currentColor" className="text-obsidian-secondary" strokeWidth="3" fill="none" />
                    <path d="M60 0 Q70 100 80 200 Q90 300 100 350" stroke="currentColor" className="text-obsidian-secondary" strokeWidth="2" fill="none" />
                    <path d="M0 200 Q100 190 200 210 Q240 215 260 220" stroke="currentColor" className="text-obsidian-secondary" strokeWidth="2" fill="none" />
                    <path d="M140 0 Q150 80 160 160 Q170 240 180 350" stroke="currentColor" className="text-obsidian-secondary" strokeWidth="1.5" fill="none" />
                </svg>
                {/* Pins */}
                {pins.map((pin, i) => (
                    <motion.div key={i} initial={{ scale: 0, opacity: 0, y: -20 }} animate={active ? { scale: 1, opacity: 1, y: 0 } : {}}
                        transition={{ delay: pin.delay, type: 'spring', stiffness: 400, damping: 15 }}
                        className="absolute flex flex-col items-center" style={{ top: pin.top, left: pin.left, transform: 'translate(-50%,-50%)' }}>
                        <motion.div animate={active ? { y: [0, -4, 0] } : {}} transition={{ repeat: Infinity, duration: 2.5, delay: i * 0.3 }}
                            className={`${pin.size === 'lg' ? 'w-12 h-12 text-xl' : 'w-8 h-8 text-sm'} bg-ivory-bg border border-obsidian-border rounded-2xl shadow-xl flex items-center justify-center`}>
                            {pin.emoji}
                        </motion.div>
                        {pin.size === 'lg' && (
                            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={active ? { opacity: 1, scale: 1 } : {}} transition={{ delay: pin.delay + 0.3 }}
                                className="mt-1 bg-terracotta-500 text-obsidian-bg text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-lg">
                                {pin.label}
                            </motion.div>
                        )}
                    </motion.div>
                ))}
                {/* User dot */}
                <motion.div initial={{ scale: 0 }} animate={active ? { scale: 1 } : {}} transition={{ delay: 0.5, type: 'spring' }}
                    className="absolute top-[55%] left-[45%] -translate-x-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 bg-terracotta-500 rounded-full border-2 border-ivory-bg shadow-lg" />
                    <motion.div animate={{ scale: [1, 3, 1], opacity: [0.6, 0, 0.6] }} transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 bg-terracotta-400 rounded-full" />
                </motion.div>
            </div>
            {/* Bottom pill */}
            <motion.div initial={{ y: 30, opacity: 0 }} animate={active ? { y: 0, opacity: 1 } : {}} transition={{ delay: 2.3 }}
                className="mx-3 mb-2 bg-obsidian-card backdrop-blur rounded-2xl px-3 py-2.5 border border-obsidian-border flex items-center gap-2.5">
                <div className="w-8 h-8 bg-terracotta-500 text-obsidian-bg rounded-xl flex items-center justify-center flex-shrink-0 text-base">🏛️</div>
                <div>
                    <p className="text-obsidian-primary text-[11px] font-bold">Esperienze trovate</p>
                    <p className="text-terracotta-400 text-[9px]">Nel centro della città</p>
                </div>
                <div className="ml-auto w-6 h-6 bg-terracotta-500 text-obsidian-bg rounded-full flex items-center justify-center">
                    <ChevronRight className="w-3 h-3 text-obsidian-bg" />
                </div>
            </motion.div>
        </div>
    );
};

// ─────────────────────────────────────────────
// STEP 2 — AI Itinerary (mock ASTRATTO Gate EE)
// Prima: nomi POI veri ("Bar San Calisto", "Da Enzo al 29") + prezzi
// hardcoded in euro + citta' hardcoded nell'header. Ivano: mai nomi
// inventati che sembrano veri, mai prezzi finti, mai una citta' hardcoded.
// Ora: dichiaratamente astratto — Tappa 1/2/3 con categoria + orario
// (fatti generici sull'idea di itinerario), zero nomi POI, zero prezzi.
// ─────────────────────────────────────────────
const Step2Phone = ({ active }) => {
    const stops = [
        { time: '09:00', emoji: '☕', title: 'Tappa 1', cat: 'colazione' },
        { time: '10:30', emoji: '🏛️', title: 'Tappa 2', cat: 'cultura' },
        { time: '13:00', emoji: '🍝', title: 'Tappa 3', cat: 'pranzo' },
        { time: '15:30', emoji: '🎨', title: 'Tappa 4', cat: 'arte' },
        { time: '18:00', emoji: '🌅', title: 'Tappa 5', cat: 'panorama' },
    ];
    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-3 pt-1 pb-2 bg-obsidian-bg">
                <motion.div initial={{ opacity: 0 }} animate={active ? { opacity: 1 } : {}} transition={{ delay: 0.4 }}
                    className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-ochre-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                        <Brain className="w-4 h-4 text-obsidian-bg" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-ochre-400 text-[11px] font-bold">AI DoveVai</span>
                            {active && (
                                <motion.div className="flex gap-0.5 items-center">
                                    {[0, 1, 2].map(i => (
                                        <motion.div key={i} animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.15 }}
                                            className="w-1 h-1 bg-ochre-400 rounded-full" />
                                    ))}
                                </motion.div>
                            )}
                        </div>
                        <p className="text-obsidian-secondary text-[9px]">Esempio di itinerario</p>
                    </div>
                    <motion.div initial={{ scale: 0 }} animate={active ? { scale: 1 } : {}} transition={{ delay: 2.2, type: 'spring' }}
                        className="bg-ochre-500/20 text-ochre-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-ochre-500/30">
                        ✓ Pronto
                    </motion.div>
                </motion.div>
                {/* Progress bar */}
                <div className="mt-2 bg-obsidian-raised rounded-full h-1 overflow-hidden">
                    <motion.div initial={{ width: '0%' }} animate={active ? { width: '100%' } : {}} transition={{ delay: 0.6, duration: 1.5, ease: 'easeOut' }}
                        className="h-full bg-ochre-500 rounded-full" />
                </div>
            </div>
            {/* Stops list */}
            <div className="flex-1 overflow-hidden px-2.5 py-1 space-y-1.5 bg-obsidian-card">
                {stops.map((stop, i) => (
                    <motion.div key={i} initial={{ x: 50, opacity: 0 }} animate={active ? { x: 0, opacity: 1 } : {}}
                        transition={{ delay: 0.8 + i * 0.25, type: 'spring', stiffness: 200 }}
                        className="flex items-center gap-2 bg-obsidian-raised border border-obsidian-border rounded-2xl px-2.5 py-2 overflow-hidden relative">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-ochre-500 rounded-r" />
                        <span className="text-lg flex-shrink-0">{stop.emoji}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-ochre-400 text-[9px] font-black">{stop.time}</span>
                                <span className="text-[8px] bg-ochre-500/15 text-ochre-400 px-1.5 rounded-full border border-ochre-500/20">{stop.cat}</span>
                            </div>
                            <p className="text-obsidian-primary text-[11px] font-semibold truncate">{stop.title}</p>
                        </div>
                        {/* Gate EE: rimosso stop.price (prezzi euro/Gratis) — prezzi fake. */}
                    </motion.div>
                ))}
            </div>
            {/* Bottom action */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={active ? { opacity: 1, y: 0 } : {}} transition={{ delay: 2.2 }}
                className="mx-2.5 mb-2 bg-ochre-500 rounded-2xl py-2.5 flex items-center justify-center gap-2 shadow-lg">
                <Sparkles className="w-3.5 h-3.5 text-obsidian-bg" />
                <span className="text-obsidian-bg text-[12px] font-bold">Salva Itinerario</span>
            </motion.div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Gate EE — Step3Phone (Chat Guida) e Step4Phone (Live Tour Navigation)
// ELIMINATI. Erano mock di funzioni V2/V3 con persona inventata (nome
// finto + foto stock + contatore tour + prezzi euro + chat finta) e
// feature V2/V3 (live nav, live stories) che non esistono in V1.
// Ivano: zero mock di UI futura, zero persone inventate. Se serve
// accennare al futuro, UNA riga di testo linkata a /prossimamente/guide
// (in fondo alla landing).
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// STEP DEFINITIONS — Gate EE riscrittura V1 onesta
// Da 4 step a 3. Copy vero: parla solo di cio' che V1 fa.
// Zero claim su guide certificate, feature V2/V3 live, prezzi promessi,
// chat con la persona guida, copertura fisica ("in tutta Italia").
// ─────────────────────────────────────────────
const STEPS = [
    {
        id: 0, label: '01', tag: 'Scoperta',
        title: 'Scegli la tua città',
        desc: 'Scegli dove sei o dove vai. La mappa mostra subito luoghi veri con coordinate vere e orari veri, in qualunque città scegli.',
        gradient: 'from-terracotta-500 via-terracotta-400 to-ochre-500',
        glow: 'rgba(234,88,12,0.3)',
        meshColor: 'var(--terracotta-500)',
        accent: 'var(--terracotta-400)',
        Phone: Step1Phone,
    },
    {
        id: 1, label: '02', tag: 'Pianificazione',
        title: "L'AI costruisce il tuo percorso",
        desc: "In pochi secondi un itinerario su misura per te, sui tuoi interessi. Zero elenchi sponsorizzati travestiti da consigli, zero prezzi finti.",
        gradient: 'from-ochre-500 via-ochre-400 to-ochre-500',
        glow: 'rgba(217,119,6,0.3)',
        meshColor: 'var(--ochre-500)',
        accent: 'var(--ochre-400)',
        Phone: Step2Phone,
    },
    {
        id: 2, label: '03', tag: 'Esperienza',
        title: 'Vivi il percorso',
        desc: 'Mappa reale, coordinate reali. Ogni luogo nella sua vera posizione — nessun marker inventato, nessun elenco che paga per apparire.',
        gradient: 'from-brand-orange via-ochre-500 to-terracotta-500',
        glow: 'rgba(249,115,22,0.3)',
        meshColor: 'var(--brand-orange)',
        accent: 'var(--brand-orange)',
        Phone: Step1Phone,  // Riusa Step1Phone (mappa reale) per il terzo step "vivi il percorso"
    },
];

const AUTO_ADVANCE_SECONDS = 7;

/* ─────────────────────────────────────────────
   HOW IT WORKS MODAL
───────────────────────────────────────────── */
const HowItWorksModal = ({ onClose }) => {
    const [step, setStep] = useState(0);
    const [phoneKey, setPhoneKey] = useState(0);
    const [progress, setProgress] = useState(0);
    const timerRef = useRef(null);
    const current = STEPS[step];

    const goTo = useCallback((idx) => {
        setStep(idx);
        setPhoneKey(k => k + 1);
        setProgress(0);
    }, []);

    // Auto-advance with progress bar
    useEffect(() => {
        setProgress(0);
        let elapsed = 0;
        const INTERVAL = 80;
        timerRef.current = setInterval(() => {
            elapsed += INTERVAL;
            setProgress(elapsed / (AUTO_ADVANCE_SECONDS * 1000) * 100);
            if (elapsed >= AUTO_ADVANCE_SECONDS * 1000) {
                if (step < STEPS.length - 1) {
                    goTo(step + 1);
                } else {
                    clearInterval(timerRef.current);
                    setProgress(100);
                }
            }
        }, INTERVAL);
        return () => clearInterval(timerRef.current);
    }, [step, goTo]);

    const pauseTimer = () => clearInterval(timerRef.current);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center">
            {/* Blurred backdrop */}
            <motion.div className="absolute inset-0 bg-obsidian-bg/70 backdrop-blur-2xl" onClick={onClose} />

            {/* Modal container — full screen feel */}
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 250, damping: 28 }}
                // Gate FF.1 — h-svh (small viewport height) su mobile gestisce
                // correttamente Safari iPhone che ridimensiona il viewport quando
                // appare la toolbar. overflow-y-auto (non scroll) evita la barra
                // sempre visibile.
                className="relative z-10 w-full h-svh md:h-auto md:max-h-[92vh] md:max-w-5xl md:rounded-3xl overflow-y-auto flex flex-col bg-obsidian-bg"
                style={{ WebkitOverflowScrolling: 'touch' }}
                onMouseEnter={pauseTimer}
                onMouseLeave={() => goTo(step)} // restart timer on mouse leave
            >
                {/* Animated mesh background per step */}
                <AnimatePresence mode="wait">
                    <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20"
                            style={{ background: current.meshColor }} />
                        <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full blur-[100px] opacity-15"
                            style={{ background: current.accent }} />
                    </motion.div>
                </AnimatePresence>

                {/* Top bar — Gate FF.1: padding compresso mobile */}
                <div className="relative z-10 flex items-center justify-between px-4 md:px-6 pt-4 md:pt-5 pb-3 md:pb-4 border-b border-obsidian-border flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-orange rounded-xl flex items-center justify-center shadow-lg">
                            <Compass className="w-4 h-4 text-obsidian-bg" />
                        </div>
                        <div>
                            <span className="text-obsidian-primary font-bold text-sm">Come funziona DoveVai</span>
                            <div className="flex gap-1 mt-1">
                                {STEPS.map((_, i) => (
                                    <div key={i} className="relative h-0.5 flex-1 bg-obsidian-raised rounded-full overflow-hidden cursor-pointer" onClick={() => goTo(i)}>
                                        {i < step && <div className="absolute inset-0 rounded-full" style={{ background: current.accent }} />}
                                        {i === step && <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: current.accent }} animate={{ width: `${progress}%` }} transition={{ duration: 0 }} />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 bg-obsidian-card hover:bg-obsidian-raised rounded-full flex items-center justify-center transition-colors border border-obsidian-border">
                        <X className="w-4 h-4 text-obsidian-secondary" />
                    </button>
                </div>

                {/* Main content */}
                <div className="relative z-10 flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

                    {/* LEFT — Text. Gate FF.1: padding + font + margini compressi
                        su mobile per far entrare tutto in iPhone 390x844 insieme
                        al phone sotto (mobile stack verticale). */}
                    <div className="lg:w-[50%] flex flex-col justify-between p-4 md:p-6 lg:p-10">
                        <AnimatePresence mode="wait">
                            <motion.div key={step}
                                initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
                                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                                className="flex-1 flex flex-col justify-center">

                                {/* Step number + tag — Gate FF.1: text-4xl mobile, text-5xl da md */}
                                <div className="flex items-center gap-3 mb-4 md:mb-6">
                                    <span className={`text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r ${current.gradient} leading-none`}>
                                        {current.label}
                                    </span>
                                    <div className="flex flex-col gap-1">
                                        <span className={`text-xs font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r ${current.gradient}`}>
                                            {current.tag}
                                        </span>
                                        {/* Steps dots */}
                                        <div className="flex gap-1.5">
                                            {STEPS.map((_, i) => (
                                                <motion.button key={i} onClick={() => goTo(i)}
                                                    animate={{ scale: i === step ? 1 : 0.7, opacity: i === step ? 1 : 0.35 }}
                                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                                    style={{ background: i === step ? current.accent : 'var(--obsidian-secondary)' }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Gate FF.1: title text-2xl mobile → 3xl md → 4xl lg */}
                                <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-obsidian-primary mb-3 md:mb-4 leading-[1.1] tracking-tight">{current.title}</h2>
                                <p className="text-obsidian-secondary text-sm md:text-base leading-relaxed mb-4 md:mb-8 max-w-sm">{current.desc}</p>

                                {/* Feature chips — Gate EE: rimossi vecchi chip che promettevano
                                    feature V2/V3 (esperti curatori, prezzi tour, chat con la
                                    persona guida, live navigation, live stories) non presenti
                                    in V1. Ora solo chip su cio' che V1 fa davvero.
                                    Gate FF.1: chip piu' compatti su mobile (padding + font). */}
                                <div className="flex flex-wrap gap-1.5 md:gap-2 mb-4 md:mb-8">
                                    {[
                                        step === 0 && ['🗺️ Mappa reale', '📍 Coordinate vere', '🌍 Ogni città italiana'],
                                        step === 1 && ['🧠 AI personalizzata', '⏱️ In pochi secondi', '🎯 Sui tuoi interessi'],
                                        step === 2 && ['🗺️ Marker sui punti veri', '📖 Fatti verificabili', '🕒 Orari veri'],
                                    ].flat().filter(Boolean).map((chip, i) => (
                                        <motion.span key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.08 }}
                                            className="text-[10px] md:text-xs font-semibold px-2 md:px-3 py-1 md:py-1.5 rounded-full border text-obsidian-primary"
                                            style={{ borderColor: `${current.accent}40`, background: `${current.accent}12` }}>
                                            {chip}
                                        </motion.span>
                                    ))}
                                </div>

                                {/* Navigation buttons — Gate FF.1: h-10 mobile → h-11 da md */}
                                <div className="flex items-center gap-3">
                                    {step > 0 && (
                                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => goTo(step - 1)}
                                            className="w-10 h-10 md:w-11 md:h-11 bg-obsidian-card hover:bg-obsidian-raised border border-obsidian-border rounded-xl flex items-center justify-center transition-all">
                                            <ChevronLeft className="w-5 h-5 text-obsidian-secondary" />
                                        </motion.button>
                                    )}
                                    {step < STEPS.length - 1 ? (
                                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => goTo(step + 1)}
                                            className={`flex-1 h-10 md:h-11 bg-gradient-to-r ${current.gradient} text-obsidian-bg font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg`}
                                            style={{ boxShadow: `0 8px 24px ${current.glow}` }}>
                                            Prossimo <ChevronRight className="w-4 h-4" />
                                        </motion.button>
                                    ) : (
                                        <Link to="/login" className="flex-1" onClick={onClose}>
                                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                className="w-full h-10 md:h-11 bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg">
                                                🎉 Inizia Gratis ora <ArrowRight className="w-4 h-4" />
                                            </motion.button>
                                        </Link>
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* RIGHT — Phone. Gate FF.1: padding compresso mobile
                        (pt-2 pb-6 → il phone stacca dal testo ma non spreca
                        altezza sotto). Ring decorativo scalato per non
                        eccedere il phone su mobile (w-64 mobile → w-80 md). */}
                    <div className="lg:w-[50%] flex items-center justify-center pt-2 pb-6 px-4 md:p-6 lg:p-10 relative">
                        {/* Decorative ring behind phone */}
                        <AnimatePresence mode="wait">
                            <motion.div key={step}
                                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.5 }}
                                className="absolute w-56 h-56 md:w-80 md:h-80 rounded-full border border-obsidian-border"
                                style={{ boxShadow: `0 0 80px 20px ${current.glow}` }}
                            />
                        </AnimatePresence>
                        <AnimatePresence mode="wait">
                            <motion.div key={`phone-${step}`}
                                initial={{ opacity: 0, y: 30, rotateY: -15, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -30, rotateY: 15, scale: 0.9 }}
                                transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
                                style={{ perspective: 1000 }}
                            >
                                <PhoneShell accent={current.accent}>
                                    <current.Phone key={phoneKey} active={true} />
                                </PhoneShell>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

/* ─────────────────────────────────────────────
   HERO PHOTOS CONFIGURATION
───────────────────────────────────────────── */
/**
 * Array di foto per l'hero a rotazione con didascalia (nome del posto e città).
 * 
 * COME INSERIRE LE FOTO REALI (10-15 elementi):
 *   {
 *     url: '/images/hero/colosseo-roma.webp', // percorso in /public/images/hero/... o URL statico/CDN
 *     title: 'Colosseo',                      // nome del posto / monumento reale
 *     city: 'Roma',                           // nome della città
 *   }
 */
const HERO_PHOTOS = [
    {
        url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1200',
        title: 'Colosseo',
        city: `Roma`,
    },
];

/* ─────────────────────────────────────────────
   LANDING PAGE
───────────────────────────────────────────── */
const Landing = () => {
    const [cityIdx, setCityIdx] = useState(0);
    const [photoIdx, setPhotoIdx] = useState(0);
    const [captionVisible, setCaptionVisible] = useState(false);
    const [showHowItWorks, setShowHowItWorks] = useState(false);
    const containerRef = useRef(null);
    const { scrollY } = useScroll();
    const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
    const heroScale = useTransform(scrollY, [0, 400], [1, 1.08]);
    const shouldReduceMotion = useReducedMotion();

    useEffect(() => {
        const t = setInterval(() => setCityIdx(i => (i + 1) % CITIES.length), 2000);
        return () => clearInterval(t);
    }, []);

    // Gestione rotazione foto (5.5s), Ken Burns e sincronizzazione didascalia (+600ms ingresso, -400ms uscita)
    useEffect(() => {
        // La didascalia entra ~600ms dopo l'avvio della foto
        const showCaptionTimer = setTimeout(() => {
            setCaptionVisible(true);
        }, 600);

        // Se c'è solo 1 foto o prefers-reduced-motion, nessuna rotazione automatica
        if (shouldReduceMotion || HERO_PHOTOS.length <= 1) {
            return () => clearTimeout(showCaptionTimer);
        }

        // La didascalia esce ~400ms prima del cambio foto (a 5100ms su intervallo di 5500ms)
        const hideCaptionTimer = setTimeout(() => {
            setCaptionVisible(false);
        }, 5100);

        // Cambio foto al termine dei 5.5s con crossfade di 1.2s
        const nextPhotoTimer = setTimeout(() => {
            setPhotoIdx(i => (i + 1) % HERO_PHOTOS.length);
            setCaptionVisible(false);
        }, 5500);

        return () => {
            clearTimeout(showCaptionTimer);
            clearTimeout(hideCaptionTimer);
            clearTimeout(nextPhotoTimer);
        };
    }, [photoIdx, shouldReduceMotion]);

    useEffect(() => {
        const test = async () => { try { await supabase.from('explorers').select('id').limit(1); } catch { } };
        test();
    }, []);

    const currentPhoto = HERO_PHOTOS[photoIdx] || HERO_PHOTOS[0] || null;

    return (
        <div className="relative min-h-screen bg-obsidian-bg text-obsidian-primary overflow-x-hidden font-sans" ref={containerRef}>

            {/* HERO SECTION — occupa l'altezza utile dello schermo (100dvh) con la foto a pieno sfondo dietro a nav, titolo e CTA */}
            <header className="relative min-h-[100dvh] md:min-h-screen flex flex-col justify-between overflow-hidden">

                {/* HERO BACKGROUND PHOTOS WITH CROSSFADE & SLOW KEN BURNS */}
                <motion.div className="absolute inset-0 z-0 overflow-hidden" style={{ scale: heroScale, opacity: heroOpacity }}>
                    <AnimatePresence initial={false}>
                        {currentPhoto && (
                            <motion.div
                                key={currentPhoto.url}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1.2, ease: 'easeInOut' }}
                                className="absolute inset-0 overflow-hidden"
                            >
                                <motion.img
                                    src={currentPhoto.url}
                                    alt={currentPhoto.title && currentPhoto.city ? `${currentPhoto.title}, ${currentPhoto.city}` : 'Hero background'}
                                    className="w-full h-full object-cover object-[50%_85%] md:object-center origin-center"
                                    initial={shouldReduceMotion ? { scale: 1, y: '0%' } : { scale: 1, y: '0%' }}
                                    animate={shouldReduceMotion ? { scale: 1, y: '0%' } : { scale: 1.06, y: '-2%' }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 20, ease: 'linear' }}
                                    loading={photoIdx === 0 ? 'eager' : 'lazy'}
                                    fetchPriority={photoIdx === 0 ? 'high' : 'auto'}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Scrim neutri protettivi: base calibrata + dissolvenza inferiore verso l'ossidiana */}
                    <div className="absolute inset-0 bg-black/35 pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian-bg via-black/25 to-black/10 pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/5 hidden md:block pointer-events-none" />
                </motion.div>

                {/* PARTICLES */}
                <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
                    {[...Array(12)].map((_, i) => (
                        <motion.div key={i} className="absolute w-1 h-1 bg-brand-orange/40 rounded-full"
                            style={{ left: `${8 + i * 8}%`, top: `${20 + (i % 3) * 20}%` }}
                            animate={{ y: [-15, 15, -15], opacity: [0.2, 0.6, 0.2] }}
                            transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }} />
                    ))}
                </div>

                {/* NAV */}
                <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }}
                    className="relative z-10 flex justify-between items-center px-6 py-6 md:px-12">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-brand-orange rounded-xl flex items-center justify-center shadow-lg">
                            <Compass className="w-5 h-5 text-obsidian-bg" />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-obsidian-primary">DOVEVAI</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="text-sm font-semibold text-obsidian-secondary hover:text-obsidian-primary transition-colors">Accedi</Link>
                        <Link to="/login">
                            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                                className="px-4 py-2 bg-obsidian-card/80 backdrop-blur-md border border-obsidian-border rounded-full text-sm font-semibold text-obsidian-primary hover:bg-obsidian-raised transition-all">
                                Inizia Gratis →
                            </motion.button>
                        </Link>
                    </div>
                </motion.nav>

                {/* HERO MAIN */}
                <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 py-6">
                    {/* Fascia di contrasto localizzata dietro al titolo (protegge il contrasto > 4.5:1 sulla zona centrale senza scurire il resto della foto) */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-96 max-w-4xl mx-auto bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.12)_55%,transparent_80%)] pointer-events-none -z-10" />

                    <motion.div variants={stagger.container} initial="hidden" animate="show" className="flex flex-col items-center max-w-5xl mx-auto relative z-10">
                        <motion.div variants={stagger.item}>
                            <span className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-brand-orange/10 backdrop-blur-md border border-brand-orange/30 text-xs font-bold tracking-widest uppercase mb-8 text-brand-orange">
                                <span className="w-1.5 h-1.5 bg-brand-orange rounded-full animate-pulse" />Il futuro del viaggio è qui
                            </span>
                        </motion.div>
                        {/* Gate EE — Hero riscritta V1. Frase-firma locked Ivano.
                            Zero claim su persone V2. Zero "in tutta Italia" (promessa
                            di copertura fisica): "in qualunque città scegli" (vero: il
                            motore funziona ovunque ci siano POI). */}
                        <motion.h1 variants={stagger.item} className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-[1.05] tracking-tight text-obsidian-primary">
                            Il posto esiste.<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange via-ochre-400 to-brand-orange-hover">Nessuno te lo aveva mostrato così.</span>
                        </motion.h1>
                        <motion.div variants={stagger.item} className="flex items-center gap-2 mb-5">
                            <MapPin className="w-4 h-4 text-brand-orange flex-shrink-0" />
                            <span className="text-obsidian-secondary text-sm font-medium">In qualunque città scegli — anche</span>
                            <div className="relative h-6 overflow-hidden w-20">
                                <AnimatePresence mode="wait">
                                    <motion.span key={cityIdx} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
                                        transition={{ duration: 0.35 }} className="absolute inset-0 text-brand-orange font-bold text-sm">{CITIES[cityIdx]}</motion.span>
                                </AnimatePresence>
                            </div>
                        </motion.div>
                        <motion.p variants={stagger.item} className="text-lg md:text-xl text-obsidian-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
                            L'AI ti costruisce un percorso su misura in qualunque città italiana,<br className="hidden md:block" />
                            con luoghi veri e orari veri.
                        </motion.p>
                        <motion.div variants={stagger.item} className="flex flex-col sm:flex-row items-center gap-4 mb-8 sm:mb-12">
                            <Link to="/login">
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    className="group px-8 py-4 bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg rounded-full font-bold text-base shadow-lg flex items-center gap-3">
                                    INIZIA L'AVVENTURA <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </motion.button>
                            </Link>
                            <motion.button onClick={() => setShowHowItWorks(true)}
                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                className="flex items-center gap-2.5 px-6 py-4 bg-obsidian-card/80 backdrop-blur-md border border-obsidian-border rounded-full font-semibold text-sm text-obsidian-primary hover:bg-obsidian-raised transition-all">
                                <div className="w-8 h-8 bg-obsidian-raised rounded-full flex items-center justify-center">
                                    <Play className="w-3 h-3 text-obsidian-primary fill-current ml-0.5" />
                                </div>
                                Guarda come funziona
                            </motion.button>
                        </motion.div>
                        {/* Gate EE — Rimosso social proof fake:
                            - conteggio utenti soddisfatti (numero inventato, al lancio
                              non c'e' NESSUN utente. Anche se ci fossero, "soddisfatti"
                              e' un'attribuzione senza recensione vera).
                            - avatar da servizio foto stock (persone finte).
                            - 5 stelle piene senza recensione dietro.
                            Il social proof vero arrivera' quando ci saranno recensioni reali.
                            Fino ad allora, nessun claim di popolarita'. */}
                    </motion.div>
                </main>

                {/* DIDASCALIA FOTO HERO (entra a +600ms con fade/slide, esce a -400ms prima del cambio foto) */}
                <AnimatePresence>
                    {captionVisible && currentPhoto?.title && currentPhoto?.city && (
                        <motion.div
                            key={`${currentPhoto.title}-${currentPhoto.city}`}
                            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                            transition={{
                                duration: shouldReduceMotion ? 0.3 : 0.5,
                                ease: [0.25, 0.46, 0.45, 0.94],
                            }}
                            className="absolute bottom-3 right-4 sm:bottom-4 sm:right-6 z-10 pointer-events-none select-none flex items-center gap-1.5"
                        >
                            <MapPin className="w-3.5 h-3.5 text-obsidian-secondary/70 shrink-0" />
                            <span className="text-[11px] text-obsidian-secondary font-medium tracking-wide">
                                {currentPhoto.title} · {currentPhoto.city}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* SCROLL PROMPT */}
                <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 opacity-30 pointer-events-none">
                    <div className="w-px h-6 bg-obsidian-border" /><div className="w-1.5 h-1.5 rounded-full bg-obsidian-border" />
                </motion.div>
            </header>

            {/* FEATURES */}
            <motion.section initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.8 }}
                className="relative z-10 px-4 pb-16 max-w-5xl mx-auto">
                <div className="w-full h-px border-b border-obsidian-border mb-12" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Gate EE — Feature grid riscritta V1.
                        Rimosso: vecchio blocco che prometteva persone V2 come feature
                        gia' presente. La V2 arrivera' — c'e' una riga di testo linkata
                        a /prossimamente/guide sotto la grid. */}
                    {[
                        { icon: <Compass className="w-6 h-6 text-ochre-400" />, bg: 'bg-obsidian-card', border: 'border-ochre-500/20', title: 'Motore AI', desc: 'Costruisce un percorso su misura dai luoghi reali della citta\' che scegli.' },
                        { icon: <Globe className="w-6 h-6 text-terracotta-400" />, bg: 'bg-obsidian-card', border: 'border-terracotta-500/20', title: 'Mappa vera', desc: 'Ogni POI nella sua vera posizione — coordinate reali, nessun marker inventato.' },
                        { icon: <Sparkles className="w-6 h-6 text-brand-orange" />, bg: 'bg-obsidian-card', border: 'border-brand-orange/20', title: 'Personalizzazione', desc: 'Impara i tuoi interessi. Ogni consiglio, sempre piu\' tuo.' },
                    ].map((feat, i) => (
                        <motion.div key={i} whileHover={{ y: -4, scale: 1.02 }}
                            className={`${feat.bg} backdrop-blur-sm p-6 rounded-2xl border ${feat.border} transition-all duration-300`}>
                            <div className="mb-4">{feat.icon}</div>
                            <h3 className="font-bold text-base mb-2 text-obsidian-primary">{feat.title}</h3>
                            <p className="text-sm text-obsidian-secondary leading-relaxed">{feat.desc}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Gate EE — UNA riga onesta sul futuro. Zero mock, zero foto,
                    zero personas. Solo un accenno linkato alla schermata dedicata.
                    NB: il copy evita di proposito il termine V2 (regola
                    anti-fake no-v2-features-in-copy) — la feature V2 e' annunciata
                    nella pagina /prossimamente/guide, non promessa a parole qui. */}
                <div className="mt-8 text-center">
                    <Link to="/prossimamente/guide" className="text-obsidian-secondary hover:text-obsidian-primary text-sm transition-colors inline-flex items-center gap-1.5">
                        <span className="text-terracotta-400">◇</span>
                        Presto: persone del posto in carne e ossa
                        <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            </motion.section>

            <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 opacity-30">
                <div className="w-px h-8 bg-obsidian-border" /><div className="w-1.5 h-1.5 rounded-full bg-obsidian-border" />
            </motion.div>

            {/* HOW IT WORKS MODAL */}
            <AnimatePresence>
                {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
            </AnimatePresence>
        </div>
    );
};

export default Landing;
