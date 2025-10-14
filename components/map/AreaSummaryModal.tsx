import React from 'react';

interface AreaSummaryModalProps {
  isOpen: boolean;
  isLoading: boolean;
  summary: string | null;
  error: string | null;
  onClose: () => void;
}

const AreaSummaryModal: React.FC<AreaSummaryModalProps> = ({ isOpen, isLoading, summary, error, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[2000]" onClick={onClose}>
      <div 
        className="bg-brand-secondary/80 backdrop-blur-lg border border-brand-accent/20 rounded-lg shadow-xl p-6 m-4 w-full max-w-md relative animate-fade-in-down"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-2 right-2 text-text-secondary hover:text-text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-xl font-bold text-text-primary mb-4">
          {isLoading && !summary ? 'Generating Area Summary...' : 'Area Summary'}
        </h2>

        {isLoading && !summary && (
          <div className="flex items-center justify-center h-24">
            <svg className="animate-spin h-8 w-8 text-brand-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {error && <p className="text-red-400 bg-red-500/10 p-3 rounded-md">{error}</p>}
        
        {summary && (
            <p className="text-text-secondary leading-relaxed min-h-[6rem]">
                {summary}
                {isLoading && <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse" style={{ animationDuration: '1s' }}></span>}
            </p>
        )}
      </div>
    </div>
  );
};

export default AreaSummaryModal;