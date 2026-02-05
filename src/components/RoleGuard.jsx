import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';

/**
 * RoleGuard
 * Enforces role-based access to routes.
 * 
 * Behavior:
 * 1. Checks authentication (redirects to / if Guest)
 * 2. Checks role against allowedRoles
 * 3. On mismatch, redirects to the users correct dashboard
 */
const RoleGuard = ({ allowedRoles = [] }) => {
    const { profile, isLoading } = useUserProfile();

    if (isLoading) {
        return null; // Silent loading state (prevent flash)
    }

    // 1. Auth Guard
    if (!profile?.isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    // 2. Role Guard
    const userRole = profile.role || 'user';
    const normalizedRole = userRole.toLowerCase();

    if (allowedRoles.includes(normalizedRole)) {
        return <Outlet />;
    }

    // 3. Mismatch Redirect (to valid dashboard)
    // Safety: ensure infinite loops don't happen if role is somehow weird
    const validRoles = ['user', 'guide', 'business'];
    const targetDashboard = validRoles.includes(normalizedRole)
        ? `/dashboard-${normalizedRole}`
        : '/';

    return <Navigate to={targetDashboard} replace />;
};

export default RoleGuard;
