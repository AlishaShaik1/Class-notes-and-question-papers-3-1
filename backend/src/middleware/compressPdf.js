// backend/src/middleware/compressPdf.js
// Background PDF compression using iLovePDF API.
// Files > 10 MB are compressed AFTER the note is saved, so the user
// is NOT blocked. Once compression finishes, the note's fileUrl and
// compressionStatus are updated in MongoDB automatically.

import ILovePDFApi from '@ilovepdf/ilovepdf-nodejs';
import ILovePDFFile from '@ilovepdf/ilovepdf-nodejs/ILovePDFFile.js';
import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import cloudinary from '../config/cloudinary.js';
import Note from '../models/Note.js';

const CLOUDINARY_MAX = 10 * 1024 * 1024; // 10 MB
const TEMP_DIR = os.tmpdir();

/**
 * Compress a PDF via iLovePDF at the given compression level.
 * Returns a Buffer of the compressed file.
 */
async function compressWithILovePDF(inputPath, level) {
    const instance = new ILovePDFApi(
        process.env.ILOVEPDF_PUBLIC_KEY,
        process.env.ILOVEPDF_SECRET_KEY
    );

    const task = instance.newTask('compress');
    await task.start();

    const file = new ILovePDFFile(inputPath);
    await task.addFile(file);

    await task.process({ compression_level: level });

    const compressedData = await task.download();
    return Buffer.from(compressedData);
}

/**
 * Background compression worker.
 * Call this AFTER responding to the user — it runs asynchronously.
 *
 * @param {string} noteId       - MongoDB Note _id to update when done
 * @param {string} tempFilePath - Path to the uncompressed file on disk
 * @param {string} publicIdBase - Cloudinary public_id prefix (without folder)
 */
export async function runBackgroundCompression(noteId, tempFilePath, publicIdBase) {
    const originalSize = fs.existsSync(tempFilePath) ? fs.statSync(tempFilePath).size : 0;
    if (originalSize === 0) {
        console.warn(`[BG Compress] Temp file not found for note ${noteId}: ${tempFilePath}`);
        await Note.findByIdAndUpdate(noteId, { compressionStatus: 'failed' });
        return;
    }

    const originalSizeMB = (originalSize / (1024 * 1024)).toFixed(2);
    console.log(`[BG Compress] Starting for note ${noteId} — ${originalSizeMB} MB`);

    let compressedBuffer = null;
    let compressedSize = originalSize;

    try {
        // --- Attempt 1: recommended compression ---
        console.log('[BG Compress] → Attempt 1: "recommended" level...');
        compressedBuffer = await compressWithILovePDF(tempFilePath, 'recommended');
        compressedSize = compressedBuffer.length;
        console.log(`[BG Compress]   ${originalSizeMB} MB → ${(compressedSize / (1024 * 1024)).toFixed(2)} MB`);

        // --- Attempt 2: extreme compression if still > 10 MB ---
        if (compressedSize > CLOUDINARY_MAX) {
            console.log('[BG Compress] → Attempt 2: "extreme" level...');
            compressedBuffer = await compressWithILovePDF(tempFilePath, 'extreme');
            compressedSize = compressedBuffer.length;
            console.log(`[BG Compress]   → ${(compressedSize / (1024 * 1024)).toFixed(2)} MB`);
        }

    } catch (ilovepdfErr) {
        const reason = ilovepdfErr?.message || String(ilovepdfErr);
        console.warn(`[BG Compress] ⚠️  iLovePDF failed: ${reason}`);
        // Mark as failed — keep the original uncompressed URL
        await Note.findByIdAndUpdate(noteId, { compressionStatus: 'failed' });
        return;
    } finally {
        // Always clean up the temp file
        try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (_) {}
    }

    // If still over 10 MB after compression, Cloudinary will reject it
    if (compressedSize > CLOUDINARY_MAX) {
        console.warn(`[BG Compress] ⚠️ File is still ${(compressedSize / (1024 * 1024)).toFixed(2)} MB after compression — exceeds Cloudinary 10 MB limit.`);
        await Note.findByIdAndUpdate(noteId, { compressionStatus: 'failed' });
        return;
    }

    // Write compressed buffer to a new temp file for Cloudinary upload
    const compressedPath = path.join(TEMP_DIR, `compressed-${crypto.randomUUID()}.pdf`);
    try {
        fs.writeFileSync(compressedPath, compressedBuffer);

        // Upload compressed file to Cloudinary
        const result = await cloudinary.uploader.upload(compressedPath, {
            resource_type: 'raw',
            folder: 'pec-notes',
            public_id: publicIdBase,
            overwrite: true,
            format: 'pdf',
        });

        const reductionPercent = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        console.log(`[BG Compress] ✓ Done for note ${noteId}: ${originalSizeMB} MB → ${(compressedSize / (1024 * 1024)).toFixed(2)} MB (${reductionPercent}% smaller). URL: ${result.secure_url}`);

        // Update note in DB with new compressed URL and publicId
        await Note.findByIdAndUpdate(noteId, {
            fileUrl: result.secure_url,
            filePath: result.public_id,
            compressionStatus: 'done',
        });

    } catch (uploadErr) {
        console.error(`[BG Compress] ✗ Cloudinary re-upload failed for note ${noteId}:`, uploadErr.message);
        await Note.findByIdAndUpdate(noteId, { compressionStatus: 'failed' });
    } finally {
        try { if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath); } catch (_) {}
    }
}

/**
 * Check if a file on disk is large enough to need background compression.
 * @param {string} filePath - Path to file on disk
 * @returns {boolean}
 */
export function needsCompression(filePath) {
    try {
        return fs.statSync(filePath).size > CLOUDINARY_MAX;
    } catch {
        return false;
    }
}
