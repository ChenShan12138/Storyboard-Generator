import React, { useState, useRef } from 'react';
import { StoryboardPanel } from '../types';
import { Language, t } from '../translations';
import { X, Upload, ClipboardPaste, Link as LinkIcon, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (panels: StoryboardPanel[], mode: 'replace' | 'append') => void;
  lang: Language;
}

export function ImportModal({ isOpen, onClose, onImport, lang }: ImportModalProps) {
  const [pasteText, setPasteText] = useState('');
  const [feishuUrl, setFeishuUrl] = useState('');
  const [isImportingFeishu, setIsImportingFeishu] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('append');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  async function fetchWithRetry(url: string, options?: RequestInit, retries = 2): Promise<Response> {
    try {
      const response = await fetch(url, options);
      if (!response.ok && response.status >= 500 && retries > 0) {
        console.warn(`Server error ${response.status} for ${url}, retrying... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchWithRetry(url, options, retries - 1);
      }
      return response;
    } catch (e) {
      if (retries > 0) {
        console.warn(`Fetch failed for ${url}, retrying... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw e;
    }
  }

  const parseFeishuUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const spreadsheetToken = pathParts[pathParts.indexOf('sheets') + 1];
      const sheetId = urlObj.searchParams.get('sheet') || '';
      return { spreadsheetToken, sheetId };
    } catch (e) {
      return null;
    }
  };

  const handleFeishuImport = async () => {
    const parsed = parseFeishuUrl(feishuUrl);
    if (!parsed || !parsed.spreadsheetToken) {
      alert(t[lang].feishuInvalidUrl);
      return;
    }

    setIsImportingFeishu(true);
    try {
      const response = await fetchWithRetry('/api/feishu/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetToken: parsed.spreadsheetToken,
          sheetId: parsed.sheetId,
          range: 'A1:Z100'
        })
      });

      if (response.status === 401) {
        // Need auth
        const appId = localStorage.getItem('feishu_app_id');
        const appSecret = localStorage.getItem('feishu_app_secret');

        const authUrlRes = await fetchWithRetry('/api/auth/feishu/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, appSecret })
        });
        
        if (!authUrlRes.ok) {
          const err = await authUrlRes.json();
          alert(err.error || 'Failed to initiate Feishu authentication');
          setIsImportingFeishu(false);
          return;
        }

        const { url } = await authUrlRes.json();
        
        const authWindow = window.open(url, 'feishu_auth', 'width=600,height=700');
        
        const handleMessage = async (event: MessageEvent) => {
          if (event.data?.type === 'FEISHU_AUTH_SUCCESS') {
            window.removeEventListener('message', handleMessage);
            // Retry import
            handleFeishuImport();
          }
        };
        window.addEventListener('message', handleMessage);
        return;
      }

      const data = await response.json();
      if (data.valueRange && data.valueRange.values) {
        const panels = parseData(data.valueRange.values);
        if (panels.length > 0) {
          onImport(panels, importMode);
          onClose();
          setFeishuUrl('');
        }
      } else {
        alert('Failed to fetch data from Feishu. Please check the URL and permissions.');
      }
    } catch (error) {
      console.error('Feishu import failed', error);
      alert('Feishu import failed');
    } finally {
      setIsImportingFeishu(false);
    }
  };

  const parseData = (rows: any[][]) => {
    let startIndex = 0;
    // Check if first row looks like headers
    if (rows.length > 0 && rows[0].some(cell => {
      const str = String(cell).toLowerCase();
      return str.includes('场次') || str.includes('scene') || str.includes('画面') || str.includes('content');
    })) {
      startIndex = 1;
    }

    const newPanels: StoryboardPanel[] = [];
    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || row.every(c => !c)) continue; // skip empty rows

      newPanels.push({
        id: uuidv4(),
        sceneShotNumber: String(row[0] || ''),
        coreVisualContent: String(row[1] || ''),
        opticalParameters: String(row[2] || ''),
        shotSize: String(row[3] || ''),
        cameraMovement: String(row[4] || ''),
        compositionRequirements: String(row[5] || ''),
        lightingColorStyle: String(row[6] || ''),
        physicalAiConstraints: String(row[7] || ''),
        modificationSuggestions: String(row[8] || ''),
        imagePrompt: String(row[9] || ''),
        generatedImages: [],
        selectedImageIndex: 0,
        status: 'idle'
      });
    }
    return newPanels;
  };

  const handlePasteImport = () => {
    if (!pasteText.trim()) return;
    const rows = pasteText.split('\n').map(line => line.split('\t'));
    const panels = parseData(rows);
    if (panels.length > 0) {
      onImport(panels, importMode);
      onClose();
      setPasteText('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      const panels = parseData(data);
      if (panels.length > 0) {
        onImport(panels, importMode);
        onClose();
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{t[lang].importTable}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <p className="text-sm text-gray-600">{t[lang].importDesc}</p>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-4 mb-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={importMode === 'append'} 
                  onChange={() => setImportMode('append')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{t[lang].appendExisting}</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={importMode === 'replace'} 
                  onChange={() => setImportMode('replace')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{t[lang].replaceExisting}</span>
              </label>
            </div>
            
            <div className="border border-gray-300 rounded-lg p-1">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={t[lang].pasteData}
                className="w-full h-48 p-3 border-none focus:ring-0 resize-none text-sm"
              />
            </div>
            <button
              onClick={handlePasteImport}
              disabled={!pasteText.trim()}
              className="w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex justify-center items-center"
            >
              <ClipboardPaste className="w-4 h-4 mr-2" />
              {t[lang].import}
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">OR</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 flex items-center justify-center font-medium transition-colors"
            >
              <Upload className="w-5 h-5 mr-2" />
              {t[lang].uploadFile}
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">OR</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center border border-gray-300 rounded-lg p-1 bg-white">
              <LinkIcon className="w-4 h-4 ml-2 text-gray-400" />
              <input
                type="text"
                value={feishuUrl}
                onChange={(e) => setFeishuUrl(e.target.value)}
                placeholder={t[lang].feishuUrlPlaceholder}
                className="w-full p-2 border-none focus:ring-0 text-sm"
              />
            </div>
            <button
              onClick={handleFeishuImport}
              disabled={isImportingFeishu || !feishuUrl.trim()}
              className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex justify-center items-center"
            >
              {isImportingFeishu ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LinkIcon className="w-4 h-4 mr-2" />
              )}
              {isImportingFeishu ? t[lang].feishuImporting : t[lang].importFeishu}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}