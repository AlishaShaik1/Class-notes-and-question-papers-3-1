// frontend/src/pages/Home.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface DepartmentInfo {
    key: string;
    name: string;
    fullName: string;
    icon: string;
}

const DEPARTMENTS: DepartmentInfo[] = [
    { key: 'aiml', name: 'AIML', fullName: 'Artificial Intelligence & Machine Learning', icon: '🤖' },
    { key: 'ai', name: 'AI', fullName: 'Artificial Intelligence', icon: '🧠' },
    { key: 'cse', name: 'CSE', fullName: 'Computer Science & Engineering', icon: '💻' },
    { key: 'ds', name: 'DS', fullName: 'Data Science', icon: '📊' },
];

const Home: React.FC = () => {
    const navigate = useNavigate();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.12,
                delayChildren: 0.2,
            },
        },
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.4, ease: 'easeOut' },
        },
    };

    return (
        <div className="py-8 sm:py-12">
            {/* Header Section — matches Library page style */}
            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="text-center mb-8 sm:mb-12 bg-white p-6 sm:p-8 rounded-xl shadow-2xl"
            >
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">
                    📚 SELECT YOUR DEPARTMENT
                </h1>
                <p className="text-base sm:text-lg text-gray-600">
                    Choose your branch to access class notes, assignments & previous papers.
                </p>
            </motion.div>

            {/* Department Cards — styled like subject folders */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 px-2 sm:px-0"
            >
                {DEPARTMENTS.map((dept) => (
                    <motion.button
                        key={dept.key}
                        variants={cardVariants}
                        onClick={() => navigate(`/${dept.key}/library`)}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex flex-col items-center p-6 sm:p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-b-4 border-pec-yellow"
                    >
                        <span className="text-4xl sm:text-5xl mb-3">{dept.icon}</span>
                        <span className="text-xl sm:text-2xl font-extrabold text-gray-900 uppercase tracking-wide">
                            {dept.name}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-500 mt-1 text-center leading-tight">
                            {dept.fullName}
                        </span>
                        <span className="mt-3 px-4 py-1.5 text-xs sm:text-sm font-bold bg-pec-blue text-white rounded-full shadow-sm">
                            3-1 Semester →
                        </span>
                    </motion.button>
                ))}
            </motion.div>
        </div>
    );
};

export default Home;
