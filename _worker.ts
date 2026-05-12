/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { cors } from "hono/cors";
import { sign, verify } from "hono/jwt";
import { createMiddleware } from "hono/factory";
import bcrypt from "bcryptjs";

type Env = {
  Bindings: {
    DB: D1Database;
    R2: R2Bucket;
    SECRET: string;
  };
  Variables: {
    user: any;
  };
};

const app = new Hono<Env>();

const SECRET = "bmtv-secret-key-2026";

app.use("*", cors());

// Auth Middleware
const authenticate = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.split(" ")[1];
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  
  try {
    const decoded = await verify(token, c.env.SECRET || SECRET, "HS256") as any;
    const { results } = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(decoded.id).all();
    const user = results[0] as any;
    
    if (!user || user.statut !== "active") return c.json({ error: "Forbidden or Suspended" }, 403);
    
    // Session validation
    if (decoded.sessionId && user.current_session_id && decoded.sessionId !== user.current_session_id && !decoded.isImpersonation) {
      return c.json({ error: "Ce compte est déjà utilisé sur un autre appareil", code: "SESSION_EXPIRED" }, 401);
    }
    
    if (user.permissions) {
      try {
        user.permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
      } catch (e) {
        user.permissions = [];
      }
    } else {
      user.permissions = [];
    }
    
    c.set("user", user);
    await next();
  } catch (e) {
    return c.json({ error: "Invalid token" }, 401);
  }
});

// Optional Auth Middleware (for public routes that show more info to logged in users/admins)
const optionalAuthenticate = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.split(" ")[1];
  if (!token) {
    await next();
    return;
  }
  
  try {
    const decoded = await verify(token, c.env.SECRET || SECRET, "HS256") as any;
    const { results } = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(decoded.id).all();
    const user = results[0] as any;
    
    if (user && user.statut === "active") {
      // Session validation
      if (!(decoded.sessionId && user.current_session_id && decoded.sessionId !== user.current_session_id && !decoded.isImpersonation)) {
        if (user.permissions) {
          try {
            user.permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
          } catch (e) {
            user.permissions = [];
          }
        } else {
          user.permissions = [];
        }
        c.set("user", user);
      }
    }
  } catch (e) {}
  await next();
});

const isAdmin = createMiddleware<Env>(async (c, next) => {
  const user = c.get("user");
  if (user.role !== "admin" && user.role !== "owner") return c.json({ error: "Admin only" }, 403);
  await next();
});

const isOwner = createMiddleware<Env>(async (c, next) => {
  const user = c.get("user");
  if (user.role !== "owner") return c.json({ error: "Owner only" }, 403);
  await next();
});

// Initialize DB (can be called via a special route or manually)
async function initDB(d1: D1Database) {
  console.log("Initializing D1 database...");

  try {
    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telephone TEXT UNIQUE,
        prenom TEXT,
        nom TEXT,
        pin TEXT,
        role TEXT DEFAULT 'user',
        statut TEXT DEFAULT 'active',
        permissions TEXT,
        last_profile_update DATETIME,
        current_session_id TEXT,
        last_tutorial_watch DATETIME
      )
    `).run();

    // Migration for existing users table
    try {
      await d1.prepare("ALTER TABLE users ADD COLUMN current_session_id TEXT").run();
    } catch (e) {}
    try {
      await d1.prepare("ALTER TABLE users ADD COLUMN last_tutorial_watch DATETIME").run();
    } catch (e) {}

    // Migration: Prefix existing phone numbers with +224 if they don't have one
    try {
      // Find users whose telephone doesn't start with '+'
      const { results: usersToUpdate } = await d1.prepare("SELECT id, telephone FROM users WHERE telephone NOT LIKE '+%'").all();
      for (const user of (usersToUpdate as any[])) {
        let newPhone = user.telephone;
        // if it's a 9 digit number, add +224
        if (newPhone.length === 9) {
          newPhone = '+224' + newPhone;
        } else if (!newPhone.startsWith('+')) {
          // generic fallback if it's not + already
          newPhone = '+224' + newPhone;
        }
        
        if (newPhone !== user.telephone) {
          await d1.prepare("UPDATE users SET telephone = ? WHERE id = ?").bind(newPhone, user.id).run();
          console.log(`Updated user ${user.id} phone to ${newPhone}`);
        }
      }
    } catch (e) {
      console.error("Migration error:", e);
    }

    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS series (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titre TEXT,
        description TEXT,
        image TEXT,
        banniere TEXT,
        genre TEXT,
        langue TEXT,
        statut TEXT DEFAULT 'published',
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS seasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_serie INTEGER,
        numero INTEGER,
        prix TEXT,
        titre TEXT,
        statut TEXT DEFAULT 'published',
        date_publication DATETIME,
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(id_serie) REFERENCES series(id) ON DELETE CASCADE
      )
    `).run();

     // Migration for existing seasons table
     try {
       await d1.prepare("ALTER TABLE seasons ADD COLUMN statut TEXT DEFAULT 'published'").run();
     } catch (e) {}
     try {
       await d1.prepare("ALTER TABLE seasons ADD COLUMN date_publication DATETIME").run();
     } catch (e) {}

    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_saison INTEGER,
        titre TEXT,
        url_video TEXT,
        statut TEXT DEFAULT 'locked',
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(id_saison) REFERENCES seasons(id) ON DELETE CASCADE
      )
    `).run();

    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS stock_episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titre TEXT,
        url_video TEXT,
        file_name TEXT,
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS payment_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_utilisateur INTEGER,
        telephone TEXT,
        nom_utilisateur TEXT,
        titre_serie TEXT,
        numero_saison INTEGER,
        id_saison INTEGER,
        prix TEXT,
        numero_paiement TEXT,
        solde_apres_paiement TEXT,
        date TEXT,
        statut TEXT DEFAULT 'pending',
        FOREIGN KEY(id_utilisateur) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();

    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS user_purchases (
        id_utilisateur INTEGER,
        id_saison INTEGER,
        PRIMARY KEY(id_utilisateur, id_saison),
        FOREIGN KEY(id_utilisateur) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(id_saison) REFERENCES seasons(id) ON DELETE CASCADE
      )
    `).run();

    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS pin_reset_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_utilisateur INTEGER,
        statut TEXT DEFAULT 'pending',
        date TEXT,
        FOREIGN KEY(id_utilisateur) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();

    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titre TEXT,
        image TEXT,
        id_serie INTEGER,
        statut TEXT DEFAULT 'active',
        type TEXT DEFAULT 'image',
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS payments_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telephone TEXT,
        montant REAL,
        statut TEXT DEFAULT 'received',
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        cle TEXT PRIMARY KEY,
        valeur TEXT
      )
    `).run();

    await d1.prepare("CREATE INDEX IF NOT EXISTS idx_seasons_serie ON seasons(id_serie)").run();
    await d1.prepare("CREATE INDEX IF NOT EXISTS idx_episodes_saison ON episodes(id_saison)").run();
    await d1.prepare("CREATE INDEX IF NOT EXISTS idx_payment_requests_user ON payment_requests(id_utilisateur)").run();
    await d1.prepare("CREATE INDEX IF NOT EXISTS idx_payment_requests_saison ON payment_requests(id_saison)").run();
    await d1.prepare("CREATE INDEX IF NOT EXISTS idx_banners_statut ON banners(statut)").run();
    await d1.prepare("CREATE INDEX IF NOT EXISTS idx_payments_log_tel ON payments_log(telephone)").run();

    // Initialiser les paramètres par défaut
    const defaultSettings = [
      ['app_name', 'MANDEN TSERIE'],
      ['app_description', 'Manden Tserie streaming'],
      ['app_logo_url', ''],
      ['banner_home_image', ''],
      ['banner_home_video', ''],
      ['info_bar_text', ''],
      ['payment_orange_money_number', '+224 655 00 00 00'],
      ['payment_whatsapp_number', '224627322525'],
      ['payment_ussd_code_1', '*144*6*650474*{prix}*1#'],
      ['payment_ussd_code_2', '*144*1*1*627322525*{prix}*1*1#'],
      ['payment_deposit_number', '+224627322525'],
      ['payment_instructions', '627613880'],
      ['security_right_click_disabled', 'true'],
      ['security_text_selection_disabled', 'true'],
      ['security_dev_tools_disabled', 'true'],
      ['security_external_links_disabled', 'true'],
      ['tutorial_video_url', '']
    ];

    for (const [cle, valeur] of defaultSettings) {
      await d1.prepare("INSERT INTO settings (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO NOTHING").bind(cle, valeur).run();
    }

    // Seed Owner if not exists
    const ownerPhone = "+224627613880";
    const { results: existingOwnerResults } = await d1.prepare("SELECT * FROM users WHERE telephone = ?").bind(ownerPhone).all();
    if (existingOwnerResults.length === 0) {
      const hashedPin = bcrypt.hashSync("1234", 10);
      await d1.prepare("INSERT INTO users (telephone, pin, role, permissions) VALUES (?, ?, 'owner', ?)").bind(ownerPhone, hashedPin, JSON.stringify([])).run();
    }

  } catch (err) {
    console.error("Error initializing tables:", err);
  }
}

// Routes
app.get("/api/init", async (c) => {
  await initDB(c.env.DB);
  return c.json({ success: true });
});

app.post("/api/auth/register", async (c) => {
  const { telephone, pin, prenom, nom } = await c.req.json();
  const normalizedPhone = telephone?.toString().trim();
  
  if (!normalizedPhone || !pin || pin.length !== 4) {
    return c.json({ error: "Numéro de téléphone et PIN (4 chiffres) requis" }, 400);
  }
  
  const hashedPin = bcrypt.hashSync(pin, 10);
  try {
    const { results } = await c.env.DB.prepare("INSERT INTO users (telephone, pin, prenom, nom, permissions) VALUES (?, ?, ?, ?, ?) RETURNING id").bind(normalizedPhone, hashedPin, prenom, nom, JSON.stringify([])).all();
    const userId = (results[0] as any).id;
    const token = await sign({ id: userId }, c.env.SECRET || SECRET, "HS256");
    return c.json({ token, user: { id: userId, telephone: normalizedPhone, role: 'user', prenom, nom, permissions: [], last_profile_update: null } });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return c.json({ error: "Ce numéro de téléphone est déjà utilisé" }, 400);
    }
    return c.json({ error: "Une erreur est survenue lors de l'inscription" }, 500);
  }
});

app.post("/api/auth/login", async (c) => {
  try {
    const { telephone, pin } = await c.req.json();
    const { results } = await c.env.DB.prepare("SELECT * FROM users WHERE telephone = ?").bind(telephone).all();
    const user = results[0] as any;
    if (!user || !bcrypt.compareSync(pin, user.pin)) {
      return c.json({ error: "Numéro de téléphone ou PIN incorrect" }, 401);
    }
    if (user.statut !== "active") return c.json({ error: "Compte " + user.statut }, 403);
    
    let sessionId: string | null = null;
    try {
      sessionId = crypto.randomUUID();
      await c.env.DB.prepare("UPDATE users SET current_session_id = ? WHERE id = ?").bind(sessionId, user.id).run();
    } catch (e: any) {
      console.error("Session update failed, attempting migration:", e.message);
      try {
        // Attempt to add the column if it's missing
        await c.env.DB.prepare("ALTER TABLE users ADD COLUMN current_session_id TEXT").run();
        // Retry the update
        if (sessionId) {
          await c.env.DB.prepare("UPDATE users SET current_session_id = ? WHERE id = ?").bind(sessionId, user.id).run();
        }
      } catch (migrationError: any) {
        console.error("Migration or retry failed:", migrationError.message);
        // Fallback: allow login without session tracking if DB is not ready
        // This prevents the "Connection error" for the user
      }
    }
    
    const token = await sign({ id: user.id, sessionId }, c.env.SECRET || SECRET, "HS256");
    
    let permissions = [];
    if (user.permissions) {
      try {
        permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
      } catch (e) {}
    }

    return c.json({ token, user: { id: user.id, telephone: user.telephone, role: user.role, prenom: user.prenom, nom: user.nom, permissions, last_profile_update: user.last_profile_update, last_tutorial_watch: user.last_tutorial_watch } });
  } catch (err: any) {
    console.error("Login error:", err);
    return c.json({ error: "Erreur de connexion: " + err.message }, 500);
  }
});

app.get("/api/admin/setup-db", authenticate, isAdmin, async (c) => {
  try {
    // Ensure stock_episodes table exists
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS stock_episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titre TEXT,
        url_video TEXT,
        file_name TEXT,
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Add statut to series if not exists
    try {
      await c.env.DB.prepare("ALTER TABLE series ADD COLUMN statut TEXT DEFAULT 'published'").run();
    } catch (e) {}

    // Add statut to seasons if not exists
    try {
      await c.env.DB.prepare("ALTER TABLE seasons ADD COLUMN statut TEXT DEFAULT 'published'").run();
    } catch (e) {}
    
    // Add date_publication to seasons if not exists
    try {
      await c.env.DB.prepare("ALTER TABLE seasons ADD COLUMN date_publication DATETIME").run();
    } catch (e) {}
    
    // Add statut to episodes if not exists
    try {
      await c.env.DB.prepare("ALTER TABLE episodes ADD COLUMN statut TEXT DEFAULT 'locked'").run();
    } catch (e) {}

    return c.json({ success: true, message: "Database updated successfully" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/series", optionalAuthenticate, async (c) => {
  const user = c.get("user");
  const isAdminUser = user && (user.role === 'admin' || user.role === 'owner');

  let query = "SELECT * FROM series WHERE statut != 'deleted'";
  if (!isAdminUser) {
    query += " AND statut IN ('published', 'reserved')";
  }
  const { results } = await c.env.DB.prepare(query).all();
  return c.json(results);
});

app.get("/api/series/:id", optionalAuthenticate, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const isAdminUser = user && (user.role === 'admin' || user.role === 'owner');

  const { results: seriesResults } = await c.env.DB.prepare("SELECT * FROM series WHERE id = ?").bind(id).all();
  const series = seriesResults[0] as any;
  if (!series) return c.json({ error: "Series not found" }, 404);

  // Bloquer l'accès si la série n'est pas disponible (sauf pour les admins)
  if (!isAdminUser && series.statut === 'draft') {
    return c.json({ error: "Cette série n'est pas disponible pour le moment." }, 403);
  }

  let seasonsResults: any[] = [];
  try {
    let seasonsQuery = "SELECT * FROM seasons WHERE id_serie = ?";
    if (!isAdminUser) {
      seasonsQuery = `
        SELECT *, 
        CASE 
          WHEN statut = 'reserved' AND date_publication IS NOT NULL AND date_publication <= datetime('now') THEN 'published' 
          ELSE statut 
        END as effective_statut 
        FROM seasons 
        WHERE id_serie = ? AND statut IN ('published', 'reserved')
      `;
    } else {
      seasonsQuery = "SELECT * FROM seasons WHERE id_serie = ? AND statut != 'deleted'";
    }
    const { results } = await c.env.DB.prepare(seasonsQuery).bind(id).all();
    
    // Normalisation pour le front-end
    seasonsResults = results.map((s: any) => ({
      ...s,
      statut: s.effective_statut || s.statut
    }));
  } catch (e) {
    const { results } = await c.env.DB.prepare("SELECT * FROM seasons WHERE id_serie = ?").bind(id).all();
    seasonsResults = results;
  }
  
  return c.json({ ...series, saisons: seasonsResults });
});

app.get("/api/banners", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM banners WHERE statut = 'active'").all();
  return c.json(results);
});

app.get("/api/seasons/:id/episodes", authenticate, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const isAdminUser = user.role === 'admin' || user.role === 'owner';
  
  // Verify season status first for non-admins
  if (!isAdminUser) {
    const { results: seasonResults } = await c.env.DB.prepare("SELECT statut FROM seasons WHERE id = ?").bind(id).all();
    const season = seasonResults[0] as any;
    if (!season || !['published', 'reserved'].includes(season.statut)) {
      return c.json({ error: "Cette saison n'est pas disponible." }, 403);
    }
  }

  let query = "SELECT * FROM episodes WHERE id_saison = ?";
  if (!isAdminUser) {
    query += " AND statut IN ('locked', 'unlocked')";
  }
  
  const { results: episodesResults } = await c.env.DB.prepare(query).bind(id).all();
  const { results: purchaseResults } = await c.env.DB.prepare("SELECT * FROM user_purchases WHERE id_utilisateur = ? AND id_saison = ?").bind(user.id, id).all();
  
  const mappedEpisodes = episodesResults.map((ep: any) => ({
    ...ep,
    accessible: ep.statut === 'unlocked' || purchaseResults.length > 0,
    url_video: undefined
  }));
  
  return c.json(mappedEpisodes);
});

app.get("/api/redirect-video/:id", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.text("Unauthorized", 401);

  try {
    const SECRET_VAL = "bmtv-secret-key-2026";
    const payload = await verify(token, c.env.SECRET || SECRET_VAL, "HS256");
    if (!payload) return c.text("Invalid token", 401);

    const id = c.req.param("id");
    const { results } = await c.env.DB.prepare("SELECT url_video FROM episodes WHERE id = ?")
      .bind(id)
      .all();

    const episode = results[0] as any;
    if (!episode) return c.text("Episode not found", 404);

    let url = episode.url_video;
    if (url.startsWith("/") && !url.startsWith("//")) {
      const origin = new URL(c.req.url).origin;
      url = `${origin}${url}`;
    }

    return c.redirect(url);
  } catch (e) {
    return c.text("Error redirecting", 500);
  }
});

app.get("/api/video/:id", authenticate, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const { results: episodeResults } = await c.env.DB.prepare(`
    SELECT e.*, s.id as id_saison, s.statut as saison_statut, ser.statut as serie_statut
    FROM episodes e 
    JOIN seasons s ON e.id_saison = s.id 
    JOIN series ser ON s.id_serie = ser.id
    WHERE e.id = ?
  `).bind(id).all();
  const episode = episodeResults[0] as any;

  if (!episode) return c.json({ error: "Épisode non trouvé" }, 404);

  const isAdminUser = user.role === 'admin' || user.role === 'owner';

  // Vérifier si toute la chaîne est publiée
  if (!isAdminUser) {
    if (episode.serie_statut !== 'published' || episode.saison_statut !== 'published' || (episode.statut !== 'unlocked' && episode.statut !== 'locked')) {
      return c.json({ error: "Ce contenu n'est pas disponible pour le moment." }, 403);
    }
  }

  const { results: purchaseResults } = await c.env.DB.prepare("SELECT * FROM user_purchases WHERE id_utilisateur = ? AND id_saison = ?").bind(user.id, episode.id_saison).all();
  
  if (episode.statut !== 'unlocked' && purchaseResults.length === 0 && !isAdminUser) {
    return c.json({ error: "Accès refusé. Veuillez acheter la saison." }, 403);
  }

  return c.json({ url_video: episode.url_video });
});

app.post("/api/payments/request", authenticate, async (c) => {
  const body = await c.req.json();
  const user = c.get("user");
  
  try {
    const { results: existingResults } = await c.env.DB.prepare("SELECT * FROM payment_requests WHERE id_utilisateur = ? AND id_saison = ? AND statut IN ('pending', 'approved')").bind(user.id, body.id_saison).all();
    const existingRequest = existingResults[0] as any;

    if (existingRequest && existingRequest.statut === 'approved') {
      return c.json({ error: "Une demande a déjà été approuvée pour cette saison." }, 400);
    }

    const date = new Date().toISOString();
    const final_nom_utilisateur = body.nom_utilisateur || `${user.prenom} ${user.nom}`;
    
    // Format price to have .00
    const formattedPrix = typeof body.prix === 'number' ? body.prix.toFixed(2) : body.prix;
    // Normalisation du numéro pour la recherche (on prend les 9 derniers chiffres)
    const searchPhone = body.numero_paiement.replace(/\D/g, '').slice(-9);
    const numericPrix = Number(body.prix) || 0;

    // Vérifier si un paiement automatique existe déjà dans payments_log
    const { results: autoPaymentResults } = await c.env.DB.prepare(`
      SELECT * FROM payments_log 
      WHERE INSTR(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telephone, ' ', ''), '.', ''), '+', ''), '-', ''), '(', ''), ')', ''), ?) > 0 
      AND ABS(CAST(montant AS REAL) - ?) < 1 
      AND LOWER(statut) = 'received' 
      ORDER BY date_creation DESC
      LIMIT 1
    `).bind(searchPhone, numericPrix).all();
    const autoPayment = autoPaymentResults[0] as any;

    if (autoPayment) {
      if (existingRequest) {
        // Mettre à jour la demande existante en 'approved'
        await c.env.DB.batch([
          c.env.DB.prepare("UPDATE payment_requests SET numero_paiement = ?, telephone = ?, nom_utilisateur = ?, date = ?, statut = 'approved' WHERE id = ?").bind(body.numero_paiement, body.telephone, final_nom_utilisateur, date, existingRequest.id),
          c.env.DB.prepare("INSERT INTO user_purchases (id_utilisateur, id_saison) VALUES (?, ?) ON CONFLICT (id_utilisateur, id_saison) DO NOTHING").bind(user.id, body.id_saison),
          c.env.DB.prepare("UPDATE payments_log SET statut = 'used' WHERE id = ?").bind(autoPayment.id)
        ]);
      } else {
        // Créer une nouvelle demande approuvée
        await c.env.DB.batch([
          c.env.DB.prepare("INSERT INTO payment_requests (id_utilisateur, telephone, nom_utilisateur, titre_serie, numero_saison, id_saison, prix, numero_paiement, solde_apres_paiement, date, statut) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')").bind(user.id, body.telephone, final_nom_utilisateur, body.titre_serie, body.numero_saison, body.id_saison, formattedPrix, body.numero_paiement, body.solde_apres_paiement, date),
          c.env.DB.prepare("INSERT INTO user_purchases (id_utilisateur, id_saison) VALUES (?, ?) ON CONFLICT (id_utilisateur, id_saison) DO NOTHING").bind(user.id, body.id_saison),
          c.env.DB.prepare("UPDATE payments_log SET statut = 'used' WHERE id = ?").bind(autoPayment.id)
        ]);
      }
      return c.json({ success: true, message: "Paiement automatique détecté et saison débloquée !" });
    }

    if (existingRequest) {
      // Mettre à jour la demande en attente existante
      await c.env.DB.prepare("UPDATE payment_requests SET numero_paiement = ?, telephone = ?, nom_utilisateur = ?, date = ? WHERE id = ?").bind(body.numero_paiement, body.telephone, final_nom_utilisateur, date, existingRequest.id).run();
      return c.json({ success: true, message: "Demande de paiement mise à jour avec le nouveau numéro." });
    }

    // Sinon créer une nouvelle demande (pending)
    await c.env.DB.prepare("INSERT INTO payment_requests (id_utilisateur, telephone, nom_utilisateur, titre_serie, numero_saison, id_saison, prix, numero_paiement, solde_apres_paiement, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(user.id, body.telephone, final_nom_utilisateur, body.titre_serie, body.numero_saison, body.id_saison, formattedPrix, body.numero_paiement, body.solde_apres_paiement, date).run();
    
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: "Une erreur est survenue lors de l'envoi de la demande: " + e.message }, 500);
  }
});

app.get("/api/settings", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM settings").all();
  const settings: Record<string, string> = {};
  results.forEach((row: any) => {
    settings[row.cle] = row.valeur;
  });
  return c.json(settings);
});

app.post("/api/auth/check-phone", async (c) => {
  const { telephone } = await c.req.json();
  const { results } = await c.env.DB.prepare("SELECT prenom, nom, role FROM users WHERE telephone = ?").bind(telephone).all();
  const user = results[0];
  if (!user) return c.json({ error: "Numéro de téléphone non trouvé" }, 404);
  return c.json({ user });
});

app.post("/api/user/pin-requests/request-by-phone", async (c) => {
  const { telephone } = await c.req.json();
  const { results: userResults } = await c.env.DB.prepare("SELECT id FROM users WHERE telephone = ?").bind(telephone).all();
  const user = userResults[0] as any;
  if (!user) return c.json({ error: "Utilisateur non trouvé" }, 404);

  const { results: existingResults } = await c.env.DB.prepare("SELECT * FROM pin_reset_requests WHERE id_utilisateur = ? AND statut = 'pending'").bind(user.id).all();
  if (existingResults.length > 0) return c.json({ error: "Une demande est déjà en attente." }, 400);

  const date = new Date().toISOString();
  await c.env.DB.prepare("INSERT INTO pin_reset_requests (id_utilisateur, date) VALUES (?, ?)").bind(user.id, date).run();
  return c.json({ success: true });
});

app.get("/api/user/purchases", authenticate, async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare("SELECT id_saison FROM user_purchases WHERE id_utilisateur = ?").bind(user.id).all();
  return c.json(results.map((p: any) => p.id_saison));
});

app.post("/api/admin/settings/save", authenticate, isAdmin, async (c) => {
  const { cle, valeur } = await c.req.json();
  if (!cle) return c.json({ error: "Clé manquante" }, 400);
  await c.env.DB.prepare("INSERT INTO settings (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO UPDATE SET valeur = ?").bind(cle, valeur, valeur).run();
  return c.json({ success: true });
});

app.post("/api/user/watched-tutorial", authenticate, async (c) => {
  const user = c.get("user");
  const date = new Date().toISOString();
  await c.env.DB.prepare("UPDATE users SET last_tutorial_watch = ? WHERE id = ?").bind(date, user.id).run();
  return c.json({ success: true, last_tutorial_watch: date });
});

app.post("/api/admin/users/:id/statut", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  const { statut, pin } = await c.req.json();
  const user = c.get("user");
  if (!pin || !bcrypt.compareSync(pin, user.pin)) return c.json({ error: "Code PIN incorrect" }, 401);
  await c.env.DB.prepare("UPDATE users SET statut = ? WHERE id = ?").bind(statut, id).run();
  return c.json({ success: true });
});

app.post("/api/admin/users/:id/role", authenticate, isOwner, async (c) => {
  const id = c.req.param("id");
  const { role, pin } = await c.req.json();
  const user = c.get("user");
  if (!pin || !bcrypt.compareSync(pin, user.pin)) return c.json({ error: "Code PIN incorrect" }, 401);
  await c.env.DB.prepare("UPDATE users SET role = ? WHERE id = ?").bind(role, id).run();
  return c.json({ success: true });
});

app.post("/api/admin/users/:id/permissions", authenticate, isOwner, async (c) => {
  const id = c.req.param("id");
  const { permissions, pin } = await c.req.json();
  const user = c.get("user");
  if (!pin || !bcrypt.compareSync(pin, user.pin)) return c.json({ error: "Code PIN incorrect" }, 401);
  await c.env.DB.prepare("UPDATE users SET permissions = ? WHERE id = ?").bind(JSON.stringify(permissions), id).run();
  return c.json({ success: true });
});

app.post("/api/admin/users/:id/impersonate", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  const { pin } = await c.req.json();
  const admin = c.get("user");

  if (!pin || !bcrypt.compareSync(pin, admin.pin)) return c.json({ error: "Code PIN incorrect" }, 401);

  const { results } = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).all();
  const user = results[0] as any;
  if (!user) return c.json({ error: "Utilisateur non trouvé" }, 404);

  const sessionId = crypto.randomUUID();
  // Ne pas mettre à jour current_session_id pour ne pas déconnecter l'utilisateur réel
  // await c.env.DB.prepare("UPDATE users SET current_session_id = ? WHERE id = ?").bind(sessionId, user.id).run();

  const token = await sign({ id: user.id, sessionId, isImpersonation: true }, c.env.SECRET || SECRET, "HS256");
  
  let permissions = [];
  if (user.permissions) {
    try {
      permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } catch (e) {}
  }

  return c.json({ 
    token, 
    user: { 
      id: user.id, 
      telephone: user.telephone, 
      role: user.role, 
      prenom: user.prenom, 
      nom: user.nom, 
      permissions, 
      last_profile_update: user.last_profile_update 
    } 
  });
});

app.post("/api/admin/payments/:id/reject", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  const { pin } = await c.req.json();
  const user = c.get("user");
  if (!pin || !bcrypt.compareSync(pin, user.pin)) return c.json({ error: "Code PIN incorrect" }, 401);
  const { results: requestResults } = await c.env.DB.prepare("SELECT * FROM payment_requests WHERE id = ?").bind(id).all();
  const request = requestResults[0] as any;
  if (!request) return c.json({ error: "Request not found" }, 404);

  await c.env.DB.prepare("UPDATE payment_requests SET statut = 'rejected' WHERE id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM user_purchases WHERE id_utilisateur = ? AND id_saison = ?").bind(request.id_utilisateur, request.id_saison).run();
  return c.json({ success: true });
});

app.post("/api/admin/payments/:id/relock", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  const { pin } = await c.req.json();
  const user = c.get("user");
  if (!pin || !bcrypt.compareSync(pin, user.pin)) return c.json({ error: "Code PIN incorrect" }, 401);
  const { results: requestResults } = await c.env.DB.prepare("SELECT * FROM payment_requests WHERE id = ?").bind(id).all();
  const request = requestResults[0] as any;
  if (!request) return c.json({ error: "Request not found" }, 404);

  await c.env.DB.prepare("UPDATE payment_requests SET statut = 'pending' WHERE id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM user_purchases WHERE id_utilisateur = ? AND id_saison = ?").bind(request.id_utilisateur, request.id_saison).run();
  return c.json({ success: true });
});

app.post("/api/admin/payments/:id/revoke", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  const { pin } = await c.req.json();
  const user = c.get("user");
  if (!pin || !bcrypt.compareSync(pin, user.pin)) return c.json({ error: "Code PIN incorrect" }, 401);
  const { results: requestResults } = await c.env.DB.prepare("SELECT * FROM payment_requests WHERE id = ?").bind(id).all();
  const request = requestResults[0] as any;
  if (!request) return c.json({ error: "Request not found" }, 404);

  await c.env.DB.prepare("UPDATE payment_requests SET statut = 'revoked' WHERE id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM user_purchases WHERE id_utilisateur = ? AND id_saison = ?").bind(request.id_utilisateur, request.id_saison).run();
  return c.json({ success: true });
});

app.get("/api/admin/stock", authenticate, isAdmin, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM stock_episodes ORDER BY date_creation DESC").all();
  return c.json(results);
});

app.post("/api/admin/stock/upload", authenticate, isAdmin, async (c) => {
  try {
    const formData = await c.req.formData();
    const files = formData.getAll("files");
    
    if (!files || files.length === 0) {
      return c.json({ error: "Aucun fichier reçu" }, 400);
    }
    
    const results = [];
    for (const file of files) {
      if (file instanceof File) {
        console.log(`Processing file: ${file.name} (${file.size} bytes)`);
        const cleanName = file.name.replace(/\s+/g, '_');
        const key = `stock/${cleanName}`;
        
        try {
          await c.env.R2.put(key, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type || 'video/mp4' }
          });
          
          const url = `/api/files/${key}`;
          
          const { results: dbResults } = await c.env.DB.prepare(
            "INSERT INTO stock_episodes (titre, url_video, file_name) VALUES (?, ?, ?) RETURNING id"
          ).bind(file.name, url, file.name).all();
          results.push(dbResults[0]);
        } catch (uploadErr: any) {
          console.error(`Error uploading/saving file ${file.name}:`, uploadErr.message);
          // Continue with next file
        }
      }
    }
    
    return c.json({ success: true, results });
  } catch (err: any) {
    console.error("Stock upload general error:", err.message);
    return c.json({ error: "Erreur générale d'upload: " + err.message }, 500);
  }
});

app.post("/api/admin/stock/:id/assign", authenticate, isAdmin, async (c) => {
  const stockId = c.req.param("id");
  const { id_saison, titre, statut } = await c.req.json();
  const admin = c.get("user");
  // Optional: check pin if needed, but let's keep it simple for now as it's a move operation
  
  const { results: stockResults } = await c.env.DB.prepare("SELECT * FROM stock_episodes WHERE id = ?").bind(stockId).all();
  const stockEp = stockResults[0] as any;
  if (!stockEp) return c.json({ error: "Épisode non trouvé dans le stock" }, 404);
  
  let finalUrl = stockEp.url_video;

  // Si c'est un fichier stocké dans R2 sous stock/, on le déplace vers la racine
  if (stockEp.url_video.includes("/api/files/stock/")) {
    const oldKey = stockEp.url_video.split("/api/files/")[1];
    const filename = oldKey.replace("stock/", "");
    const newKey = filename;

    try {
      const object = await c.env.R2.get(oldKey);
      if (object) {
        await c.env.R2.put(newKey, object.body, {
          httpMetadata: object.httpMetadata
        });
        await c.env.R2.delete(oldKey);
        // Utiliser l'URL directe R2 comme pour l'upload direct
        finalUrl = `https://pub-7bb28ff3c4f448a19f8caf3f040ceb0b.r2.dev/${newKey}`;
      }
    } catch (e) {
      console.error("Error moving file in R2:", e);
    }
  }
  
  try {
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO episodes (id_saison, titre, url_video, statut) VALUES (?, ?, ?, ?)").bind(id_saison, titre || stockEp.titre, finalUrl, statut || 'locked'),
      c.env.DB.prepare("DELETE FROM stock_episodes WHERE id = ?").bind(stockId)
    ]);
    return c.json({ success: true, url_video: finalUrl });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post("/api/admin/stock/bulk-assign", authenticate, isAdmin, async (c) => {
  const { ids, id_saison, statut } = await c.req.json();
  if (!ids || !Array.isArray(ids) || ids.length === 0) return c.json({ error: "Aucun épisode sélectionné" }, 400);

  try {
    const queries = [];
    for (const stockId of ids) {
      const { results: stockResults } = await c.env.DB.prepare("SELECT * FROM stock_episodes WHERE id = ?").bind(stockId).all();
      const stockEp = stockResults[0] as any;
      if (stockEp) {
        let finalUrl = stockEp.url_video;

        if (stockEp.url_video.includes("/api/files/stock/")) {
          const oldKey = stockEp.url_video.split("/api/files/")[1];
          const filename = oldKey.replace("stock/", "");
          const newKey = filename;

          try {
            const object = await c.env.R2.get(oldKey);
            if (object) {
              await c.env.R2.put(newKey, object.body, {
                httpMetadata: object.httpMetadata
              });
              await c.env.R2.delete(oldKey);
              finalUrl = `https://pub-7bb28ff3c4f448a19f8caf3f040ceb0b.r2.dev/${newKey}`;
            }
          } catch (e) {
            console.error(`Error moving ${oldKey} in R2:`, e);
          }
        }

        queries.push(c.env.DB.prepare("INSERT INTO episodes (id_saison, titre, url_video, statut) VALUES (?, ?, ?, ?)").bind(id_saison, stockEp.titre, finalUrl, statut || 'locked'));
        queries.push(c.env.DB.prepare("DELETE FROM stock_episodes WHERE id = ?").bind(stockId));
      }
    }
    
    if (queries.length > 0) {
      await c.env.DB.batch(queries);
    }
    
    return c.json({ success: true, count: queries.length / 2 });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.delete("/api/admin/stock/:id", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  
  const { results: stockResults } = await c.env.DB.prepare("SELECT * FROM stock_episodes WHERE id = ?").bind(id).all();
  const stockEp = stockResults[0] as any;
  if (!stockEp) return c.json({ error: "Épisode non trouvé" }, 404);
  
  // Attempt to delete from R2 if url starts with /api/files/
  if (stockEp.url_video.startsWith("/api/files/")) {
    const key = stockEp.url_video.replace("/api/files/", "");
    try {
      await c.env.R2.delete(key);
    } catch (e) {}
  }
  
  await c.env.DB.prepare("DELETE FROM stock_episodes WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

// Route to serve R2 files with Range support
app.get("/api/files/:key{.+$}", async (c) => {
  const key = c.req.param("key");
  const rangeHeader = c.req.header("Range");
  
  try {
    if (rangeHeader) {
      const object = await c.env.R2.get(key, { range: rangeHeader });
      if (!object) return c.json({ error: "Fichier non trouvé" }, 404);
      
      const headers = new Headers();
      object.writeHttpMetadata(headers as any);
      headers.set("etag", object.httpEtag);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Content-Type", headers.get("Content-Type") || "video/mp4");
      
      if (object.range) {
        const offset = (object.range as any).offset;
        const length = (object.range as any).length;
        const size = (object as any).size;
        headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${size}`);
        headers.set("Content-Length", length.toString());
        return new Response(object.body, { status: 206, headers });
      }
    }
    
    const object = await c.env.R2.get(key);
    if (!object) return c.json({ error: "Fichier non trouvé" }, 404);
    
    const headers = new Headers();
    object.writeHttpMetadata(headers as any);
    headers.set("etag", object.httpEtag);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Length", object.size.toString());
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Content-Type", headers.get("Content-Type") || "video/mp4");
    
    return new Response(object.body, { headers });
  } catch (e: any) {
    return c.json({ error: "Erreur R2: " + e.message }, 500);
  }
});

app.get("/api/admin/stats", authenticate, isAdmin, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        s.id as id_saison,
        ser.titre as titre_serie,
        s.numero as numero_saison,
        CAST(s.prix AS REAL) as prix_saison,
        COUNT(pr.id) as compte,
        COALESCE(SUM(CAST(pr.prix AS REAL)), 0) as total_recettes
      FROM seasons s
      JOIN series ser ON s.id_serie = ser.id
      LEFT JOIN payment_requests pr ON s.id = pr.id_saison AND pr.statut = 'approved'
      GROUP BY s.id, ser.titre, s.numero, s.prix
      ORDER BY ser.titre, s.numero
    `).all();
    return c.json(results);
  } catch (error) {
    return c.json({ error: "Erreur lors de la récupération des statistiques" }, 500);
  }
});

app.post("/api/admin/reset-sales", authenticate, isAdmin, async (c) => {
  const { pin } = await c.req.json();
  const user = c.get("user");
  if (!pin || !bcrypt.compareSync(pin, user.pin)) return c.json({ error: "Code PIN incorrect" }, 401);
  await c.env.DB.prepare("DELETE FROM payment_requests WHERE statut = 'approved'").run();
  await c.env.DB.prepare("DELETE FROM user_purchases").run();
  return c.json({ message: "Données de vente réinitialisées avec succès" });
});

app.get("/api/admin/series", authenticate, isAdmin, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM series ORDER BY date_creation DESC").all();
  return c.json(results);
});

app.get("/api/admin/seasons", authenticate, isAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT s.*, ser.titre as titre_serie 
    FROM seasons s 
    JOIN series ser ON s.id_serie = ser.id
    ORDER BY s.date_creation DESC
  `).all();
  return c.json(results);
});

app.get("/api/admin/episodes", authenticate, isAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT e.*, s.numero as numero_saison, ser.titre as titre_serie 
    FROM episodes e 
    JOIN seasons s ON e.id_saison = s.id 
    JOIN series ser ON s.id_serie = ser.id
    ORDER BY e.date_creation DESC
  `).all();
  return c.json(results);
});

app.get("/api/admin/pin-requests", authenticate, isAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT pr.*, u.telephone as telephone_utilisateur, (u.prenom || ' ' || u.nom) as nom_utilisateur 
    FROM pin_reset_requests pr 
    JOIN users u ON pr.id_utilisateur = u.id 
    ORDER BY pr.date DESC
  `).all();
  return c.json(results);
});

app.post("/api/admin/pin-requests/:id/approve", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  const { pin } = await c.req.json();
  const user = c.get("user");
  if (!pin || !bcrypt.compareSync(pin, user.pin)) return c.json({ error: "Code PIN incorrect" }, 401);
  await c.env.DB.prepare("UPDATE pin_reset_requests SET statut = 'approved' WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

app.post("/api/admin/pin-requests/:id/reject", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  const { pin } = await c.req.json();
  const user = c.get("user");
  if (!pin || !bcrypt.compareSync(pin, user.pin)) return c.json({ error: "Code PIN incorrect" }, 401);
  await c.env.DB.prepare("UPDATE pin_reset_requests SET statut = 'rejected' WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

app.post("/api/user/profile/update", authenticate, async (c) => {
  const { prenom, nom, telephone } = await c.req.json();
  const user = c.get("user");

  if (user.last_profile_update) {
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();
    const lastUpdateTime = new Date(user.last_profile_update).getTime();
    if (now - lastUpdateTime < thirtyDaysInMs) {
      const remainingDays = Math.ceil((thirtyDaysInMs - (now - lastUpdateTime)) / (24 * 60 * 60 * 1000));
      return c.json({ error: `Vous ne pouvez modifier vos informations qu'une fois tous les 30 jours. Veuillez patienter encore ${remainingDays} jours.` }, 400);
    }
  }

  try {
    const { results } = await c.env.DB.prepare(
      "UPDATE users SET prenom = ?, nom = ?, telephone = ?, last_profile_update = CURRENT_TIMESTAMP WHERE id = ? RETURNING id, telephone, role, prenom, nom, permissions, last_profile_update"
    ).bind(prenom, nom, telephone, user.id).all();
    const updatedUser = results[0] as any;
    if (updatedUser.permissions) {
      try {
        updatedUser.permissions = typeof updatedUser.permissions === 'string' ? JSON.parse(updatedUser.permissions) : updatedUser.permissions;
      } catch (e) {}
    }
    return c.json({ success: true, user: updatedUser });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return c.json({ error: "Ce numéro de téléphone est déjà utilisé par un autre compte." }, 400);
    }
    return c.json({ error: "Erreur lors de la mise à jour du profil" }, 500);
  }
});

app.get("/api/user/pin-request", authenticate, async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare("SELECT * FROM pin_reset_requests WHERE id_utilisateur = ? ORDER BY date DESC LIMIT 1").bind(user.id).all();
  return c.json(results[0] || { error: "No request found" });
});

app.post("/api/user/pin-requests/request", authenticate, async (c) => {
  const user = c.get("user");
  const { results: existingResults } = await c.env.DB.prepare("SELECT * FROM pin_reset_requests WHERE id_utilisateur = ? AND statut = 'pending'").bind(user.id).all();
  if (existingResults.length > 0) return c.json({ error: "Une demande est déjà en attente." }, 400);
  const date = new Date().toISOString();
  const { results } = await c.env.DB.prepare("INSERT INTO pin_reset_requests (id_utilisateur, date) VALUES (?, ?) RETURNING *").bind(user.id, date).all();
  return c.json(results[0]);
});

app.post("/api/user/pin-requests/complete", authenticate, async (c) => {
  const { nouveau_pin } = await c.req.json();
  const user = c.get("user");
  const { results: requestResults } = await c.env.DB.prepare("SELECT * FROM pin_reset_requests WHERE id_utilisateur = ? AND statut = 'approved' ORDER BY date DESC LIMIT 1").bind(user.id).all();
  if (requestResults.length === 0) return c.json({ error: "Aucune demande approuvée trouvée." }, 400);

  const hashedPin = bcrypt.hashSync(nouveau_pin, 10);
  await c.env.DB.prepare("UPDATE users SET pin = ? WHERE id = ?").bind(hashedPin, user.id).run();
  await c.env.DB.prepare("DELETE FROM pin_reset_requests WHERE id_utilisateur = ?").bind(user.id).run();
  return c.json({ success: true });
});

app.post("/api/user/change-pin", authenticate, async (c) => {
  const { ancien_pin, nouveau_pin } = await c.req.json();
  const user = c.get("user");
  if (!bcrypt.compareSync(ancien_pin, user.pin)) return c.json({ error: "Ancien PIN incorrect." }, 400);
  const hashedPin = bcrypt.hashSync(nouveau_pin, 10);
  await c.env.DB.prepare("UPDATE users SET pin = ? WHERE id = ?").bind(hashedPin, user.id).run();
  return c.json({ success: true });
});

app.post("/api/admin/reset-pin", async (c) => {
  const { telephone, prenom, nom, mot_secret, nouveau_pin } = await c.req.json();
  if (mot_secret !== "ADBMPIN") return c.json({ error: "Mot secret incorrect." }, 403);
  const { results } = await c.env.DB.prepare("SELECT * FROM users WHERE telephone = ? AND prenom = ? AND nom = ?").bind(telephone, prenom, nom).all();
  const user = results[0] as any;
  if (!user) return c.json({ error: "Administrateur non trouvé avec ces informations." }, 404);
  if (user.role !== 'admin' && user.role !== 'owner') return c.json({ error: "Seuls les administrateurs peuvent utiliser cette fonction." }, 403);
  const hashedPin = bcrypt.hashSync(nouveau_pin, 10);
  await c.env.DB.prepare("UPDATE users SET pin = ? WHERE id = ?").bind(hashedPin, user.id).run();
  return c.json({ success: true });
});

app.post("/api/admin/series", authenticate, isAdmin, async (c) => {
  const { titre, description, image, banniere, genre, langue, statut } = await c.req.json();
  try {
    const { results } = await c.env.DB.prepare("INSERT INTO series (titre, description, image, banniere, genre, langue, statut) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id").bind(titre, description, image, banniere, genre, langue, statut || 'published').all();
    return c.json({ id: (results[0] as any).id });
  } catch (e) {
    const { results } = await c.env.DB.prepare("INSERT INTO series (titre, description, image, banniere, genre, langue) VALUES (?, ?, ?, ?, ?, ?) RETURNING id").bind(titre, description, image, banniere, genre, langue).all();
    return c.json({ id: (results[0] as any).id });
  }
});

app.put("/api/admin/series/:id", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  const { titre, description, image, banniere, genre, langue, statut } = await c.req.json();
  try {
    await c.env.DB.prepare("UPDATE series SET titre = ?, description = ?, image = ?, banniere = ?, genre = ?, langue = ?, statut = ? WHERE id = ?").bind(titre, description, image, banniere, genre, langue, statut, id).run();
  } catch (e) {
    await c.env.DB.prepare("UPDATE series SET titre = ?, description = ?, image = ?, banniere = ?, genre = ?, langue = ? WHERE id = ?").bind(titre, description, image, banniere, genre, langue, id).run();
  }
  return c.json({ success: true });
});

app.delete("/api/admin/series/:id", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  // Soft delete
  await c.env.DB.prepare("UPDATE series SET statut = 'deleted' WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

app.delete("/api/admin/series/:id/permanent", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM series WHERE id = ?").bind(id).run();
  // Also delete related seasons and episodes
  await c.env.DB.prepare("DELETE FROM seasons WHERE id_serie = ?").bind(id).run();
  return c.json({ success: true });
});

app.post("/api/admin/seasons", authenticate, isAdmin, async (c) => {
  const { id_serie, numero, prix, titre, statut, date_publication } = await c.req.json();
  const formattedPrix = typeof prix === 'number' ? prix.toFixed(2) : prix;
  try {
    const { results } = await c.env.DB.prepare("INSERT INTO seasons (id_serie, numero, prix, titre, statut, date_publication) VALUES (?, ?, ?, ?, ?, ?) RETURNING id").bind(id_serie, numero, formattedPrix, titre, statut || 'published', date_publication || null).all();
    return c.json({ id: (results[0] as any).id });
  } catch (e) {
    // Try without date_publication first
    try {
      const { results } = await c.env.DB.prepare("INSERT INTO seasons (id_serie, numero, prix, titre, statut) VALUES (?, ?, ?, ?, ?) RETURNING id").bind(id_serie, numero, formattedPrix, titre, statut || 'published').all();
      return c.json({ id: (results[0] as any).id });
    } catch (e2) {
      // Final fallback
      const { results } = await c.env.DB.prepare("INSERT INTO seasons (id_serie, numero, prix, titre) VALUES (?, ?, ?, ?) RETURNING id").bind(id_serie, numero, formattedPrix, titre).all();
      return c.json({ id: (results[0] as any).id });
    }
  }
});

app.put("/api/admin/seasons/:id", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  const { id_serie, numero, prix, titre, statut, date_publication } = await c.req.json();
  const formattedPrix = typeof prix === 'number' ? prix.toFixed(2) : prix;
  try {
    await c.env.DB.prepare("UPDATE seasons SET id_serie = ?, numero = ?, prix = ?, titre = ?, statut = ?, date_publication = ? WHERE id = ?").bind(id_serie, numero, formattedPrix, titre, statut, date_publication || null, id).run();
  } catch (e) {
    // Try without date_publication first
    try {
      await c.env.DB.prepare("UPDATE seasons SET id_serie = ?, numero = ?, prix = ?, titre = ?, statut = ? WHERE id = ?").bind(id_serie, numero, formattedPrix, titre, statut, id).run();
    } catch (e2) {
      // Final fallback
      await c.env.DB.prepare("UPDATE seasons SET id_serie = ?, numero = ?, prix = ?, titre = ? WHERE id = ?").bind(id_serie, numero, formattedPrix, titre, id).run();
    }
  }
  return c.json({ success: true });
});

app.delete("/api/admin/seasons/:id", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  // Soft delete
  await c.env.DB.prepare("UPDATE seasons SET statut = 'deleted' WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

app.delete("/api/admin/seasons/:id/permanent", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM seasons WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

app.post("/api/admin/episodes", authenticate, isAdmin, async (c) => {
  const { id_saison, titre, url_video, statut } = await c.req.json();
  try {
    const { results } = await c.env.DB.prepare("INSERT INTO episodes (id_saison, titre, url_video, statut) VALUES (?, ?, ?, ?) RETURNING id").bind(id_saison, titre, url_video, statut).all();
    return c.json({ id: (results[0] as any).id });
  } catch (e) {
    // Fallback if statut column doesn't exist
    const { results } = await c.env.DB.prepare("INSERT INTO episodes (id_saison, titre, url_video) VALUES (?, ?, ?) RETURNING id").bind(id_saison, titre, url_video).all();
    return c.json({ id: (results[0] as any).id });
  }
});

app.get("/api/admin/payments-log", authenticate, isAdmin, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM payments_log ORDER BY date_creation DESC").all();
  return c.json(results);
});

app.delete("/api/admin/payments-log/:id", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM payments_log WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

app.post("/api/upload", authenticate, isAdmin, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'] as File;

    if (!file) {
      return c.json({ error: "Aucun fichier fourni" }, 400);
    }

    const filename = file.name.replace(/\s+/g, '_');
    await c.env.R2.put(filename, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    });

    const url = `https://pub-7bb28ff3c4f448a19f8caf3f040ceb0b.r2.dev/${filename}`;
    return c.json({ url });
  } catch (error: any) {
    return c.json({ error: "Erreur lors de l'upload: " + error.message }, 500);
  }
});

app.put("/api/admin/episodes/:id", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  const { id_saison, titre, url_video, statut } = await c.req.json();
  try {
    await c.env.DB.prepare("UPDATE episodes SET id_saison = ?, titre = ?, url_video = ?, statut = ? WHERE id = ?").bind(id_saison, titre, url_video, statut, id).run();
  } catch (e) {
    // Fallback if statut column doesn't exist
    await c.env.DB.prepare("UPDATE episodes SET id_saison = ?, titre = ?, url_video = ? WHERE id = ?").bind(id_saison, titre, url_video, id).run();
  }
  return c.json({ success: true });
});

app.delete("/api/admin/episodes/:id", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  // Soft delete
  await c.env.DB.prepare("UPDATE episodes SET statut = 'deleted' WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

app.delete("/api/admin/episodes/:id/permanent", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM episodes WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

app.post("/api/admin/episodes/:id/statut", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  const { statut } = await c.req.json();
  await c.env.DB.prepare("UPDATE episodes SET statut = ? WHERE id = ?").bind(statut, id).run();
  return c.json({ success: true });
});

app.get("/api/user/payment-requests", authenticate, async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare("SELECT * FROM payment_requests WHERE id_utilisateur = ? ORDER BY date DESC").bind(user.id).all();
  return c.json(results);
});

app.get("/api/user/purchased-content", authenticate, async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(`
    SELECT 
      s.id as id_serie,
      s.titre as titre_serie,
      s.image as image_serie,
      sea.id as id_saison,
      sea.numero as numero_saison,
      sea.prix as prix_saison,
      sea.titre as titre_saison,
      (SELECT COUNT(*) FROM episodes e WHERE e.id_saison = sea.id) as total_episodes
    FROM user_purchases up
    JOIN seasons sea ON up.id_saison = sea.id
    JOIN series s ON sea.id_serie = s.id
    WHERE up.id_utilisateur = ? AND s.statut = 'published' AND sea.statut = 'published'
  `).bind(user.id).all();
  return c.json(results);
});

app.get("/api/admin/banners", authenticate, isAdmin, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM banners ORDER BY date_creation DESC").all();
  return c.json(results);
});

app.post("/api/admin/banners", authenticate, isAdmin, async (c) => {
  const { titre, image, id_serie, statut, type } = await c.req.json();
  const { results } = await c.env.DB.prepare("INSERT INTO banners (titre, image, id_serie, statut, type) VALUES (?, ?, ?, ?, ?) RETURNING id").bind(titre, image, id_serie, statut, type || 'image').all();
  return c.json({ id: (results[0] as any).id });
});

app.put("/api/admin/banners/:id", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  const { titre, image, id_serie, statut, type } = await c.req.json();
  await c.env.DB.prepare("UPDATE banners SET titre = ?, image = ?, id_serie = ?, statut = ?, type = ? WHERE id = ?").bind(titre, image, id_serie, statut, type || 'image', id).run();
  return c.json({ success: true });
});

app.delete("/api/admin/banners/:id", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM banners WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

app.get("/api/admin/settings", authenticate, isAdmin, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM settings").all();
  return c.json(results);
});

app.post("/api/admin/settings", authenticate, isAdmin, async (c) => {
  const { cle, valeur } = await c.req.json();
  await c.env.DB.prepare("INSERT INTO settings (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur").bind(cle, valeur).run();
  return c.json({ success: true });
});

app.delete("/api/admin/settings/:cle", authenticate, isAdmin, async (c) => {
  const cle = c.req.param("cle");
  await c.env.DB.prepare("DELETE FROM settings WHERE cle = ?").bind(cle).run();
  return c.json({ success: true });
});

// Admin Routes
app.get("/api/admin/users", authenticate, isAdmin, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, telephone, prenom, nom, role, statut, permissions FROM users").all();
  const formattedUsers = results.map((u: any) => {
    let permissions = [];
    if (u.permissions) {
      try {
        permissions = typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions;
      } catch (e) {}
    }
    return { ...u, permissions };
  });
  return c.json(formattedUsers);
});

app.get("/api/admin/payments", authenticate, isAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT pr.*, u.telephone as telephone_utilisateur, (u.prenom || ' ' || u.nom) as nom_utilisateur
    FROM payment_requests pr 
    JOIN users u ON pr.id_utilisateur = u.id 
    ORDER BY pr.date DESC
  `).all();
  return c.json(results);
});

app.post("/api/admin/payments/:id/approve", authenticate, isAdmin, async (c) => {
  const id = c.req.param("id");
  
  const { results: requestResults } = await c.env.DB.prepare("SELECT * FROM payment_requests WHERE id = ?").bind(id).all();
  const request = requestResults[0] as any;
  if (!request) return c.json({ error: "Request not found" }, 404);
  
  // D1 doesn't support multi-statement transactions in a single query string easily, 
  // but we can use batch or just sequential queries for simplicity in this context.
  await c.env.DB.prepare("UPDATE payment_requests SET statut = 'approved' WHERE id = ?").bind(id).run();
  await c.env.DB.prepare("INSERT INTO user_purchases (id_utilisateur, id_saison) VALUES (?, ?) ON CONFLICT (id_utilisateur, id_saison) DO NOTHING").bind(request.id_utilisateur, request.id_saison).run();
  
  return c.json({ success: true });
});

app.get("/api/admin/trash", authenticate, isAdmin, async (c) => {
  const { results: series } = await c.env.DB.prepare("SELECT *, 'series' as type FROM series WHERE statut = 'deleted'").all();
  const { results: seasons } = await c.env.DB.prepare("SELECT s.*, ser.titre as titre_serie, 'season' as type FROM seasons s JOIN series ser ON s.id_serie = ser.id WHERE s.statut = 'deleted'").all();
  const { results: episodes } = await c.env.DB.prepare("SELECT e.*, ser.titre as titre_serie, s.numero as numero_saison, 'episode' as type FROM episodes e JOIN seasons s ON e.id_saison = s.id JOIN series ser ON s.id_serie = ser.id WHERE e.statut = 'deleted'").all();
  
  return c.json({ series, seasons, episodes });
});

app.post("/api/admin/trash/restore", authenticate, isAdmin, async (c) => {
  const { id, type } = await c.req.json();
  let table = "";
  if (type === 'series') table = "series";
  else if (type === 'season') table = "seasons";
  else if (type === 'episode') table = "episodes";
  
  if (!table) return c.json({ error: "Invalid type" }, 400);
  
  await c.env.DB.prepare(`UPDATE ${table} SET statut = 'draft' WHERE id = ?`).bind(id).run();
  return c.json({ success: true });
});
app.get("/api/admin/dashboard-stats", authenticate, isAdmin, async (c) => {
  const { results: usersCountResults } = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users").all();
  const { results: seriesCountResults } = await c.env.DB.prepare("SELECT COUNT(*) as count FROM series").all();
  const { results: revenueResults } = await c.env.DB.prepare("SELECT SUM(CAST(prix AS REAL)) as sum FROM payment_requests WHERE statut = 'approved'").all();
  const { results: pendingPaymentsResults } = await c.env.DB.prepare("SELECT COUNT(*) as count FROM payment_requests WHERE statut = 'pending'").all();
  const { results: pendingPinResetsResults } = await c.env.DB.prepare("SELECT COUNT(*) as count FROM pin_reset_requests WHERE statut = 'pending'").all();

  return c.json({
    totalUsers: Number((usersCountResults[0] as any).count || 0),
    totalSeries: Number((seriesCountResults[0] as any).count || 0),
    totalRevenue: Number((revenueResults[0] as any).sum || 0),
    pendingPayments: Number((pendingPaymentsResults[0] as any).count || 0),
    pendingPinResets: Number((pendingPinResetsResults[0] as any).count || 0)
  });
});

// Fallback for SPA
export default app;
