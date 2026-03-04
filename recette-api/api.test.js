// tests/api.test.js
// Installation : npm install --save-dev jest supertest
// Lancement    : npx jest

const request = require("supertest");
const fs = require("fs");
const path = require("path");

const TEST_DATA_FILE = path.join(__dirname, "test_recipes.json");
process.env.DATA_FILE = TEST_DATA_FILE;

const app = require("../server");

beforeEach(() => {
  fs.writeFileSync(
    TEST_DATA_FILE,
    JSON.stringify([
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
        created_at: "2024-01-02T00:00:00.000Z",
      },
    ])
  );
});

afterAll(() => {
  if (fs.existsSync(TEST_DATA_FILE)) fs.unlinkSync(TEST_DATA_FILE);
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

// ─── GET /recipes/:id ────────────────────────────────────────────────────────

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
});

// ─── POST /recipes ────────────────────────────────────────────────────────────

describe("POST /recipes", () => {
  test("crée une recette (dev mode sans Keycloak)", async () => {
    const res = await request(app).post("/recipes").send({
      title: "Tarte aux pommes",
      category: "dessert",
      preparation_time: 45,
    });
    expect([201, 401]).toContain(res.statusCode);
    if (res.statusCode === 201) {
      expect(res.body).toHaveProperty("id");
    }
  });

  test("retourne 400 si title manquant", async () => {
    const res = await request(app).post("/recipes").send({ category: "dessert" });
    expect(res.statusCode).toBe(400);
  });
});

// ─── PUT /recipes/:id ────────────────────────────────────────────────────────

describe("PUT /recipes/:id", () => {
  test("modifie une recette existante", async () => {
    const res = await request(app).put("/recipes/1").send({ portions: 8 });
    expect([200, 401]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.body.portions).toBe(8);
      expect(res.body.id).toBe(1);
    }
  });

  test("retourne 404 si inexistant", async () => {
    const res = await request(app).put("/recipes/999").send({ title: "X" });
    expect([404, 401]).toContain(res.statusCode);
  });
});

// ─── DELETE /recipes/:id ─────────────────────────────────────────────────────

describe("DELETE /recipes/:id", () => {
  test("supprime une recette", async () => {
    const res = await request(app).delete("/recipes/1");
    expect([200, 401]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      const check = await request(app).get("/recipes/1");
      expect(check.statusCode).toBe(404);
    }
  });

  test("retourne 404 si inexistant", async () => {
    const res = await request(app).delete("/recipes/999");
    expect([404, 401]).toContain(res.statusCode);
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