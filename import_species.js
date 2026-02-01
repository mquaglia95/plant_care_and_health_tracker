require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API_KEY = process.env.PERENUAL_API_KEY;

const mapWateringToDays = (watering) => {
  const lookup = { 'Frequent': 3, 'Average': 7, 'Minimum': 14, 'None': 30 };
  return lookup[watering] || 7; 
};

async function seedSpecies() {
  console.log("🌱 Starting expansive import (Target: ~120 plants)...");

  // Loop through pages 1 to 4
  for (let page = 1; page <= 4; page++) {
    try {
      console.log(`Page ${page}: Fetching...`);
      // We filter for indoor=1 to get houseplants
      const url = `https://perenual.com/api/species-list?key=${API_KEY}&indoor=1&page=${page}`;
      const response = await axios.get(url);
      const plants = response.data.data;

      const formattedPlants = plants.map(plant => ({
        scientific_name: plant.scientific_name[0],
        common_name: plant.common_name,
        typical_watering_frequency_days: mapWateringToDays(plant.watering),
        light_requirements: plant.sunlight ? plant.sunlight.join(', ') : 'Partial Shade',
        // Optional: you can add a column for images later, but let's keep it clean for now
        is_toxic_to_cats: true 
      }));

      const { error } = await supabase
        .from('species_dim')
        .upsert(formattedPlants, { onConflict: 'scientific_name' });

      if (error) throw error;
      console.log(`Page ${page}: ✅ Imported ${formattedPlants.length} plants.`);

    } catch (err) {
      console.error(`Page ${page}: ❌ Error:`, err.message);
    }
  }
  console.log("🌿 Expansive Import Complete!");
}

seedSpecies();