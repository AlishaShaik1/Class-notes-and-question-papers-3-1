// backend/src/models/Note.js
import mongoose from 'mongoose';

const noteSchema = mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        subject: {
            type: String,
            required: true,
            trim: true,
        },
        chapter: { 
            type: Number,
            required: true,
            max: 10,
        },
        courseYear: {
            type: Number,
            required: true,
        },
        fileUrl: {
            type: String,
            required: true,
        },
        // Cloudinary public_id (used for deletion)
        filePath: {
            type: String,
            default: '',
        },
        fileType: {
            type: String,
            required: true,
            enum: ['Notes', 'Papers', 'Assignments'], 
        },
        // NEW: Department field for multi-department support
        department: {
            type: String,
            required: true,
            enum: ['AIML', 'CSE', 'DS', 'AI'],
        },
        uploaderName: {
            type: String,
            required: false,
            default: '',
            maxlength: 50,
        },
        // Hashed token for uploader to edit/delete without login
        uploadToken: {
            type: String,
            default: '',
        },
        // Background compression status: 'none' | 'pending' | 'done' | 'failed'
        compressionStatus: {
            type: String,
            enum: ['none', 'pending', 'done', 'failed'],
            default: 'none',
        },
    },
    {
        timestamps: true,
    }
);

const Note = mongoose.model('Note', noteSchema);

export default Note;