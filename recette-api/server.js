const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();

// ─── Sécurité HTTP headers ────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS restrictif ──────────────────────────────────────────────────────────
app.use(cors({
    origin: "http://localhost:8000", // Seulement Django
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "10kb" })); // Limite la taille des requêtes

// ─── Rate limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { message: "Trop de requêtes, réessayez plus tard." },
});
app.use(limiter);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: "Trop de tentatives d'authentification." },
});

// ─── Validation des données ───────────────────────────────────────────────────
function validateRecipe(data) {
    const errors = [];
    const validCategories = ["entree", "plat", "dessert", "cocktail"];
    const validDifficulties = ["facile", "moyen", "difficile"];

    if (!data.title || typeof data.title !== "string" || data.title.trim().length < 2) {
        errors.push("Le titre doit contenir au moins 2 caractères.");
    }
    if (data.title && data.title.length > 200) {
        errors.push("Le titre ne peut pas dépasser 200 caractères.");
    }
    if (!data.category || !validCategories.includes(data.category.toLowerCase())) {
        errors.push("Catégorie invalide. Valeurs acceptées : entree, plat, dessert, cocktail.");
    }
    if (data.preparation_time && (isNaN(data.preparation_time) || data.preparation_time < 0)) {
        errors.push("Le temps de préparation doit être un nombre positif.");
    }
    if (data.portions && (isNaN(data.portions) || data.portions < 1)) {
        errors.push("Le nombre de portions doit être supérieur à 0.");
    }
    if (data.difficulty && !validDifficulties.includes(data.difficulty.toLowerCase())) {
        errors.push("Difficulté invalide. Valeurs acceptées : facile, moyen, difficile.");
    }
    if (data.image && data.image.length > 0) {
        try {
            const url = new URL(data.image);
            if (!["http:", "https:"].includes(url.protocol)) {
                errors.push("L'URL de l'image doit commencer par http ou https.");
            }
        } catch {
            errors.push("L'URL de l'image est invalide.");
        }
    }
    return errors;
}

function validateReview(data) {
    const errors = [];
    if (!data.rating || isNaN(data.rating) || data.rating < 1 || data.rating > 5) {
        errors.push("La note doit être entre 1 et 5.");
    }
    if (data.comment && data.comment.length > 1000) {
        errors.push("Le commentaire ne peut pas dépasser 1000 caractères.");
    }
    if (data.author && data.author.length > 100) {
        errors.push("Le nom ne peut pas dépasser 100 caractères.");
    }
    return errors;
}

// ─── Sanitisation basique ─────────────────────────────────────────────────────
function sanitizeString(str) {
    if (typeof str !== "string") return str;
    return str.trim().replace(/[<>]/g, ""); // Empêche injection HTML basique
}

function sanitizeRecipe(data) {
    return {
        title: sanitizeString(data.title),
        category: sanitizeString(data.category)?.toLowerCase(),
        preparation_time: parseInt(data.preparation_time) || 0,
        ingredients: sanitizeString(data.ingredients),
        steps: sanitizeString(data.steps),
        portions: parseInt(data.portions) || 1,
        difficulty: sanitizeString(data.difficulty)?.toLowerCase(),
        utensils: sanitizeString(data.utensils),
        image: sanitizeString(data.image),
    };
}

// ─── Persistance JSON ─────────────────────────────────────────────────────────
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "recipes.json");
const REVIEWS_FILE = process.env.REVIEWS_FILE || path.join(__dirname, "reviews.json");

function loadJSON(file) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Token manquant" });
    }
    next();
}

// ─── Routes recettes ──────────────────────────────────────────────────────────

app.get("/recipes", (req, res) => {
    let recipes = loadJSON(DATA_FILE);
    const { q, category } = req.query;

    if (q && typeof q === "string") {
        recipes = recipes.filter(r => r.title.toLowerCase().includes(q.toLowerCase()));
    }
    if (category && typeof category === "string") {
        recipes = recipes.filter(r => r.category.toLowerCase() === category.toLowerCase());
    }
    res.json(recipes);
});

app.get("/recipes/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const recipes = loadJSON(DATA_FILE);
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return res.status(404).json({ message: "Recette non trouvée" });
    res.json(recipe);
});

app.post("/recipes", requireAuth, (req, res) => {
    const errors = validateRecipe(req.body);
    if (errors.length > 0) return res.status(400).json({ message: errors.join(", ") });

    const recipes = loadJSON(DATA_FILE);
    const data = sanitizeRecipe(req.body);
    const newId = recipes.length > 0 ? Math.max(...recipes.map(r => r.id)) + 1 : 1;

    const newRecipe = {
        id: newId,
        ...data,
        created_at: new Date().toISOString(),
    };

    recipes.push(newRecipe);
    saveJSON(DATA_FILE, recipes);
    res.status(201).json(newRecipe);
});

app.put("/recipes/:id", requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const errors = validateRecipe(req.body);
    if (errors.length > 0) return res.status(400).json({ message: errors.join(", ") });

    const recipes = loadJSON(DATA_FILE);
    const index = recipes.findIndex(r => r.id === id);
    if (index === -1) return res.status(404).json({ message: "Recette non trouvée" });

    const data = sanitizeRecipe(req.body);
    recipes[index] = { ...recipes[index], ...data, id: recipes[index].id };
    saveJSON(DATA_FILE, recipes);
    res.json(recipes[index]);
});

app.delete("/recipes/:id", requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    let recipes = loadJSON(DATA_FILE);
    const exists = recipes.some(r => r.id === id);
    if (!exists) return res.status(404).json({ message: "Recette non trouvée" });

    recipes = recipes.filter(r => r.id !== id);
    saveJSON(DATA_FILE, recipes);
    res.json({ message: "Recette supprimée" });
});

// ─── Routes reviews ───────────────────────────────────────────────────────────

app.get("/recipes/:id/reviews", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const reviews = loadJSON(REVIEWS_FILE);
    res.json(reviews.filter(r => r.recipe_id === id));
});

app.post("/recipes/:id/reviews", requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const errors = validateReview(req.body);
    if (errors.length > 0) return res.status(400).json({ message: errors.join(", ") });

    const reviews = loadJSON(REVIEWS_FILE);
    const newId = reviews.length > 0 ? Math.max(...reviews.map(r => r.id)) + 1 : 1;

    const newReview = {
        id: newId,
        recipe_id: id,
        rating: parseInt(req.body.rating),
        comment: sanitizeString(req.body.comment || ""),
        author: sanitizeString(req.body.author || "Anonyme"),
        created_at: new Date().toISOString(),
    };

    reviews.push(newReview);
    saveJSON(REVIEWS_FILE, reviews);
    res.status(201).json(newReview);
});

app.delete("/recipes/:id/reviews/:reviewId", requireAuth, (req, res) => {
    const reviewId = parseInt(req.params.reviewId);
    if (isNaN(reviewId)) return res.status(400).json({ message: "ID invalide" });

    let reviews = loadJSON(REVIEWS_FILE);
    reviews = reviews.filter(r => r.id !== reviewId);
    saveJSON(REVIEWS_FILE, reviews);
    res.json({ message: "Avis supprimé" });
});

// ─── Gestion des erreurs globale ──────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Erreur interne du serveur" });
});

// ─── Démarrage ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(` API démarrée sur http://localhost:${PORT}`);
});

module.exports = app;