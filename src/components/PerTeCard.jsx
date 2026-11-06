// PER-TE-TRE (T27) — la scheda di una proposta di Per Te: la stessa sulla home e nell'elenco di «Vedi tutte».
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, MapPin, Star } from 'lucide-react';
import TourCover from '@/components/TourCover';

const PerTeCard = ({ exp, city, className = 'block w-[calc((100vw-60px)/2)] max-w-[170px] min-w-[150px] shrink-0 snap-start' }) => (
    <Link to={`/tour-details/${exp.id}`} state={{ tourData: exp, origine: 'per_te' }} className={className}>
        <motion.div
            className="group flex flex-col h-[265px] rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-obsidian-border bg-obsidian-card"
            whileHover={{ y: -3 }}
        >
            {/* Foto Places PULITA (ramo A) o Gradient Categoria (ramo B) con rapporto fisso */}
            <div className="relative h-28 w-full overflow-hidden shrink-0 border-b border-obsidian-border bg-obsidian-raised">
                <TourCover cover={exp.image} category={exp.category || exp.type} type={exp.type} title={exp.title} animateKey={exp.image} overlay={false} />
            </div>

            {/* Blocco Dati su bg-obsidian-card: due card intere a schermo */}
            <div className="p-2.5 flex flex-col flex-1 justify-between">
                <div>
                    {/* Badge discreto */}
                    <div className="mb-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-obsidian-raised text-obsidian-secondary border border-obsidian-border tracking-tight truncate max-w-full">
                            {exp.category}
                        </span>
                    </div>

                    {/* Titolo compatto */}
                    <h4 className="font-playfair font-bold text-xs text-obsidian-primary leading-snug line-clamp-2 mb-1">
                        {exp.title}
                    </h4>

                    {/* Riga Include o Luogo */}
                    {exp.featuredPoi && Number.isFinite(exp.featuredPoi.rating) ? (
                        <div className="flex items-center gap-1 text-[10px] text-obsidian-secondary truncate">
                            <Star className="w-3 h-3 text-brand-orange fill-current shrink-0" />
                            <span className="truncate">{exp.featuredPoi.name}</span>
                            <span className="font-semibold text-obsidian-primary shrink-0">· {exp.featuredPoi.rating.toFixed(1)}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 text-[10px] text-obsidian-secondary truncate">
                            <MapPin className="w-3 h-3 text-obsidian-secondary/80 shrink-0" />
                            <span className="truncate">{exp.location || (city ? `Tour a ${city}` : 'Esperienza')}</span>
                        </div>
                    )}
                </div>

                {/* Metadati ancorati in basso */}
                <div className="mt-auto pt-2 border-t border-obsidian-border flex items-center justify-between text-[10px] text-obsidian-secondary">
                    <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-obsidian-secondary shrink-0" />
                        <span className="truncate">{exp.duration}</span>
                    </div>
                    {Number.isFinite(exp.price) && (
                        <span className="font-bold text-xs text-obsidian-primary shrink-0">€{exp.price}</span>
                    )}
                </div>
            </div>
        </motion.div>
    </Link>
);

export default PerTeCard;
