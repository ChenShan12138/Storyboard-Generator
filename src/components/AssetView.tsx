import React, { useRef, useState } from 'react';
import { Asset } from '../types';
import { Language, t } from '../translations';
import { Upload, Trash2, Image as ImageIcon, Plus, FileSpreadsheet, Link as LinkIcon, Loader2, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

interface AssetViewProps {
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  lang: Language;
}

export function AssetView({ assets, setAssets, lang }: AssetViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const activeAssetIdRef = useRef<string | null>(null);
  const [isImportingFeishu, setIsImportingFeishu] = useState(false);
  const [showFeishuInput, setShowFeishuInput] = useState(false);
  const [feishuUrl, setFeishuUrl] = useState('');

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
            handleFeishuImport();
          }
        };
        window.addEventListener('message', handleMessage);
        return;
      }

      const data = await response.json();
      if (data.valueRange && data.valueRange.values) {
        const rows = data.valueRange.values;
        if (rows.length > 1) {
          const newAssets: Asset[] = [];
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || row.every((cell: any) => !cell)) continue;
            newAssets.push({
              id: uuidv4(),
              name: row[0] ? String(row[0]) : '',
              type: (row[1] ? String(row[1]).toLowerCase() : 'scene') as any,
              description: row[2] ? String(row[2]) : '',
              images: []
            });
          }
          if (newAssets.length > 0) {
            setAssets(prev => [...prev, ...newAssets]);
            setShowFeishuInput(false);
            setFeishuUrl('');
          }
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

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length > 1) {
          // Skip header row (index 0)
          const newAssets: Asset[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            // Skip empty rows
            if (!row || row.length === 0 || row.every(cell => !cell)) continue;
            
            // Assuming columns: Name, Type, Description
            newAssets.push({
              id: uuidv4(),
              name: row[0] ? String(row[0]) : '',
              type: (row[1] ? String(row[1]).toLowerCase() : 'scene') as any,
              description: row[2] ? String(row[2]) : '',
              images: []
            });
          }
          
          if (newAssets.length > 0) {
            setAssets(prev => [...prev, ...newAssets]);
          }
        }
      } catch (error) {
        console.error("Failed to parse Excel file", error);
        alert("Failed to parse Excel file. Please ensure it's a valid .xlsx or .csv file.");
      }
    };
    reader.readAsArrayBuffer(file);
    
    if (excelInputRef.current) {
      excelInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeAssetIdRef.current) return;

    const currentAssetId = activeAssetIdRef.current;
    const imageFiles = (Array.from(files) as File[]).filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const newImages: string[] = [];
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const reader = new FileReader();
      const promise = new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => resolve('');
      });
      reader.readAsDataURL(file);
      const result = await promise;
      if (result) newImages.push(result);
    }
    
    if (newImages.length > 0) {
      setAssets(prev => prev.map(a => 
        a.id === currentAssetId 
          ? { ...a, images: [...(a.images || []), ...newImages] } 
          : a
      ));
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerUpload = (id: string) => {
    console.log("Triggering upload for asset:", id);
    activeAssetIdRef.current = id;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error("fileInputRef is null");
    }
  };

  const addAssetRow = () => {
    setAssets(prev => [...prev, {
      id: uuidv4(),
      name: '',
      type: 'scene',
      description: '',
      images: []
    }]);
  };

  const updateAsset = (id: string, field: keyof Asset, value: any) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const removeImage = (assetId: string, imageIndex: number) => {
    setAssets(prev => prev.map(a => {
      if (a.id === assetId) {
        const newImages = [...a.images];
        newImages.splice(imageIndex, 1);
        return { ...a, images: newImages };
      }
      return a;
    }));
  };

  const [dragOverAssetId, setDragOverAssetId] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, assetId: string) => {
    e.preventDefault();
    setDragOverAssetId(assetId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverAssetId(null);
  };

  const handleDrop = (e: React.DragEvent, assetId: string) => {
    e.preventDefault();
    setDragOverAssetId(null);
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const newImages: string[] = [];
    let loadedCount = 0;
    const imageFiles = (Array.from(files) as File[]).filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) return;

    imageFiles.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        newImages.push(base64);
        loadedCount++;
        
        if (loadedCount === imageFiles.length) {
          setAssets(prev => prev.map(a => 
            a.id === assetId 
              ? { ...a, images: [...a.images, ...newImages] } 
              : a
          ));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-medium text-gray-900 flex items-center">
          <ImageIcon className="w-5 h-5 mr-2 text-indigo-600" />
          {t[lang].assetLibrary}
        </h3>
        <div className="flex space-x-2">
          {showFeishuInput ? (
            <div className="flex items-center space-x-2 bg-white border border-gray-300 rounded-md px-2 py-1">
              <input
                type="text"
                value={feishuUrl}
                onChange={(e) => setFeishuUrl(e.target.value)}
                placeholder={t[lang].feishuUrlPlaceholder}
                className="text-xs w-48 focus:outline-none"
              />
              <button 
                onClick={handleFeishuImport}
                disabled={isImportingFeishu || !feishuUrl.trim()}
                className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
              >
                {isImportingFeishu ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
              <button onClick={() => setShowFeishuInput(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowFeishuInput(true)}
              className="flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LinkIcon className="w-4 h-4 mr-2 text-green-600" />
              {t[lang].importFeishu}
            </button>
          )}
          <button
            onClick={() => excelInputRef.current?.click()}
            className="flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-indigo-600" />
            {t[lang].uploadExcel || 'Upload Excel'}
          </button>
          <button
            onClick={addAssetRow}
            className="flex items-center px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t[lang].addAssetRow}
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-500 border-collapse">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 border-r border-gray-200 w-12 text-center">#</th>
              <th className="px-4 py-3 border-r border-gray-200 w-48">{t[lang].assetName}</th>
              <th className="px-4 py-3 border-r border-gray-200 w-32">{t[lang].assetType}</th>
              <th className="px-4 py-3 border-r border-gray-200 w-24 text-center">{t[lang].showInStoryboard}</th>
              <th className="px-4 py-3 border-r border-gray-200 w-64">{t[lang].assetDescription}</th>
              <th className="px-4 py-3">{t[lang].assetImages}</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 border-b border-gray-200">
                  {t[lang].assetLibrary} - {t[lang].addAssetRow}
                </td>
              </tr>
            ) : (
              (assets || []).map((asset, index) => (
                <tr key={asset.id} className="bg-white border-b border-gray-200 hover:bg-gray-50 group">
                  <td className="px-2 py-2 border-r border-gray-200 text-center relative">
                    <span className="group-hover:hidden">{index + 1}</span>
                    <button 
                      onClick={() => deleteAsset(asset.id)}
                      className="hidden group-hover:flex items-center justify-center w-full text-red-500 hover:text-red-700"
                      title={t[lang].deleteAsset}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="p-0 border-r border-gray-200 align-top">
                    <textarea
                      value={asset.name}
                      onChange={(e) => updateAsset(asset.id, 'name', e.target.value)}
                      placeholder={t[lang].assetNamePlaceholder}
                      className="w-full h-full min-h-[80px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td className="p-2 border-r border-gray-200 align-top">
                    <select
                      value={asset.type}
                      onChange={(e) => updateAsset(asset.id, 'type', e.target.value)}
                      className="w-full p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-transparent text-sm"
                    >
                      <option value="scene">{t[lang].assetTypeScene}</option>
                      <option value="character">{t[lang].assetTypeCharacter}</option>
                      <option value="prop">{t[lang].assetTypeProp}</option>
                      <option value="other">{t[lang].assetTypeOther}</option>
                    </select>
                  </td>
                  <td className="p-2 border-r border-gray-200 align-top text-center">
                    <input
                      type="checkbox"
                      checked={asset.showInStoryboard !== false}
                      onChange={(e) => updateAsset(asset.id, 'showInStoryboard', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200 align-top">
                    <textarea
                      value={asset.description}
                      onChange={(e) => updateAsset(asset.id, 'description', e.target.value)}
                      placeholder={t[lang].assetDescPlaceholder}
                      className="w-full h-full min-h-[80px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td 
                    className={`p-2 align-top transition-colors ${dragOverAssetId === asset.id ? 'bg-indigo-50 border-indigo-300' : ''}`}
                    onDragOver={(e) => handleDragOver(e, asset.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, asset.id)}
                  >
                    <div className="flex flex-wrap gap-2">
                      {(asset.images || []).map((img, imgIndex) => (
                        <div key={imgIndex} className="relative w-24 h-16 bg-gray-100 rounded overflow-hidden group/img border border-gray-200">
                          <img src={img} alt="Asset" className="w-full h-full object-cover pointer-events-none" />
                          <button 
                            onClick={() => removeImage(asset.id, imgIndex)}
                            className="absolute top-1 right-1 p-1 bg-white/80 rounded shadow-sm text-gray-600 hover:text-red-600 opacity-0 group-hover/img:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => triggerUpload(asset.id)}
                        className={`w-24 h-16 flex flex-col items-center justify-center border-2 border-dashed rounded transition-colors ${dragOverAssetId === asset.id ? 'border-indigo-500 text-indigo-600 bg-indigo-100' : 'border-gray-300 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50'}`}
                      >
                        <Upload className="w-4 h-4 mb-1" />
                        <span className="text-[10px]">{dragOverAssetId === asset.id ? 'Drop here' : t[lang].uploadImage}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <input 
        type="file" 
        ref={excelInputRef} 
        onChange={handleExcelUpload} 
        accept=".xlsx, .xls, .csv" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        multiple
        className="hidden" 
      />
    </div>
  );
}
