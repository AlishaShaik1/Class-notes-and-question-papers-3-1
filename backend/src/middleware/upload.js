// backend/src/middleware/upload.js
// Cloudinary-based file upload middleware

import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import fs from 'fs';
import os from 'os';

// Allowed MIME types: PDF, Word, PowerPoint
const ALLOWED_MIMES = [
    'application/pdf',
    'application/msword',                                                        // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // .docx
    'application/vnd.ms-powerpoint',                                             // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
];

// Map MIME to extension
const MIME_TO_EXT = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};

// 1. Use disk storage — reduces memory usage for large files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
        const ext = MIME_TO_EXT[file.mimetype] || '.pdf';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// 2. File Filter — PDF, Word, PowerPoint
const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        req.fileValidationError = 'Only PDF, Word (.doc/.docx), and PowerPoint (.ppt/.pptx) files are allowed.';
        cb(null, false);
    }
};

// 3. Configure Multer with disk storage
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 100 // 100 MB upload limit
    }
});

// 4. Multer middleware to accept single file
export const multerUpload = upload.single('pdfFile');

// 5. Cloudinary upload middleware — runs AFTER multer parses the file
export const uploadToCloudinary = async (req, res, next) => {
    // If no file was parsed by multer, skip
    if (!req.file) {
        return next();
    }

    try {
        const filePath = req.file.path;
        const ext = MIME_TO_EXT[req.file.mimetype] || '.pdf';

        // Use the user-given title as the Cloudinary filename (not the original laptop filename)
        const userTitle = req.body.title
            ? req.body.title.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').slice(0, 80)
            : 'note';
        const publicId = `${userTitle}-${Date.now()}`;

        // Cloudinary free plan has a 10 MB limit for raw uploads.
        // For PDFs > 10 MB, skip uploading to Cloudinary now.
        // It will be compressed first with iLovePDF and uploaded in the background.
        const CLOUDINARY_MAX = 10 * 1024 * 1024;
        const fileSize = req.file.size || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);

        if (ext === '.pdf' && fileSize > CLOUDINARY_MAX) {
            console.log(`[Upload] Large PDF detected (${(fileSize / (1024 * 1024)).toFixed(2)} MB > 10 MB). Skipping direct Cloudinary upload — deferring to background compression & upload.`);
            req.file.cloudinaryUrl = null;
            req.file.cloudinaryPublicId = null;
            req.file.cloudinaryPublicIdBase = publicId;
            req.file.fileExt = ext;
            req.file.needsBackgroundUpload = true;
            return next();
        }

        console.log(`Uploading to Cloudinary as: ${publicId}${ext}`);

        // Upload as 'raw' resource type
        const result = await cloudinary.uploader.upload(filePath, {
            resource_type: 'raw',
            folder: 'pec-notes',
            public_id: publicId,
            overwrite: false,
            // Append the correct extension so the file is downloadable with the right format
            format: ext.replace('.', ''),
        });

        // Attach URL, public_id, file type, and the Cloudinary base public_id to the request
        req.file.cloudinaryUrl = result.secure_url;
        req.file.cloudinaryPublicId = result.public_id;
        req.file.cloudinaryPublicIdBase = publicId; // without folder prefix — used for overwrite on compression
        req.file.fileExt = ext;

        console.log('Cloudinary upload successful:', result.secure_url);
        next();

    } catch (err) {
        console.error('Cloudinary upload exception:', err);
        return res.status(500).json({
            message: 'Upload failed: Server error during file processing.',
        });
    } finally {
        // Clean up temp file ONLY if not needed for background compression
        if (!req.file?.needsBackgroundUpload && req.file?.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupErr) {
                console.error('Error cleaning up temp file:', cleanupErr.message);
            }
        }
    }
};