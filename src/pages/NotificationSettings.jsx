/**
 * DVAI-027 — NotificationSettings
 * Pagina impostazioni notifiche raggiungibile da /notification-settings.
 * Risolve il dead-end UX segnalato nell'audit.
 */
import { useState } from 'react';
import { ArrowLeft, Bell, BellOff, Mail, Smartphone, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import TopBar from '../components/TopBar';
import BottomNavigation from '../components/BottomNavigation';
import { useToast } from '../hooks/use-toast';

const SETTINGS_KEY = 'dvai_notification_settings';

const defaultSettings = {
    pushEnabled: true,
    emailEnabled: true,
    soundEnabled: true,
    bookingUpdates: true,
    chatMessages: true,
    aiTips: true,
    tourReminders: true,
    promotions: false,
};

export default function NotificationSettings() {
    const { toast } = useToast();
    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem(SETTINGS_KEY);
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch {
            return defaultSettings;
        }
    });

    const toggle = (key) => {
        setSettings(prev => {
            const next = { ...prev, [key]: !prev[key] };
            try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
            return next;
        });
    };

    const saveAll = () => {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
        toast({ title: 'Impostazioni salvate!', type: 'success' });
    };

    const Row = ({ label, desc, settingKey, icon: Icon }) => (
        <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
                </div>
            </div>
            <button
                onClick={() => toggle(settingKey)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                    settings[settingKey] ? 'bg-orange-500' : 'bg-gray-200'
                }`}
            >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    settings[settingKey] ? 'translate-x-5' : 'translate-x-0'
                }`} />
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            <TopBar />
            <div className="max-w-lg mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Link to="/notifications" className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
                        <ArrowLeft className="w-4 h-4 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Impostazioni Notifiche</h1>
                        <p className="text-xs text-gray-500">Personalizza come ricevi gli aggiornamenti</p>
                    </div>
                </div>

                {/* Canali */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 mb-4"
                >
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider pt-4 pb-2">Canali</p>
                    <Row label="Notifiche Push"       settingKey="pushEnabled"    icon={Smartphone} />
                    <Row label="Email"                settingKey="emailEnabled"   icon={Mail}       desc="Riepilogo giornaliero" />
                    <Row label="Suoni"                settingKey="soundEnabled"   icon={settings.soundEnabled ? Volume2 : VolumeX} />
                </motion.div>

                {/* Tipologie */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 mb-6"
                >
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider pt-4 pb-2">Tipologie</p>
                    <Row label="Aggiornamenti prenotazioni" settingKey="bookingUpdates"  icon={Bell}    desc="Accettazioni, rifiuti, conferme" />
                    <Row label="Messaggi chat"              settingKey="chatMessages"    icon={Bell}    desc="Guide e utenti" />
                    <Row label="Consigli AI"                settingKey="aiTips"          icon={Bell}    desc="Suggerimenti personalizzati" />
                    <Row label="Promemoria tour"            settingKey="tourReminders"   icon={Bell}    desc="24h prima del tour" />
                    <Row label="Promozioni"                 settingKey="promotions"      icon={BellOff} desc="Offerte e novità DoveVai" />
                </motion.div>

                <button
                    onClick={saveAll}
                    className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-200 hover:shadow-orange-300 transition-all"
                >
                    Salva Impostazioni
                </button>
            </div>
            <BottomNavigation />
        </div>
    );
}
