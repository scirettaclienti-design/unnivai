import React, { useState } from 'react';
import { Upload, X, Image as ImageIcon, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/use-toast';

export default function ImageUploader({ images = [], onImagesChange, bucketName = 'business-media', userId }) {
    const [uploading, setUploading] = useState(false);
    const { toast } = useToast();

    const uploadImage = async (event) => {
        try {
            setUploading(true);

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('Devi selezionare un\'immagine da caricare.');
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // 1. Attempt Upload
            let { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filePath, file);

            // 2. Handle 'Bucket not found' (404 or specific code)
            if (uploadError && (uploadError.message.includes('Bucket not found') || uploadError.statusCode === '404')) {
                console.warn("⚠️ Bucket missing. Attempting to create...");

                // Try creating bucket
                const { error: createError } = await supabase.storage.createBucket(bucketName, {
                    public: true
                });

                if (createError) {
                    // Failing to create usually means permissions issue, but we try.
                    console.error("❌ Failed to create bucket:", createError);
                    throw new Error("Il sistema di archiviazione non è configurato (Bucket missing). Contatta l'assistenza.");
                }

                // Retry Upload
                const { error: retryError } = await supabase.storage
                    .from(bucketName)
                    .upload(filePath, file);

                if (retryError) throw retryError;
                uploadError = null; // Clear error if retry worked
            }

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
            const publicUrl = data.publicUrl;

            // Update parent state
            onImagesChange([...images, publicUrl]);

        } catch (error) {
            console.error("Upload Failed:", error);
            toast({ title: 'Errore caricamento: ' + error.message, type: 'error' });
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (indexToRemove) => {
        onImagesChange(images.filter((_, index) => index !== indexToRemove));
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((url, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
                        <img loading="lazy" src={url} alt={`Upload ${index}`} className="w-full h-full object-cover" />
                        <button
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-white/80 p-1.5 rounded-full text-red-500 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}

                {/* Upload Button */}
                {images.length < 5 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors bg-gray-50">
                        {uploading ? <Loader className="animate-spin" /> : <Upload size={24} />}
                        <span className="text-xs font-bold mt-2">{uploading ? 'Caricamento...' : 'Aggiungi Foto'}</span>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={uploadImage}
                            disabled={uploading}
                            className="hidden"
                        />
                    </label>
                )}
            </div>
            {images.length === 0 && (
                <p className="text-xs text-gray-400 italic">Carica almeno 3 foto per apparire nei risultati migliori.</p>
            )}
        </div>
    );
}
