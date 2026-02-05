import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, Sun, Cloud, Zap, Star, Target } from 'lucide-react';

interface SmartNotification {
  id: string;
  type: 'location' | 'time' | 'weather' | 'tour' | 'tip';
  title: string;
  message: string;
  emoji: string;
  priority: 'high' | 'medium' | 'low';
  autoHide: boolean;
  duration: number;
}

interface SmartNotificationSystemProps {
  userLocation?: string;
  isDeployment?: boolean;
}

export function SmartNotificationSystem({ 
  userLocation = 'Roma', 
  isDeployment = true 
}: SmartNotificationSystemProps) {
  // Sistema di notifiche completamente disabilitato su richiesta utente
  // Non mostra più popup automatici
  return null;
}

export default SmartNotificationSystem;