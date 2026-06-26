// server/services/routingService.js
// FIXED:
// - comfort path, fastest path avoiding blocked edges, hospital routing fix
// - NOUVEAU: getBasePathAvoidingBlocked — algo de base (dijkstra simple, sans
//   facteur horaire/trafic) utilisé pour le trajet SOS->driver. Il évite
//   uniquement les obstacles actifs, jamais de "fastest"/"comfort" sur ce segment.
// FIX v5 (CE PATCH) — CAUSE RÉELLE DU BUG "fastest n'évite pas l'obstacle" :
// Dans getPathAvoidingEdges, la sous-requête SQL passée à pgr_dijkstra
// référençait `FROM ways WHERE source IS NOT NULL ${blockedClause}` — SANS
// alias sur la table `ways`. Or `blockedClause` est construit comme
// `AND w.gid NOT IN (...)`, qui suppose un alias `w`. Comme cet alias
// n'existait pas dans cette sous-requête précise (contrairement à
// getBasePathAvoidingBlocked et getComfortPath, qui écrivent bien
// `FROM ways w`), la requête échouait dès qu'au moins un obstacle actif
// existait (blockedClause non vide) avec une erreur Postgres du type
// "missing FROM-clause entry for table w" ou "relation w does not exist".
// Cette erreur était silencieusement absorbée par le bloc catch, qui
// retombe sur getPathWithGeometry — une fonction qui ne tient JAMAIS compte
// des obstacles. Résultat observé : le serveur renvoie bien un nouveau
// tracé (donc le client le redessine, et le message "recalculé" apparaît
// normalement), mais ce tracé traverse toujours la rue bloquée, puisqu'il
// vient en réalité du fallback sans obstacle. C'est pour ça que ça
// "marchait par hasard" tant qu'aucun obstacle n'était encore actif
// (blockedClause vide → requête valide), et cassait dès qu'un obstacle
// existait. getComfortPath et getBasePathAvoidingBlocked n'ont jamais eu ce
// bug car leurs sous-requêtes écrivent bien `FROM ways w` avec l'alias.
// FIX: ajout de l'alias `w` dans la sous-requête de getPathAvoidingEdges,
// exactement comme dans les deux autres fonctions. Aucun autre changement
// de comportement.

import { pool } from "../config/database.js";

class RoutingService {
  // ── Find nearest vertex to GPS coordinates ────────────────────────────────
  async findNearestVertex(lat, lon) {
    try {
      const query = `
        SELECT id,
               ST_Distance(the_geom, ST_SetSRID(ST_MakePoint($1,$2),4326)) AS distance
        FROM ways_vertices_pgr
        ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint($1,$2),4326)
        LIMIT 1
      `;
      const result = await pool.query(query, [lon, lat]);
      if (result.rows.length > 0) {
        return {
          success: true,
          vertex_id: result.rows[0].id,
          distance: result.rows[0].distance,
          data: { vertex_id: result.rows[0].id },
        };
      }
      return { success: false, error: "No vertex found" };
    } catch (error) {
      console.error("Nearest vertex error:", error);
      return { success: false, error: error.message };
    }
  }

  // ── Find nearest ROAD SEGMENT (edge) to GPS coordinates ───────────────────
  // Used for roadblock reporting: we need the real street geometry, not just
  // a network vertex (a vertex is a point/intersection, not a drawable road).
  async findNearestEdge(lat, lon) {
    try {
      const query = `
        SELECT gid,
               ST_AsGeoJSON(the_geom) AS geometry
        FROM ways
        ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint($1,$2),4326)
        LIMIT 1
      `;
      const result = await pool.query(query, [lon, lat]);
      if (!result.rows.length)
        return { success: false, error: "No edge found" };

      const row = result.rows[0];
      let coords = [];
      try {
        const geo = JSON.parse(row.geometry);
        // GeoJSON is [lon, lat] — convert to [lat, lon] for direct Leaflet use
        coords = geo.coordinates.map(([lon2, lat2]) => [lat2, lon2]);
      } catch {
        /* ignore */
      }

      if (coords.length < 2)
        return { success: false, error: "Edge has no usable geometry" };

      return {
        success: true,
        edge_id: row.gid,
        road_name: `Route #${row.gid}`,
        coords, // [lat, lon] pairs, ready for Leaflet
      };
    } catch (error) {
      console.error("Find nearest edge error:", error);
      return { success: false, error: error.message };
    }
  }

  // ── Time factor based on hour of day ─────────────────────────────────────
  getTimeFactor(hour, minute) {
    if (hour >= 23 || hour <= 6 || (hour === 6 && minute <= 30)) return 0.8;
    if ((hour === 7 && minute >= 30) || (hour >= 8 && hour < 9)) return 1.5;
    if (hour >= 17 && hour < 19) return 1.6;
    if (hour >= 12 && hour < 14) return 1.3;
    if (hour >= 14 && hour < 17) return 1.2;
    return 1.0;
  }

  // ── Get zone traffic factor ───────────────────────────────────────────────
  async getZoneTrafficFactor(lat, lon) {
    try {
      const result = await pool.query(
        `SELECT congestion_factor, active_hours, name
         FROM traffic_zones
         WHERE ST_DWithin(
           ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,
           ST_SetSRID(ST_MakePoint(center_lon,center_lat),4326)::geography,
           radius_meters
         )`,
        [lon, lat],
      );
      if (!result.rows.length) return { factor: 1.0, zoneName: null };

      let maxFactor = 1.0,
        activeZone = null;
      const currentHour = new Date().getHours();
      for (const zone of result.rows) {
        let isActive = true;
        if (zone.active_hours) {
          const [start, end] = zone.active_hours.split("-");
          const s = parseInt(start.split(":")[0]);
          const e = parseInt(end.split(":")[0]);
          if (currentHour < s || currentHour >= e) isActive = false;
        }
        if (isActive && zone.congestion_factor > maxFactor) {
          maxFactor = zone.congestion_factor;
          activeZone = zone.name;
        }
      }
      return { factor: maxFactor, zoneName: activeZone };
    } catch {
      return { factor: 1.0, zoneName: null };
    }
  }

  // ── Base path with geometry (no traffic, no blocked roads) ───────────────
  async getPathWithGeometry(startVertexId, endVertexId, directed = true) {
    try {
      if (!startVertexId || !endVertexId)
        return { success: false, error: "Missing vertex IDs" };

      const query = `
        SELECT a.seq, a.node, a.edge, a.cost, a.agg_cost,
               ST_AsGeoJSON(
                 CASE WHEN a.node = w.source THEN w.the_geom
                      ELSE ST_Reverse(w.the_geom) END
               ) AS geometry
        FROM pgr_dijkstra(
          'SELECT gid::bigint AS id, source::bigint, target::bigint,
                  (ST_Length(the_geom::geography) / (COALESCE(maxspeed_forward,40)*1000.0/3600.0)) AS cost,
                  (ST_Length(the_geom::geography) / (COALESCE(maxspeed_backward,maxspeed_forward,40)*1000.0/3600.0)) AS reverse_cost
           FROM ways WHERE source IS NOT NULL',
          $1::bigint, $2::bigint, $3::boolean
        ) a
        JOIN ways w ON a.edge = w.gid
        ORDER BY a.seq
      `;
      const result = await pool.query(query, [
        startVertexId,
        endVertexId,
        directed,
      ]);
      if (!result.rows?.length)
        return { success: false, error: "No route found" };
      return { success: true, data: result.rows };
    } catch (error) {
      console.error("Path geometry error:", error);
      return { success: false, error: error.message };
    }
  }

  // ── NOUVEAU — Path SOS : dijkstra simple (PAS fastest/comfort) ───────────
  // Évite uniquement les obstacles actifs (blocked_roads). Utilisé pour TOUT
  // trajet ambulance -> SOS. Le fastest/comfort ne s'applique JAMAIS ici,
  // uniquement sur le segment SOS -> hôpital (voir getPathAvoidingEdges /
  // getComfortPath plus bas, appelés depuis driverController pour l'hôpital).
  async getBasePathAvoidingBlocked(
    startVertexId,
    endVertexId,
    directed = true,
  ) {
    try {
      if (!startVertexId || !endVertexId)
        return { success: false, error: "Missing vertex IDs" };

      let dbBlocked = [];
      try {
        const res = await pool.query(
          `SELECT edge_id FROM blocked_roads
           WHERE status = 'active'`,
        );
        dbBlocked = res.rows.map((r) => parseInt(r.edge_id, 10));
      } catch {
        /* table peut ne pas exister encore */
      }

      const blockedClause =
        dbBlocked.length > 0 ? `AND w.gid NOT IN (${dbBlocked.join(",")})` : "";

      const query = `
        SELECT a.seq, a.node, a.edge, a.cost, a.agg_cost,
               ST_AsGeoJSON(
                 CASE WHEN a.node = w.source THEN w.the_geom
                      ELSE ST_Reverse(w.the_geom) END
               ) AS geometry
        FROM pgr_dijkstra(
          'SELECT gid::bigint AS id, source::bigint, target::bigint,
                  (ST_Length(the_geom::geography) / (COALESCE(maxspeed_forward,40)*1000.0/3600.0)) AS cost,
                  (ST_Length(the_geom::geography) / (COALESCE(maxspeed_backward,maxspeed_forward,40)*1000.0/3600.0)) AS reverse_cost
           FROM ways w WHERE source IS NOT NULL ${blockedClause}',
          $1::bigint, $2::bigint, $3::boolean
        ) a
        JOIN ways w ON a.edge = w.gid
        ORDER BY a.seq
      `;
      const result = await pool.query(query, [
        startVertexId,
        endVertexId,
        directed,
      ]);

      if (!result.rows?.length) {
        console.warn(
          "⚠️ Aucun trajet de base trouvé, fallback géométrie simple",
        );
        return this.getPathWithGeometry(startVertexId, endVertexId, directed);
      }

      return {
        success: true,
        data: result.rows,
        meta: { blockedEdges: dbBlocked },
      };
    } catch (error) {
      console.error("Base path avoiding blocked error:", error);
      return this.getPathWithGeometry(startVertexId, endVertexId, directed);
    }
  }

  // ── FASTEST path: time-based, avoids blocked edges ───────────────────────
  // Utilisé UNIQUEMENT pour le segment SOS -> hôpital (driverController)
  // FIX v5: la sous-requête utilise maintenant "FROM ways w" (alias présent)
  // au lieu de "FROM ways" (sans alias) — c'était la cause réelle du bug:
  // blockedClause référence "w.gid", qui n'existait pas tant que l'alias
  // n'était pas déclaré, faisant échouer silencieusement la requête dès
  // qu'un obstacle actif existait, et retomber sur getPathWithGeometry qui
  // ignore totalement les obstacles.
  async getPathAvoidingEdges(
    startVertexId,
    endVertexId,
    blockedEdgeIds = [],
    directed = true,
  ) {
    try {
      if (!startVertexId || !endVertexId)
        return { success: false, error: "Missing vertex IDs" };

      // Combine provided IDs with active DB blocks
      const sanitized = (blockedEdgeIds || [])
        .map((id) => parseInt(id, 10))
        .filter((id) => !isNaN(id) && id > 0);

      let dbBlocked = [];
      try {
        const res = await pool.query(
          `SELECT edge_id FROM blocked_roads
           WHERE status = 'active'`,
        );
        dbBlocked = res.rows.map((r) => parseInt(r.edge_id, 10));
      } catch {
        /* table may not exist yet */
      }

      const allBlocked = [...new Set([...sanitized, ...dbBlocked])];
      const blockedClause =
        allBlocked.length > 0
          ? `AND w.gid NOT IN (${allBlocked.join(",")})`
          : "";

      const now = new Date();
      const timeFactor = this.getTimeFactor(now.getHours(), now.getMinutes());

      // FIX v5: "FROM ways w" — alias ajouté (était "FROM ways" avant ce patch)
      const query = `
        SELECT a.seq, a.node, a.edge, a.cost, a.agg_cost,
               ST_AsGeoJSON(
                 CASE WHEN a.node = w.source THEN w.the_geom
                      ELSE ST_Reverse(w.the_geom) END
               ) AS geometry
        FROM pgr_dijkstra(
          'SELECT w.gid::bigint AS id, w.source::bigint, w.target::bigint,
                  (ST_Length(w.the_geom::geography) / (COALESCE(w.maxspeed_forward,40)*1000.0/3600.0)) * ${timeFactor} AS cost,
                  (ST_Length(w.the_geom::geography) / (COALESCE(w.maxspeed_backward,w.maxspeed_forward,40)*1000.0/3600.0)) * ${timeFactor} AS reverse_cost
           FROM ways w
           WHERE w.source IS NOT NULL ${blockedClause}',
          $1::bigint, $2::bigint, $3::boolean
        ) a
        JOIN ways w ON a.edge = w.gid
        ORDER BY a.seq
      `;

      const result = await pool.query(query, [
        startVertexId,
        endVertexId,
        directed,
      ]);

      if (!result.rows?.length) {
        console.warn("⚠️ No fastest route found, fallback to base path");
        return this.getPathWithGeometry(startVertexId, endVertexId, directed);
      }

      const turnPenalty = await this.calculateTurnPenaltiesForRoute(
        result.rows,
      );
      return {
        success: true,
        data: result.rows,
        meta: {
          timeFactor,
          turnPenaltySeconds: Math.round(turnPenalty),
          blockedEdges: allBlocked,
        },
      };
    } catch (error) {
      console.error("Path avoiding edges error:", error);
      return this.getPathWithGeometry(startVertexId, endVertexId, directed);
    }
  }

  // ── COMFORT path: minimises speed bumps ──────────────────────────────────
  // Utilisé UNIQUEMENT pour le segment SOS -> hôpital (driverController)
  async getComfortPath(startVertexId, endVertexId, directed = true) {
    try {
      if (!startVertexId || !endVertexId)
        return { success: false, error: "Missing vertex IDs" };

      let dbBlocked = [];
      try {
        const res = await pool.query(
          `SELECT edge_id FROM blocked_roads WHERE status = 'active'`,
        );
        dbBlocked = res.rows.map((r) => parseInt(r.edge_id, 10));
      } catch {
        /* table may not exist */
      }

      const blockedClause =
        dbBlocked.length > 0 ? `AND w.gid NOT IN (${dbBlocked.join(",")})` : "";

      // Check if speed_bumps table exists
      let hasBumps = false;
      try {
        await pool.query("SELECT 1 FROM speed_bumps LIMIT 1");
        hasBumps = true;
      } catch {
        /* table doesn't exist */
      }

      let query;
      if (hasBumps) {
        // FIX: détection des dos-d'âne par PROXIMITÉ SPATIALE (ST_DWithin),
        // pas seulement par edge_id — beaucoup de speed_bumps n'ont pas
        // edge_id renseigné dans la table (seulement lat/lon/location).
        // Sans ce fallback spatial, le chemin "confort" ne détectait quasiment
        // aucun dos-d'âne et roulait dessus comme le chemin "rapide".
        query = `
          SELECT a.seq, a.node, a.edge, a.cost, a.agg_cost,
                 ST_AsGeoJSON(
                   CASE WHEN a.node = w.source THEN w.the_geom
                        ELSE ST_Reverse(w.the_geom) END
                 ) AS geometry
          FROM pgr_dijkstra(
            'SELECT w.gid::bigint AS id, w.source::bigint, w.target::bigint,
                    COALESCE((
                      SELECT COUNT(*)::float FROM speed_bumps sb
                      WHERE sb.edge_id = w.gid
                         OR (sb.location IS NOT NULL AND ST_DWithin(sb.location::geography, w.the_geom::geography, 15))
                    ), 0) * 150.0
                      + (ST_Length(w.the_geom::geography) / (COALESCE(w.maxspeed_forward,40)*1000.0/3600.0)) AS cost,
                    COALESCE((
                      SELECT COUNT(*)::float FROM speed_bumps sb
                      WHERE sb.edge_id = w.gid
                         OR (sb.location IS NOT NULL AND ST_DWithin(sb.location::geography, w.the_geom::geography, 15))
                    ), 0) * 150.0
                      + (ST_Length(w.the_geom::geography) / (COALESCE(w.maxspeed_backward,w.maxspeed_forward,40)*1000.0/3600.0)) AS reverse_cost
             FROM ways w
             WHERE w.source IS NOT NULL ${blockedClause}',
            $1::bigint, $2::bigint, $3::boolean
          ) a
          JOIN ways w ON a.edge = w.gid
          ORDER BY a.seq
        `;
      } else {
        // Fallback: use fastest path if no speed_bumps table
        console.warn(
          "⚠️ speed_bumps table not found, using fastest path for comfort",
        );
        return this.getPathAvoidingEdges(
          startVertexId,
          endVertexId,
          [],
          directed,
        );
      }

      const result = await pool.query(query, [
        startVertexId,
        endVertexId,
        directed,
      ]);

      if (!result.rows?.length) {
        console.warn("⚠️ No comfort route found, fallback to fastest");
        return this.getPathAvoidingEdges(
          startVertexId,
          endVertexId,
          [],
          directed,
        );
      }

      // Count bumps on selected path (edge_id match OU proximité spatiale)
      const edgeIds = result.rows.map((r) => r.edge).filter((id) => id !== -1);
      let totalBumps = 0;
      if (edgeIds.length > 0 && hasBumps) {
        try {
          const bc = await pool.query(
            `SELECT COUNT(DISTINCT sb.id) AS total
             FROM speed_bumps sb
             JOIN ways w ON w.gid = ANY($1::bigint[])
             WHERE sb.edge_id = w.gid
                OR (sb.location IS NOT NULL AND ST_DWithin(sb.location::geography, w.the_geom::geography, 15))`,
            [edgeIds],
          );
          totalBumps = parseInt(bc.rows[0]?.total || 0);
        } catch {
          /* ignore */
        }
      }

      return {
        success: true,
        data: result.rows,
        meta: {
          routeType: "comfort",
          totalBumpsOnPath: totalBumps,
          blockedEdges: dbBlocked,
        },
      };
    } catch (error) {
      console.error("Comfort path error:", error);
      return this.getPathAvoidingEdges(
        startVertexId,
        endVertexId,
        [],
        directed,
      );
    }
  }

  // ── Path with time+traffic factors ───────────────────────────────────────
  async getPathWithTimeAndTraffic(
    startVertexId,
    endVertexId,
    timeFactor,
    zoneFactor,
    directed = true,
  ) {
    try {
      if (!startVertexId || !endVertexId)
        return { success: false, error: "Missing vertex IDs" };

      const totalFactor = timeFactor * zoneFactor;

      const query = `
        SELECT a.seq, a.node, a.edge, a.cost, a.agg_cost,
               ST_AsGeoJSON(w.the_geom) AS geometry
        FROM pgr_dijkstra(
          'SELECT gid::bigint AS id, source::bigint, target::bigint,
                  (ST_Length(the_geom::geography) / (COALESCE(maxspeed_forward,40)*1000.0/3600.0)) * ${totalFactor} AS cost,
                  (ST_Length(the_geom::geography) / (COALESCE(maxspeed_backward,maxspeed_forward,40)*1000.0/3600.0)) * ${totalFactor} AS reverse_cost
           FROM ways WHERE source IS NOT NULL',
          $1::bigint, $2::bigint, $3::boolean
        ) a
        JOIN ways w ON a.edge = w.gid
        ORDER BY a.seq
      `;

      const result = await pool.query(query, [
        startVertexId,
        endVertexId,
        directed,
      ]);
      if (!result.rows?.length) return { success: true, data: [] };
      return { success: true, data: result.rows };
    } catch (error) {
      console.error("Path with traffic error:", error);
      return { success: false, error: error.message };
    }
  }

  // ── Advanced ETA ──────────────────────────────────────────────────────────
  async calculateETAAdvanced(
    startVertexId,
    endVertexId,
    directed = false,
    includeTurnPenalties = true,
  ) {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const startCoords = await pool.query(
        "SELECT ST_X(the_geom) AS lon, ST_Y(the_geom) AS lat FROM ways_vertices_pgr WHERE id = $1",
        [startVertexId],
      );
      if (!startCoords.rows.length)
        return { success: false, error: "Start vertex not found" };

      const startZone = await this.getZoneTrafficFactor(
        startCoords.rows[0].lat,
        startCoords.rows[0].lon,
      );
      const zoneFactor = startZone.factor || 1.0;
      const timeFactor = this.getTimeFactor(currentHour, currentMinute);
      const totalFactor = timeFactor * zoneFactor;

      const routeData = await this.getPathWithTimeAndTraffic(
        startVertexId,
        endVertexId,
        timeFactor,
        zoneFactor,
        directed,
      );

      if (!routeData.success || !routeData.data?.length)
        return { success: false, error: "No path found" };

      const edgeIds = routeData.data
        .map((r) => r.edge)
        .filter((id) => id !== -1);
      let totalDistanceKm = 0;
      if (edgeIds.length > 0) {
        const distRes = await pool.query(
          "SELECT SUM(ST_Length(the_geom::geography)) / 1000 AS km FROM ways WHERE gid = ANY($1::bigint[])",
          [edgeIds],
        );
        totalDistanceKm = parseFloat(distRes.rows[0]?.km || 0);
      }

      let baseTimeSeconds =
        routeData.data[routeData.data.length - 1]?.agg_cost || 0;
      let adjustedTimeSeconds = baseTimeSeconds;
      let turnPenaltySeconds = 0;

      if (includeTurnPenalties && routeData.data.length > 0) {
        turnPenaltySeconds = await this.calculateTurnPenaltiesForRoute(
          routeData.data,
        );
        adjustedTimeSeconds += turnPenaltySeconds;
      }

      return {
        success: true,
        data: {
          total_km: parseFloat(totalDistanceKm.toFixed(2)),
          total_minutes: parseFloat((adjustedTimeSeconds / 60).toFixed(1)),
          time_seconds: Math.round(adjustedTimeSeconds),
          base_time_seconds: Math.round(baseTimeSeconds),
          turn_penalty_seconds: Math.round(turnPenaltySeconds),
          traffic_factor: parseFloat(totalFactor.toFixed(2)),
          time_factor: timeFactor,
          zone_factor: zoneFactor,
          active_zone: startZone.zoneName,
          current_time: `${currentHour}:${currentMinute.toString().padStart(2, "0")}`,
        },
      };
    } catch (error) {
      console.error("ETA error:", error);
      return { success: false, error: error.message };
    }
  }

  // ── Find nearest hospital by road ─────────────────────────────────────────
  async findNearestHospitalByRoad(lat, lon, limit = 3) {
    try {
      const emergencyVertex = await this.findNearestVertex(lat, lon);
      if (!emergencyVertex.success)
        return { success: false, error: "Cannot find vertex" };

      const hospitals = await pool.query(
        "SELECT id, nom, latitude, longitude FROM hopitaux WHERE latitude IS NOT NULL AND longitude IS NOT NULL",
      );
      if (!hospitals.rows.length)
        return { success: false, error: "No hospitals found" };

      const results = await Promise.all(
        hospitals.rows.map(async (h) => {
          const hv = await this.findNearestVertex(h.latitude, h.longitude);
          if (!hv.success) return null;
          const eta = await this.calculateETAAdvanced(
            emergencyVertex.vertex_id,
            hv.vertex_id,
            false,
          );
          if (!eta.success) return null;
          return {
            hospital_id: h.id,
            hospital_name: h.nom,
            hospital_lat: h.latitude,
            hospital_lon: h.longitude,
            distance_km: eta.data.total_km,
            eta_minutes: eta.data.total_minutes,
          };
        }),
      );

      const valid = results
        .filter((r) => r !== null)
        .sort((a, b) => a.eta_minutes - b.eta_minutes);
      return { success: true, data: valid.slice(0, limit) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ── Turn penalties helper ─────────────────────────────────────────────────
  async calculateTurnPenaltiesForRoute(route) {
    let totalPenalty = 0;
    for (let i = 1; i < route.length; i++) {
      const prev = route[i - 1];
      const curr = route[i];
      if (!prev.geometry || !curr.geometry) continue;
      try {
        const pc = JSON.parse(prev.geometry).coordinates;
        const cc = JSON.parse(curr.geometry).coordinates;
        if (pc.length >= 2 && cc.length >= 2) {
          const p1 = pc[pc.length - 2];
          const p2 = pc[pc.length - 1];
          const p3 = cc.length >= 2 ? cc[1] : cc[0];
          const angle = this.calculateAngle(
            p1[0],
            p1[1],
            p2[0],
            p2[1],
            p3[0],
            p3[1],
          );
          const penalty = this.getTurnPenalty(angle);
          if (penalty > 1.0) totalPenalty += (curr.cost || 0) * (penalty - 1);
        }
      } catch {
        /* ignore */
      }
    }
    return totalPenalty;
  }

  calculateAngle(x1, y1, x2, y2, x3, y3) {
    const ax = x1 - x2,
      ay = y1 - y2;
    const bx = x3 - x2,
      by = y3 - y2;
    const dot = ax * bx + ay * by;
    const magA = Math.sqrt(ax * ax + ay * ay);
    const magB = Math.sqrt(bx * bx + by * by);
    if (magA === 0 || magB === 0) return 0;
    return (
      (Math.acos(Math.min(1, Math.max(-1, dot / (magA * magB)))) * 180) /
      Math.PI
    );
  }

  getTurnPenalty(deg) {
    if (deg < 15) return 1.0;
    if (deg < 30) return 1.1;
    if (deg < 45) return 1.2;
    if (deg < 60) return 1.35;
    if (deg < 90) return 1.6;
    if (deg < 120) return 2.0;
    return 2.5;
  }

  // ── Single merged line (for routing controller) ───────────────────────────
  async getPathAsSingleLine(startVertexId, endVertexId, directed = false) {
    try {
      const query = `
        SELECT
          ST_AsGeoJSON(ST_LineMerge(ST_Collect(
            CASE WHEN a.node = w.source THEN w.the_geom
                 ELSE ST_Reverse(w.the_geom) END
          ))) AS geometry,
          SUM(ST_Length(w.the_geom::geography)) AS total_distance,
          SUM(a.cost) AS total_time
        FROM pgr_dijkstra(
          'SELECT gid::bigint AS id, source::bigint, target::bigint,
                  (ST_Length(the_geom::geography) / (COALESCE(maxspeed_forward,40)*1000.0/3600.0)) AS cost,
                  (ST_Length(the_geom::geography) / (COALESCE(maxspeed_backward,maxspeed_forward,40)*1000.0/3600.0)) AS reverse_cost
           FROM ways WHERE source IS NOT NULL',
          $1::bigint, $2::bigint, $3::boolean
        ) a
        JOIN ways w ON a.edge = w.gid
      `;
      const result = await pool.query(query, [
        startVertexId,
        endVertexId,
        directed,
      ]);
      if (!result.rows?.[0]?.geometry)
        return { success: false, error: "No route found" };
      return {
        success: true,
        data: [
          {
            seq: 1,
            geometry: result.rows[0].geometry,
            agg_cost: result.rows[0].total_time,
            total_km: result.rows[0].total_distance / 1000,
          },
        ],
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default new RoutingService();
