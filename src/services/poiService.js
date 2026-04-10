import { validateData } from '@/services/dataService';
import { ActivityUISchema } from '@/lib/schemas';

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export const poiService = {
  async fetchRealPois(city) {
    // Recuperiamo monumenti, musei e siti storici
    const query = `
      [out:json][timeout:25];
      area["name"="${city}"]["admin_level"~"4|8"]->.searchArea;
      (
        node["historic"](area.searchArea);
        node["tourism"="museum"](area.searchArea);
        node["tourism"="attraction"](area.searchArea);
        way["historic"](area.searchArea);
      );
      out body;
      >;
      out skel qt;
    `;

    try {
      const response = await fetch(`${OVERPASS_URL}?data=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("OSM Fetch failed");
      const data = await response.json();
      
      return data.elements
        .filter(el => el.tags && el.tags.name)
        .map(el => {
          const raw = {
            id: `osm-${el.id}`,
            name: el.tags.name,
            lat: el.lat || el.center?.lat,
            lng: el.lon || el.center?.lon,
            city: city,
            category: 'monument',
            type: el.tags.historic || 'museum',
            icon: el.tags.historic === 'church' ? '⛪' : '🏛️',
            level: 0, // Level 0: Base Esplorazione
            historicalNotes: "Dato reale da OpenStreetMap. In attesa di arricchimento AI.",
            funFacts: [],
            source: 'osm'
          };
          // Validazione Contract-First
          return validateData(ActivityUISchema, raw, `POI:${raw.name}`);
        });
    } catch (error) {
      console.error("🚨 [poiService] Errore:", error);
      return [];
    }
  }
};
