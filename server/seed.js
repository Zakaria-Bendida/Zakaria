import { fileURLToPath } from "url";
import pkg from "pg";

const { Pool } = pkg;

// HARDCODED DATABASE CONNECTION - for seeding only
const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "postgresql",
  database: "PostGis",
});

// Mock data for parkings table
const mockParkings = [
  {
    nom: "Parking Central",
    adresse: "Centre-ville Sidi Bel Abbès",
    capacite: 10,
    latitude: 35.1919,
    longitude: -0.6298,
  },
  {
    nom: "Parking Nord",
    adresse: "Quartier Nord, Sidi Bel Abbès",
    capacite: 8,
    latitude: 35.1985,
    longitude: -0.6245,
  },
  {
    nom: "Parking Sud",
    adresse: "Quartier Sud, Sidi Bel Abbès",
    capacite: 6,
    latitude: 35.185,
    longitude: -0.635,
  },
  {
    nom: "Parking Est",
    adresse: "Zone Industrielle, Sidi Bel Abbès",
    capacite: 15,
    latitude: 35.202,
    longitude: -0.618,
  },
  {
    nom: "Parking Ouest",
    adresse: "Cité 20 Août, Sidi Bel Abbès",
    capacite: 12,
    latitude: 35.188,
    longitude: -0.641,
  },
];

// Mock data for ambulances table
const mockAmbulances = [
  {
    immatriculation: "AMB001SBA",
    type: "Type A",
    statut: "Disponible",
    latitude: 35.1919,
    longitude: -0.6298,
    kilometrage: 45000,
    parking_id: 1,
  },
  {
    immatriculation: "AMB002SBA",
    type: "Type B",
    statut: "En mission",
    latitude: 35.1985,
    longitude: -0.6245,
    kilometrage: 32000,
    parking_id: 2,
  },
  {
    immatriculation: "AMB003SBA",
    type: "Type A",
    statut: "Maintenance",
    latitude: 35.185,
    longitude: -0.635,
    kilometrage: 67000,
    parking_id: 1,
  },
  {
    immatriculation: "AMB004SBA",
    type: "Type C",
    statut: "Disponible",
    latitude: 35.202,
    longitude: -0.618,
    kilometrage: 18000,
    parking_id: 3,
  },
  {
    immatriculation: "AMB005SBA",
    type: "Type B",
    statut: "En mission",
    latitude: 35.2183,
    longitude: -0.64688,
    kilometrage: 15000,
    parking_id: 4,
  },
  {
    immatriculation: "AMB006SBA",
    type: "Type A",
    statut: "Disponible",
    latitude: 35.19216,
    longitude: -0.63162,
    kilometrage: 23000,
    parking_id: 2,
  },
  {
    immatriculation: "AMB007SBA",
    type: "Type C",
    statut: "Disponible",
    latitude: 35.195,
    longitude: -0.628,
    kilometrage: 8900,
    parking_id: 5,
  },
  {
    immatriculation: "AMB008SBA",
    type: "Type B",
    statut: "En mission",
    latitude: 35.21358,
    longitude: -0.61269,
    kilometrage: 54000,
    parking_id: 3,
  },
];

// Mock data for hopitaux table
const mockHopitaux = [
  {
    nom: "Hôpital Universitaire Abdelkader Hassani",
    adresse: "Rue de la République, Sidi Bel Abbès",
    telephone: "+213-48-123-456",
    email: "contact@hu-hassani.dz",
    latitude: 35.195,
    longitude: -0.628,
  },
  {
    nom: "Clinique El Amal",
    adresse: "Cité El Amal, Sidi Bel Abbès",
    telephone: "+213-48-789-012",
    email: "info@elamal.dz",
    latitude: 35.188,
    longitude: -0.632,
  },
  {
    nom: "Centre de Santé Sidi Djilali",
    adresse: "Boulevard Sidi Djilali, Sidi Bel Abbès",
    telephone: "+213-48-345-678",
    email: "contact@cs-djilali.dz",
    latitude: 35.2,
    longitude: -0.62,
  },
  {
    nom: "Hôpital Militaire Régional",
    adresse: "Quartier Militaire, Sidi Bel Abbès",
    telephone: "+213-48-111-222",
    email: "hmr@sba.dz",
    latitude: 35.21,
    longitude: -0.64,
  },
  {
    nom: "Polyclinique El Bassatine",
    adresse: "Cité El Bassatine, Sidi Bel Abbès",
    telephone: "+213-48-567-890",
    email: "contact@elbassatine.dz",
    latitude: 35.183,
    longitude: -0.637,
  },
];

// Mock data for interventions table
const mockInterventions = [
  {
    type: "Accident de route",
    description: "Collision entre deux véhicules sur la RN7",
    statut: "en cours",
    latitude_depart: 35.193,
    longitude_depart: -0.627,
    caller_name: "Ahmed Benali",
    caller_phone: "0555123456",
    ambulance_id: 2,
    hospital_id: 1,
  },
  {
    type: "Urgence cardiaque",
    description: "Patient avec douleurs thoraciques intenses",
    statut: "terminée",
    latitude_depart: 35.189,
    longitude_depart: -0.631,
    caller_name: "Fatima Zohra",
    caller_phone: "0555789012",
    ambulance_id: 1,
    hospital_id: 2,
  },
  {
    type: "Chute",
    description: "Personne âgée ayant chuté dans un escalier",
    statut: "en cours",
    latitude_depart: 35.197,
    longitude_depart: -0.625,
    caller_name: "Mohamed Khelifi",
    caller_phone: "0555345678",
    ambulance_id: 4,
    hospital_id: 1,
  },
  {
    type: "Malaise",
    description: "Malaise vagal dans un supermarché",
    statut: "terminée",
    latitude_depart: 35.186,
    longitude_depart: -0.634,
    caller_name: "Samira Boudiaf",
    caller_phone: "0555901234",
    ambulance_id: 3,
    hospital_id: 3,
  },
  {
    type: "Accident domestique",
    description: "Brûlure grave à la main",
    statut: "en attente",
    latitude_depart: 35.212,
    longitude_depart: -0.619,
    caller_name: "Karim Meziani",
    caller_phone: "0555567890",
    ambulance_id: 5,
    hospital_id: 4,
  },
  {
    type: "Détresse respiratoire",
    description: "Difficultés respiratoires chez enfant",
    statut: "en cours",
    latitude_depart: 35.182,
    longitude_depart: -0.638,
    caller_name: "Nadia Ould",
    caller_phone: "0555456789",
    ambulance_id: 6,
    hospital_id: 2,
  },
  {
    type: "AVC",
    description: "Patient suspecté d'accident vasculaire cérébral",
    statut: "en cours",
    latitude_depart: 35.196,
    longitude_depart: -0.63,
    caller_name: "Abdelkader Bensaid",
    caller_phone: "0555678901",
    ambulance_id: 7,
    hospital_id: 1,
  },
  {
    type: "Femme enceinte",
    description: "Femme enceinte avec contractions",
    statut: "en attente",
    latitude_depart: 35.19,
    longitude_depart: -0.633,
    caller_name: "Leila Bouali",
    caller_phone: "0555345210",
    ambulance_id: 8,
    hospital_id: 5,
  },
  {
    type: "Intoxication alimentaire",
    description: "Plusieurs personnes avec vomissements",
    statut: "terminée",
    latitude_depart: 35.201,
    longitude_depart: -0.622,
    caller_name: "Rachid Hadj",
    caller_phone: "0555987654",
    ambulance_id: 2,
    hospital_id: 3,
  },
  {
    type: "Noyade",
    description: "Tentative de noyade à la piscine",
    statut: "en cours",
    latitude_depart: 35.187,
    longitude_depart: -0.636,
    caller_name: "Sofiane Mebarki",
    caller_phone: "0555765432",
    ambulance_id: 4,
    hospital_id: 2,
  },
];

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    console.log("🌱 Début du seed de la base de données...\n");

    // Clear existing data (optional - be careful with this!)
    console.log("⚠️  Suppression des données existantes...");
    await client.query("DELETE FROM interventions");
    await client.query("DELETE FROM ambulances");
    await client.query("DELETE FROM hopitaux");
    await client.query("DELETE FROM parkings");
    await client.query("ALTER SEQUENCE parkings_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE ambulances_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE hopitaux_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE interventions_id_seq RESTART WITH 1");
    console.log("✅ Données existantes supprimées\n");

    // 1. Insert parkings
    console.log("🅿️  Insertion des parkings...");
    for (const p of mockParkings) {
      const result = await client.query(
        `INSERT INTO parkings (nom, adresse, capacite, latitude, longitude) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id`,
        [p.nom, p.adresse, p.capacite, p.latitude, p.longitude],
      );
      console.log(
        `   ✅ Parking: ${p.nom} (Capacité: ${p.capacite}) - ID: ${result.rows[0].id}`,
      );
    }
    console.log(`   📊 Total: ${mockParkings.length} parkings insérés\n`);

    // 2. Insert hopitaux
    console.log("🏥 Insertion des hôpitaux...");
    for (const h of mockHopitaux) {
      const result = await client.query(
        `INSERT INTO hopitaux (nom, adresse, telephone, email, latitude, longitude) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id`,
        [h.nom, h.adresse, h.telephone, h.email, h.latitude, h.longitude],
      );
      console.log(`   ✅ Hôpital: ${h.nom} - ID: ${result.rows[0].id}`);
    }
    console.log(`   📊 Total: ${mockHopitaux.length} hôpitaux insérés\n`);

    // 3. Insert ambulances
    console.log("🚑 Insertion des ambulances...");
    for (const a of mockAmbulances) {
      const result = await client.query(
        `INSERT INTO ambulances (immatriculation, type, statut, latitude, longitude, kilometrage, parking_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id`,
        [
          a.immatriculation,
          a.type,
          a.statut,
          a.latitude,
          a.longitude,
          a.kilometrage,
          a.parking_id,
        ],
      );
      console.log(
        `   ✅ Ambulance: ${a.immatriculation} (${a.type}) - ${a.statut} - ${a.kilometrage} km - ID: ${result.rows[0].id}`,
      );
    }
    console.log(`   📊 Total: ${mockAmbulances.length} ambulances insérées\n`);

    // 4. Insert interventions
    console.log("🚨 Insertion des interventions...");
    for (const i of mockInterventions) {
      const result = await client.query(
        `INSERT INTO interventions (type, description, statut, latitude_depart, longitude_depart, caller_name, caller_phone, ambulance_id, hospital_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING id`,
        [
          i.type,
          i.description,
          i.statut,
          i.latitude_depart,
          i.longitude_depart,
          i.caller_name,
          i.caller_phone,
          i.ambulance_id,
          i.hospital_id,
        ],
      );
      console.log(
        `   ✅ Intervention: ${i.type} - ${i.statut} (Appelant: ${i.caller_name}) - ID: ${result.rows[0].id}`,
      );
    }
    console.log(
      `   📊 Total: ${mockInterventions.length} interventions insérées\n`,
    );

    await client.query("COMMIT");

    console.log("🎉 Seed terminé avec succès !");
    console.log("\n📊 RÉSUMÉ DES DONNÉES INSÉRÉES:");
    console.log("═".repeat(50));
    console.log(`   🅿️  Parkings:       ${mockParkings.length}`);
    console.log(`   🏥 Hôpitaux:       ${mockHopitaux.length}`);
    console.log(`   🚑 Ambulances:     ${mockAmbulances.length}`);
    console.log(`   🚨 Interventions:  ${mockInterventions.length}`);
    console.log("═".repeat(50));

    // Display current statistics
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM ambulances) as total_ambulances,
        (SELECT COUNT(*) FROM ambulances WHERE statut = 'Disponible') as disponibles,
        (SELECT COUNT(*) FROM ambulances WHERE statut = 'En mission') as en_mission,
        (SELECT COUNT(*) FROM ambulances WHERE statut = 'Maintenance') as maintenance,
        (SELECT COUNT(*) FROM hopitaux) as total_hopitaux,
        (SELECT COUNT(*) FROM parkings) as total_parkings,
        (SELECT COUNT(*) FROM interventions WHERE statut = 'en cours') as interventions_en_cours,
        (SELECT COUNT(*) FROM interventions WHERE statut = 'terminée') as interventions_terminees,
        (SELECT COUNT(*) FROM interventions WHERE statut = 'en attente') as interventions_attente
    `);

    console.log("\n📈 STATISTIQUES ACTUELLES:");
    console.log("═".repeat(50));
    console.log(
      `   🚑 Ambulances totales:        ${stats.rows[0].total_ambulances}`,
    );
    console.log(
      `   ✅ Ambulances disponibles:    ${stats.rows[0].disponibles}`,
    );
    console.log(`   🚗 Ambulances en mission:     ${stats.rows[0].en_mission}`);
    console.log(
      `   🔧 Ambulances maintenance:    ${stats.rows[0].maintenance}`,
    );
    console.log(
      `   🏥 Hôpitaux:                  ${stats.rows[0].total_hopitaux}`,
    );
    console.log(
      `   🅿️  Parkings:                  ${stats.rows[0].total_parkings}`,
    );
    console.log(
      `   🔴 Interventions en cours:    ${stats.rows[0].interventions_en_cours}`,
    );
    console.log(
      `   ✅ Interventions terminées:   ${stats.rows[0].interventions_terminees}`,
    );
    console.log(
      `   ⏳ Interventions en attente:  ${stats.rows[0].interventions_attente}`,
    );
    console.log("═".repeat(50));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\n❌ ERREUR lors du seed:");
    console.error("═".repeat(50));
    console.error(error.message);
    if (error.code) console.error(`Code: ${error.code}`);
    console.error("═".repeat(50));
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed function
seed();
