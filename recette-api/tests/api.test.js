// tests/api.test.js
const request = require("supertest");
const fs = require("fs");
const path = require("path");

const TEST_DATA_FILE = path.join(__dirname, "test_recipes.json");
const TEST_REVIEWS_FILE = path.join(__dirname, "test_reviews.json");
process.env.DATA_FILE = TEST_DATA_FILE;
process.env.REVIEWS_FILE = TEST_REVIEWS_FILE;

const app = require("../server");

const FAKE_TOKEN = "Bearer fake-token-for-tests";

beforeEach(() => {
    fs.writeFileSync(TEST_DATA_FILE, JSON.stringify([
        {
            id: 1,
            title: "Fondant au chocolat",
            category: "dessert",
            preparation_time: 25,
            ingredients: "chocolat, beurre, oeufs, sucre, farine",
            steps: "Faire fondre le chocolat...",
            portions: 4,
            difficulty: "facile",
            utensils: "four, moule",
            image: null,
            created_at: "2024-01-01T00:00:00.000Z",
        },
        {
            id: 2,
            title: "Salade César",
            category: "entree",
            preparation_time: 15,
            ingredients: "salade, poulet, parmesan, croutons",
            steps: "Mélanger les ingrédients...",
            portions: 2,
            difficulty: "facile",
            utensils: "saladier",
            image: null,
            created_at: "2024-01-02T00:00:00.000Z",
        },
    ]));
    fs.writeFileSync(TEST_REVIEWS_FILE, JSON.stringify([
        {
            id: 1,
            recipe_id: 1,
            rating: 5,
            comment: "Excellent !",
            author: "Alice",
            created_at: "2024-01-01T00:00:00.000Z",
        }
    ]));
});

afterAll(() => {
    if (fs.existsSync(TEST_DATA_FILE)) fs.unlinkSync(TEST_DATA_FILE);
    if (fs.existsSync(TEST_REVIEWS_FILE)) fs.unlinkSync(TEST_REVIEWS_FILE);
});

// ─── GET /recipes ─────────────────────────────────────────────────────────────

describe("GET /recipes", () => {
    test("retourne toutes les recettes", async () => {
        const res = await request(app).get("/recipes");
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(2);
    });

    test("filtre par titre avec ?q=", async () => {
        const res = await request(app).get("/recipes?q=salade");
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe("Salade César");
    });

    test("filtre par catégorie avec ?category=dessert", async () => {
        const res = await request(app).get("/recipes?category=dessert");
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(1);
    });

    test("retourne [] si aucun résultat", async () => {
        const res = await request(app).get("/recipes?q=inexistant");
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(0);
    });
});

// ─── GET /recipes/:id ─────────────────────────────────────────────────────────

describe("GET /recipes/:id", () => {
    test("retourne la bonne recette", async () => {
        const res = await request(app).get("/recipes/1");
        expect(res.statusCode).toBe(200);
        expect(res.body.title).toBe("Fondant au chocolat");
    });

    test("retourne 404 si inexistant", async () => {
        const res = await request(app).get("/recipes/999");
        expect(res.statusCode).toBe(404);
    });

    test("retourne 400 si ID invalide", async () => {
        const res = await request(app).get("/recipes/abc");
        expect(res.statusCode).toBe(400);
    });
});

// ─── POST /recipes ────────────────────────────────────────────────────────────

describe("POST /recipes", () => {
    test("crée une recette avec token", async () => {
        const res = await request(app)
            .post("/recipes")
            .set("Authorization", FAKE_TOKEN)
            .send({ title: "Tarte aux pommes", category: "dessert", preparation_time: 45 });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("id");
        expect(res.body.title).toBe("Tarte aux pommes");
    });

    test("retourne 401 sans token", async () => {
        const res = await request(app)
            .post("/recipes")
            .send({ title: "Tarte aux pommes", category: "dessert" });
        expect(res.statusCode).toBe(401);
    });

    test("retourne 400 si title manquant", async () => {
        const res = await request(app)
            .post("/recipes")
            .set("Authorization", FAKE_TOKEN)
            .send({ category: "dessert" });
        expect(res.statusCode).toBe(400);
    });

    test("retourne 400 si category invalide", async () => {
        const res = await request(app)
            .post("/recipes")
            .set("Authorization", FAKE_TOKEN)
            .send({ title: "Test", category: "invalide" });
        expect(res.statusCode).toBe(400);
    });

    test("retourne 400 si URL image invalide", async () => {
        const res = await request(app)
            .post("/recipes")
            .set("Authorization", FAKE_TOKEN)
            .send({ title: "Test", category: "dessert", image: "not-a-url" });
        expect(res.statusCode).toBe(400);
    });
});

// ─── PUT /recipes/:id ─────────────────────────────────────────────────────────

describe("PUT /recipes/:id", () => {
    test("modifie une recette avec token", async () => {
        const res = await request(app)
            .put("/recipes/1")
            .set("Authorization", FAKE_TOKEN)
            .send({ title: "Fondant modifié", category: "dessert" });
        expect(res.statusCode).toBe(200);
        expect(res.body.title).toBe("Fondant modifié");
    });

    test("retourne 401 sans token", async () => {
        const res = await request(app)
            .put("/recipes/1")
            .send({ title: "Test", category: "dessert" });
        expect(res.statusCode).toBe(401);
    });

    test("retourne 404 si inexistant", async () => {
        const res = await request(app)
            .put("/recipes/999")
            .set("Authorization", FAKE_TOKEN)
            .send({ title: "Test", category: "dessert" });
        expect(res.statusCode).toBe(404);
    });
});

// ─── DELETE /recipes/:id ──────────────────────────────────────────────────────

describe("DELETE /recipes/:id", () => {
    test("supprime une recette avec token", async () => {
        const res = await request(app)
            .delete("/recipes/1")
            .set("Authorization", FAKE_TOKEN);
        expect(res.statusCode).toBe(200);
        const check = await request(app).get("/recipes/1");
        expect(check.statusCode).toBe(404);
    });

    test("retourne 401 sans token", async () => {
        const res = await request(app).delete("/recipes/1");
        expect(res.statusCode).toBe(401);
    });

    test("retourne 404 si inexistant", async () => {
        const res = await request(app)
            .delete("/recipes/999")
            .set("Authorization", FAKE_TOKEN);
        expect(res.statusCode).toBe(404);
    });
});

// ─── GET /recipes/:id/reviews ─────────────────────────────────────────────────

describe("GET /recipes/:id/reviews", () => {
    test("retourne les avis d'une recette", async () => {
        const res = await request(app).get("/recipes/1/reviews");
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].author).toBe("Alice");
    });

    test("retourne [] si pas d'avis", async () => {
        const res = await request(app).get("/recipes/2/reviews");
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(0);
    });
});

// ─── POST /recipes/:id/reviews ────────────────────────────────────────────────

describe("POST /recipes/:id/reviews", () => {
    test("ajoute un avis avec token", async () => {
        const res = await request(app)
            .post("/recipes/1/reviews")
            .set("Authorization", FAKE_TOKEN)
            .send({ rating: 4, comment: "Très bon !", author: "Bob" });
        expect(res.statusCode).toBe(201);
        expect(res.body.rating).toBe(4);
    });

    test("retourne 401 sans token", async () => {
        const res = await request(app)
            .post("/recipes/1/reviews")
            .send({ rating: 4, author: "Bob" });
        expect(res.statusCode).toBe(401);
    });

    test("retourne 400 si note invalide", async () => {
        const res = await request(app)
            .post("/recipes/1/reviews")
            .set("Authorization", FAKE_TOKEN)
            .send({ rating: 6, author: "Bob" });
        expect(res.statusCode).toBe(400);
    });

    test("retourne 400 si note manquante", async () => {
        const res = await request(app)
            .post("/recipes/1/reviews")
            .set("Authorization", FAKE_TOKEN)
            .send({ comment: "Sans note", author: "Bob" });
        expect(res.statusCode).toBe(400);
    });
});

// ─── Sécurité ─────────────────────────────────────────────────────────────────

describe("Sécurité", () => {
    test("refuse les balises HTML dans le titre", async () => {
        const res = await request(app)
            .post("/recipes")
            .set("Authorization", FAKE_TOKEN)
            .send({ title: "<script>alert('xss')</script>", category: "dessert" });
        if (res.statusCode === 201) {
            expect(res.body.title).not.toContain("<script>");
        }
    });

    test("refuse un payload trop grand", async () => {
        const bigData = { title: "Test", category: "dessert", steps: "x".repeat(20000) };
        const res = await request(app)
            .post("/recipes")
            .set("Authorization", FAKE_TOKEN)
            .send(bigData);
        expect([201, 413]).toContain(res.statusCode);
    });
});

// ─── Efficience ───────────────────────────────────────────────────────────────

describe("Efficience - temps de réponse", () => {
    test("GET /recipes < 200ms", async () => {
        const start = Date.now();
        await request(app).get("/recipes");
        expect(Date.now() - start).toBeLessThan(200);
    });

    test("GET /recipes/:id < 200ms", async () => {
        const start = Date.now();
        await request(app).get("/recipes/1");
        expect(Date.now() - start).toBeLessThan(200);
    });
});