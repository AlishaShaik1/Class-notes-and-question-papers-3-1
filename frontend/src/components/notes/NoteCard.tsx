// frontend/src/components/notes/NoteCard.tsx
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import { useAdmin } from "../../contexts/AdminContext";
import axios from "axios";

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
  chapter?: number;
  department?: string;
  compressionStatus?: 'none' | 'pending' | 'done' | 'failed';
}

interface NoteCardProps {
  note: Note;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, updatedNote: Partial<Note>) => void;
}

// Check if the current browser has the upload token for this note
const getUploadToken = (noteId: string): string | null => {
  try {
    const tokens = JSON.parse(localStorage.getItem('uploadTokens') || '{}');
    return tokens[noteId] || null;
  } catch {
    return null;
  }
};

// Helper: detect if a URL points to a Word or PowerPoint file
const isOfficeFile = (url: string) => /\.(docx?|pptx?)(\?|$)/i.test(url);

const NoteCard: React.FC<NoteCardProps> = ({ note, onDelete, onEdit }) => {
  const { isAdmin } = useAdmin();
  const uploadToken = getUploadToken(note._id);
  const canModify = isAdmin || !!uploadToken;

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [saving, setSaving] = useState(false);

  // Track background compression status (starts from what DB returned)
  const [compressionStatus, setCompressionStatus] = useState<Note['compressionStatus']>(
    note.compressionStatus ?? 'none'
  );
  const [currentFileUrl, setCurrentFileUrl] = useState(note.fileUrl);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for compression completion if status is 'pending'
  useEffect(() => {
    if (compressionStatus !== 'pending') return;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/notes/${note._id}/status`);
        const { compressionStatus: newStatus, fileUrl: newUrl } = res.data;
        if (newStatus !== 'pending') {
          setCompressionStatus(newStatus);
          if (newUrl) setCurrentFileUrl(newUrl);
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000); // poll every 5 seconds

    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [compressionStatus, note._id]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });

  // Download button removed to save Cloudinary bandwidth credits.

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
    try {
      const headers: Record<string, string> = {};
      if (isAdmin) {
        const token = localStorage.getItem('adminToken');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      if (uploadToken) {
        headers['x-upload-token'] = uploadToken;
      }

      await axios.delete(`${API_BASE_URL}/api/notes/${note._id}`, { headers });

      // Remove token from localStorage
      try {
        const tokens = JSON.parse(localStorage.getItem('uploadTokens') || '{}');
        delete tokens[note._id];
        localStorage.setItem('uploadTokens', JSON.stringify(tokens));
      } catch {}

      if (onDelete) onDelete(note._id);
    } catch (err) {
      console.error("Error deleting note:", err);
      alert("Failed to delete note. You may not have permission.");
    }
  };

  const handleSaveEdit = async () => {
    if (saving || !editTitle.trim()) return;
    setSaving(true);
    try {
      const headers: Record<string, string> = {};
      if (isAdmin) {
        const token = localStorage.getItem('adminToken');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      if (uploadToken) {
        headers['x-upload-token'] = uploadToken;
      }

      const response = await axios.put(
        `${API_BASE_URL}/api/notes/${note._id}`,
        { title: editTitle.trim() },
        { headers }
      );

      setIsEditing(false);
      if (onEdit) onEdit(note._id, response.data);
    } catch (err) {
      console.error("Error editing note:", err);
      alert("Failed to edit note. You may not have permission.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditTitle(note.title);
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.05, boxShadow: "0 15px 30px rgba(0,0,0,0.15)" }}
      className="relative overflow-hidden rounded-2xl p-6 bg-white/50 backdrop-blur-xl border border-white/40 shadow-lg hover:shadow-2xl transition-all"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/60 to-blue-50/30 opacity-60 rounded-2xl -z-10" />

      {/* Action buttons (Edit + Delete) */}
      {canModify && (
        <div className="absolute top-3 right-3 flex gap-1.5 z-10">
          {!isEditing && (
            <motion.button
              onClick={() => setIsEditing(true)}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 bg-blue-500 text-white rounded-full shadow-md hover:bg-blue-600 transition-all"
              title="Edit title"
            >
              <Pencil className="w-3.5 h-3.5" />
            </motion.button>
          )}
          <motion.button
            onClick={handleDelete}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            className="p-1.5 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-all"
            title="Delete this note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      )}

      <div className="flex flex-col h-full justify-between space-y-4">
        <div>
          {/* Editable title */}
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div
                key="editing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-2"
              >
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-xl font-bold text-gray-900 border-2 border-blue-400 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <motion.button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg shadow hover:bg-green-600 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                  </motion.button>
                  <motion.button
                    onClick={handleCancelEdit}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-400 text-white text-xs font-semibold rounded-lg shadow hover:bg-gray-500"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.h3
                key="display"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-2xl font-extrabold text-gray-900 tracking-tight mb-2 line-clamp-2"
              >
                {note.title}
              </motion.h3>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-gradient-to-r from-yellow-300 to-yellow-500 text-gray-900 shadow-sm">
              {note.subject}
            </span>
            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-gradient-to-r from-indigo-300 to-blue-500 text-white shadow-sm">
              Year: {note.courseYear}
            </span>
            {canModify && !isAdmin && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 shadow-sm">
                Your Upload
              </span>
            )}
            {/* Compression status badge */}
            {compressionStatus === 'pending' && (
              <span className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 shadow-sm">
                <Loader2 className="w-3 h-3 animate-spin" /> Optimizing…
              </span>
            )}
            {compressionStatus === 'failed' && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-600 shadow-sm">
                Compression failed
              </span>
            )}
          </div>
          <div className="text-gray-700 text-sm border-t border-gray-300/40 pt-3 space-y-1">
            <p><span className="font-semibold text-gray-900">Uploaded By:</span> {note.uploaderName && note.uploaderName !== 'Anonymous' ? note.uploaderName : ''}</p>
            <p><span className="font-semibold text-gray-900">Uploaded On:</span> {formatDate(note.createdAt)}</p>
          </div>
        </div>
        <div className="flex justify-center mt-4">
          {(() => {
            const rawUrl = currentFileUrl?.replace('http://', 'https://') || '';
            const viewUrl = isOfficeFile(rawUrl)
              ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(rawUrl)}`
              : rawUrl;
            const viewLabel = isOfficeFile(rawUrl) ? 'View Document' : 'View PDF';
            const isPending = compressionStatus === 'pending';
            return (
              <motion.a
                href={isPending ? undefined : viewUrl}
                onClick={isPending ? (e) => { e.preventDefault(); } : undefined}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: isPending ? 1 : 1.05 }}
                whileTap={{ scale: isPending ? 1 : 0.95 }}
                className={`w-full flex items-center justify-center gap-2 py-3 font-bold rounded-xl shadow-md transition-all duration-300 ${
                  isPending
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white hover:from-indigo-600 hover:to-blue-600'
                }`}
              >
                {isPending
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Optimizing file…</>
                  : <><Eye className="w-5 h-5" /> {viewLabel}</>
                }
              </motion.a>
            );
          })()}
        </div>
      </div>
    </motion.div>
  );
};

export default NoteCard;