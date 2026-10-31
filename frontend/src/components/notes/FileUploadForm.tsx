// frontend/src/components/notes/FileUploadForm.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_URL = `${API_BASE_URL}/api/notes`;

/**
 * Extract the trailing number from a filename for natural numeric sort.
 * e.g. 'IRS ASSIGNMENT -3.pdf' -> 3, 'Chapter 10.pdf' -> 10
 */
const extractFileNumber = (filename: string): number => {
    const matches = filename.match(/\d+/g);
    if (!matches) return Infinity;
    return parseInt(matches[matches.length - 1], 10);
};

const sortFilesNumerically = (fileList: File[]): File[] =>
    [...fileList].sort((a, b) => extractFileNumber(a.name) - extractFileNumber(b.name));



interface FileUploadFormProps {
    department: string; // e.g., 'AIML', 'CSE', 'DS', 'AI'
    defaultFileType?: string; // Pre-filled from Library (Notes, Assignments, Papers)
    defaultSubject?: string;  // Pre-filled from Library (e.g., IRS, CN, OS)
}

const FileUploadForm: React.FC<FileUploadFormProps> = ({ department, defaultFileType = '', defaultSubject = '' }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState(defaultSubject);
    const [chapter, setChapter] = useState('');
    const [courseYear, setCourseYear] = useState('2026');
    const [uploaderName, setUploaderName] = useState('');
    const [fileType, setFileType] = useState(defaultFileType);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
    const [loading, setLoading] = useState(false);
    const [progressText, setProgressText] = useState('');

    // Department-specific subjects
    const SUBJECTS_MAP: Record<string, string[]> = {
        AIML: ['IRS', 'CN', 'OS'],
        AI:   ['DL', 'CN', 'OS'],
        CSE:  ['DWDM', 'CN', 'FLA'],
        DS:   ['ML', 'CN', 'SE'],
    };
    const SUBJECTS = SUBJECTS_MAP[department] || SUBJECTS_MAP['AIML'];
    const CHAPTERS = [1, 2, 3, 4, 5];

    const requiresSubject = fileType === 'Notes' || fileType === 'Assignments';
    const requiresChapter = fileType === 'Notes';
    const isMultiUpload = files.length > 1;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });

        if (files.length === 0) {
            setMessage({ text: 'Please select at least one file.', type: 'error' });
            return;
        }
        if (files.length > 5) {
            setMessage({ text: 'You can only upload a maximum of 5 files at a time.', type: 'error' });
            return;
        }

        if (requiresSubject && !subject) {
            setMessage({ text: 'Please select a Subject.', type: 'error' });
            return;
        }
        if (!isMultiUpload && requiresChapter && (!subject || !chapter)) {
            setMessage({ text: 'Please select both Subject and Chapter for Class Notes.', type: 'error' });
            return;
        }
        if (!isMultiUpload && !title) {
            setMessage({ text: 'Please provide a title.', type: 'error' });
            return;
        }
        if (!courseYear || !fileType) {
            setMessage({ text: 'Please fill out all required fields.', type: 'error' });
            return;
        }

        // Validate all files
        const ALLOWED_TYPES = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ];
        for (const file of files) {
            if (!ALLOWED_TYPES.includes(file.type)) {
                setMessage({ text: `Only PDF, Word (.doc/.docx), or PowerPoint (.ppt/.pptx) files are allowed. (${file.name} is invalid)`, type: 'error' });
                return;
            }
            if (file.size > 100 * 1024 * 1024) {
                setMessage({ text: `File size limit exceeded. (${file.name} is over 100MB)`, type: 'error' });
                return;
            }
        }

        setLoading(true);
        let successCount = 0;
        let failCount = 0;

        // Upload in reverse so lowest-numbered file is newest (backend sorts createdAt DESC)
        const uploadOrder = files.length > 1 ? [...files].reverse() : [...files];

        try {
            for (let i = 0; i < uploadOrder.length; i++) {
                const file = uploadOrder[i];
                setProgressText(`Uploading ${i + 1} of ${uploadOrder.length}: ${file.name}...`);
                
                const formData = new FormData();
                formData.append('pdfFile', file);
                formData.append('courseYear', courseYear);
                formData.append('uploaderName', uploaderName.trim());
                formData.append('fileType', fileType);
                formData.append('department', department);
                formData.append('subject', requiresSubject ? subject : 'N/A');

                if (isMultiUpload) {
                    // Extract title and chapter from filename
                    const baseName = file.name.replace(/\.(pdf|docx?|pptx?)$/i, '');
                    const semanticMatch = baseName.match(/(?:chapter|ch|module|mod)[-_ ]?(\d+)/i);
                    const lastNumberMatch = baseName.match(/(\d+)(?!.*\d)/);
                    const parsedChapter = semanticMatch ? semanticMatch[1] : (lastNumberMatch ? lastNumberMatch[1] : '0');
                    
                    formData.append('title', baseName);
                    formData.append('chapter', requiresChapter ? parsedChapter : '0');
                } else {
                    formData.append('title', title);
                    formData.append('chapter', requiresChapter ? chapter : '0');
                }

                try {
                    const response = await axios.post(API_URL, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        timeout: 180000, // 3 minutes — iLovePDF compression + Cloudinary upload can be slow on hosted servers
                    });

                    if (response.data._id && response.data.uploadToken) {
                        const savedTokens = JSON.parse(localStorage.getItem('uploadTokens') || '{}');
                        savedTokens[response.data._id] = response.data.uploadToken;
                        localStorage.setItem('uploadTokens', JSON.stringify(savedTokens));
                    }
                    successCount++;
                } catch (err: unknown) {
                    let reason = 'Unknown error';
                    if (axios.isAxiosError(err)) {
                        if (err.code === 'ECONNABORTED') {
                            reason = 'Request timed out — the server is taking too long (likely compressing a large PDF). Try a smaller file.';
                        } else if (err.response?.data?.message) {
                            reason = err.response.data.message;
                        } else if (err.message) {
                            reason = err.message;
                        }
                    }
                    console.error(`Failed to upload ${file.name}: ${reason}`, err);
                    setMessage({ text: `Failed to upload "${file.name}": ${reason}`, type: 'error' });
                    failCount++;
                }
            }

            if (failCount === 0) {
                setMessage({ text: `Successfully uploaded ${successCount} file(s)!`, type: 'success' });
                setFiles([]);
                setTitle('');
                setSubject('');
                setChapter('');
                setCourseYear('2026');
                setUploaderName('');
                setFileType('');
                const fileInput = document.getElementById('file-input') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            } else if (successCount > 0) {
                setMessage({ text: `Uploaded ${successCount} file(s), but ${failCount} failed. Check console.`, type: 'error' });
            } else {
                setMessage({ text: 'Upload failed for all files.', type: 'error' });
            }
        } catch (error) {
            console.error(error);
            setMessage({ text: 'A critical error occurred during upload.', type: 'error' });
        } finally {
            setLoading(false);
            setProgressText('');
        }
    };

    const alertClasses =
        message.type === 'success'
            ? 'bg-pec-green/10 border-pec-green text-pec-green'
            : 'bg-red-500/10 border-red-500 text-red-700';

    const fieldVariant = {
        hidden: { opacity: 0, y: 15 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.1, duration: 0.3 },
        }),
    };

    return (
        <motion.form
            onSubmit={handleSubmit}
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, staggerChildren: 0.1 } },
            }}
            className="bg-white p-6 md:p-10 rounded-xl shadow-2xl space-y-6 max-w-lg mx-auto border border-gray-200"
        >
            <motion.h3 variants={fieldVariant} custom={0} className="text-2xl sm:text-3xl font-extrabold text-center text-pec-blue flex flex-col sm:flex-row items-center justify-center gap-2">
                <span className="text-3xl sm:text-4xl">📤</span>
                <span>SHARE YOUR NOTES <br className="sm:hidden" />({department})</span>
            </motion.h3>

            {message.text && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`p-3 border-l-4 rounded-md font-medium ${alertClasses}`}
                >
                    {message.text}
                </motion.div>
            )}

            {/* File Type */}
            <motion.div variants={fieldVariant} custom={1}>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content Type:</label>
                <motion.select
                    value={fileType}
                    onChange={(e) => {
                        setFileType(e.target.value);
                        if (e.target.value !== 'Notes') {
                            setSubject('');
                            setChapter('');
                        }
                    }}
                    whileHover={{ scale: 1.02 }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-pec-blue focus:border-pec-blue transition"
                    required
                >
                    <option value="">-- Select Type --</option>
                    <option value="Notes">Class Notes</option>
                    <option value="Assignments">Assignments</option>
                    <option value="Papers">Previous Exam Papers</option>
                </motion.select>
            </motion.div>

            {/* File Input */}
            <motion.div variants={fieldVariant} custom={2}>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select File(s) — PDF, Word, or PowerPoint (Max 5 files, 100MB each) </label>
                <motion.input
                    id="file-input"
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx"
                    multiple
                    onChange={(e) => {
                        const selectedFiles = Array.from(e.target.files || []);
                        if (selectedFiles.length > 5) {
                            setMessage({ text: 'You can only select up to 5 files.', type: 'error' });
                            e.target.value = '';
                            setFiles([]);
                        } else {
                            setMessage({ text: '', type: '' });
                            setFiles(sortFilesNumerically(selectedFiles));
                        }
                    }}
                    whileHover={{ scale: 1.02 }}
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm text-gray-600 
                    file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 
                    file:text-sm file:font-semibold file:bg-pec-blue/10 file:text-pec-blue 
                    hover:file:bg-pec-blue/20"
                    required
                />
                {isMultiUpload && (
                    <p className="mt-2 text-xs text-blue-600 font-semibold">
                        Multiple files selected. Title and Chapter will be extracted from the filenames.
                    </p>
                )}
            </motion.div>

            {/* Title (Hidden if multi-upload) */}
            {!isMultiUpload && (
                <motion.input
                    variants={fieldVariant}
                    custom={3}
                    type="text"
                    placeholder={requiresChapter ? 'Title (e.g., Module 3 Handout)' : 'Title (e.g., Midterm Exam 2024)'}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-pec-blue focus:border-pec-blue transition"
                    required
                />
            )}

            {/* Subject and Chapter */}
            <AnimatePresence initial={false}>
                {requiresSubject && (
                    <motion.div
                        key="conditional-fields"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4 overflow-hidden"
                    >
                        {/* Subject */}
                        <motion.div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Subject:</label>
                            <motion.select
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                whileHover={{ scale: 1.02 }}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-pec-blue focus:border-pec-blue transition"
                                required
                            >
                                <option value="">-- Select Subject --</option>
                                {SUBJECTS.map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </motion.select>
                        </motion.div>

                        {/* Chapter (Notes Only) - Hidden if multi-upload */}
                        {!isMultiUpload && requiresChapter && (
                            <motion.div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Chapter:</label>
                                <motion.select
                                    value={chapter}
                                    onChange={(e) => setChapter(e.target.value)}
                                    whileHover={{ scale: 1.02 }}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-pec-blue focus:border-pec-blue transition"
                                    required
                                >
                                    <option value="">-- Select Chapter --</option>
                                    {CHAPTERS.map(ch => (
                                        <option key={ch} value={String(ch)}>{`Chapter ${ch}`}</option>
                                    ))}
                                </motion.select>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Course Year */}
            <motion.input
                variants={fieldVariant}
                custom={6}
                type="number"
                placeholder="Course Year (e.g., 2025)"
                value={courseYear}
                onChange={(e) => setCourseYear(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-pec-blue focus:border-pec-blue transition"
                required
            />

            {/* Uploader Name */}
            <motion.input
                variants={fieldVariant}
                custom={7}
                type="text"
                placeholder="Your Name (Optional)"
                value={uploaderName}
                onChange={(e) => setUploaderName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-pec-blue focus:border-pec-blue transition"
            />

            {/* Submit */}
            <motion.button
                variants={fieldVariant}
                custom={8}
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.03 }}
                whileTap={{ scale: loading ? 1 : 0.97 }}
                className={`w-full py-3 px-4 rounded-lg text-white font-bold transition duration-300 ${
                    loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-pec-green hover:bg-pec-blue'
                }`}
            >
                {loading ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col items-center justify-center space-y-1"
                    >
                        <div className="flex items-center space-x-3">
                            <motion.span
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                className="inline-block h-5 w-5 border-2 border-white border-t-transparent rounded-full"
                            />
                            <span>{progressText || 'Processing & Uploading...'}</span>
                        </div>
                        <span className="text-xs text-white font-semibold text-center px-2 drop-shadow">
                            Uploading... Large files are compressed in the background — you can upload more right after!
                        </span>
                    </motion.div>
                ) : (
                    files.length > 1 ? `Upload ${files.length} Files` : 'Upload & Share'
                )}
            </motion.button>
        </motion.form>
    );
};

export default FileUploadForm;

