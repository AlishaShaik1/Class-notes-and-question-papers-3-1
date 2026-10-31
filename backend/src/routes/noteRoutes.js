// backend/src/routes/noteRoutes.js
import express from 'express';
import { uploadNote, getNotes, deleteNote, editNote, getNoteStatus } from '../controllers/noteController.js'; 
import { multerUpload, uploadToCloudinary } from '../middleware/upload.js'; 
import adminAuth from '../middleware/adminAuth.js';

import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware: Try to authenticate as admin, but DON'T block if not admin
const optionalAdminAuth = (req, res, next) => {
    req.isAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.role === 'admin') {
                req.isAdmin = true;
                req.admin = decoded;
            }
        } catch {}
    }
    next();
};

// --- GET /api/notes — Fetch all notes (with optional ?department= filter) ---
// --- POST /api/notes — Upload a new note (public) ---
router
    .route('/')
    .get(getNotes)
    .post(
        // Step 1: Multer parses the multipart form and loads file to disk
        (req, res, next) => {
            multerUpload(req, res, function (err) {
                if (err) {
                    console.error("--- MULTER UPLOAD ERROR ---");
                    console.error("Cause:", err.message);
                    return res.status(500).json({ 
                        message: "Upload failed: Error during file processing.", 
                        detail: err.message
                    });
                }
                next();
            });
        },
        // Step 2: Upload the file directly to Cloudinary (no blocking compression)
        uploadToCloudinary,
        // Step 3: Save note to MongoDB — background compression fires after response
        uploadNote
    );

// --- GET /api/notes/:id/status — Poll compression status ---
router.get('/:id/status', getNoteStatus);

// --- PUT /api/notes/:id — Edit note (Uploader via token or Admin via JWT) ---
// --- DELETE /api/notes/:id — Delete a note (Uploader via token or Admin via JWT) ---
router.route('/:id')
    .put(optionalAdminAuth, editNote)
    .delete(optionalAdminAuth, deleteNote); 

export default router;