import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Camera, Upload, Heart, Share2, MessageCircle, ArrowLeft, Home, Plus, Filter, Grid, Search, MapPin, Calendar, Tag, Facebook, Twitter, Instagram, Link as LinkIcon, Eye, MoreHorizontal, Edit, Trash2, Flag, Users, TrendingUp, Award } from "lucide-react";
import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNavigation from "../components/BottomNavigation";

const samplePhotos = [
    {
        id: 1,
        userId: 1,
        username: "Marco Rossi",
        userAvatar: "🧑‍🍳",
        tourTitle: "Cucina con Nonna Elena",
        tourLocation: "Toscana, Chianti",
        imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500&h=600&fit=crop",
        caption: "Imparando i segreti della pasta fatta in casa! Un'esperienza incredibile con Nonna Elena 👵🍝 #CucinaToscana #PastaFresca",
        likes: 47,
        shares: 12,
        comments: 8,
        isLiked: true,
        tags: ["cucina", "toscana", "pasta", "tradizione"],
        createdAt: "2 ore fa",
        isPublic: true
    },
    {
        id: 2,
        userId: 2,
        username: "Sofia Bianchi",
        userAvatar: "👩‍🎨",
        tourTitle: "Street Art di Napoli",
        tourLocation: "Napoli, Quartieri Spagnoli",
        imageUrl: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=500&h=600&fit=crop",
        caption: "I colori esplosivi della street art napoletana! Ogni muro racconta una storia 🎨✨ #StreetArt #Napoli #Arte",
        likes: 63,
        shares: 18,
        comments: 15,
        isLiked: false,
        tags: ["arte", "napoli", "street-art", "colori"],
        createdAt: "5 ore fa",
        isPublic: true
    },
    {
        id: 3,
        userId: 3,
        username: "Luca Verdi",
        userAvatar: "🚤",
        tourTitle: "Tramonto in Gondola",
        tourLocation: "Venezia, Canal Grande",
        imageUrl: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=500&h=600&fit=crop",
        caption: "Il momento magico del tramonto veneziano... niente parole possono descrivere questa bellezza 🌅🚤 #Venezia #Tramonto #Gondola",
        likes: 89,
        shares: 34,
        comments: 22,
        isLiked: true,
        tags: ["venezia", "tramonto", "gondola", "romantico"],
        createdAt: "1 giorno fa",
        isPublic: true
    },
    {
        id: 4,
        userId: 1,
        username: "Marco Rossi",
        userAvatar: "🧑‍🍳",
        tourTitle: "Degustazione Vini Siciliani",
        tourLocation: "Sicilia, Etna",
        imageUrl: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=500&h=600&fit=crop",
        caption: "Degustazione sui pendii dell'Etna con vista mozzafiato! Vini vulcanici dal sapore unico 🍷🌋 #Sicilia #Vino #Etna",
        likes: 71,
        shares: 25,
        comments: 19,
        isLiked: false,
        tags: ["sicilia", "vino", "etna", "degustazione"],
        createdAt: "2 giorni fa",
        isPublic: true
    }
];

export default function PhotosPage() {
    const [photos, setPhotos] = useState(samplePhotos);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [viewMode, setViewMode] = useState('grid');
    const [filterTag, setFilterTag] = useState('all');
    const [newComment, setNewComment] = useState('');

    const toggleLike = (photoId) => {
        setPhotos(prev => prev.map(photo =>
            photo.id === photoId
                ? {
                    ...photo,
                    isLiked: !photo.isLiked,
                    likes: photo.isLiked ? photo.likes - 1 : photo.likes + 1
                }
                : photo
        ));
    };

    const sharePhoto = (platform, photo) => {
        const message = `Guarda questa foto fantastica dal mio tour "${photo.tourTitle}" a ${photo.tourLocation}! 📸✨`;
        const url = window.location.href;

        switch (platform) {
            case 'facebook':
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(message)}`, '_blank');
                break;
            case 'twitter':
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`, '_blank');
                break;
            case 'instagram':
                navigator.clipboard.writeText(message);
                alert('Messaggio copiato! Condividilo su Instagram Stories');
                break;
            case 'copy':
                navigator.clipboard.writeText(`${message} ${url}`);
                alert('Link copiato negli appunti!');
                break;
        }
        setShowShareModal(false);
    };

    const allTags = Array.from(new Set(photos.flatMap(photo => photo.tags)));
    const filteredPhotos = filterTag === 'all' ? photos : photos.filter(photo => photo.tags.includes(filterTag));

    return (
        <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-8 pb-24">
                {/* Back Button */}
                <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Link to="/dashboard-user">
                        <motion.button
                            className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm text-terracotta-600 px-4 py-2 rounded-2xl shadow-lg hover:shadow-xl transition-all group"
                            whileHover={{ scale: 1.05, x: 5 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-medium">Home</span>
                            <span className="text-lg">🏠</span>
                        </motion.button>
                    </Link>
                </motion.div>

                {/* Header */}
                <motion.div
                    className="text-center mb-10 relative"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-terracotta-300 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
                    <motion.div
                        className="text-7xl mb-4 relative z-10"
                        animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                    >
                        📸
                    </motion.div>
                    <h1 className="text-3xl font-black text-gray-800 mb-2 relative z-10 tracking-tight">Foto dei Tour</h1>
                    <p className="text-gray-600 font-medium relative z-10">Condividi i tuoi ricordi migliori</p>
                </motion.div>

                {/* Action Bar */}
                <motion.div
                    className="flex items-center justify-between mb-8 bg-white/80 backdrop-blur-md rounded-2xl p-2 pl-4 shadow-xl border border-white/50"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    <div className="flex items-center space-x-3">
                        <motion.button
                            onClick={() => setViewMode(viewMode === 'grid' ? 'feed' : 'grid')}
                            className={`p-2.5 rounded-xl transition-all shadow-sm ${viewMode === 'grid'
                                ? 'bg-terracotta-500 text-white shadow-terracotta-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Grid className="w-5 h-5" />
                        </motion.button>

                        <div className="h-8 w-px bg-gray-200 mx-2"></div>

                        <div className="relative">
                            <Filter className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                            <select
                                value={filterTag}
                                onChange={(e) => setFilterTag(e.target.value)}
                                className="bg-transparent text-gray-700 font-bold text-sm focus:outline-none pl-8 py-2 pr-4 appearance-none cursor-pointer hover:text-terracotta-600 transition-colors"
                            >
                                <option value="all">Tutti i Tag</option>
                                {allTags.map(tag => (
                                    <option key={tag} value={tag}>#{tag}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <motion.button
                        onClick={() => setShowUploadModal(true)}
                        className="bg-black text-white p-3 px-5 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center space-x-2 border border-black/10"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-bold text-sm">Carica</span>
                    </motion.button>
                </motion.div>

                {/* Photo Grid/Feed */}
                <div className={`${viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-6'}`}>
                    {filteredPhotos.map((photo, index) => (
                        <motion.div
                            key={photo.id}
                            className={`bg-white/70 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all ${viewMode === 'feed' ? 'p-4' : ''
                                }`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ scale: 1.02 }}
                        >
                            {viewMode === 'feed' && (
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="w-10 h-10 bg-gradient-to-br from-terracotta-300 to-terracotta-400 rounded-full flex items-center justify-center">
                                        <span className="text-lg">{photo.userAvatar}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-800 text-sm">{photo.username}</h4>
                                        <p className="text-xs text-gray-600">{photo.createdAt} • {photo.tourLocation}</p>
                                    </div>
                                    <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                        <MoreHorizontal className="w-4 h-4 text-gray-500" />
                                    </button>
                                </div>
                            )}

                            <div
                                className="relative cursor-pointer group"
                                onClick={() => setSelectedPhoto(photo)}
                            >
                                <img
                                    src={photo.imageUrl}
                                    alt={photo.caption}
                                    className={`w-full object-cover transition-transform duration-700 group-hover:scale-110 ${viewMode === 'grid' ? 'h-48 rounded-2xl' : 'h-72 rounded-xl'
                                        }`}
                                />

                                {viewMode === 'grid' && (
                                    <>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90 rounded-2xl" />
                                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
                                    </>
                                )}

                                <div className="absolute top-3 right-3 flex space-x-1">
                                    {photo.tags.slice(0, 1).map(tag => (
                                        <span
                                            key={tag}
                                            className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full border border-white/20"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>

                                {viewMode === 'grid' && (
                                    <div className="absolute bottom-3 left-3 right-3 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                        <h4 className="text-white font-bold text-sm mb-0.5 leading-tight line-clamp-1">{photo.tourTitle}</h4>
                                        <p className="text-white/70 text-[10px] flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                                            <MapPin className="w-3 h-3 mr-1" />
                                            {photo.tourLocation}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {viewMode === 'feed' && (
                                <div className="mt-4">
                                    <h4 className="font-bold text-gray-800 mb-2">{photo.tourTitle}</h4>
                                    <p className="text-sm text-gray-600 mb-3">{photo.caption}</p>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <motion.button
                                                onClick={() => toggleLike(photo.id)}
                                                className="flex items-center space-x-1"
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                            >
                                                <Heart className={`w-5 h-5 ${photo.isLiked ? 'text-red-500 fill-current' : 'text-gray-500'}`} />
                                                <span className="text-sm font-medium text-gray-700">{photo.likes}</span>
                                            </motion.button>

                                            <button className="flex items-center space-x-1">
                                                <MessageCircle className="w-5 h-5 text-gray-500" />
                                                <span className="text-sm font-medium text-gray-700">{photo.comments}</span>
                                            </button>

                                            <motion.button
                                                onClick={() => {
                                                    setSelectedPhoto(photo);
                                                    setShowShareModal(true);
                                                }}
                                                className="flex items-center space-x-1"
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                            >
                                                <Share2 className="w-5 h-5 text-gray-500" />
                                                <span className="text-sm font-medium text-gray-700">{photo.shares}</span>
                                            </motion.button>
                                        </div>

                                        <span className="text-xs text-gray-500">{photo.createdAt}</span>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>

                {/* Photo Detail Modal */}
                <AnimatePresence>
                    {selectedPhoto && !showShareModal && (
                        <motion.div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedPhoto(null)}
                        >
                            <motion.div
                                className="bg-white rounded-3xl max-w-sm w-full max-h-[90vh] overflow-y-auto"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-terracotta-300 to-terracotta-400 rounded-full flex items-center justify-center">
                                            <span className="text-lg">{selectedPhoto.userAvatar}</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800">{selectedPhoto.username}</h4>
                                            <p className="text-xs text-gray-600">{selectedPhoto.createdAt}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedPhoto(null)}
                                        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* Photo */}
                                <img
                                    src={selectedPhoto.imageUrl}
                                    alt={selectedPhoto.caption}
                                    className="w-full h-64 object-cover"
                                />

                                {/* Content */}
                                <div className="p-4">
                                    <h3 className="font-bold text-gray-800 mb-2">{selectedPhoto.tourTitle}</h3>
                                    <p className="text-sm text-gray-600 mb-3 flex items-center">
                                        <MapPin className="w-4 h-4 mr-1 text-terracotta-400" />
                                        {selectedPhoto.tourLocation}
                                    </p>
                                    <p className="text-sm text-gray-700 mb-4">{selectedPhoto.caption}</p>

                                    {/* Tags */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {selectedPhoto.tags.map(tag => (
                                            <span
                                                key={tag}
                                                className="bg-terracotta-100 text-terracotta-700 text-xs px-2 py-1 rounded-full"
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                                        <div className="flex items-center space-x-4">
                                            <motion.button
                                                onClick={() => toggleLike(selectedPhoto.id)}
                                                className="flex items-center space-x-1"
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                            >
                                                <Heart className={`w-6 h-6 ${selectedPhoto.isLiked ? 'text-red-500 fill-current' : 'text-gray-500'}`} />
                                                <span className="font-medium text-gray-700">{selectedPhoto.likes}</span>
                                            </motion.button>

                                            <button className="flex items-center space-x-1">
                                                <MessageCircle className="w-6 h-6 text-gray-500" />
                                                <span className="font-medium text-gray-700">{selectedPhoto.comments}</span>
                                            </button>
                                        </div>

                                        <motion.button
                                            onClick={() => setShowShareModal(true)}
                                            className="bg-terracotta-400 text-white px-4 py-2 rounded-xl hover:bg-terracotta-500 transition-colors flex items-center space-x-2"
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            <Share2 className="w-4 h-4" />
                                            <span>Condividi</span>
                                        </motion.button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Share Modal */}
                <AnimatePresence>
                    {showShareModal && selectedPhoto && (
                        <motion.div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowShareModal(false)}
                        >
                            <motion.div
                                className="bg-white rounded-3xl p-6 max-w-sm w-full"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-gray-800">Condividi Foto</h3>
                                    <button
                                        onClick={() => setShowShareModal(false)}
                                        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <p className="text-sm text-gray-600 mb-6">
                                    Condividi "{selectedPhoto.tourTitle}" sui social
                                </p>

                                <div className="grid grid-cols-2 gap-3">
                                    <motion.button
                                        onClick={() => sharePhoto('facebook', selectedPhoto)}
                                        className="bg-blue-600 text-white p-4 rounded-2xl flex flex-col items-center space-y-2 hover:bg-blue-700 transition-colors"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Facebook className="w-6 h-6" />
                                        <span className="text-sm font-medium">Facebook</span>
                                    </motion.button>

                                    <motion.button
                                        onClick={() => sharePhoto('twitter', selectedPhoto)}
                                        className="bg-black text-white p-4 rounded-2xl flex flex-col items-center space-y-2 hover:bg-gray-800 transition-colors"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Twitter className="w-6 h-6" />
                                        <span className="text-sm font-medium">Twitter</span>
                                    </motion.button>

                                    <motion.button
                                        onClick={() => sharePhoto('instagram', selectedPhoto)}
                                        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-2xl flex flex-col items-center space-y-2 hover:from-purple-600 hover:to-pink-600 transition-colors"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Instagram className="w-6 h-6" />
                                        <span className="text-sm font-medium">Instagram</span>
                                    </motion.button>

                                    <motion.button
                                        onClick={() => sharePhoto('copy', selectedPhoto)}
                                        className="bg-gray-500 text-white p-4 rounded-2xl flex flex-col items-center space-y-2 hover:bg-gray-600 transition-colors"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <LinkIcon className="w-6 h-6" />
                                        <span className="text-sm font-medium">Copia Link</span>
                                    </motion.button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Upload Modal */}
                <AnimatePresence>
                    {showUploadModal && (
                        <motion.div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowUploadModal(false)}
                        >
                            <motion.div
                                className="bg-white rounded-3xl p-6 max-w-sm w-full"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-gray-800">Carica Foto Tour</h3>
                                    <button
                                        onClick={() => setShowUploadModal(false)}
                                        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-terracotta-400 transition-colors cursor-pointer">
                                        <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-600 mb-2">Tocca per caricare una foto</p>
                                        <p className="text-xs text-gray-500">JPG, PNG fino a 10MB</p>
                                    </div>

                                    <input
                                        type="text"
                                        placeholder="Titolo del tour"
                                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
                                    />

                                    <input
                                        type="text"
                                        placeholder="Località"
                                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
                                    />

                                    <textarea
                                        placeholder="Descrivi la tua esperienza..."
                                        rows={3}
                                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-terracotta-400 resize-none"
                                    />

                                    <input
                                        type="text"
                                        placeholder="Tag (separati da virgola)"
                                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
                                    />

                                    <div className="flex items-center space-x-3">
                                        <input
                                            type="checkbox"
                                            id="public"
                                            className="w-4 h-4 text-terracotta-600 rounded"
                                            defaultChecked
                                        />
                                        <label htmlFor="public" className="text-sm text-gray-700">
                                            Rendi pubblica la foto
                                        </label>
                                    </div>
                                </div>

                                <motion.button
                                    className="w-full mt-6 bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white py-3 px-4 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        alert('Foto caricata con successo!');
                                        setShowUploadModal(false);
                                    }}
                                >
                                    Pubblica Foto
                                </motion.button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <BottomNavigation />
        </div>
    );
}
