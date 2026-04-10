import React from 'react';
import { AdvancedMarker } from '@vis.gl/react-google-maps';

const getCategoryStyles = (category, type) => {
    const typeStr = (type || '').toLowerCase();
    
    // 1. Force styles based on functional TYPE first to avoid confusion
    if (typeStr === 'waypoint' || typeStr === 'tour_step') {
        return { bg: '#1f2937', border: '#030712', icon: '📍', isStep: true }; // Dark Slate/Black for Route Steps
    }
    if (typeStr === 'business_partner') {
        return { bg: '#eab308', border: '#a16207', icon: '⭐' }; // Yellow for Partners
    }

    // 2. Thematic fallback via CATEGORY
    const catLower = (category || '').toLowerCase();
    
    if (catLower.includes('food') || catLower.includes('cibo') || catLower.includes('ristorazione') || catLower.includes('restaurant')) {
        return { bg: '#f97316', border: '#c2410c', icon: '🍝' }; // Orange
    }
    if (catLower.includes('shopping') || catLower.includes('negozio')) {
        return { bg: '#ec4899', border: '#be185d', icon: '🛍️' }; // Pink
    }
    if (catLower.includes('coffee') || catLower.includes('bar') || catLower.includes('cafe')) {
        return { bg: '#8b5cf6', border: '#6d28d9', icon: '☕' }; // Purple
    }
    if (catLower.includes('storia') || catLower.includes('history') || catLower.includes('museo') || catLower.includes('museum')) {
        return { bg: '#3b82f6', border: '#1d4ed8', icon: '🏛️' }; // Blue
    }
    if (catLower.includes('art') || catLower.includes('arte')) {
        return { bg: '#10b981', border: '#047857', icon: '🎨' }; // Green
    }
    if (catLower.includes('natura') || catLower.includes('parco') || catLower.includes('park')) {
        return { bg: '#84cc16', border: '#4d7c0f', icon: '🌲' }; // Lime
    }

    // 3. Absolute default
    return { bg: '#ef4444', border: '#b91c1c', icon: '📌' }; // Red default for POIs
};

export const MapMarker = React.memo(({ activity, onClick, sequenceNumber }) => {
    const lat = Number(activity?.latitude || activity?.lat);
    const lng = Number(activity?.longitude || activity?.lng);

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;

    const styles = getCategoryStyles(activity.category || activity.category_tags?.[0], activity.type);
    
    // Check if we have an explicit sequenceNumber or an index (it's a route step)
    const isStep = sequenceNumber !== undefined ? true : activity.index !== undefined;
    const stepNumber = sequenceNumber !== undefined ? sequenceNumber : (activity.index !== undefined ? activity.index + 1 : null);
    
    // Base z-index logic: steps should be highest priority (e.g., 100 - step) to be always on top
    const baseZIndex = isStep ? 100 - (stepNumber || 0) : (activity.type === 'monument' ? 40 : 10);

    return (
        <AdvancedMarker
            position={{ lat, lng }}
            onClick={() => onClick && onClick(activity)}
            title={activity.name || activity.title || 'Marker'}
            zIndex={baseZIndex}
        >
            <div className={`group relative cursor-pointer ${isStep ? 'animate-in zoom-in slide-in-from-bottom-2 duration-300' : ''}`} style={{ transformOrigin: 'bottom center', transform: 'translate(0, -50%)' }}>
                
                {/* 3D Counter / Badge Shape */}
                <div 
                    className="relative flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-2 group-hover:scale-110"
                >
                    {/* The main badge body */}
                    <div 
                        className={`overflow-hidden flex items-center justify-center font-black ${isStep ? 'rounded-2xl px-3.5 py-2.5 min-w-[44px] min-h-[44px] text-lg' : 'w-10 h-10 rounded-full text-base'}`}
                        style={{
                            backgroundColor: styles.bg,
                            border: `2px solid white`,
                            // High-end 3D effect: top highlight, bottom shadow, outer drop shadow
                            boxShadow: `0 8px 16px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -4px 6px ${styles.border}`,
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                    >
                        <span className="text-white leading-none tracking-tight flex items-center justify-center">
                            {isStep ? stepNumber : styles.icon}
                        </span>
                    </div>

                    {/* Cute pointer at the bottom */}
                    <div 
                        className={`absolute left-1/2 -translate-x-1/2 rotate-45 ${isStep ? '-bottom-2 w-4 h-4' : '-bottom-1.5 w-3 h-3'}`}
                        style={{
                            backgroundColor: styles.bg,
                            borderBottom: `2px solid white`,
                            borderRight: `2px solid white`,
                            boxShadow: `3px 3px 6px rgba(0,0,0,0.2), inset -2px -2px 3px ${styles.border}`,
                            zIndex: -1
                        }}
                    />
                </div>
                
                {/* Base Shadow (Pin point shadow) */}
                <div className={`absolute left-1/2 transform -translate-x-1/2 bg-black/40 blur-[3px] rounded-[100%] transition-all duration-300 group-hover:w-10 group-hover:blur-[5px] group-hover:bg-black/30 group-hover:-bottom-4 z-[-2] ${isStep ? '-bottom-3 w-8 h-2.5' : '-bottom-2 w-6 h-2'}`}></div>
            </div>
        </AdvancedMarker>
    );
}, (prevProps, nextProps) => {
    // Evita ri-render continui inutili (anti-stutter durante il panning 60fps)
    const prevId = prevProps.activity?.id || prevProps.activity?.rawId;
    const nextId = nextProps.activity?.id || nextProps.activity?.rawId;
    const prevLat = prevProps.activity?.latitude || prevProps.activity?.lat;
    const nextLat = nextProps.activity?.latitude || nextProps.activity?.lat;
    const prevLng = prevProps.activity?.longitude || prevProps.activity?.lng;
    const nextLng = nextProps.activity?.longitude || nextProps.activity?.lng;
    
    return prevId === nextId && prevLat === nextLat && prevLng === nextLng && prevProps.sequenceNumber === nextProps.sequenceNumber;
});

export default MapMarker;
