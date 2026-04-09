import React from 'react';
import { Language, t } from '../translations';
import { X, BookOpen, Table, Image as ImageIcon } from 'lucide-react';

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export function DocsModal({ isOpen, onClose, lang }: DocsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <BookOpen className="w-5 h-5 mr-2" />
            {t[lang].documentation}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-8">
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t[lang].docsTitle}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t[lang].docsIntro}
            </p>
          </section>

          <section className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
              <Table className="w-4 h-4 mr-2 text-indigo-600" />
              {t[lang].docsStoryboardFormatTitle}
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              {t[lang].docsStoryboardFormatDesc}
            </p>
            <div className="bg-white border border-gray-200 rounded-md p-3 overflow-x-auto">
              <code className="text-sm text-indigo-700 whitespace-nowrap">
                {t[lang].docsStoryboardCols}
              </code>
            </div>
          </section>

          <section className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
              <ImageIcon className="w-4 h-4 mr-2 text-indigo-600" />
              {t[lang].docsAssetFormatTitle}
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              {t[lang].docsAssetFormatDesc}
            </p>
            <div className="bg-white border border-gray-200 rounded-md p-3 overflow-x-auto">
              <code className="text-sm text-indigo-700 whitespace-nowrap">
                {t[lang].docsAssetCols}
              </code>
            </div>
          </section>
        </div>
        
        <div className="p-5 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            {t[lang].cancel || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
