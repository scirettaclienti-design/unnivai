import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import TopBar from "../components/TopBar";

export default function GuidePlaceholder({ type }) {
    const { id } = useParams();

    return (
        <div className="min-h-screen bg-ochre-100 p-4">
            <TopBar />
            <div className="mt-20 max-w-md mx-auto text-center">
                <Link to={`/tour-details/1`}>
                    <motion.button className="mb-8 p-2 bg-white rounded-full">
                        <ArrowLeft />
                    </motion.button>
                </Link>

                <h1 className="text-2xl font-bold text-gray-800 mb-4">
                    {type === 'chat' ? 'Chat con Guida' : 'Profilo Guida'}
                </h1>
                <p className="text-gray-600 mb-8">
                    Funzionalità {type === 'chat' ? 'di messaggistica' : 'profilo pubblico'} in arrivo.
                    <br />
                    ID Guida: {id}
                </p>

                <div className="p-6 bg-white rounded-3xl shadow-xl">
                    <span className="text-4xl">🚧</span>
                    <p className="mt-4 font-bold text-terracotta-500">Coming Soon</p>
                </div>
            </div>
        </div>
    );
}
