import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { 
  ArrowLeft, 
  Bell, 
  MapPin, 
  CloudRain, 
  Heart, 
  Clock,
  Volume2,
  Smartphone,
  Mail,
  Settings,
  Save,
  User,
  MapIcon,
  Palette,
  Calendar
} from 'lucide-react';

interface SettingsState {
  tourRecommendations: boolean;
  weatherAlerts: boolean;
  socialNotifications: boolean;
  tourReminders: boolean;
  groupInvites: boolean;
  specialOffers: boolean;
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  maxDailyNotifications: number;
  preferredCategories: string[];
  budgetRange: string;
  travelStyle: string;
  groupSize: string;
  weatherSensitivity: number;
  currentLocation: string;
  locationTracking: boolean;
  personalizedTiming: boolean;
  smartBatching: boolean;
}

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({
    // Notification Types
    tourRecommendations: true,
    weatherAlerts: true,
    socialNotifications: true,
    tourReminders: true,
    groupInvites: true,
    specialOffers: false,
    
    // Delivery Methods
    pushNotifications: true,
    emailNotifications: false,
    smsNotifications: false,
    
    // Timing & Frequency
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    maxDailyNotifications: 10,
    
    // AI Preferences
    preferredCategories: ['food', 'history'],
    budgetRange: 'medium',
    travelStyle: 'balanced',
    groupSize: 'small',
    weatherSensitivity: 3,
    currentLocation: 'Roma',
    
    // Advanced
    locationTracking: true,
    personalizedTiming: true,
    smartBatching: true
  });

  const handleToggle = (key: keyof SettingsState) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key as keyof SettingsState]
    }));
  };

  const handleSelectChange = (key: keyof SettingsState, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleArrayToggle = (key: keyof SettingsState, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: (prev[key] as string[]).includes(value)
        ? (prev[key] as string[]).filter((item: string) => item !== value)
        : [...(prev[key] as string[]), value]
    }));
  };

  const saveSettings = () => {
    // TODO: Save to backend
    console.log('Saving settings:', settings);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 pb-20">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Link href="/notifications">
              <motion.button
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
            </Link>
            <h1 className="text-xl font-bold text-gray-800">Impostazioni Notifiche</h1>
          </div>
          <motion.button
            onClick={saveSettings}
            className="bg-terracotta-500 hover:bg-terracotta-600 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Save className="w-4 h-4" />
            <span>Salva</span>
          </motion.button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Notification Types */}
        <motion.div
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <Bell className="w-5 h-5 mr-2 text-terracotta-500" />
            Tipi di Notifica
          </h2>
          
          <div className="space-y-4">
            {[
              { key: 'tourRecommendations', label: 'Raccomandazioni Tour', desc: 'Suggerimenti personalizzati basati sui tuoi interessi', icon: MapPin },
              { key: 'weatherAlerts', label: 'Alert Meteo', desc: 'Notifiche quando il tempo è perfetto per esplorare', icon: CloudRain },
              { key: 'socialNotifications', label: 'Attività Social', desc: 'Like, commenti e condivisioni sulle tue foto', icon: Heart },
              { key: 'tourReminders', label: 'Promemoria Tour', desc: 'Ricordati dei tour prenotati e degli orari', icon: Clock },
              { key: 'groupInvites', label: 'Inviti Gruppo', desc: 'Inviti a tour di gruppo da amici e famiglia', icon: User },
              { key: 'specialOffers', label: 'Offerte Speciali', desc: 'Sconti e promozioni esclusive', icon: Palette }
            ].map(({ key, label, desc, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <Icon className="w-5 h-5 text-terracotta-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-800">{label}</p>
                    <p className="text-sm text-gray-600">{desc}</p>
                  </div>
                </div>
                <motion.button
                  onClick={() => handleToggle(key)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings[key] ? 'bg-terracotta-500' : 'bg-gray-300'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="w-5 h-5 bg-white rounded-full shadow-md"
                    animate={{ x: settings[key] ? 24 : 2 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                </motion.button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Delivery Methods */}
        <motion.div
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <Smartphone className="w-5 h-5 mr-2 text-terracotta-500" />
            Modalità di Consegna
          </h2>
          
          <div className="space-y-4">
            {[
              { key: 'pushNotifications', label: 'Notifiche Push', desc: 'Notifiche istantanee sul tuo dispositivo', icon: Volume2 },
              { key: 'emailNotifications', label: 'Email', desc: 'Riassunti giornalieri via email', icon: Mail },
              { key: 'smsNotifications', label: 'SMS', desc: 'Solo per tour urgenti e promemoria', icon: Smartphone }
            ].map(({ key, label, desc, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <Icon className="w-5 h-5 text-terracotta-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-800">{label}</p>
                    <p className="text-sm text-gray-600">{desc}</p>
                  </div>
                </div>
                <motion.button
                  onClick={() => handleToggle(key)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings[key] ? 'bg-terracotta-500' : 'bg-gray-300'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="w-5 h-5 bg-white rounded-full shadow-md"
                    animate={{ x: settings[key] ? 24 : 2 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                </motion.button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* AI Preferences */}
        <motion.div
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-terracotta-500" />
            Preferenze AI
          </h2>
          
          <div className="space-y-6">
            {/* Categorie Preferite */}
            <div>
              <p className="font-medium text-gray-800 mb-3">Categorie di Interesse</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'food', label: 'Gastronomia', emoji: '🍝' },
                  { key: 'history', label: 'Storia', emoji: '🏛️' },
                  { key: 'art', label: 'Arte', emoji: '🎨' },
                  { key: 'nature', label: 'Natura', emoji: '🌿' },
                  { key: 'culture', label: 'Cultura', emoji: '🎭' },
                  { key: 'adventure', label: 'Avventura', emoji: '⛰️' }
                ].map(({ key, label, emoji }) => (
                  <motion.button
                    key={key}
                    onClick={() => handleArrayToggle('preferredCategories', key)}
                    className={`flex items-center space-x-2 p-3 rounded-lg border-2 transition-all ${
                      settings.preferredCategories.includes(key)
                        ? 'border-terracotta-500 bg-terracotta-50 text-terracotta-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="text-sm font-medium">{label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Budget Range */}
            <div>
              <p className="font-medium text-gray-800 mb-3">Range di Budget</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'low', label: 'Economico', desc: '€15-35' },
                  { key: 'medium', label: 'Medio', desc: '€35-65' },
                  { key: 'high', label: 'Premium', desc: '€65+' }
                ].map(({ key, label, desc }) => (
                  <motion.button
                    key={key}
                    onClick={() => handleSelectChange('budgetRange', key)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      settings.budgetRange === key
                        ? 'border-terracotta-500 bg-terracotta-50 text-terracotta-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs opacity-75">{desc}</p>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Travel Style */}
            <div>
              <p className="font-medium text-gray-800 mb-3">Stile di Viaggio</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'relaxed', label: 'Rilassato', desc: 'Ritmo lento' },
                  { key: 'balanced', label: 'Bilanciato', desc: 'Mix perfetto' },
                  { key: 'intensive', label: 'Intensivo', desc: 'Pieno di attività' }
                ].map(({ key, label, desc }) => (
                  <motion.button
                    key={key}
                    onClick={() => handleSelectChange('travelStyle', key)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      settings.travelStyle === key
                        ? 'border-terracotta-500 bg-terracotta-50 text-terracotta-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs opacity-75">{desc}</p>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Weather Sensitivity */}
            <div>
              <p className="font-medium text-gray-800 mb-3">Sensibilità Meteo</p>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">Bassa</span>
                <div className="flex-1 flex space-x-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <motion.button
                      key={level}
                      onClick={() => handleSelectChange('weatherSensitivity', level.toString())}
                      className={`flex-1 h-3 rounded-full transition-colors ${
                        level <= settings.weatherSensitivity
                          ? 'bg-terracotta-500'
                          : 'bg-gray-200'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600">Alta</span>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {settings.weatherSensitivity <= 2 
                  ? 'Riceverai poche notifiche meteo'
                  : settings.weatherSensitivity >= 4
                  ? 'Riceverai molte notifiche meteo personalizzate'
                  : 'Equilibrio tra notifiche utili e tranquillità'
                }
              </p>
            </div>
          </div>
        </motion.div>

        {/* Quiet Hours */}
        <motion.div
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-terracotta-500" />
            Orari di Silenzio
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">Attiva Orari di Silenzio</p>
                <p className="text-sm text-gray-600">Nessuna notifica durante le ore di riposo</p>
              </div>
              <motion.button
                onClick={() => handleToggle('quietHoursEnabled')}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.quietHoursEnabled ? 'bg-terracotta-500' : 'bg-gray-300'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="w-5 h-5 bg-white rounded-full shadow-md"
                  animate={{ x: settings.quietHoursEnabled ? 24 : 2 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              </motion.button>
            </div>
            
            {settings.quietHoursEnabled && (
              <motion.div
                className="grid grid-cols-2 gap-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dalle
                  </label>
                  <input
                    type="time"
                    value={settings.quietHoursStart}
                    onChange={(e) => handleSelectChange('quietHoursStart', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alle
                  </label>
                  <input
                    type="time"
                    value={settings.quietHoursEnd}
                    onChange={(e) => handleSelectChange('quietHoursEnd', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                  />
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Advanced Settings */}
        <motion.div
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-terracotta-500" />
            Impostazioni Avanzate
          </h2>
          
          <div className="space-y-4">
            {[
              { key: 'locationTracking', label: 'Tracking Posizione', desc: 'Suggerimenti basati sulla tua posizione attuale' },
              { key: 'personalizedTiming', label: 'Timing Personalizzato', desc: 'Notifiche negli orari migliori per te' },
              { key: 'smartBatching', label: 'Raggruppamento Intelligente', desc: 'Raggruppa notifiche simili per ridurre interruzioni' }
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{label}</p>
                  <p className="text-sm text-gray-600">{desc}</p>
                </div>
                <motion.button
                  onClick={() => handleToggle(key)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings[key] ? 'bg-terracotta-500' : 'bg-gray-300'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="w-5 h-5 bg-white rounded-full shadow-md"
                    animate={{ x: settings[key] ? 24 : 2 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                </motion.button>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}