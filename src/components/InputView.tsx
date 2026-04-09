import React, { useState } from 'react';
import { StoryboardPanel, Asset, AssetCategory } from '../types';
import { Plus, Trash2, Image as ImageIcon, Loader2, ChevronDown, ChevronUp, Table, Settings as SettingsIcon, BookOpen, Download, X, Upload, Search, Check, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Language, t } from '../translations';
import { ImportModal } from './ImportModal';

interface InputViewProps {
  panels: StoryboardPanel[];
  setPanels: React.Dispatch<React.SetStateAction<StoryboardPanel[]>>;
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  categories: AssetCategory[];
  systemPrompt: string;
  setSystemPrompt: (val: string) => void;
  onGenerateAll: () => void;
  onGenerateSingle: (id: string) => void;
  onGoToStoryboard: () => void;
  lang: Language;
}

export function InputView({ panels, setPanels, assets, setAssets, categories, systemPrompt, setSystemPrompt, onGenerateAll, onGenerateSingle, onGoToStoryboard, lang }: InputViewProps) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activeAssetSelector, setActiveAssetSelector] = useState<string | null>(null);

  const handleSystemPromptChange = (val: string) => {
    setSystemPrompt(val);
  };

  const addPanel = () => {
    setPanels([...panels, {
      id: uuidv4(),
      sceneShotNumber: '',
      coreVisualContent: '',
      opticalParameters: '',
      shotSize: '',
      cameraMovement: '',
      compositionRequirements: '',
      lightingColorStyle: '',
      physicalAiConstraints: '',
      modificationSuggestions: '',
      imagePrompt: '',
      generatedImages: [],
      selectedImageIndex: 0,
      status: 'idle',
      showInStoryboard: true
    }]);
  };

  const updatePanel = (id: string, field: keyof StoryboardPanel, value: any) => {
    setPanels(panels.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removePanel = (id: string) => {
    setPanels(panels.filter(p => p.id !== id));
  };

  const handleReferenceUpload = async (panelId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    await processFiles(panelId, Array.from(files));
    e.target.value = '';
  };

  const processFiles = async (panelId: string, files: File[]) => {
    const newImages: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      const promise = new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
      });
      reader.readAsDataURL(file);
      newImages.push(await promise);
    }

    const panel = panels.find(p => p.id === panelId);
    const existingImages = panel?.referenceImages || [];
    updatePanel(panelId, 'referenceImages', [...existingImages, ...newImages]);
  };

  const handleDrop = async (e: React.DragEvent, panelId: string) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length > 0) {
      await processFiles(panelId, files);
    }
  };

  const removeReferenceImage = (panelId: string, index: number) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel) return;
    const newImages = [...(panel.referenceImages || [])];
    newImages.splice(index, 1);
    updatePanel(panelId, 'referenceImages', newImages);
  };

  const handleImport = (importedPanels: StoryboardPanel[], mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      setPanels(importedPanels);
    } else {
      setPanels([...panels, ...importedPanels]);
    }
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [isAssociating, setIsAssociating] = useState<Record<string, boolean>>({});

  const handleIntelligentAssociate = async (panelId: string) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel || assets.length === 0) return;

    setIsAssociating(prev => ({ ...prev, [panelId]: true }));
    try {
      const { associateAssetWithPanel } = await import('../services/geminiService');
      const results = await associateAssetWithPanel(panel, assets);
      if (results && results.length > 0) {
        const associatedAssets = results.map(result => {
          const asset = assets.find(a => a.id === result.assetId);
          let image;
          if (asset && asset.images && asset.images.length > result.imageIndex) {
            image = asset.images[result.imageIndex];
          }
          return { assetId: result.assetId, image };
        });
        updatePanel(panelId, 'associatedAssets', associatedAssets);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsAssociating(prev => ({ ...prev, [panelId]: false }));
    }
  };

  const isGenerating = panels.some(p => p.status === 'generating');

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-[1800px] mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{t[lang].title}</h1>
        <div className="space-x-3 flex items-center">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium transition-colors"
          >
            <Table className="w-4 h-4 mr-2" />
            {t[lang].importTable}
          </button>
          <button
            onClick={onGenerateAll}
            disabled={isGenerating || panels.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isGenerating ? t[lang].generating : t[lang].generateAll}
          </button>
          <button
            onClick={onGoToStoryboard}
            disabled={panels.length === 0}
            className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {t[lang].viewStoryboard}
          </button>
        </div>
      </div>

      {/* Storyboard Generation Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center">
          <SettingsIcon className="w-5 h-5 mr-2 text-indigo-600" />
          {t[lang].storyboardGenSettings}
        </h2>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">{t[lang].systemPrompt}</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => handleSystemPromptChange(e.target.value)}
            placeholder={lang === 'zh' ? '输入系统提示词以指导 AI 生成...' : 'Enter system prompt to guide AI generation...'}
            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-24 text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left text-gray-700 border-collapse table-fixed min-w-[2200px]">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-4 w-64">AI Generation</th>
                <th className="px-3 py-4 w-64">{t[lang].reference}</th>
                <th className="px-2 py-4 w-10 text-center">#</th>
                <th className="px-2 py-4 w-12 text-center">{lang === 'zh' ? '显' : 'S'}</th>
                <th className="px-3 py-4 w-20">{t[lang].sceneShotNumber}</th>
                <th className="px-3 py-4 w-32">{t[lang].sceneTitle}</th>
                <th className="px-3 py-4 w-48">{t[lang].sceneDescription}</th>
                <th className="px-3 py-4 w-64">{t[lang].coreVisualContent}</th>
                <th className="px-3 py-4 w-32">{t[lang].opticalParameters}</th>
                <th className="px-3 py-4 w-24">{t[lang].shotSize}</th>
                <th className="px-3 py-4 w-24">{t[lang].cameraMovement}</th>
                <th className="px-3 py-4 w-40">{t[lang].compositionRequirements}</th>
                <th className="px-3 py-4 w-40">{t[lang].lightingColorStyle}</th>
                <th className="px-3 py-4 w-40">{t[lang].physicalAiConstraints}</th>
                <th className="px-3 py-4 w-32">{t[lang].additionalNotes}</th>
              </tr>
            </thead>
            <tbody>
              {(panels || []).map((panel, index) => (
                <tr key={panel.id} className="border-b border-gray-100 hover:bg-gray-50/50 group align-top">
                  {/* AI Generation Column */}
                  <td className="p-3">
                    <div className="space-y-3">
                      {(panel.generatedImages || []).length > 0 ? (
                        <div className="relative group/img rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-[16/9] bg-gray-50">
                          <img 
                            src={panel.generatedImages[panel.selectedImageIndex || 0]} 
                            alt="Generated" 
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setPreviewImage(panel.generatedImages[panel.selectedImageIndex || 0])}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                            <button
                              onClick={() => onGenerateSingle(panel.id)}
                              disabled={panel.status === 'generating'}
                              className="px-3 py-1.5 bg-white text-gray-900 rounded-md text-[10px] font-bold hover:bg-gray-100 transition-colors flex items-center"
                            >
                              <ImageIcon className="w-3 h-3 mr-1" />
                              {t[lang].regenerate}
                            </button>
                            <button
                              onClick={() => handleDownload(panel.generatedImages[panel.selectedImageIndex || 0], `panel-${panel.sceneShotNumber || index + 1}.png`)}
                              className="p-1.5 bg-white text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => onGenerateSingle(panel.id)}
                          disabled={panel.status === 'generating'}
                          className="w-full aspect-[16/9] border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all group/gen"
                        >
                          {panel.status === 'generating' ? (
                            <><Loader2 className="w-6 h-6 mb-2 animate-spin" /> <span className="text-xs">{t[lang].generating}</span></>
                          ) : (
                            <><ImageIcon className="w-6 h-6 mb-2 group-hover/gen:scale-110 transition-transform" /> <span className="text-xs font-bold">{t[lang].generateImage}</span></>
                          )}
                        </button>
                      )}
                      {panel.error && <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded border border-red-100">{panel.error}</div>}
                    </div>
                  </td>

                  {/* Reference Column */}
                  <td 
                    className="p-3 space-y-4"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, panel.id)}
                  >
                    {/* Assets Section */}
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t[lang].associatedAsset}</span>
                        <button 
                          onClick={() => handleIntelligentAssociate(panel.id)}
                          disabled={isAssociating[panel.id]}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center disabled:opacity-50 bg-indigo-50 px-2 py-0.5 rounded"
                        >
                          {isAssociating[panel.id] ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                          {t[lang].intelligentAssociate}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {(panel.associatedAssets || []).map((assoc, idx) => {
                          const asset = assets.find(a => a.id === assoc.assetId);
                          if (!asset) return null;
                          return (
                            <div key={idx} className="group/assoc relative w-12 h-12 bg-gray-100 rounded border border-gray-200 overflow-hidden shadow-sm">
                              {assoc.image ? (
                                <img src={assoc.image} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400">NO IMG</div>
                              )}
                              <button 
                                onClick={() => {
                                  const current = panel.associatedAssets || [];
                                  updatePanel(panel.id, 'associatedAssets', current.filter(a => a.assetId !== assoc.assetId));
                                }}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/assoc:opacity-100 transition-opacity"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          );
                        })}
                        <button 
                          onClick={() => setActiveAssetSelector(activeAssetSelector === panel.id ? null : panel.id)}
                          className="w-12 h-12 flex items-center justify-center border-2 border-dashed border-gray-300 rounded text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>

                      {activeAssetSelector === panel.id && (
                        <div className="absolute z-10 top-full left-0 w-80 bg-white border border-gray-200 shadow-xl rounded-lg p-4 mt-2 max-h-[400px] overflow-y-auto">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-sm">{lang === 'zh' ? '选择关联资产' : 'Select Assets'}</h4>
                            <button onClick={() => setActiveAssetSelector(null)}><X className="w-4 h-4 text-gray-400" /></button>
                          </div>
                          <div className="space-y-4">
                            {categories.map(cat => {
                              const catAssets = assets.filter(a => a.categoryId === cat.id);
                              if (catAssets.length === 0) return null;
                              const isExpanded = expandedCategories[cat.id] !== false;
                              return (
                                <div key={cat.id} className="space-y-2">
                                  <button 
                                    onClick={() => toggleCategory(cat.id)}
                                    className="flex items-center w-full text-left text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-indigo-600"
                                  >
                                    {isExpanded ? <ChevronDown className="w-3 h-3 mr-1" /> : <ChevronRight className="w-3 h-3 mr-1" />}
                                    {cat.name}
                                  </button>
                                  {isExpanded && (
                                    <div className="grid grid-cols-2 gap-2">
                                      {catAssets.map(asset => {
                                        const isSelected = (panel.associatedAssets || []).some(a => a.assetId === asset.id);
                                        const selectedAssoc = (panel.associatedAssets || []).find(a => a.assetId === asset.id);
                                        return (
                                          <div key={asset.id} className="space-y-1">
                                            <div 
                                              onClick={() => {
                                                const current = panel.associatedAssets || [];
                                                if (isSelected) {
                                                  updatePanel(panel.id, 'associatedAssets', current.filter(a => a.assetId !== asset.id));
                                                } else {
                                                  updatePanel(panel.id, 'associatedAssets', [...current, { assetId: asset.id, image: asset.images?.[0] }]);
                                                }
                                              }}
                                              className={`relative aspect-[4/3] rounded border-2 overflow-hidden cursor-pointer transition-all ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-gray-100 hover:border-gray-300'}`}
                                            >
                                              {asset.images?.[0] ? (
                                                <img src={asset.images[0]} className="w-full h-full object-cover" />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-50 text-[10px] text-gray-400">NO IMG</div>
                                              )}
                                              {isSelected && (
                                                <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full p-0.5">
                                                  <Check className="w-3 h-3" />
                                                </div>
                                              )}
                                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">
                                                {asset.name}
                                              </div>
                                            </div>
                                            {isSelected && asset.images && asset.images.length > 1 && (
                                              <div className="flex flex-wrap gap-1">
                                                {asset.images.map((img, imgIdx) => (
                                                  <div 
                                                    key={imgIdx}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const newAssoc = [...(panel.associatedAssets || [])];
                                                      const idx = newAssoc.findIndex(a => a.assetId === asset.id);
                                                      newAssoc[idx] = { ...newAssoc[idx], image: img };
                                                      updatePanel(panel.id, 'associatedAssets', newAssoc);
                                                    }}
                                                    className={`w-5 h-5 rounded-sm border overflow-hidden cursor-pointer ${selectedAssoc?.image === img ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                                  >
                                                    <img src={img} className="w-full h-full object-cover" />
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Reference Images */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t[lang].referenceImages}</span>
                        <label className="cursor-pointer text-indigo-600 hover:text-indigo-800 flex items-center text-[10px] bg-indigo-50 px-2 py-0.5 rounded">
                          <Upload className="w-3 h-3 mr-1" /> {t[lang].uploadReference}
                          <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleReferenceUpload(panel.id, e)} />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(panel.referenceImages || []).map((img, idx) => (
                          <div key={idx} className="relative group w-12 h-12 bg-gray-100 rounded border border-gray-200 overflow-hidden shadow-sm">
                            <img src={img} className="w-full h-full object-cover pointer-events-none" />
                            <button onClick={() => removeReferenceImage(panel.id, idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>

                  <td className="px-1 py-4 text-center relative">
                    <span className="group-hover:hidden text-gray-400 font-mono">{index + 1}</span>
                    <button 
                      onClick={() => removePanel(panel.id)}
                      className="hidden group-hover:flex items-center justify-center w-full text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="px-1 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={panel.showInStoryboard !== false}
                      onChange={(e) => updatePanel(panel.id, 'showInStoryboard', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-1"
                    />
                  </td>
                  {[
                    { field: 'sceneShotNumber', placeholder: t[lang].sceneShotPlaceholder },
                    { field: 'sceneTitle', placeholder: t[lang].sceneTitlePlaceholder },
                    { field: 'sceneDescription', placeholder: t[lang].sceneDescriptionPlaceholder },
                    { field: 'coreVisualContent', placeholder: t[lang].coreVisualPlaceholder },
                    { field: 'opticalParameters', placeholder: t[lang].opticalPlaceholder },
                    { field: 'shotSize', placeholder: t[lang].shotSizePlaceholder },
                    { field: 'cameraMovement', placeholder: t[lang].cameraMovementPlaceholder },
                    { field: 'compositionRequirements', placeholder: t[lang].compositionPlaceholder },
                    { field: 'lightingColorStyle', placeholder: t[lang].lightingPlaceholder },
                    { field: 'physicalAiConstraints', placeholder: t[lang].constraintsPlaceholder },
                    { field: 'modificationSuggestions', placeholder: t[lang].suggestionsPlaceholder },
                  ].map(col => (
                    <td key={col.field} className="p-1">
                      <textarea
                        value={(panel as any)[col.field] || ''}
                        onChange={(e) => updatePanel(panel.id, col.field as any, e.target.value)}
                        placeholder={col.placeholder}
                        className="w-full min-h-[140px] p-2 border border-transparent hover:border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded resize-none bg-transparent transition-all leading-relaxed"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={addPanel}
        className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 flex items-center justify-center font-bold transition-all group"
      >
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-indigo-100 flex items-center justify-center mr-3 transition-colors">
            <Plus className="w-5 h-5" />
          </div>
          {t[lang].addNew}
        </div>
      </button>

      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={handleImport} 
        lang={lang} 
      />

      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-5xl w-full flex items-center justify-center">
            <button 
              className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2 bg-white/10 rounded-full backdrop-blur-md"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10" 
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
