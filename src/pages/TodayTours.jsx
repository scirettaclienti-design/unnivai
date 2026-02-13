import React from 'react';
import BottomNavigation from '../components/BottomNavigation';
import { ArrowLeft, Clock, MapPin, Users, Calendar, Play, Heart, Camera, Coffee, Wine } from 'lucide-react';
import { Link } from 'react-router-dom';
import './TodayTours.css';

const TodayTours = () => {
    return (
        <div className="today-container">
            {/* Header */}
            <header className="today-header">
                <div className="header-bg-img" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1552832230-c0197dd311b5?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80')" }}></div>
                <div className="header-content">
                    <div className="today-header-row">
                        <Link to="/dashboard-user" className="icon-blur">
                            <ArrowLeft size={24} />
                        </Link>
                        <h1 className="text-xl font-bold">In Diretta Oggi</h1>
                        <div style={{ width: 40 }}></div>
                    </div>
                    <div className="live-badge-row">
                        <span className="live-pulse">LIVE NOW</span>
                        <span style={{ color: '#FDE68A', fontSize: '0.875rem', fontWeight: 500 }}>3 tour disponibili</span>
                    </div>
                </div>
            </header>

            <div className="main-content-area">
                {/* Main Card */}
                <div className="today-card">
                    <h3 className="what-waits">Cosa ti aspetta:</h3>
                    <div className="tag-row">
                        <span className="pill-tag orange">
                            <Coffee size={12} /> Pasta fresca
                        </span>
                        <span className="pill-tag red">
                            <Wine size={12} /> Vini locali
                        </span>
                        <span className="pill-tag amber">
                            <Camera size={12} /> Foto ricordo
                        </span>
                    </div>

                    <div className="info-grid">
                        <div className="grid-item">
                            <div className="gi-label">Dove</div>
                            <div className="gi-val">
                                <MapPin size={14} className="txt-orange" style={{ marginTop: 2 }} />
                                <div>Roma,<br />Trastevere</div>
                            </div>
                        </div>
                        <div className="grid-item">
                            <div className="gi-label">Durata</div>
                            <div className="gi-val">
                                <Clock size={14} className="txt-orange" />
                                90 min
                            </div>
                        </div>
                        <div className="grid-item">
                            <div className="gi-label">Partecipanti</div>
                            <div className="gi-val">
                                <Users size={14} className="txt-orange" />
                                8/12
                            </div>
                        </div>
                        <div className="grid-item">
                            <div className="gi-label">Inizio</div>
                            <div className="gi-val">
                                <Calendar size={14} className="txt-orange" />
                                Tra 2 ore
                            </div>
                        </div>
                    </div>

                    <div className="action-row">
                        <button className="btn-live">
                            <Play size={20} style={{ fill: 'currentColor' }} />
                            <span style={{ width: 8, height: 8, background: 'white', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span>
                            Entra LIVE
                        </button>
                        <button className="btn-heart">
                            <Heart size={24} />
                        </button>
                    </div>
                </div>

                {/* Second Card (Preview) */}
                <div className="preview-card">
                    <img
                        src="https://images.unsplash.com/photo-1526392060635-9d6019884377?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80"
                        alt="Machu Picchu"
                        className="prev-img"
                    />
                    <div className="prev-overlay-tl">
                        <span className="live-pulse" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 6, height: 6, background: 'white', borderRadius: '50%' }}></span> LIVE
                        </span>
                    </div>
                    <div className="prev-overlay-tr">
                        <div style={{ fontWeight: 'bold', fontSize: '1.125rem', lineHeight: 1 }}>22€</div>
                        <div style={{ fontSize: '0.625rem', textDecoration: 'line-through', opacity: 0.7 }}>30€</div>
                    </div>

                    <div className="prev-overlay-bl">
                        <button className="cam-btn">
                            <Camera size={20} />
                        </button>
                    </div>
                </div>

            </div>
            <BottomNavigation />
        </div>
    );
};

export default TodayTours;
