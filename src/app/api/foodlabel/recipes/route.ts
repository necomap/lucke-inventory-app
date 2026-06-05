import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// Postgres Pool (再利用するためグローバルスコープで定義)
const pool = new Pool({
  connectionString: process.env.FOODLABEL_DB_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function GET() {
  if (!process.env.FOODLABEL_DB_URL) {
    return NextResponse.json({ error: 'Database URL not configured' }, { status: 500 });
  }

  try {
    // レシピとその材料を取得するクエリ
    const client = await pool.connect();
    
    // 1. レシピの取得
    const { rows: recipes } = await client.query(`
      SELECT id, name, "unitCount", "salePrice", "bakingConditions"
      FROM recipes
      WHERE "isActive" = true
      ORDER BY "createdAt" DESC
    `);
    
    // 2. レシピ材料の取得
    const { rows: ingredients } = await client.query(`
      SELECT 
        ri.id, 
        ri."recipeId", 
        ri."ingredientId", 
        ri.amount, 
        ri.unit,
        i.name as "ingredientName",
        i."purchaseUnitG"
      FROM recipe_ingredients ri
      LEFT JOIN ingredients i ON ri."ingredientId" = i.id
    `);
    
    client.release();

    // データのマージ
    const result = recipes.map(recipe => {
      const recipeIngs = ingredients
        .filter(ing => ing.recipeId === recipe.id)
        .map(ing => ({
          id: ing.id,
          ingredientId: ing.ingredientId,
          name: ing.ingredientName,
          amount: parseFloat(ing.amount),
          unit: ing.unit
        }));
        
      return {
        ...recipe,
        ingredients: recipeIngs
      };
    });

    return NextResponse.json({ recipes: result });
  } catch (error: any) {
    console.error('FoodLabel DB Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
