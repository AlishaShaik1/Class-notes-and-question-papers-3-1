// backend/src/server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import noteRoutes from './routes/noteRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();
connectDB();

const app = express();

// CORS — allow localhost dev + production Vercel frontend + optional env override
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://pec-class-notes-and-questions-2-2.vercel.app', // production frontend (2-2)
    'https://pec-class-notes-and-questions-3-1.vercel.app', // production frontend (3-1)
    process.env.FRONTEND_URL, // optional extra origin via env var
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // Log blocked origins to help debug future issues
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Upload-Token'],
    credentials: true,
}));

app.use(express.json());

// Routes
app.use('/api/notes', noteRoutes);
app.use('/api/admin', adminRoutes);

// Simple route for testing
app.get('/', (req, res) => {
    res.send('PEC Notes Hub API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});