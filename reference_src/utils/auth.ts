// Simple auth utility functions
export const checkAuth = async () => {
  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch (error) {
    return null;
  }
};

export const logout = async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/auth/welcome';
  } catch (error) {
    window.location.href = '/auth/welcome';
  }
};