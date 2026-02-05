import React, { useState } from 'react';
import { useUserProfile } from '../hooks/useUserProfile';
import { useQuery } from '@tanstack/react-query';
import { dataService } from '../services/dataService';
import { MapPin, Calendar, Check, X, Radio } from 'lucide-react';

const DashboardGuide = () => {
    const { profile } = useUserProfile();
    const [isLive, setIsLive] = useState(false); // Local state for live toggle

    // Fetch pending bookings
    const { data: bookings, isLoading } = useQuery({
        queryKey: ['guide-bookings', profile?.id],
        queryFn: () => dataService.getPendingBookingsForGuide(profile?.id),
        enabled: !!profile?.id,
        initialData: []
    });

    const handleAction = (bookingId, action) => {
        console.log(`Booking ${bookingId} ${action} (Backend pending implementation)`);
        // Here we would call dataService.updateBookingStatus(id, newStatus)
    };

    const toggleLive = () => {
        const newState = !isLive;
        setIsLive(newState);
        console.log(`Guide Live Status: ${newState ? 'ON' : 'OFF'}`);
        // dataService.setLiveStatus(profile.id, newState)
    };

    return (
        <div className="p-6 max-w-4xl mx-auto font-sans">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Dashboard Guida</h1>

            {/* Guide Info & Live Control */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Ciao, {profile?.firstName || 'Guide'}!</h2>
                    <p className="text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin size={16} /> Roma, Italia
                    </p>
                </div>

                <button
                    onClick={toggleLive}
                    className={`flex items-center gap-3 px-5 py-2.5 rounded-full font-bold transition-all ${isLive
                            ? 'bg-red-500 text-white shadow-red-200 shadow-lg'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                >
                    <Radio size={20} className={isLive ? 'animate-pulse' : ''} />
                    {isLive ? 'SEI LIVE' : 'VAI LIVE'}
                </button>
            </div>

            {/* Operations Area */}
            <div className="space-y-6">
                <h3 className="font-semibold text-lg text-gray-700 flex items-center gap-2">
                    <Calendar size={20} />
                    Richieste di Prenotazione
                </h3>

                {isLoading ? (
                    <div className="h-40 bg-gray-50 rounded-xl animate-pulse"></div>
                ) : bookings.length > 0 ? (
                    <div className="grid gap-4">
                        {bookings.map(booking => (
                            <div key={booking.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h4 className="font-bold text-gray-800">{booking.tourName}</h4>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {new Date(booking.date).toLocaleDateString()} alle {booking.time} • {booking.guests} Ospiti
                                    </p>
                                    <p className="text-sm font-medium text-green-600 mt-1">
                                        Guadagno netto: €{booking.profit}
                                    </p>
                                </div>
                                <div className="flex gap-3 w-full md:w-auto">
                                    <button
                                        onClick={() => handleAction(booking.id, 'rejected')}
                                        className="flex-1 md:flex-none px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 font-medium text-sm"
                                    >
                                        <X size={16} /> Rifiuta
                                    </button>
                                    <button
                                        onClick={() => handleAction(booking.id, 'accepted')}
                                        className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 font-medium text-sm shadow-sm"
                                    >
                                        <Check size={16} /> Accetta
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-300 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Calendar size={24} />
                        </div>
                        <p className="text-gray-500 font-medium">Nessuna richiesta in attesa</p>
                        <p className="text-sm text-gray-400 mt-1">Le nuove prenotazioni appariranno qui.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardGuide;
