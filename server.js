const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Mock Payment Intent Endpoint (No Stripe library needed in backend for demo)
app.post('/api/payment/create-intent', async (req, res) => {
  console.log('--- Incoming Payment Intent Request ---');
  console.log('Amount:', req.body.amount);
  // We return a mock secret instantly to avoid loading hangs
  res.json({ clientSecret: 'pi_mock_123_secret_mock_123' });
});

// ==========================================
// MOCK AUTHENTICATION MIDDLEWARE
// ==========================================
// This requires a Bearer token for all /api/* routes to test validation in Next.js
app.use('/api', (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Missing or invalid token. Please ensure your Next.js app sends the header -> Authorization: Bearer mock-token-123' 
    });
  }

  const token = authHeader.split(' ')[1];
  if (token !== 'mock-token-123') {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'The token provided is incorrect.' 
    });
  }

  // Token is valid, proceed to the actual route handler
  next();
});

// Load the JSON data
const categoriesPath = path.join(__dirname, 'categories.json');
const productsPath = path.join(__dirname, 'products.json');

let categories = [];
let products = [];

try {
  categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));
  products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
  console.log(`Successfully loaded ${categories.length} categories and ${products.length} products.`);
} catch (error) {
  console.error('Error loading JSON files:', error.message);
  process.exit(1);
}

// ==========================================
// CATEGORIES ENDPOINTS
// ==========================================

// 1. Get all categories
app.get('/api/categories', (req, res) => {
  res.json(categories);
});

// 2. Get a single category by ID or slug
app.get('/api/categories/:identifier', (req, res) => {
  const identifier = req.params.identifier;
  const category = categories.find(c => c.id === identifier || c.slug === identifier);
  
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }
  
  res.json(category);
});

// 3. Get products for a specific category (with pagination)
app.get('/api/categories/:identifier/products', (req, res) => {
  const identifier = req.params.identifier;
  const category = categories.find(c => c.id === identifier || c.slug === identifier);
  
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const categoryProducts = products.filter(p => p.categoryId === category.id);
  
  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const paginatedProducts = categoryProducts.slice(startIndex, endIndex);

  res.json({
    category,
    pagination: {
      total: categoryProducts.length,
      page,
      limit,
      totalPages: Math.ceil(categoryProducts.length / limit),
    },
    data: paginatedProducts
  });
});

// ==========================================
// PRODUCTS ENDPOINTS
// ==========================================

// 4. Get all products (with pagination and basic search)
app.get('/api/products', (req, res) => {
  let filteredProducts = products;
  
  // Basic search filter
  if (req.query.search) {
    const search = req.query.search.toLowerCase();
    filteredProducts = products.filter(p => 
      p.title.toLowerCase().includes(search) || 
      p.description.toLowerCase().includes(search)
    );
  }

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  res.json({
    pagination: {
      total: filteredProducts.length,
      page,
      limit,
      totalPages: Math.ceil(filteredProducts.length / limit),
    },
    data: paginatedProducts
  });
});

// 5. Get a single product by ID or slug (includes recommended products)
app.get('/api/products/:identifier', (req, res) => {
  const identifier = req.params.identifier;
  const product = products.find(p => p.id === identifier || p.slug === identifier);
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  // Recommend 4 other random products from the SAME category
  const categoryProducts = products.filter(p => p.categoryId === product.categoryId && p.id !== product.id);
  
  // Shuffle array and pick top 4
  const shuffled = [...categoryProducts].sort(() => 0.5 - Math.random());
  const recommendations = shuffled.slice(0, 4);

  res.json({
    product,
    recommendations
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`\n🚀 Mock E-Commerce API is running on http://localhost:${PORT}`);
  console.log(`\nAvailable Endpoints:`);
  console.log(`👉 http://localhost:${PORT}/api/categories`);
  console.log(`👉 http://localhost:${PORT}/api/categories/cat-1/products?page=1&limit=10`);
  console.log(`👉 http://localhost:${PORT}/api/products?page=1&limit=20&search=ergonomic`);
  console.log(`👉 http://localhost:${PORT}/api/products/prod-1`);
  console.log(`\nPress Ctrl+C to stop the server.`);
});
