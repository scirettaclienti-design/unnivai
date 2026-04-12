import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, MessageSquare, ArrowUp, X, MapPin } from 'lucide-react';
import { aiRecommendationService } from '../../services/aiRecommendationService';

export const AIDrawer = ({ isOpen, onClose, selectedPOI, activeCity }) => {
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState([
        { role: 'assistant', content: `Ciao! Sono l'assistente di DoveVai. Chiedimi curiosità, storie nascoste o consigli su ${selectedPOI?.name || selectedPOI?.title || activeCity}!` }
    ]);
    const [isTyping, setIsTyping] = useState(false);

    const handleSend = async () => {
        if (!query.trim()) return;
        
        const newMsg = { role: 'user', content: query };
        const currentMessages = [...messages, newMsg];
        setMessages(currentMessages);
        setQuery('');
        setIsTyping(true);

        try {
            const aiReply = await aiRecommendationService.chatWithGuide(
                currentMessages,
                { city: activeCity, poiName: selectedPOI?.name || selectedPOI?.title }
            );
            setMessages(prev => [...prev, { role: 'assistant', content: aiReply }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: "C'è stato un errore di rete. Potresti ripetere?" }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 left-0 right-0 z-[110] bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] flex flex-col max-h-[85vh] h-[500px]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 border-b border-gray-100 py-4 shrink-0 bg-white rounded-t-3xl z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-0.5">
                                    <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                                        <Bot size={18} className="text-purple-600" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 leading-none">Assistente DoveVai</h3>
                                    <p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider mt-1">AI Guide</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Context Pill (if a POI is focused) */}
                        {selectedPOI && (
                            <div className="px-6 py-2 bg-gray-50/80 border-b border-gray-100 shrink-0">
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                    <MapPin size={12} className="text-purple-500" />
                                    Focus: <span className="text-gray-900">{selectedPOI.name || selectedPOI.title}</span>
                                </div>
                            </div>
                        )}

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                        msg.role === 'user' 
                                            ? 'bg-gray-900 text-white rounded-br-sm' 
                                            : 'bg-indigo-50/80 text-gray-800 rounded-bl-sm border border-indigo-100/50'
                                    }`}>
                                        {msg.role === 'assistant' && (
                                            <div className="flex items-center gap-1.5 mb-1.5 opacity-60">
                                                <Bot size={10} />
                                                <span className="text-[9px] uppercase tracking-widest font-bold">DoveVai AI</span>
                                            </div>
                                        )}
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="max-w-[85%] rounded-2xl px-4 py-4 bg-indigo-50/80 text-gray-800 rounded-bl-sm flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-gray-100 shrink-0 relative">
                            <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 group focus-within:border-purple-300 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
                                <MessageSquare size={18} className="text-gray-400 shrink-0" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Scrivi qui..."
                                    className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                                />
                                <button 
                                    onClick={handleSend}
                                    disabled={!query.trim() || isTyping}
                                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                        query.trim() && !isTyping ? 'bg-purple-600 text-white hover:bg-purple-700 hover:scale-105 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                                >
                                    <ArrowUp size={16} strokeWidth={3} />
                                </button>
                            </div>
                            <div className="text-center mt-2">
                                <span className="text-[9px] text-gray-400 font-medium">L'assistente AI può commettere errori. Verifica le info sensibili.</span>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
