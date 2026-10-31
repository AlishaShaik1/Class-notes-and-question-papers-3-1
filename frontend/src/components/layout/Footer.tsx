// frontend/src/components/layout/Footer.tsx
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-pec-blue text-white mt-12 py-4 shadow-inner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

        <p className="text-lg md:text-xl font-bold mb-2 text-pec-yellow uppercase">
          PEC 3-1 Semester Notes & Papers Hub
        </p>

        <div className="text-sm md:text-base space-y-1">
          <p className="font-semibold text-white/90">
            Contact:{" "}
            <a
              href="mailto:alishashiak1606@gmail.com"
              className="text-pec-green hover:underline"
              title="Send Email to Alisha"
            >
              alishashiak1606@gmail.com
            </a>
          </p>
          <p>
            Shaik.Alisha | Roll No: <span className="font-medium text-pec-green">24A31A42C8</span>
          </p>
          <p className="text-xs text-white/70 pt-1">
            3nd Year - Artificial Intelligence and Machine Learning (AIML-B)
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
