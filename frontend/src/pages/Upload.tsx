// frontend/src/pages/Upload.tsx
import React, { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AnimatePresence } from "framer-motion"; 
import FileUploadForm from "../components/notes/FileUploadForm";
import NotificationModal from "../components/ui/NotificationModal"; 

// Department display names
const DEPT_NAMES: Record<string, string> = {
    aiml: 'AIML',
    ai: 'AI',
    cse: 'CSE',
    ds: 'DS',
};

const Upload: React.FC = () => {
  const { department } = useParams<{ department: string }>();
  const [searchParams] = useSearchParams();
  const deptKey = department?.toLowerCase() || '';
  const deptName = DEPT_NAMES[deptKey] || deptKey.toUpperCase();

  // Read pre-fill values from query params
  const defaultFileType = searchParams.get('fileType') || '';
  const defaultSubject = searchParams.get('subject') || '';

  const [isWarningVisible, setIsWarningVisible] = useState(true);

  // Dynamic warning message
  const UploadWarning = (
    <p>
      As a shared community resource, we kindly ask for your cooperation to maintain the integrity of our library. 
      <br/><br/>
      **Please do not upload any random or non-related PDFs here.** Ensure that your **exam papers** and **question papers** are uploaded only in the respective categories (selected in the form below). If unrelated content is uploaded, it will be visible to all students.
      <br/><br/>
      Thank you for contributing responsibly to the **{deptName} 3-1 Semester Notes & Papers Hub**.
    </p>
  );

  return (
    <div className="relative min-h-screen py-20 bg-gradient-to-br from-sky-100 via-indigo-100 to-emerald-100 overflow-hidden">
      
      {/* --- BACKGROUND ANIMATIONS --- */}
      <motion.div
        className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-full blur-3xl opacity-40"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-gradient-to-tr from-green-400 to-teal-500 rounded-full blur-3xl opacity-40"
        animate={{ x: [0, -40, 0], y: [0, -30, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* --- GLOBAL WARNING MODAL --- */}
      <AnimatePresence>
        {isWarningVisible && (
          <NotificationModal
              isVisible={true} 
              onClose={() => setIsWarningVisible(false)} 
              title="⚠️ IMPORTANT NOTICE: Community Upload Guidelines"
              message={UploadWarning}
          />
        )}
      </AnimatePresence>


      {/* --- UPLOAD CONTAINER --- */}
      <motion.div
        initial={false} 
        animate={isWarningVisible ? { filter: 'blur(5px)', pointerEvents: 'none' } : { filter: 'blur(0px)', pointerEvents: 'auto' }}
        transition={{ duration: 0.3 }}
        className="relative z-10 max-w-3xl mx-auto px-6 md:px-10 bg-white/60 backdrop-blur-lg border border-white/50 shadow-2xl rounded-3xl p-10"
      >
        {/* Back to Library */}
        <Link
          to={`/${deptKey}/library`}
          className="inline-block mb-6 px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg shadow-md hover:bg-gray-300 transition duration-200 font-semibold"
        >
          ← Back to Library
        </Link>

        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold text-blue-800 mb-8 drop-shadow-md uppercase"
        >
          UPLOAD YOUR NOTES OR PAPERS
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-lg text-gray-700 mb-10"
        >
          Share your knowledge with classmates by uploading notes, question
          papers, or study materials for <strong>{deptName}</strong>.
        </motion.p>

        {/* Animated Form — now receives department */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <FileUploadForm
            department={deptName}
            defaultFileType={defaultFileType}
            defaultSubject={defaultSubject}
          />
        </motion.div>
      </motion.div>

      {/* Glow ring accent at bottom */}
      <motion.div
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2 w-80 h-80 bg-gradient-to-r from-indigo-400 via-blue-500 to-teal-400 rounded-full blur-[120px] opacity-40"
        animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
};

export default Upload;