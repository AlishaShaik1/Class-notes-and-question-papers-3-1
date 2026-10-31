// frontend/src/pages/AdminAnalytics.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Trash2, Download, Eye, ArrowLeft, Edit, X } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Note {
    _id: string;
    title: string;
    subject: string;
    courseYear: number;
    fileUrl: string;
    fileType: string;
    uploaderName: string;
    createdAt: string;
    department: string;
    chapter?: number;
}

interface Stats {
    totalFiles: number;
    totalUploaders: number;
    byDepartment: Record<string, number>;
    byType: Record<string, number>;
    bySubject: Record<string, number>;
}

const AdminAnalytics: React.FC = () => {
    const navigate = useNavigate();
    const [notes, setNotes] = useState<Note[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterDept, setFilterDept] = useState('All');
    const [filterType, setFilterType] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [editFormData, setEditFormData] = useState({ title: '', uploaderName: '', createdAt: '' });

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const res = await axios.get(`${API_BASE_URL}/api/admin/analytics`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setNotes(res.data.notes);
            setStats(res.data.stats);
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Unknown error';
            setError(`Failed to load analytics: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const token = localStorage.getItem('adminToken');
            await axios.delete(`${API_BASE_URL}/api/notes/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setNotes(prev => prev.filter(n => n._id !== id));
            setDeleteConfirm(null);
            // Recalculate stats
            if (stats) {
                setStats(prev => prev ? { ...prev, totalFiles: prev.totalFiles - 1 } : prev);
            }
        } catch {
            alert('Failed to delete. Check console.');
        }
    };

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingNote) return;
        try {
            const token = localStorage.getItem('adminToken');
            const res = await axios.put(`${API_BASE_URL}/api/admin/notes/${editingNote._id}`, editFormData, {
                headers: { Authorization: `Bearer ${token}` },
            });
            // Update the state locally to avoid needing a refresh
            setNotes(prev => prev.map(n => n._id === editingNote._id ? { ...n, ...res.data.note } : n));
            setEditingNote(null);
        } catch {
            alert('Failed to update note. Check console.');
        }
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

    const getLocalDatetimeString = (d: string) => {
        const date = new Date(d);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const filteredNotes = notes.filter(n => {
        const matchDept = filterDept === 'All' || n.department === filterDept;
        const matchType = filterType === 'All' || n.fileType === filterType;
        const q = searchTerm.toLowerCase();
        const matchSearch = !q || n.title.toLowerCase().includes(q) || (n.uploaderName || '').toLowerCase().includes(q) || n.subject.toLowerCase().includes(q);
        return matchDept && matchType && matchSearch;
    });

    if (loading) return <div className="text-center text-2xl text-pec-blue mt-20">Loading analytics...</div>;
    if (error) return <div className="text-center text-xl text-red-600 mt-20">{error}</div>;

    const StatCard = ({ label, value, color }: { label: string; value: string | number; color: string }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white rounded-xl shadow-lg p-5 border-b-4 ${color}`}
        >
            <p className="text-sm font-semibold text-gray-500 uppercase">{label}</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{value}</p>
        </motion.div>
    );

    return (
        <div className="py-8 sm:py-12">
            {/* Header */}
            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="bg-white p-6 rounded-xl shadow-2xl mb-8"
            >
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg shadow-md hover:bg-gray-300 transition"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900">
                        📊 Admin Analytics
                    </h1>
                    <div></div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                        <StatCard label="Total Files" value={stats.totalFiles} color="border-pec-blue" />
                        <StatCard label="Uploaders" value={stats.totalUploaders} color="border-pec-green" />
                        <StatCard label="Notes" value={stats.byType.Notes || 0} color="border-green-500" />
                        <StatCard label="Papers" value={stats.byType.Papers || 0} color="border-indigo-500" />
                    </div>
                )}

                {/* Department breakdown */}
                {stats && (
                    <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.entries(stats.byDepartment).map(([dept, count]) => (
                            <div key={dept} className="bg-gray-50 rounded-lg p-3 text-center border">
                                <p className="text-lg font-bold text-pec-blue">{dept}</p>
                                <p className="text-2xl font-extrabold text-gray-800">{count}</p>
                                <p className="text-xs text-gray-500">files</p>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* Filters */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-white p-4 rounded-xl shadow-lg mb-6 flex flex-wrap gap-3 items-center"
            >
                <select
                    value={filterDept}
                    onChange={e => setFilterDept(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-pec-blue focus:border-pec-blue"
                >
                    <option value="All">All Departments</option>
                    <option value="AIML">AIML</option>
                    <option value="AI">AI</option>
                    <option value="CSE">CSE</option>
                    <option value="DS">DS</option>
                </select>

                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-pec-blue focus:border-pec-blue"
                >
                    <option value="All">All Types</option>
                    <option value="Notes">Notes</option>
                    <option value="Assignments">Assignments</option>
                    <option value="Papers">Papers</option>
                </select>

                <input
                    type="text"
                    placeholder="Search by title, uploader, subject..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-grow px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-pec-blue focus:border-pec-blue min-w-[200px]"
                />

                <span className="text-sm font-semibold text-gray-500">
                    {filteredNotes.length} file{filteredNotes.length !== 1 ? 's' : ''}
                </span>
            </motion.div>

            {/* Upload History Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gradient-to-r from-pec-blue to-indigo-600 text-white">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Title</th>
                                <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Subject</th>
                                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Dept</th>
                                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Type</th>
                                <th className="px-4 py-3 text-left font-semibold">Uploaded By</th>
                                <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Date</th>
                                <th className="px-4 py-3 text-center font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <AnimatePresence>
                                {filteredNotes.map((note, index) => (
                                    <motion.tr
                                        key={note._id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10, height: 0 }}
                                        transition={{ duration: 0.2, delay: index * 0.02 }}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-gray-800 truncate max-w-[200px]">{note.title}</p>
                                            {/* Mobile: show subject & dept inline */}
                                            <p className="text-xs text-gray-500 sm:hidden">
                                                {note.subject} • {note.department} • {note.fileType}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 hidden sm:table-cell">
                                            <span className="px-2 py-0.5 bg-pec-yellow/30 text-gray-800 rounded-full text-xs font-semibold">{note.subject}</span>
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell">
                                            <span className="px-2 py-0.5 bg-pec-blue/10 text-pec-blue rounded-full text-xs font-bold">{note.department}</span>
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                note.fileType === 'Notes' ? 'bg-green-100 text-green-700' :
                                                note.fileType === 'Papers' ? 'bg-blue-100 text-blue-700' :
                                                'bg-purple-100 text-purple-700'
                                            }`}>{note.fileType}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-700 truncate max-w-[120px]">{note.uploaderName}</p>
                                        </td>
                                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                                            {formatDate(note.createdAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 flex-wrap">
                                                <motion.a
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    href={note.fileUrl?.replace('http://', 'https://')}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition"
                                                    title="View PDF"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </motion.a>
                                                <motion.a
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    href={note.fileUrl?.replace('http://', 'https://')}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition"
                                                    title="Download"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </motion.a>

                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => {
                                                        setEditingNote(note);
                                                        setEditFormData({
                                                            title: note.title,
                                                            uploaderName: note.uploaderName,
                                                            createdAt: getLocalDatetimeString(note.createdAt)
                                                        });
                                                    }}
                                                    className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                                                    title="Edit Details"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </motion.button>

                                                {/* Delete with confirmation */}
                                                {deleteConfirm === note._id ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleDelete(note._id)}
                                                            className="px-2 py-1 bg-red-500 text-white text-xs rounded font-bold hover:bg-red-600 transition"
                                                        >
                                                            Yes
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(null)}
                                                            className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded font-bold hover:bg-gray-400 transition"
                                                        >
                                                            No
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <motion.button
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.9 }}
                                                        onClick={() => setDeleteConfirm(note._id)}
                                                        className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </motion.button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>

                {filteredNotes.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <p className="text-lg font-semibold">No files found</p>
                        <p className="text-sm mt-1">Try adjusting your filters or search term.</p>
                    </div>
                )}
            </motion.div>

            {/* Edit Modal */}
            <AnimatePresence>
                {editingNote && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md relative"
                        >
                            <button
                                onClick={() => setEditingNote(null)}
                                className="absolute top-4 right-4 text-gray-500 hover:text-gray-900"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <h2 className="text-xl font-bold text-pec-blue mb-4">Edit Note Details</h2>
                            <form onSubmit={handleEditSave} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                                    <input
                                        type="text"
                                        required
                                        value={editFormData.title}
                                        onChange={e => setEditFormData({ ...editFormData, title: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pec-blue"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Uploader Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={editFormData.uploaderName}
                                        onChange={e => setEditFormData({ ...editFormData, uploaderName: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pec-blue"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Upload Date</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={editFormData.createdAt}
                                        onChange={e => setEditFormData({ ...editFormData, createdAt: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pec-blue"
                                    />
                                </div>
                                <div className="pt-2 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setEditingNote(null)}
                                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-300 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-pec-green text-white rounded-lg font-bold hover:bg-green-600 transition shadow-md"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminAnalytics;
