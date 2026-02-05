import { motion } from "framer-motion";
import { useState } from "react";
import { 
  Video, 
  Bot, 
  Home, 
  Utensils, 
  Trees, 
  Landmark, 
  Calendar 
} from "lucide-react";

const categories = [
  {
    id: 1,
    name: "Tour Live",
    icon: Video,
    gradient: "from-terracotta-300 to-terracotta-400",
    delay: 0
  },
  {
    id: 2,
    name: "AI Itinerario",
    icon: Bot,
    gradient: "from-olive-300 to-olive-400",
    delay: 0.2
  },
  {
    id: 3,
    name: "Borghi",
    icon: Home,
    gradient: "from-ochre-300 to-ochre-400",
    delay: 0.4
  },
  {
    id: 4,
    name: "Cibo Locale",
    icon: Utensils,
    gradient: "from-terracotta-400 to-terracotta-500",
    delay: 0.6
  },
  {
    id: 5,
    name: "Natura",
    icon: Trees,
    gradient: "from-olive-400 to-olive-500",
    delay: 0.8
  },
  {
    id: 6,
    name: "Cultura",
    icon: Landmark,
    gradient: "from-ochre-400 to-ochre-500",
    delay: 1.0
  },
  {
    id: 7,
    name: "Eventi",
    icon: Calendar,
    gradient: "from-terracotta-300 to-olive-400",
    delay: 1.2
  }
];

export default function CategoryIcons() {
  const [clickedId, setClickedId] = useState<number | null>(null);

  const handleClick = (categoryId: number, categoryName: string) => {
    setClickedId(categoryId);
    console.log(`Category selected: ${categoryName}`);
    
    // Reset animation after a short delay
    setTimeout(() => setClickedId(null), 600);
  };

  return (
    <div className="organic-grid mb-12">
      {categories.map((category) => {
        const IconComponent = category.icon;
        const isClicked = clickedId === category.id;
        return (
          <motion.div
            key={category.id}
            className="icon-item"
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              rotate: [0, 2, -2, 0]
            }}
            transition={{ 
              delay: category.delay, 
              duration: 0.8,
              rotate: {
                repeat: Infinity,
                duration: 6,
                ease: "easeInOut"
              }
            }}
          >
            <motion.div 
              className="rounded-full transform transition-all duration-500"
              whileHover={{ 
                y: -8, 
                scale: 1.1, 
                rotate: 5,
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
              }}
              whileTap={{ 
                scale: 0.9,
                rotate: -5
              }}
            >
              <motion.button
                className={`w-20 h-20 bg-gradient-to-br ${category.gradient} rounded-full shadow-lg flex items-center justify-center group relative overflow-hidden`}
                onClick={() => handleClick(category.id, category.name)}
                whileHover={{
                  background: `linear-gradient(135deg, ${category.gradient})`,
                }}
                animate={isClicked ? {
                  scale: [1, 1.3, 1],
                  rotate: [0, 360, 0],
                  boxShadow: [
                    "0 4px 15px rgba(0,0,0,0.2)",
                    "0 8px 30px rgba(255,255,255,0.6)",
                    "0 4px 15px rgba(0,0,0,0.2)"
                  ]
                } : {}}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              >
                {/* Sparkle effect */}
                {isClicked && (
                  <>
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-white rounded-full"
                        initial={{
                          x: 0,
                          y: 0,
                          opacity: 1,
                          scale: 0
                        }}
                        animate={{
                          x: Math.cos(i * 45 * Math.PI / 180) * 40,
                          y: Math.sin(i * 45 * Math.PI / 180) * 40,
                          opacity: 0,
                          scale: [0, 1, 0]
                        }}
                        transition={{
                          duration: 0.6,
                          ease: "easeOut"
                        }}
                      />
                    ))}
                  </>
                )}
                
                <motion.div
                  className="absolute inset-0 bg-white/20 rounded-full"
                  initial={{ scale: 0, opacity: 0 }}
                  whileHover={{ 
                    scale: 1, 
                    opacity: 1,
                    transition: { duration: 0.3 }
                  }}
                />
                <motion.div
                  whileHover={{ 
                    scale: 1.2, 
                    rotate: 360 
                  }}
                  animate={isClicked ? {
                    scale: [1, 1.4, 1],
                    rotate: [0, 360, 0]
                  } : {}}
                  transition={{ 
                    rotate: { duration: 0.6, ease: "easeInOut" },
                    scale: { duration: 0.3 }
                  }}
                >
                  <IconComponent className="text-white w-6 h-6 relative z-10" />
                </motion.div>
              </motion.button>
            </motion.div>
            <motion.span 
              className="text-sm text-gray-700 mt-3 block font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: category.delay + 0.3 }}
            >
              {category.name}
            </motion.span>
          </motion.div>
        );
      })}
    </div>
  );
}
