
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
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
const PhoneShell = ({ children, accent = '#6366f1', time = '9:41' }) => (
    <div className="relative w-[260px] h-[520px] flex-shrink-0">
        {/* Outer glow */}
        <div className="absolute inset-0 rounded-[44px] blur-3xl opacity-40" style={{ background: `radial-gradient(circle, ${accent}55, transparent 70%)`, transform: 'scale(1.1)' }} />
        {/* Phone body */}
        <div className="relative w-full h-full bg-[#0d0d14] rounded-[44px] border border-white/15 shadow-2xl overflow-hidden"
            style={{ boxShadow: `0 40px 80px -20px ${accent}40, 0 0 0 1px rgba(255,255,255,0.06) inset` }}>
            {/* Top shine */}
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            {/* Dynamic Island */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-7 bg-black rounded-full z-20 flex items-center justify-center gap-2 border border-white/10">
                <div className="w-2 h-2 bg-black rounded-full border border-white/20" />
                <div className="w-3 h-3 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
            </div>
            {/* Status bar */}
            <div className="absolute top-0 left-0 right-0 h-14 flex items-end justify-between px-5 pb-1.5 z-10">
                <span className="text-white/70 text-[11px] font-bold">{time}</span>
                <div className="flex items-center gap-1.5">
                    <Signal className="w-3 h-3 text-white/60" />
                    <Wifi className="w-3 h-3 text-white/60" />
                    <Battery className="w-3.5 h-3.5 text-white/60" />
                </div>
            </div>
            {/* Content area */}
            <div className="absolute inset-0 pt-14 pb-2">{children}</div>
        </div>
        {/* Side buttons */}
        <div className="absolute right-0 top-24 w-1 h-10 bg-white/10 rounded-l-full" />
        <div className="absolute left-0 top-20 w-1 h-7 bg-white/10 rounded-r-full" />
        <div className="absolute left-0 top-30 w-1 h-7 bg-white/10 rounded-r-full" />
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
            <div className="px-3 pt-1 pb-2.5 bg-gradient-to-b from-[#0d0d14] to-[#111827]">
                <motion.div initial={{ opacity: 0, y: -8 }} animate={active ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.3 }}
                    className="bg-white/8 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 border border-white/10 backdrop-blur">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
                        <Search className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex items-center flex-1">
                        <motion.span initial={{ width: 0 }} animate={active ? { width: 'auto' } : {}} transition={{ delay: 0.7, duration: 0.9 }}
                            className="text-white text-[13px] font-semibold overflow-hidden whitespace-nowrap">Roma, Italia</motion.span>
                        <motion.div animate={active ? { opacity: [1, 0, 1] } : {}} transition={{ repeat: Infinity, duration: 0.9 }}
                            className="w-0.5 h-3.5 bg-indigo-400 ml-0.5 rounded-full" />
                    </div>
                    <motion.div animate={active ? { scale: [1, 1.3, 1] } : {}} transition={{ repeat: Infinity, duration: 2, delay: 1.5 }}
                        className="w-2 h-2 bg-green-400 rounded-full" />
                </motion.div>
            </div>
            {/* Map */}
            <div className="flex-1 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #1a2035 0%, #131b2e 100%)' }}>
                {/* SVG roads */}
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 260 350">
                    <path d="M0 120 Q80 100 130 140 Q180 180 260 160" stroke="white" strokeWidth="3" fill="none" />
                    <path d="M60 0 Q70 100 80 200 Q90 300 100 350" stroke="white" strokeWidth="2" fill="none" />
                    <path d="M0 200 Q100 190 200 210 Q240 215 260 220" stroke="white" strokeWidth="2" fill="none" />
                    <path d="M140 0 Q150 80 160 160 Q170 240 180 350" stroke="white" strokeWidth="1.5" fill="none" />
                </svg>
                {/* Grid */}
                <div className="absolute inset-0 opacity-5"
                    style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
                {/* Pins */}
                {pins.map((pin, i) => (
                    <motion.div key={i} initial={{ scale: 0, opacity: 0, y: -20 }} animate={active ? { scale: 1, opacity: 1, y: 0 } : {}}
                        transition={{ delay: pin.delay, type: 'spring', stiffness: 400, damping: 15 }}
                        className="absolute flex flex-col items-center" style={{ top: pin.top, left: pin.left, transform: 'translate(-50%,-50%)' }}>
                        <motion.div animate={active ? { y: [0, -4, 0] } : {}} transition={{ repeat: Infinity, duration: 2.5, delay: i * 0.3 }}
                            className={`${pin.size === 'lg' ? 'w-12 h-12 text-xl' : 'w-8 h-8 text-sm'} bg-white rounded-2xl shadow-xl flex items-center justify-center`}
                            style={{ boxShadow: `0 8px 24px rgba(99,102,241,0.4)` }}>
                            {pin.emoji}
                        </motion.div>
                        {pin.size === 'lg' && (
                            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={active ? { opacity: 1, scale: 1 } : {}} transition={{ delay: pin.delay + 0.3 }}
                                className="mt-1 bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-lg">
                                {pin.label}
                            </motion.div>
                        )}
                    </motion.div>
                ))}
                {/* User dot */}
                <motion.div initial={{ scale: 0 }} animate={active ? { scale: 1 } : {}} transition={{ delay: 0.5, type: 'spring' }}
                    className="absolute top-[55%] left-[45%] -translate-x-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 bg-indigo-500 rounded-full border-2 border-white shadow-lg" style={{ boxShadow: '0 0 0 4px rgba(99,102,241,0.3)' }} />
                    <motion.div animate={{ scale: [1, 3, 1], opacity: [0.6, 0, 0.6] }} transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 bg-indigo-400 rounded-full" />
                </motion.div>
            </div>
            {/* Bottom pill */}
            <motion.div initial={{ y: 30, opacity: 0 }} animate={active ? { y: 0, opacity: 1 } : {}} transition={{ delay: 2.3 }}
                className="mx-3 mb-2 bg-white/8 backdrop-blur rounded-2xl px-3 py-2.5 border border-white/10 flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0 text-base">🏛️</div>
                <div>
                    <p className="text-white text-[11px] font-bold">5 esperienze trovate</p>
                    <p className="text-indigo-400 text-[9px]">Roma del centro storico</p>
                </div>
                <div className="ml-auto w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                    <ChevronRight className="w-3 h-3 text-white" />
                </div>
            </motion.div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   STEP 2 — AI Itinerary
───────────────────────────────────────────── */
const Step2Phone = ({ active }) => {
    const stops = [
        { time: '09:00', emoji: '☕', title: 'Bar San Calisto', cat: 'food', price: 'Gratis', color: '#10b981' },
        { time: '10:30', emoji: '🏛️', title: 'Colosseo + Foro Romano', cat: 'cultura', price: '€18', color: '#10b981' },
        { time: '13:00', emoji: '🍝', title: 'Da Enzo al 29', cat: 'pranzo', price: '€28', color: '#10b981' },
        { time: '15:30', emoji: '🎨', title: 'Mercati di Traiano', cat: 'arte', price: '€15', color: '#10b981' },
        { time: '18:00', emoji: '🌅', title: 'Tramonto al Gianicolo', cat: 'scenic', price: 'Gratis', color: '#10b981' },
    ];
    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-3 pt-1 pb-2 bg-gradient-to-b from-[#0d1a15] to-[#0d1a15]">
                <motion.div initial={{ opacity: 0 }} animate={active ? { opacity: 1 } : {}} transition={{ delay: 0.4 }}
                    className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/30">
                        <Brain className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-emerald-400 text-[11px] font-bold">AI DoveVai</span>
                            {active && (
                                <motion.div className="flex gap-0.5 items-center">
                                    {[0, 1, 2].map(i => (
                                        <motion.div key={i} animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.15 }}
                                            className="w-1 h-1 bg-emerald-400 rounded-full" />
                                    ))}
                                </motion.div>
                            )}
                        </div>
                        <p className="text-white/40 text-[9px]">Itinerario personalizzato · Roma</p>
                    </div>
                    <motion.div initial={{ scale: 0 }} animate={active ? { scale: 1 } : {}} transition={{ delay: 2.2, type: 'spring' }}
                        className="bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        ✓ Pronto
                    </motion.div>
                </motion.div>
                {/* Progress bar */}
                <div className="mt-2 bg-white/5 rounded-full h-1 overflow-hidden">
                    <motion.div initial={{ width: '0%' }} animate={active ? { width: '100%' } : {}} transition={{ delay: 0.6, duration: 1.5, ease: 'easeOut' }}
                        className="h-full bg-emerald-500 rounded-full" />
                </div>
            </div>
            {/* Stops list */}
            <div className="flex-1 overflow-hidden px-2.5 py-1 space-y-1.5">
                {stops.map((stop, i) => (
                    <motion.div key={i} initial={{ x: 50, opacity: 0 }} animate={active ? { x: 0, opacity: 1 } : {}}
                        transition={{ delay: 0.8 + i * 0.25, type: 'spring', stiffness: 200 }}
                        className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-2xl px-2.5 py-2 overflow-hidden relative">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500 rounded-r" />
                        <span className="text-lg flex-shrink-0">{stop.emoji}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-emerald-400 text-[9px] font-black">{stop.time}</span>
                                <span className="text-[8px] bg-emerald-500/15 text-emerald-400 px-1.5 rounded-full border border-emerald-500/20">{stop.cat}</span>
                            </div>
                            <p className="text-white text-[11px] font-semibold truncate">{stop.title}</p>
                        </div>
                        <span className="text-white/50 text-[10px] font-bold flex-shrink-0">{stop.price}</span>
                    </motion.div>
                ))}
            </div>
            {/* Bottom action */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={active ? { opacity: 1, y: 0 } : {}} transition={{ delay: 2.2 }}
                className="mx-2.5 mb-2 bg-emerald-500 rounded-2xl py-2.5 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span className="text-white text-[12px] font-bold">Salva Itinerario</span>
            </motion.div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   STEP 3 — Chat Guida
───────────────────────────────────────────── */
const Step3Phone = ({ active }) => {
    const messages = [
        { from: 'guide', text: 'Ciao! Sono Giulia 👋 Ho visto il tuo itinerario per Roma', delay: 0.7, time: '18:12' },
        { from: 'user', text: 'Perfetto! Sei disponibile sabato mattina?', delay: 1.3, time: '18:13' },
        { from: 'guide', text: 'Sì! Ho uno slot libero dalle 9. Ti porto nei vicoli segreti di Trastevere 🌿', delay: 1.9, time: '18:13' },
        { from: 'user', text: 'Fantastico, confermo! 🎉', delay: 2.5, time: '18:14' },
    ];
    return (
        <div className="flex flex-col h-full">
            {/* Guide header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={active ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.3 }}
                className="px-3 pt-1 pb-2.5 border-b border-white/8 bg-gradient-to-b from-[#1a0f00] to-transparent">
                <div className="flex items-center gap-2.5">
                    <div className="relative flex-shrink-0">
                        <img loading="lazy" src="https://randomuser.me/api/portraits/women/44.jpg" alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-orange-500/40" />
                        <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0d0d14]" />
                    </div>
                    <div className="flex-1">
                        <p className="text-white text-[13px] font-bold">Giulia Romano</p>
                        <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-0.5">
                                {[...Array(5)].map((_, i) => <Star key={i} className="w-2 h-2 text-amber-400 fill-current" />)}
                            </div>
                            <span className="text-white/40 text-[9px]">4.9 · 218 tour</span>
                        </div>
                    </div>
                    <div className="flex gap-1.5">
                        <div className="w-7 h-7 bg-white/8 rounded-full flex items-center justify-center border border-white/10">
                            <MessageCircle className="w-3.5 h-3.5 text-white/60" />
                        </div>
                    </div>
                </div>
            </motion.div>
            {/* Messages */}
            <div className="flex-1 px-3 py-2 space-y-2.5 overflow-hidden">
                {messages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: msg.from === 'user' ? 20 : -20, y: 10 }}
                        animate={active ? { opacity: 1, x: 0, y: 0 } : {}} transition={{ delay: msg.delay, type: 'spring', stiffness: 200 }}
                        className={`flex flex-col ${msg.from === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-[11px] leading-relaxed ${msg.from === 'user'
                                ? 'bg-orange-500 text-white rounded-br-md'
                                : 'bg-white/8 border border-white/10 text-white/85 rounded-bl-md'
                            }`}>{msg.text}</div>
                        <span className="text-white/25 text-[8px] mt-0.5 px-1">{msg.time}</span>
                    </motion.div>
                ))}
            </div>
            {/* Confirmed badge */}
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={active ? { scale: 1, opacity: 1 } : {}} transition={{ delay: 3, type: 'spring', stiffness: 200 }}
                className="mx-3 mb-1 bg-orange-500/10 border border-orange-500/30 rounded-2xl px-3 py-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <div>
                    <p className="text-white text-[10px] font-bold">Tour Confermato — Sab 15 Feb</p>
                    <p className="text-orange-400 text-[9px]">Trastevere · 09:00 · 3h · €45</p>
                </div>
            </motion.div>
            {/* Input */}
            <div className="mx-3 mb-2.5 bg-white/5 border border-white/8 rounded-2xl px-3 py-2 flex items-center gap-2">
                <span className="text-white/25 text-[11px] flex-1">Scrivi a Giulia...</span>
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                    <ArrowRight className="w-3 h-3 text-white" />
                </div>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   STEP 4 — Live Tour Navigation
───────────────────────────────────────────── */
const Step4Phone = ({ active }) => (
    <div className="flex flex-col h-full">
        {/* Nav bar */}
        <motion.div initial={{ opacity: 0 }} animate={active ? { opacity: 1 } : {}} transition={{ delay: 0.4 }}
            className="px-3 pt-1 pb-2 border-b border-white/8 bg-gradient-to-b from-[#1a0d2e] to-transparent">
            <div className="flex items-center gap-2">
                <motion.div animate={active ? { rotate: [0, 20, -20, 0] } : {}} transition={{ repeat: Infinity, duration: 3, delay: 1 }}>
                    <Navigation className="w-4 h-4 text-violet-400" />
                </motion.div>
                <div className="flex-1">
                    <span className="text-violet-300 text-[11px] font-bold">Tour Live · Tappa 2 di 5</span>
                    <div className="flex gap-1 mt-0.5">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className={`h-1 flex-1 rounded-full ${i < 2 ? 'bg-violet-500' : 'bg-white/10'}`} />
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-white/30" />
                    <span className="text-white/40 text-[9px]">2h 20m</span>
                </div>
            </div>
        </motion.div>
        {/* Map with animated SVG route */}
        <div className="flex-1 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)' }}>
            {/* Grid */}
            <div className="absolute inset-0 opacity-5"
                style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 260 260">
                {/* Completed route */}
                <motion.path d="M 40 220 Q 80 200 100 160 Q 115 130 130 110"
                    stroke="#8b5cf6" strokeWidth="4" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={active ? { pathLength: 1 } : {}} transition={{ delay: 0.8, duration: 1.2 }} />
                {/* Future route dashed */}
                <motion.path d="M 130 110 Q 155 80 175 60 Q 200 35 220 20"
                    stroke="#8b5cf6" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="6 5"
                    initial={{ pathLength: 0 }} animate={active ? { pathLength: 1 } : {}} transition={{ delay: 2, duration: 1 }} />
                {/* Start dot */}
                <circle cx="40" cy="220" r="5" fill="#8b5cf6" opacity="0.5" />
                {/* Completed stop */}
                <circle cx="100" cy="160" r="4" fill="#10b981" />
                {/* Current position */}
                <motion.circle cx="130" cy="110" r="6" fill="#8b5cf6"
                    animate={{ r: [6, 9, 6] }} transition={{ repeat: Infinity, duration: 1.5 }} />
                <circle cx="130" cy="110" r="3" fill="white" />
                {/* Future stop */}
                <motion.circle cx="175" cy="60" r="4" fill="white" opacity="0.4"
                    initial={{ opacity: 0 }} animate={active ? { opacity: 0.4 } : {}} transition={{ delay: 2.2 }} />
                <motion.circle cx="220" cy="20" r="4" fill="white" opacity="0.4"
                    initial={{ opacity: 0 }} animate={active ? { opacity: 0.4 } : {}} transition={{ delay: 2.4 }} />
            </svg>
        </div>
        {/* Current stop card */}
        <motion.div initial={{ y: 40, opacity: 0 }} animate={active ? { y: 0, opacity: 1 } : {}} transition={{ delay: 1.8, type: 'spring', stiffness: 200 }}
            className="mx-3 mb-2 bg-white/8 backdrop-blur rounded-2xl p-3 border border-violet-500/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-500 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-lg shadow-violet-500/30">🏛️</div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-bold text-violet-400 uppercase">Prossima Tappa</span>
                        <span className="text-[8px] bg-violet-500/20 text-violet-300 px-1.5 rounded-full">3 min a piedi</span>
                    </div>
                    <p className="text-white text-[12px] font-bold truncate">Mercati di Traiano</p>
                    <p className="text-violet-300 text-[10px] italic truncate">"Il Giulia: Qui l'arte parla..."</p>
                </div>
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                    className="w-8 h-8 bg-violet-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <ChevronRight className="w-4 h-4 text-white" />
                </motion.div>
            </div>
        </motion.div>
    </div>
);

/* ─────────────────────────────────────────────
   STEP DEFINITIONS
───────────────────────────────────────────── */
const STEPS = [
    {
        id: 0, label: '01', tag: 'Scoperta',
        title: 'Scegli la tua città',
        desc: 'Apri DoveVai e digita dove vuoi andare. La mappa si anima istantaneamente con decine di esperienze autentiche curate da chi vive davvero quei luoghi.',
        gradient: 'from-blue-600 via-indigo-600 to-violet-700',
        glow: 'rgba(99,102,241,0.3)',
        meshColor: '#4f46e5',
        accent: '#6366f1',
        Phone: Step1Phone,
    },
    {
        id: 1, label: '02', tag: 'Pianificazione',
        title: "L'AI costruisce il tuo percorso",
        desc: 'In pochi secondi l\'intelligenza artificiale analizza i tuoi interessi, il meteo, i tuoi orari e crea un itinerario con orari, prezzi e consigli su misura per te.',
        gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
        glow: 'rgba(16,185,129,0.3)',
        meshColor: '#059669',
        accent: '#10b981',
        Phone: Step2Phone,
    },
    {
        id: 2, label: '03', tag: 'Connessione',
        title: 'Incontra la tua guida',
        desc: 'Scegli tra decine di guide locali verificate. Chatta direttamente, personalizza ogni dettaglio del tour e conferma il tuo appuntamento in pochi tap.',
        gradient: 'from-orange-500 via-red-500 to-rose-600',
        glow: 'rgba(249,115,22,0.3)',
        meshColor: '#ea580c',
        accent: '#f97316',
        Phone: Step3Phone,
    },
    {
        id: 3, label: '04', tag: 'Esperienza',
        title: "Vivi l'avventura in diretta",
        desc: 'Il giorno del tour apri la navigazione live. Segui il percorso, ascolta le storie della guida su ogni luogo e crea ricordi che nessuna audioguida ti darà mai.',
        gradient: 'from-violet-600 via-purple-600 to-fuchsia-600',
        glow: 'rgba(139,92,246,0.3)',
        meshColor: '#7c3aed',
        accent: '#8b5cf6',
        Phone: Step4Phone,
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
            <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-2xl" onClick={onClose} />

            {/* Modal container — full screen feel */}
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 250, damping: 28 }}
                className="relative z-10 w-full h-full md:h-auto md:max-h-[92vh] md:max-w-5xl md:rounded-3xl overflow-hidden flex flex-col"
                style={{ background: '#090910' }}
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
                        {/* Subtle grid */}
                        <div className="absolute inset-0 opacity-[0.03]"
                            style={{ backgroundImage: 'linear-gradient(white 1px,transparent 1px),linear-gradient(90deg,white 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
                    </motion.div>
                </AnimatePresence>

                {/* Top bar */}
                <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/30">
                            <Compass className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <span className="text-white font-bold text-sm">Come funziona DoveVai</span>
                            <div className="flex gap-1 mt-1">
                                {STEPS.map((_, i) => (
                                    <div key={i} className="relative h-0.5 flex-1 bg-white/10 rounded-full overflow-hidden cursor-pointer" onClick={() => goTo(i)}>
                                        {i < step && <div className="absolute inset-0 rounded-full" style={{ background: current.accent }} />}
                                        {i === step && <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: current.accent }} animate={{ width: `${progress}%` }} transition={{ duration: 0 }} />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 bg-white/8 hover:bg-white/15 rounded-full flex items-center justify-center transition-colors border border-white/10">
                        <X className="w-4 h-4 text-white/70" />
                    </button>
                </div>

                {/* Main content */}
                <div className="relative z-10 flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

                    {/* LEFT — Text */}
                    <div className="lg:w-[50%] flex flex-col justify-between p-6 lg:p-10">
                        <AnimatePresence mode="wait">
                            <motion.div key={step}
                                initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
                                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                                className="flex-1 flex flex-col justify-center">

                                {/* Step number + tag */}
                                <div className="flex items-center gap-3 mb-6">
                                    <span className={`text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r ${current.gradient} leading-none`}>
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
                                                    style={{ background: i === step ? current.accent : 'white' }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <h2 className="text-3xl md:text-4xl font-black text-white mb-4 leading-[1.1] tracking-tight">{current.title}</h2>
                                <p className="text-white/55 text-base leading-relaxed mb-8 max-w-sm">{current.desc}</p>

                                {/* Feature chips */}
                                <div className="flex flex-wrap gap-2 mb-8">
                                    {[
                                        step === 0 && ['🗺️ Mappa live', '📍 Geo-rilevamento', '⭐ Curato dagli esperti'],
                                        step === 1 && ['🧠 AI personalizzata', '⏱️ Tempo reale', '💰 Prezzi inclusi'],
                                        step === 2 && ['✅ Guide verificate', '💬 Chat diretta', '📅 Prenotazione istantanea'],
                                        step === 3 && ['🧭 Navigazione live', '🎙️ Storie in diretta', '📸 Momenti da salvare'],
                                    ].flat().filter(Boolean).map((chip, i) => (
                                        <motion.span key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.08 }}
                                            className="text-xs font-semibold px-3 py-1.5 rounded-full border text-white/70"
                                            style={{ borderColor: `${current.accent}40`, background: `${current.accent}12` }}>
                                            {chip}
                                        </motion.span>
                                    ))}
                                </div>

                                {/* Navigation buttons */}
                                <div className="flex items-center gap-3">
                                    {step > 0 && (
                                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => goTo(step - 1)}
                                            className="w-11 h-11 bg-white/8 hover:bg-white/12 border border-white/10 rounded-xl flex items-center justify-center transition-all">
                                            <ChevronLeft className="w-5 h-5 text-white/60" />
                                        </motion.button>
                                    )}
                                    {step < STEPS.length - 1 ? (
                                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => goTo(step + 1)}
                                            className={`flex-1 h-11 bg-gradient-to-r ${current.gradient} text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg`}
                                            style={{ boxShadow: `0 8px 24px ${current.glow}` }}>
                                            Prossimo <ChevronRight className="w-4 h-4" />
                                        </motion.button>
                                    ) : (
                                        <Link to="/login" className="flex-1" onClick={onClose}>
                                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                className="w-full h-11 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30">
                                                🎉 Inizia Gratis ora <ArrowRight className="w-4 h-4" />
                                            </motion.button>
                                        </Link>
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* RIGHT — Phone */}
                    <div className="lg:w-[50%] flex items-center justify-center p-6 lg:p-10 relative">
                        {/* Decorative ring behind phone */}
                        <AnimatePresence mode="wait">
                            <motion.div key={step}
                                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.5 }}
                                className="absolute w-80 h-80 rounded-full border border-white/5"
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
   LANDING PAGE
───────────────────────────────────────────── */
const Landing = () => {
    const [cityIdx, setCityIdx] = useState(0);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const [showHowItWorks, setShowHowItWorks] = useState(false);
    const containerRef = useRef(null);
    const { scrollY } = useScroll();
    const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
    const heroScale = useTransform(scrollY, [0, 400], [1, 1.08]);

    useEffect(() => {
        const t = setInterval(() => setCityIdx(i => (i + 1) % CITIES.length), 2000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const test = async () => { try { await supabase.from('explorers').select('id').limit(1); } catch { } };
        test();
    }, []);

    return (
        <div className="relative min-h-screen bg-gray-950 text-white overflow-hidden font-sans" ref={containerRef}>

            {/* VIDEO BG */}
            <motion.div className="absolute inset-0 z-0" style={{ scale: heroScale, opacity: heroOpacity }}>
                <video autoPlay loop muted playsInline onCanPlayThrough={() => setVideoLoaded(true)}
                    className={`w-full h-full object-cover transition-opacity duration-1000 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}>
                    <source src="https://videos.pexels.com/video-files/4456997/4456997-uhd_2560_1440_25fps.mp4" type="video/mp4" />
                </video>
                {!videoLoaded && <img src="https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=2096" alt="" className="absolute inset-0 w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/50 to-gray-950/20" />
                <div className="absolute inset-0 bg-gradient-to-r from-gray-950/60 via-transparent to-gray-950/20" />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(3,7,18,0.7) 100%)' }} />
            </motion.div>

            {/* PARTICLES */}
            <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
                {[...Array(12)].map((_, i) => (
                    <motion.div key={i} className="absolute w-1 h-1 bg-orange-400/40 rounded-full"
                        style={{ left: `${8 + i * 8}%`, top: `${20 + (i % 3) * 20}%` }}
                        animate={{ y: [-15, 15, -15], opacity: [0.2, 0.6, 0.2] }}
                        transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }} />
                ))}
            </div>

            {/* NAV */}
            <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }}
                className="relative z-10 flex justify-between items-center px-6 py-6 md:px-12">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/30">
                        <Compass className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">DOVEVAI</span>
                </div>
                <div className="flex items-center gap-4">
                    <Link to="/login" className="text-sm font-semibold text-white/70 hover:text-white transition-colors">Accedi</Link>
                    <Link to="/login">
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                            className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-sm font-semibold hover:bg-white/20 transition-all">
                            Inizia Gratis →
                        </motion.button>
                    </Link>
                </div>
            </motion.nav>

            {/* HERO */}
            <main className="relative z-10 flex flex-col items-center justify-center min-h-[90vh] text-center px-4">
                <motion.div variants={stagger.container} initial="hidden" animate="show" className="flex flex-col items-center max-w-5xl mx-auto">
                    <motion.div variants={stagger.item}>
                        <span className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-orange-500/10 backdrop-blur-md border border-orange-500/30 text-xs font-bold tracking-widest uppercase mb-8 text-orange-400">
                            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />Il futuro del viaggio è qui
                        </span>
                    </motion.div>
                    <motion.h1 variants={stagger.item} className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-[1.05] tracking-tight">
                        Vivi l'Italia<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500">con gli occhi di chi ci vive.</span>
                    </motion.h1>
                    <motion.div variants={stagger.item} className="flex items-center gap-2 mb-5">
                        <MapPin className="w-4 h-4 text-orange-400 flex-shrink-0" />
                        <span className="text-white/60 text-sm font-medium">Guide a</span>
                        <div className="relative h-6 overflow-hidden w-20">
                            <AnimatePresence mode="wait">
                                <motion.span key={cityIdx} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
                                    transition={{ duration: 0.35 }} className="absolute inset-0 text-orange-400 font-bold text-sm">{CITIES[cityIdx]}</motion.span>
                            </AnimatePresence>
                        </div>
                        <span className="text-white/60 text-sm">e in tutta Italia</span>
                    </motion.div>
                    <motion.p variants={stagger.item} className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Guide locali vere, itinerari AI personalizzati e mappe interattive.<br className="hidden md:block" />
                        Un'esperienza di viaggio che nessuna app ti ha mai dato.
                    </motion.p>
                    <motion.div variants={stagger.item} className="flex flex-col sm:flex-row items-center gap-4 mb-16">
                        <Link to="/login">
                            <motion.button whileHover={{ scale: 1.05, boxShadow: '0 0 60px -10px rgba(234,88,12,0.7)' }} whileTap={{ scale: 0.95 }}
                                className="group px-8 py-4 bg-orange-600 text-white rounded-full font-bold text-base shadow-[0_0_40px_-10px_rgba(234,88,12,0.5)] flex items-center gap-3">
                                INIZIA L'AVVENTURA <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </motion.button>
                        </Link>
                        <motion.button onClick={() => setShowHowItWorks(true)}
                            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            className="flex items-center gap-2.5 px-6 py-4 bg-white/5 backdrop-blur-md border border-white/15 rounded-full font-semibold text-sm text-white/80 hover:bg-white/10 transition-all">
                            <div className="w-8 h-8 bg-white/15 rounded-full flex items-center justify-center">
                                <Play className="w-3 h-3 text-white fill-current ml-0.5" />
                            </div>
                            Guarda come funziona
                        </motion.button>
                    </motion.div>
                    <motion.div variants={stagger.item} className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            {['https://randomuser.me/api/portraits/women/44.jpg', 'https://randomuser.me/api/portraits/men/32.jpg',
                                'https://randomuser.me/api/portraits/women/68.jpg', 'https://randomuser.me/api/portraits/men/54.jpg'].map((src, i) => (
                                    <img loading="lazy" key={i} src={src} alt="" className="w-8 h-8 rounded-full border-2 border-gray-900 object-cover" />
                                ))}
                        </div>
                        <div className="text-left">
                            <div className="flex items-center gap-1">{[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 text-amber-400 fill-current" />)}</div>
                            <p className="text-xs text-white/50 mt-0.5">+2.800 viaggiatori soddisfatti</p>
                        </div>
                    </motion.div>
                </motion.div>
            </main>

            {/* FEATURES */}
            <motion.section initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.8 }}
                className="relative z-10 px-4 pb-16 max-w-5xl mx-auto">
                <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-12" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[
                        { icon: <Globe className="w-6 h-6 text-blue-400" />, bg: 'from-blue-500/10 to-blue-500/5', border: 'border-blue-500/20', title: 'Mappa Intelligente', desc: 'Navigazione immersiva con punti curati e geolocalizzazione in tempo reale.' },
                        { icon: <Users className="w-6 h-6 text-orange-400" />, bg: 'from-orange-500/10 to-orange-500/5', border: 'border-orange-500/20', title: 'Guide Locali Vere', desc: 'Esperti del territorio certificati, non semplici audioguide preregistrate.' },
                        { icon: <Compass className="w-6 h-6 text-emerald-400" />, bg: 'from-emerald-500/10 to-emerald-500/5', border: 'border-emerald-500/20', title: 'Itinerari su Misura', desc: "L'AI crea il tuo percorso — dalle gemme nascoste ai grandi classici." },
                    ].map((feat, i) => (
                        <motion.div key={i} whileHover={{ y: -4, scale: 1.02 }}
                            className={`bg-gradient-to-b ${feat.bg} backdrop-blur-sm p-6 rounded-2xl border ${feat.border} transition-all duration-300`}>
                            <div className="mb-4">{feat.icon}</div>
                            <h3 className="font-bold text-base mb-2">{feat.title}</h3>
                            <p className="text-sm text-white/50 leading-relaxed">{feat.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </motion.section>

            <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 opacity-30">
                <div className="w-px h-8 bg-white" /><div className="w-1.5 h-1.5 rounded-full bg-white" />
            </motion.div>

            {/* HOW IT WORKS MODAL */}
            <AnimatePresence>
                {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
            </AnimatePresence>
        </div>
    );
};

export default Landing;
