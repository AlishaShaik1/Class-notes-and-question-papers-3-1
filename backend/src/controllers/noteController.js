// backend/src/controllers/noteController.js

import crypto from 'crypto';
import Note from '../models/Note.js';
import cloudinary from '../config/cloudinary.js';
import { runBackgroundCompression, needsCompression } from '../middleware/compressPdf.js';

// Generate a random token and its hash
const generateToken = () => {
    const token = crypto.randomBytes(24).toString('hex'); // 48-char token
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return { token, hash };
};

// Verify a token against a stored hash
const verifyToken = (token, hash) => {
    const inputHash = crypto.createHash('sha256').update(token).digest('hex');
    return inputHash === hash;
};

// -----------------------------------------------------------------------
// @desc    Upload a new PDF note
// @route   POST /api/notes
// @access  Public
export const uploadNote = async (req, res) => {
    console.log('uploadNote called');
    console.log('req.file:', req.file ? req.file.originalname : 'NO FILE');
    console.log('req.body:', req.body);
    
    if (req.fileValidationError) {
        console.log('File validation error:', req.fileValidationError);
        return res.status(400).json({ message: req.fileValidationError });
    }

    if (!req.file) {
        console.log('No req.file found - Upload failed upstream');
        return res.status(500).json({ message: 'File upload failed or file object is missing.' });
    }

    // Extract metadata fields (including department)
    const { 
        title, 
        subject, 
        courseYear, 
        uploaderName, 
        fileType,
        chapter,
        department
    } = req.body; 
    
    const isNotes = fileType === 'Notes';
    const chapterNum = isNotes ? parseInt(chapter, 10) : 0; 
    const yearNum = parseInt(courseYear, 10);
    const finalSubject = subject || 'N/A';

    // Get the Cloudinary URL from the upload middleware
    const fileUrl = req.file.cloudinaryUrl;
    if (!fileUrl) {
        console.log('File upload failed or missing cloudinaryUrl. req.file:', req.file);
        return res.status(400).json({ message: 'File upload failed or missing cloudinaryUrl' });
    }
    const filePath = req.file.cloudinaryPublicId || '';

    // Validate required fields
    const validDepartments = ['AIML', 'CSE', 'DS', 'AI'];
    if (!title || !subject || isNaN(yearNum) || !fileType || 
        (isNotes && isNaN(chapterNum)) || !department || !validDepartments.includes(department)) { 
        console.log('Validation Failed: Missing required data.');
        console.log(`Debug: Chapter=${chapterNum}, Year=${yearNum}, Dept=${department}`);
        return res.status(400).json({ message: 'Missing required data or invalid values.' });
    }

    try {
        // Generate upload token for the uploader
        const { token, hash } = generateToken();

        // Determine if this PDF needs background compression (> 10 MB)
        const isPdf = req.file.mimetype === 'application/pdf';
        const tempFilePath = req.file.path || null; // disk path saved by multer
        const needsBgCompression = isPdf && tempFilePath && needsCompression(tempFilePath);

        const note = new Note({
            title,
            subject: finalSubject,
            courseYear: yearNum, 
            fileUrl, 
            filePath,
            fileType, 
            chapter: chapterNum,
            department,
            uploaderName: uploaderName ? uploaderName.trim() : '',
            uploadToken: hash, // Store only the hash
            compressionStatus: needsBgCompression ? 'pending' : 'none',
        });

        const createdNote = await note.save();

        // Return the note + the raw token (user saves this in localStorage)
        res.status(201).json({
            ...createdNote.toObject(),
            uploadToken: token, // Send raw token back (NOT the hash)
        });

        // Fire background compression AFTER responding — user is NOT blocked
        if (needsBgCompression) {
            const publicIdBase = req.file.cloudinaryPublicIdBase || req.file.cloudinaryPublicId;
            console.log(`[BG Compress] Queuing background compression for note ${createdNote._id}...`);
            // Run without await — intentionally fire-and-forget
            runBackgroundCompression(createdNote._id.toString(), tempFilePath, publicIdBase)
                .catch(err => console.error('[BG Compress] Unhandled error:', err));
        }

    } catch (error) {
        console.error('Database save error:', error.message);
        res.status(500).json({ message: 'Failed to save note metadata.', error: error.message });
    }
};

// -----------------------------------------------------------------------
// @desc    Get compression status + latest fileUrl for a note
// @route   GET /api/notes/:id/status
// @access  Public
export const getNoteStatus = async (req, res) => {
    try {
        const note = await Note.findById(req.params.id).select('compressionStatus fileUrl title');
        if (!note) return res.status(404).json({ message: 'Note not found.' });
        res.json({
            _id: note._id,
            title: note.title,
            compressionStatus: note.compressionStatus,
            fileUrl: note.fileUrl,
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch note status.', error: error.message });
    }
};

// -----------------------------------------------------------------------
// @desc    Fetch notes (optionally filtered by department)
// @route   GET /api/notes?department=AIML
// @access  Public
export const getNotes = async (req, res) => {
    try {
        const filter = {};
        
        // Filter by department if provided
        if (req.query.department) {
            filter.department = req.query.department.toUpperCase();
        }

        // Exclude uploadToken hash from public responses
        const notes = await Note.find(filter).select('-uploadToken').sort({ createdAt: -1 });
        res.json(notes);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch notes.', error: error.message });
    }
};

// -----------------------------------------------------------------------
// @desc    Download/redirect to a specific note file   
// @route   GET /api/notes/download/:id
// @access  Public
export const downloadNote = async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);

        if (note) {
            return res.redirect(note.fileUrl); 
        } else {
            res.status(404).json({ message: 'Note not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error processing download request.', error: error.message });
    }
};

// -----------------------------------------------------------------------
// @desc    Edit note metadata (title, subject, chapter, fileType, department)
// @route   PUT /api/notes/:id
// @access  Uploader (via token) or Admin (via JWT)
export const editNote = async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);

        if (!note) {
            return res.status(404).json({ message: 'Note not found.' });
        }

        // Authorization: check upload token OR admin JWT
        const uploadToken = req.headers['x-upload-token'];
        const isAdmin = req.isAdmin === true;

        if (!isAdmin && (!uploadToken || !verifyToken(uploadToken, note.uploadToken))) {
            return res.status(403).json({ message: 'You are not authorized to edit this note.' });
        }

        // Update allowed fields
        const { title, subject, chapter, fileType, department } = req.body;
        if (title) note.title = title;
        if (subject) note.subject = subject;
        if (chapter !== undefined) note.chapter = parseInt(chapter, 10);
        if (fileType) note.fileType = fileType;
        if (department) note.department = department;

        const updatedNote = await note.save();
        res.json(updatedNote);

    } catch (error) {
        res.status(500).json({ message: 'Failed to update note.', error: error.message });
    }
};

// -----------------------------------------------------------------------
// @desc    Delete a note by ID (also removes file from Cloudinary)
// @route   DELETE /api/notes/:id
// @access  Uploader (via token) or Admin (via JWT)
export const deleteNote = async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);

        if (!note) {
            return res.status(404).json({ message: 'Note not found in database.' });
        }

        // Authorization: check upload token OR admin JWT
        const uploadToken = req.headers['x-upload-token'];
        const isAdmin = req.isAdmin === true;

        if (!isAdmin && (!uploadToken || !verifyToken(uploadToken, note.uploadToken))) {
            return res.status(403).json({ message: 'You are not authorized to delete this note.' });
        }

        // Delete from Cloudinary storage if public_id exists
        if (note.filePath) {
            try {
                const result = await cloudinary.uploader.destroy(note.filePath, {
                    resource_type: 'raw',
                });

                if (result.result === 'ok') {
                    console.log('Cloudinary file deleted:', note.filePath);
                } else {
                    console.warn('Cloudinary file deletion warning:', result.result);
                }
            } catch (storageErr) {
                console.warn('Cloudinary deletion exception (continuing):', storageErr.message);
            }
        }

        // Delete from MongoDB
        await Note.deleteOne({ _id: req.params.id });
        res.json({ message: 'Note removed successfully.' });

    } catch (error) {
        res.status(500).json({ message: 'Failed to delete note.', error: error.message });
    }
};