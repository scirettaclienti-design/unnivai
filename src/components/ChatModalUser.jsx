import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Shield, AlertTriangle, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sanitizeMessage } from '@/utils/chatSanitizer';

export default function ChatModalUser({ isOpen, onClose, request, userId, userName }) {
    const [chatHistory, setChatHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [chatMessage, setChatMessage] = useState('');

    useEffect(() => {
        if (isOpen && request) {
            fetchChatHistory();
        }
    }, [isOpen, request]);

    const fetchChatHistory = async () => {
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('action_data->>request_id', request.id)
                .in('type', ['guide_message', 'user_reply', 'price_offer'])
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            setChatHistory(data || []);
        } catch (err) {
            console.error('Error fetching chat history:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const sendChatMessage = async () => {
        if (!chatMessage.trim() || !request) return;

        const { sanitizedText, hasViolations } = sanitizeMessage(chatMessage.trim());

        try {
            if (!request.guide_id) {
                console.error("No guide assigned to this request yet.");
                return;
            }

            const { error } = await supabase.from('notifications').insert({
                user_id: request.guide_id,
                type: 'user_reply',
                title: `💬 Risposta da ${userName}`,
                message: sanitizedText,
                action_url: '/dashboard-guide',
                action_data: { request_id: request.id },
                is_read: false,
                created_at: new Date().toISOString()
            });

            if (error) throw error;

            // Append locally
            setChatHistory(prev => [...prev, {
                id: Date.now().toString(),
                type: 'user_reply',
                message: sanitizedText,
                created_at: new Date().toISOString()
            }]);

            if (hasViolations) {
                setChatMessage(sanitizedText);
            } else {
                setChatMessage('');
            }
        } catch (err) {
            console.error('[sendChatMessage] Error:', err.message);
        }
    };

    if (!isOpen || !request) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
                <motion.div
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />
                <motion.div
                    initial={{ y: 60, opacity: 0 }} 
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 60, opacity: 0 }}
                    className="relative z-10 bg-white w-full max-w-md max-h-[85vh] rounded-3xl overflow-hidden overflow-y-auto shadow-2xl"
                >
                    {/* MODAL HEADER */}
                    <div className="bg-gradient-to-r from-terracotta-500 to-terracotta-600 px-5 py-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 shadow-inner">
                            <span className="text-white font-bold tracking-widest text-sm">G</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-white font-bold text-sm leading-tight">Tour a {request.city}</p>
                            <p className="text-white/80 text-xs mt-0.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                                Chat Attiva
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 -mr-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    
                    <div className="p-5">
                        {/* CHAT HISTORY */}
                        <div className="bg-gray-50 rounded-2xl mb-4 p-4 border border-gray-100 shadow-inner h-72 overflow-y-auto flex flex-col gap-3">
                            {loadingHistory ? (
                                <div className="flex-1 flex justify-center items-center text-gray-400">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-terracotta-500"></div>
                                </div>
                            ) : chatHistory.length === 0 ? (
                                <div className="flex-1 flex flex-col justify-center items-center text-gray-400 text-sm">
                                    <MessageCircle size={32} className="mb-3 opacity-30" />
                                    Non hai ancora ricevuto messaggi.
                                </div>
                            ) : (
                                chatHistory.map((msg) => {
                                    const isUser = msg.type === 'user_reply';
                                    return (
                                        <div key={msg.id} className={`flex flex-col max-w-[85%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}>
                                            <span className="text-[10px] text-gray-400 mb-1 mx-1 flex items-center gap-1">
                                                {isUser ? 'Tu' : 'Guida'} • {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                            <div className={`px-4 py-3 rounded-2xl text-sm shadow-sm ${
                                                isUser 
                                                    ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-tr-sm' 
                                                    : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                                            }`}>
                                                {msg.message}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        
                        {/* INPUT AREA */}
                        <div className="flex gap-2">
                            <div className="flex-1 bg-white border border-gray-200 shadow-sm rounded-2xl px-4 py-3">
                                <textarea
                                    value={chatMessage}
                                    onChange={e => setChatMessage(e.target.value)}
                                    placeholder="Scrivi alla guida..."
                                    className="w-full bg-transparent resize-none text-sm text-gray-700 placeholder-gray-400 focus:outline-none min-h-[40px] max-h-[120px]"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex justify-between items-center mt-3">
                            {(chatMessage.includes('[Numero Nascosto]') || chatMessage.includes('[Email Nascosta]')) ? (
                                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg flex-1 mr-3 line-clamp-2 leading-tight">
                                    <AlertTriangle size={14} className="flex-shrink-0" /> Dati nascosti (policy intermediazione).
                                </div>
                            ) : (
                                <div className="text-[10px] text-gray-400 flex items-center gap-1 flex-1 mr-3 leading-tight">
                                    <Shield size={12} className="flex-shrink-0 text-terracotta-400" /> Dati diretti sbloccati a preventivo pagato.
                                </div>
                            )}
                            <motion.button
                                onClick={sendChatMessage}
                                disabled={!chatMessage.trim() || !request.guide_id}
                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                className="w-12 h-12 rounded-full bg-terracotta-500 text-white flex items-center justify-center disabled:bg-gray-200 disabled:text-gray-400 flex-shrink-0 shadow-lg shadow-terracotta-500/30 transition-all"
                            >
                                <Send size={18} className="ml-1" />
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
