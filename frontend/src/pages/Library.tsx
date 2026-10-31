// frontend/src/pages/Library.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import NoteCard from '../components/notes/NoteCard';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// ── Numeric sort helpers ────────────────────────────────────────────────────
/** Roman numeral → integer map for unit/chapter names. */
const ROMAN_MAP: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5,
    VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
};

/**
 * Extract the primary sequence number from a note title.
 * 1. Last Arabic digit group  → "IRS ASSIGNMENT -3" = 3
 * 2. Last Roman numeral word  → "OS Unit-IV" = 4, "OS Unit-V" = 5
 * 3. Fallback = Infinity (sorted last)
 */
const extractTitleNumber = (title: string): number => {
    const arabicMatches = title.match(/\d+/g);
    if (arabicMatches && arabicMatches.length > 0) {
        return parseInt(arabicMatches[arabicMatches.length - 1], 10);
    }
    const words = title.toUpperCase().replace(/[-_]/g, ' ').split(/\s+/);
    let lastRoman = Infinity;
    for (const word of words) {
        if (ROMAN_MAP[word] !== undefined) lastRoman = ROMAN_MAP[word];
    }
    return lastRoman;
};



interface Note {
    _id: string;
    title: string;
    subject: string;
    courseYear: number;
    fileUrl: string;
    fileType: 'Notes' | 'Papers' | 'Assignments';
    uploaderName: string;
    createdAt: string;
    chapter: number;
    department: string;
}

// Department display names
const DEPT_NAMES: Record<string, string> = {
    aiml: 'AIML',
    ai: 'AI',
    cse: 'CSE',
    ds: 'DS',
};

const Library: React.FC = () => {
    const { department } = useParams<{ department: string }>();
    const deptKey = department?.toLowerCase() || '';
    const deptName = DEPT_NAMES[deptKey] || deptKey.toUpperCase();

    const [allNotes, setAllNotes] = useState<Note[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'Notes' | 'Papers' | 'Assignments'>('Notes');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

    // Department-specific subjects
    const SUBJECTS_MAP: Record<string, string[]> = {
        AIML: ['IRS', 'CN', 'OS'],
        AI: ['DL', 'CN', 'OS'],
        CSE: ['DWDM', 'CN', 'FLA'],
        DS: ['ML', 'CN', 'SE'],
    };
    const SUBJECTS = SUBJECTS_MAP[deptName] || SUBJECTS_MAP['AIML'];

    useEffect(() => {
        const fetchNotes = async () => {
            setLoading(true);
            try {
                const response = await axios.get<Note[]>(
                    `${API_BASE_URL}/api/notes?department=${deptName}`
                );
                setAllNotes(response.data);
            } catch {
                setError('Failed to fetch notes. Please ensure the backend server is running.');
            } finally {
                setLoading(false);
            }
        };
        if (deptName) fetchNotes();
    }, [deptName]);

    // Push a history entry when a subject is selected so mobile back button works
    const selectSubject = useCallback((subject: string | null) => {
        if (subject) {
            window.history.pushState({ subject }, '');
        }
        setSelectedSubject(subject);
    }, []);

    // Listen for mobile back button
    useEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            // Restore the subject from history state
            setSelectedSubject(e.state?.subject || null);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const filteredNotes = useMemo(() => {
        let notes = allNotes.filter(note => note.fileType === filterType);
        const query = searchTerm.toLowerCase();

        if (query) {
            notes = notes.filter(note =>
                note.title.toLowerCase().includes(query) ||
                note.subject.toLowerCase().includes(query) ||
                (note.uploaderName || '').toLowerCase().includes(query) ||
                (note.chapter && String(note.chapter).includes(query))
            );
        }

        if (selectedSubject) {
            notes = notes.filter(note => note.subject === selectedSubject);
        }

        // Numeric sort by number/Roman numeral extracted from title (ascending).
        // Works for Arabic numbers ("Unit 3", "Assignment -3") and
        // Roman numerals ("Unit-III", "Unit IV", "Unit V").
        return notes.sort((a, b) => extractTitleNumber(a.title) - extractTitleNumber(b.title));
    }, [allNotes, searchTerm, filterType, selectedSubject]);

    if (loading)
        return (
            <div className="text-center text-2xl text-pec-blue mt-20">
                Loading amazing content...
            </div>
        );

    const renderContent = () => {
        if (error)
            return (
                <div className="text-center text-xl text-red-600 mb-8">{error}</div>
            );

        if (filteredNotes.length === 0) {
            return (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-center text-xl text-gray-500 p-10 mt-10 border-4 border-dashed border-pec-yellow rounded-2xl bg-white shadow-lg"
                >
                    {searchTerm
                        ? `No results found for "${searchTerm}" in ${filterType}.`
                        : `No ${filterType.toLowerCase()} available yet.`}
                </motion.div>
            );
        }

        const containerVariants = {
            hidden: { opacity: 0 },
            visible: {
                opacity: 1,
                transition: {
                    staggerChildren: 0.08,
                    delayChildren: 0.1,
                },
            },
        };

        const itemVariants = {
            hidden: { opacity: 0, y: 20 },
            visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.3, ease: 'easeOut' },
            },
        };

        return (
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                {filteredNotes.map(note => (
                    <motion.div key={note._id} variants={itemVariants}>
                        <NoteCard
                            note={note}
                            onDelete={(id) => setAllNotes(prev => prev.filter(n => n._id !== id))}
                            onEdit={(id, updated) => setAllNotes(prev => prev.map(n => n._id === id ? { ...n, ...updated } as Note : n))}
                        />
                    </motion.div>
                ))}
            </motion.div>
        );
    };

    const showFolders =
        (filterType === 'Notes' || filterType === 'Assignments') &&
        !selectedSubject &&
        searchTerm.trim() === '';

    const showList =
        filterType === 'Papers' ||
        selectedSubject !== null ||
        searchTerm.trim() !== '';

    return (
        <div className="py-8 sm:py-12">
            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="text-center mb-8 sm:mb-12 bg-white p-4 sm:p-6 rounded-xl shadow-2xl"
            >

                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
                    {selectedSubject
                        ? `${selectedSubject} ${filterType}`
                        : filterType === 'Notes'
                            ? '📚 CLASS NOTES'
                            : filterType === 'Assignments'
                                ? '💼 ASSIGNMENTS'
                                : '📝 EXAM PAPERS'}
                </h1>

                {/* Section toggle buttons */}
                <div className="flex justify-center space-x-3 sm:space-x-4 mb-4">
                    <motion.button
                        onClick={() => {
                            setFilterType('Notes');
                            setSelectedSubject(null);
                            setSearchTerm('');
                        }}
                        className={`px-4 py-2 text-sm sm:text-lg font-bold rounded-full transition-all duration-300 shadow-xl ${filterType === 'Notes'
                                ? 'bg-pec-green text-white scale-105'
                                : 'bg-gray-200 text-gray-700 hover:bg-pec-green/50'
                            }`}
                        whileHover={{ scale: 1.05 }}
                    >
                        Class Notes
                    </motion.button>

                    <motion.button
                        onClick={() => {
                            setFilterType('Assignments');
                            setSelectedSubject(null);
                            setSearchTerm('');
                        }}
                        className={`px-4 py-2 text-sm sm:text-lg font-bold rounded-full transition-all duration-300 shadow-xl ${filterType === 'Assignments'
                                ? 'bg-indigo-500 text-white scale-105'
                                : 'bg-gray-200 text-gray-700 hover:bg-indigo-500/50'
                            }`}
                        whileHover={{ scale: 1.05 }}
                    >
                        Assignments
                    </motion.button>

                    <motion.button
                        onClick={() => {
                            setFilterType('Papers');
                            setSelectedSubject(null);
                            setSearchTerm('');
                        }}
                        className={`px-4 py-2 text-sm sm:text-lg font-bold rounded-full transition-all duration-300 shadow-xl ${filterType === 'Papers'
                                ? 'bg-pec-blue text-white scale-105'
                                : 'bg-gray-200 text-gray-700 hover:bg-pec-blue/50'
                            }`}
                        whileHover={{ scale: 1.05 }}
                    >
                        Exam Papers
                    </motion.button>
                </div>

                {/* Search Bar */}
                <input
                    type="text"
                    placeholder="Search by title, subject, uploader, or unit..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-3/4 p-3 border-2 border-pec-yellow rounded-xl focus:ring-pec-blue focus:border-pec-blue transition duration-200 shadow-inner"
                />
            </motion.div>

            {/* Folder View */}
            {showFolders && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
                >
                    {SUBJECTS.map(subject => (
                        <motion.button
                            key={subject}
                            onClick={() => selectSubject(subject)}
                            className="flex flex-col items-center p-4 sm:p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-b-4 border-pec-yellow"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <span className="text-4xl sm:text-5xl mb-2 text-pec-blue">📚</span>
                            <span className="text-base sm:text-lg font-bold text-gray-800">
                                {subject}
                            </span>
                            <span className="text-sm text-gray-500">View {filterType}</span>
                        </motion.button>
                    ))}

                    {/* Upload Card */}
                    <motion.div
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Link
                            to={`/${deptKey}/upload?fileType=${filterType}`}
                            className="flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-pec-green/10 to-pec-blue/10 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-dashed border-pec-green h-full"
                        >
                            <span className="text-4xl sm:text-5xl mb-2">📤</span>
                            <span className="text-base sm:text-lg font-bold text-pec-green">
                                Upload {filterType}
                            </span>
                            <span className="text-xs text-gray-500 text-center mt-1">Share with classmates</span>
                        </Link>
                    </motion.div>
                </motion.div>
            )}

            {/* List View */}
            {showList && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {selectedSubject && (
                        <>
                            <div className="flex justify-between items-center mb-6">
                                <motion.button
                                    onClick={() => window.history.back()}
                                    className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg shadow-md hover:bg-gray-300 transition duration-200"
                                    whileHover={{ scale: 1.05 }}
                                >
                                    ← Back to Subjects
                                </motion.button>
                                <h2 className="text-xl sm:text-2xl font-bold text-pec-blue hidden sm:block">
                                    {selectedSubject} {filterType} List
                                </h2>
                                <div></div>
                            </div>

                            {/* Upload Banner Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="mb-6"
                            >
                                <Link
                                    to={`/${deptKey}/upload?fileType=${filterType}&subject=${selectedSubject}`}
                                    className="flex items-center gap-4 p-4 sm:p-5 bg-gradient-to-r from-pec-green/10 via-white to-pec-blue/10 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-dashed border-pec-green group"
                                >
                                    <span className="text-4xl sm:text-5xl group-hover:scale-110 transition-transform duration-300">📤</span>
                                    <div className="flex-1">
                                        <span className="text-lg sm:text-xl font-bold text-pec-green group-hover:text-pec-blue transition-colors">
                                            Upload {selectedSubject} {filterType}
                                        </span>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            Share your {filterType.toLowerCase()} with classmates — files over 10 MB are auto-compressed
                                        </p>
                                    </div>
                                    <span className="text-pec-green group-hover:text-pec-blue text-2xl transition-colors">→</span>
                                </Link>
                            </motion.div>
                        </>
                    )}

                    {/* Upload banner for Papers (no folder view) */}
                    {filterType === 'Papers' && !selectedSubject && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="mb-6"
                        >
                            <Link
                                to={`/${deptKey}/upload?fileType=Papers`}
                                className="flex items-center gap-4 p-4 sm:p-5 bg-gradient-to-r from-pec-green/10 via-white to-pec-blue/10 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-dashed border-pec-green group"
                            >
                                <span className="text-4xl sm:text-5xl group-hover:scale-110 transition-transform duration-300">📤</span>
                                <div className="flex-1">
                                    <span className="text-lg sm:text-xl font-bold text-pec-green group-hover:text-pec-blue transition-colors">
                                        Upload Exam Papers
                                    </span>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        Share previous year papers with classmates — files over 10 MB are auto-compressed
                                    </p>
                                </div>
                                <span className="text-pec-green group-hover:text-pec-blue text-2xl transition-colors">→</span>
                            </Link>
                        </motion.div>
                    )}

                    {renderContent()}
                </motion.div>
            )}
        </div>
    );
};

export default Library;
