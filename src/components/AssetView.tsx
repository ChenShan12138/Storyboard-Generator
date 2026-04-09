import React, { useRef, useState } from 'react';
import { Asset, AssetCategory } from '../types';
import { Language, t } from '../translations';
import { Upload, Trash2, Image as ImageIcon, Plus, FileSpreadsheet, Link as LinkIcon, Loader2, X, ChevronDown, ChevronRight, Edit2, Check } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

import { BlobImage } from './BlobImage';

interface AssetViewProps {
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  categories: AssetCategory[];
  setCategories: React.Dispatch<React.SetStateAction<AssetCategory[]>>;
  lang: Language;
}

export function AssetView({ assets, setAssets, categories, setCategories, lang }: AssetViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const activeAssetIdRef = useRef<string | null>(null);
  const [isImportingFeishu, setIsImportingFeishu] = useState(false);
  const [showFeishuInput, setShowFeishuInput] = useState(false);
  const [feishuUrl, setFeishuUrl] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const addCategory = () => {
    const newCat = { id: uuidv4(), name: lang === 'zh' ? '新分类' : 'New Category' };
    setCategories([...categories, newCat]);
    setExpandedCategories(prev => ({ ...prev, [newCat.id]: true }));
  };

  const deleteCategory = (id: string) => {
    if (confirm(lang === 'zh' ? '确定要删除此分类及其所有资产吗？' : 'Are you sure you want to delete this category and all its assets?')) {
      setCategories(categories.filter(c => c.id !== id));
      setAssets(assets.filter(a => a.categoryId !== id));
    }
  };

  const startEditingCategory = (cat: AssetCategory) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
  };

  const saveCategoryName = () => {
    if (editingCategoryId && editingCategoryName.trim()) {
      setCategories(categories.map(c => c.id === editingCategoryId ? { ...c, name: editingCategoryName.trim() } : c));
    }
    setEditingCategoryId(null);
  };

  const addAssetToCategory = (categoryId: string) => {
    setAssets([...assets, {
      id: uuidv4(),
      name: '',
      categoryId,
      description: '',
      images: [],
      showInStoryboard: true
    }]);
    setExpandedCategories(prev => ({ ...prev, [categoryId]: true }));
  };

  const updateAsset = (id: string, field: keyof Asset, value: any) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const triggerUpload = (id: string) => {
    activeAssetIdRef.current = id;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeAssetIdRef.current) return;

    const currentAssetId = activeAssetIdRef.current;
    const imageFiles = (Array.from(files) as File[]).filter(f => f.type.startsWith('image/'));
    
    const newImages: string[] = [];
    for (const file of imageFiles) {
      const reader = new FileReader();
      const promise = new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => resolve('');
      });
      reader.readAsDataURL(file);
      const base64 = await promise;
      if (base64) {
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 })
          });
          if (res.ok) {
            const data = await res.json();
            newImages.push(data.url);
          } else {
            newImages.push(base64);
          }
        } catch (err) {
          console.error('Upload failed', err);
          newImages.push(base64);
        }
      }
    }
    
    if (newImages.length > 0) {
      setAssets(prev => prev.map(a => 
        a.id === currentAssetId 
          ? { ...a, images: [...(a.images || []), ...newImages] } 
          : a
      ));
    }
    e.target.value = '';
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

  const handleDrop = async (e: React.DragEvent, assetId: string) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const imageFiles = (Array.from(files) as File[]).filter(f => f.type.startsWith('image/'));
    
    const newImages: string[] = [];
    for (const file of imageFiles) {
      const reader = new FileReader();
      const promise = new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
      });
      reader.readAsDataURL(file);
      const base64 = await promise;
      if (base64) {
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 })
          });
          if (res.ok) {
            const data = await res.json();
            newImages.push(data.url);
          } else {
            newImages.push(base64);
          }
        } catch (err) {
          console.error('Upload failed', err);
          newImages.push(base64);
        }
      }
    }
    
    if (newImages.length > 0) {
      setAssets(prev => prev.map(a => 
        a.id === assetId 
          ? { ...a, images: [...(a.images || []), ...newImages] } 
          : a
      ));
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <ImageIcon className="w-6 h-6 mr-2 text-indigo-600" />
          {t[lang].assetLibrary}
        </h2>
      </div>

      <div className="space-y-4">
        {categories.map(category => {
          const categoryAssets = assets.filter(a => a.categoryId === category.id);
          const isExpanded = expandedCategories[category.id] !== false;

          return (
            <div key={category.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center group">
                <div className="flex items-center flex-1">
                  <button onClick={() => toggleCategory(category.id)} className="mr-2 text-gray-400 hover:text-indigo-600">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                  {editingCategoryId === category.id ? (
                    <div className="flex items-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={e => setEditingCategoryName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveCategoryName()}
                        autoFocus
                        className="px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button onClick={saveCategoryName} className="ml-2 text-indigo-600 hover:text-indigo-800">
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <h3 className="font-bold text-gray-900">{category.name}</h3>
                      <button 
                        onClick={() => startEditingCategory(category)}
                        className="ml-2 p-1 text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <span className="ml-3 text-xs text-gray-400">({categoryAssets.length} {lang === 'zh' ? '项资产' : 'assets'})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => deleteCategory(category.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title={lang === 'zh' ? '删除分类' : 'Delete Category'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500 border-collapse">
                    <thead className="text-xs text-gray-700 uppercase bg-white border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 w-12 text-center">#</th>
                        <th className="px-4 py-3 w-48">{t[lang].assetName}</th>
                        <th className="px-4 py-3 w-24 text-center">{t[lang].showInStoryboard}</th>
                        <th className="px-4 py-3 w-64">{t[lang].assetDescription}</th>
                        <th className="px-4 py-3">{t[lang].assetImages}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryAssets.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">
                            {lang === 'zh' ? '暂无资产，点击下方 "添加资产" 开始' : 'No assets yet, click "Add Asset" below to start'}
                          </td>
                        </tr>
                      ) : (
                        categoryAssets.map((asset, idx) => (
                          <tr 
                            key={asset.id} 
                            className="border-b border-gray-100 hover:bg-gray-50 group/row"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, asset.id)}
                          >
                            <td className="px-2 py-4 text-center relative">
                              <span className="group-hover/row:hidden">{idx + 1}</span>
                              <button 
                                onClick={() => deleteAsset(asset.id)}
                                className="hidden group-hover/row:flex items-center justify-center w-full text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                            <td className="p-2 align-top">
                              <textarea
                                value={asset.name}
                                onChange={(e) => updateAsset(asset.id, 'name', e.target.value)}
                                placeholder={t[lang].assetNamePlaceholder}
                                className="w-full p-2 border border-transparent hover:border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded resize-none bg-transparent transition-all h-20"
                              />
                            </td>
                            <td className="p-2 align-top text-center">
                              <input
                                type="checkbox"
                                checked={asset.showInStoryboard !== false}
                                onChange={(e) => updateAsset(asset.id, 'showInStoryboard', e.target.checked)}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-3"
                              />
                            </td>
                            <td className="p-2 align-top">
                              <textarea
                                value={asset.description}
                                onChange={(e) => updateAsset(asset.id, 'description', e.target.value)}
                                placeholder={t[lang].assetDescPlaceholder}
                                className="w-full p-2 border border-transparent hover:border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded resize-none bg-transparent transition-all h-20"
                              />
                            </td>
                            <td className="p-2 align-top">
                              <div className="flex flex-wrap gap-2">
                                {(asset.images || []).map((img, imgIdx) => (
                                  <div key={imgIdx} className="relative w-24 h-16 bg-gray-100 rounded-md overflow-hidden group/img border border-gray-200 shadow-sm">
                                    <BlobImage src={img} thumbnail={true} alt="Asset" className="w-full h-full object-cover" />
                                    <button 
                                      onClick={() => removeImage(asset.id, imgIdx)}
                                      className="absolute top-1 right-1 p-1 bg-white/90 rounded shadow-sm text-gray-600 hover:text-red-600 opacity-0 group-hover/img:opacity-100 transition-opacity"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => triggerUpload(asset.id)}
                                  className="w-24 h-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-md text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                                >
                                  <Upload className="w-4 h-4 mb-1" />
                                  <span className="text-[10px]">{t[lang].uploadImage}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <div className="p-3 bg-gray-50/50 border-t border-gray-100">
                    <button
                      onClick={() => addAssetToCategory(category.id)}
                      className="flex items-center justify-center w-full py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors font-medium border border-dashed border-indigo-200"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t[lang].addAsset}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={addCategory}
        className="flex items-center justify-center w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-all shadow-sm"
      >
        <Plus className="w-5 h-5 mr-2 text-indigo-600" />
        {lang === 'zh' ? '新建分类' : 'New Category'}
      </button>

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
