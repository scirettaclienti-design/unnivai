import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * RoleGuard
 * Enforces role-based access to routes using AuthContext.
 */
const RoleGuard = ({ allowedRoles = [] }) => {
    const { user, role, loading } = useAuth();

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-orange-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>;
    }

    // 1. Auth Guard
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // 2. Role Normalization (explorer -> user compatibility if needed, or strict)
    // The AuthContext returns 'explorer', 'guide', 'business', 'guest'
    // App.jsx might use 'user' for explorer. Let's handle both.
    const effectiveRole = role === 'explorer' ? 'user' : role;
    const normalizedAllowed = allowedRoles.map(r => r === 'explorer' ? 'user' : r);

    if (normalizedAllowed.includes(effectiveRole)) {
        return <Outlet />;
    }

    // 3. Smart Redirect — Gate J1: guide/business dashboards spente in V1.
    // Chi ha ruolo guide/business finisce su /dashboard-user come tutti gli
    // altri finché non lanciamo V2/V3.
    return <Navigate to="/dashboard-user" replace />;
};

export default RoleGuard;
