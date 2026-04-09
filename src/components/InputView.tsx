import React, { useState } from 'react';
import { StoryboardPanel, Asset } from '../types';
import { Plus, Trash2, Image as ImageIcon, Loader2, ChevronDown, ChevronUp, Table, Settings as SettingsIcon, BookOpen, Download, X, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Language, t } from '../translations';
import { ImportModal } from './ImportModal';

interface InputViewProps {
  panels: StoryboardPanel[];
  setPanels: React.Dispatch<React.SetStateAction<StoryboardPanel[]>>;
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  onGenerateAll: () => void;
  onGenerateSingle: (id: string) => void;
  onGoToStoryboard: () => void;
  lang: Language;
  onToggleLang: () => void;
  onOpenSettings: () => void;
  onOpenDocs: () => void;
}

export function InputView({ panels, setPanels, assets, setAssets, onGenerateAll, onGenerateSingle, onGoToStoryboard, lang, onToggleLang, onOpenSettings, onOpenDocs }: InputViewProps) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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
      status: 'idle'
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

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
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
    
    // Reset input
    e.target.value = '';
  };

  const removeReferenceImage = (panelId: string, index: number) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel) return;
    const newImages = [...(panel.referenceImages || [])];
    newImages.splice(index, 1);
    updatePanel(panelId, 'referenceImages', newImages);
  };

  const [dragOverPanelId, setDragOverPanelId] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, panelId: string) => {
    e.preventDefault();
    setDragOverPanelId(panelId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPanelId(null);
  };

  const handleDrop = async (e: React.DragEvent, panelId: string) => {
    e.preventDefault();
    setDragOverPanelId(null);
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const imageFiles = (Array.from(files) as File[]).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const newImages: string[] = [];
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const reader = new FileReader();
      const promise = new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
      });
      reader.readAsDataURL(file);
      newImages.push(await promise);
    }

    const panel = panels.find(p => p.id === panelId);
    if (panel) {
      const existingImages = panel.referenceImages || [];
      updatePanel(panelId, 'referenceImages', [...existingImages, ...newImages]);
    }
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
      } else {
        alert(lang === 'zh' ? '未找到相关资产' : 'No relevant assets found');
      }
    } catch (error) {
      console.error(error);
      alert(lang === 'zh' ? '智能关联失败' : 'Intelligent associate failed');
    } finally {
      setIsAssociating(prev => ({ ...prev, [panelId]: false }));
    }
  };

  const isGenerating = panels.some(p => p.status === 'generating');

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t[lang].title}</h1>
        <div className="space-x-4 flex items-center">
          <button onClick={onToggleLang} className="text-gray-600 hover:text-gray-900 font-medium px-3 py-1">
            {t[lang].langToggle}
          </button>
          <button
            onClick={onOpenDocs}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium transition-colors"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            {t[lang].documentation}
          </button>
          <button
            onClick={onOpenSettings}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium transition-colors"
          >
            <SettingsIcon className="w-4 h-4 mr-2" />
            {t[lang].settings}
          </button>
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700 border-collapse min-w-[1200px]">
            <thead className="text-xs text-gray-900 bg-gray-100 border-b border-gray-300">
              <tr>
                <th className="px-2 py-3 border-r border-gray-300 w-10 text-center">#</th>
                <th className="px-2 py-3 border-r border-gray-300 w-12 text-center">{lang === 'zh' ? '显示' : 'Show'}</th>
                <th className="px-2 py-3 border-r border-gray-300 w-24">{t[lang].sceneShotNumber}</th>
                <th className="px-2 py-3 border-r border-gray-300 w-32">{t[lang].sceneTitle}</th>
                <th className="px-2 py-3 border-r border-gray-300 w-48">{t[lang].sceneDescription}</th>
                <th className="px-2 py-3 border-r border-gray-300 w-32">{t[lang].dialogue}</th>
                <th className="px-2 py-3 border-r border-gray-300 w-48">{t[lang].coreVisualContent}</th>
                <th className="px-2 py-3 border-r border-gray-300 w-32">{t[lang].opticalParameters}</th>
                <th className="px-2 py-3 border-r border-gray-300 w-24">{t[lang].shotSize}</th>
                <th className="px-2 py-3 border-r border-gray-300 w-24">{t[lang].cameraMovement}</th>
                <th className="px-2 py-3 border-r border-gray-300 w-48">{t[lang].compositionRequirements}</th>
                <th className="px-2 py-3 border-r border-gray-300 w-40">{t[lang].lightingColorStyle}</th>
                <th className="px-2 py-3 border-r border-gray-300 w-40">{t[lang].physicalAiConstraints}</th>
                <th className="px-2 py-3 border-r border-gray-300 w-32">{t[lang].modificationSuggestions}</th>
                <th className="px-2 py-3 w-64">AI Generation</th>
              </tr>
            </thead>
            <tbody>
              {(panels || []).map((panel, index) => (
                <tr key={panel.id} className="border-b border-gray-200 hover:bg-gray-50 group align-top">
                  <td className="px-1 py-2 border-r border-gray-200 text-center relative">
                    <span className="group-hover:hidden text-gray-500">{index + 1}</span>
                    <button 
                      onClick={() => removePanel(panel.id)}
                      className="hidden group-hover:flex items-center justify-center w-full text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="px-1 py-2 border-r border-gray-200 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={panel.showInStoryboard !== false}
                      onChange={(e) => updatePanel(panel.id, 'showInStoryboard', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200">
                    <textarea
                      value={panel.sceneShotNumber}
                      onChange={(e) => updatePanel(panel.id, 'sceneShotNumber', e.target.value)}
                      placeholder={t[lang].sceneShotPlaceholder}
                      className="w-full h-full min-h-[120px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200">
                    <textarea
                      value={panel.sceneTitle}
                      onChange={(e) => updatePanel(panel.id, 'sceneTitle', e.target.value)}
                      placeholder={t[lang].sceneTitlePlaceholder}
                      className="w-full h-full min-h-[120px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200">
                    <textarea
                      value={panel.sceneDescription}
                      onChange={(e) => updatePanel(panel.id, 'sceneDescription', e.target.value)}
                      placeholder={t[lang].sceneDescriptionPlaceholder}
                      className="w-full h-full min-h-[120px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200">
                    <textarea
                      value={panel.dialogue}
                      onChange={(e) => updatePanel(panel.id, 'dialogue', e.target.value)}
                      placeholder={t[lang].dialoguePlaceholder}
                      className="w-full h-full min-h-[120px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200">
                    <textarea
                      value={panel.coreVisualContent}
                      onChange={(e) => updatePanel(panel.id, 'coreVisualContent', e.target.value)}
                      placeholder={t[lang].coreVisualPlaceholder}
                      className="w-full h-full min-h-[120px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200">
                    <textarea
                      value={panel.opticalParameters}
                      onChange={(e) => updatePanel(panel.id, 'opticalParameters', e.target.value)}
                      placeholder={t[lang].opticalPlaceholder}
                      className="w-full h-full min-h-[120px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200">
                    <textarea
                      value={panel.shotSize}
                      onChange={(e) => updatePanel(panel.id, 'shotSize', e.target.value)}
                      placeholder={t[lang].shotSizePlaceholder}
                      className="w-full h-full min-h-[120px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200">
                    <textarea
                      value={panel.cameraMovement}
                      onChange={(e) => updatePanel(panel.id, 'cameraMovement', e.target.value)}
                      placeholder={t[lang].cameraMovementPlaceholder}
                      className="w-full h-full min-h-[120px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200">
                    <textarea
                      value={panel.compositionRequirements}
                      onChange={(e) => updatePanel(panel.id, 'compositionRequirements', e.target.value)}
                      placeholder={t[lang].compositionPlaceholder}
                      className="w-full h-full min-h-[120px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200">
                    <textarea
                      value={panel.lightingColorStyle}
                      onChange={(e) => updatePanel(panel.id, 'lightingColorStyle', e.target.value)}
                      placeholder={t[lang].lightingPlaceholder}
                      className="w-full h-full min-h-[120px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200">
                    <textarea
                      value={panel.physicalAiConstraints}
                      onChange={(e) => updatePanel(panel.id, 'physicalAiConstraints', e.target.value)}
                      placeholder={t[lang].constraintsPlaceholder}
                      className="w-full h-full min-h-[120px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200">
                    <textarea
                      value={panel.modificationSuggestions}
                      onChange={(e) => updatePanel(panel.id, 'modificationSuggestions', e.target.value)}
                      placeholder={t[lang].suggestionsPlaceholder}
                      className="w-full h-full min-h-[120px] p-2 border-none focus:ring-1 focus:ring-indigo-500 resize-none bg-transparent"
                    />
                  </td>
                  <td className="p-2 flex flex-col gap-2 min-h-[120px]">
                    <div className="mb-2 border-b border-gray-200 pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{t[lang].associatedAsset}</span>
                        <button 
                          onClick={() => handleIntelligentAssociate(panel.id)}
                          disabled={isAssociating[panel.id]}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center disabled:opacity-50"
                        >
                          {isAssociating[panel.id] ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                          {t[lang].intelligentAssociate}
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mb-2">
                        {assets.map(asset => {
                          const isSelected = (panel.associatedAssets || []).some(a => a.assetId === asset.id);
                          return (
                            <button
                              key={asset.id}
                              onClick={() => {
                                const current = panel.associatedAssets || [];
                                if (isSelected) {
                                  updatePanel(panel.id, 'associatedAssets', current.filter(a => a.assetId !== asset.id));
                                } else {
                                  updatePanel(panel.id, 'associatedAssets', [...current, { assetId: asset.id }]);
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                                isSelected 
                                  ? 'bg-indigo-100 border-indigo-300 text-indigo-700' 
                                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {asset.name || 'Unnamed'}
                            </button>
                          );
                        })}
                      </div>

                      {(panel.associatedAssets || []).length > 0 && (
                        <div className="space-y-2">
                          {panel.associatedAssets!.map((assoc, idx) => {
                            const asset = assets.find(a => a.id === assoc.assetId);
                            if (!asset) return null;
                            return (
                              <div key={idx} className="border border-gray-100 rounded p-1 bg-gray-50/50">
                                <div className="text-[10px] font-medium text-gray-500 mb-1 truncate">{asset.name}</div>
                                <div className="flex flex-wrap gap-1">
                                  {asset.images?.map((img, imgIdx) => (
                                    <div 
                                      key={imgIdx} 
                                      onClick={() => {
                                        const newAssoc = [...(panel.associatedAssets || [])];
                                        newAssoc[idx] = { ...newAssoc[idx], image: img };
                                        updatePanel(panel.id, 'associatedAssets', newAssoc);
                                      }}
                                      className={`cursor-pointer w-8 h-8 border-2 rounded overflow-hidden ${assoc.image === img ? 'border-indigo-600' : 'border-transparent hover:border-gray-300'}`}
                                    >
                                      <img src={img} className="w-full h-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div 
                      className={`mb-2 p-1 rounded transition-colors ${dragOverPanelId === panel.id ? 'bg-indigo-50 border border-indigo-300' : 'border border-transparent'}`}
                      onDragOver={(e) => handleDragOver(e, panel.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, panel.id)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{t[lang].referenceImages}</span>
                        <label className="cursor-pointer text-indigo-600 hover:text-indigo-800 flex items-center text-[10px]">
                          <Upload className="w-3 h-3 mr-1" /> {dragOverPanelId === panel.id ? 'Drop here' : t[lang].uploadReference}
                          <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleReferenceUpload(panel.id, e)} />
                        </label>
                      </div>
                      {(panel.referenceImages || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {panel.referenceImages!.map((img, idx) => (
                            <div key={idx} className="relative group w-12 h-12">
                              <img src={img} className="w-full h-full object-cover rounded border border-gray-200 pointer-events-none" />
                              <button onClick={() => removeReferenceImage(panel.id, idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <textarea
                      value={panel.imagePrompt}
                      onChange={(e) => updatePanel(panel.id, 'imagePrompt', e.target.value)}
                      className="w-full p-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none h-16"
                      placeholder={t[lang].promptPlaceholder}
                    />
                    <button
                      onClick={() => onGenerateSingle(panel.id)}
                      disabled={panel.status === 'generating'}
                      className="w-full py-1 px-2 border border-indigo-600 text-indigo-600 rounded text-xs hover:bg-indigo-50 disabled:opacity-50 flex items-center justify-center font-medium transition-colors"
                    >
                      {panel.status === 'generating' ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> {t[lang].generating}</>
                      ) : (
                        <><ImageIcon className="w-3 h-3 mr-1" /> Generate</>
                      )}
                    </button>
                    {panel.error && (
                      <div className="text-[10px] text-red-600 bg-red-50 p-1 rounded">
                        {panel.error}
                      </div>
                    )}
                    {(panel.generatedImages || []).length > 0 && (
                      <div className="mt-2">
                        {(panel.generatedImages || []).map((img, imgIndex) => (
                          <div 
                            key={imgIndex} 
                            className="relative cursor-pointer rounded overflow-hidden border border-gray-300 transition-all group/img hover:border-indigo-500"
                            onClick={() => setPreviewImage(img)}
                          >
                            <img src={img} alt={`Generated`} className="w-full h-auto object-contain bg-gray-50" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(img, `panel-${panel.sceneShotNumber || index + 1}.png`);
                              }}
                              className="absolute top-1 right-1 p-1 bg-black bg-opacity-50 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-opacity-80"
                              title={t[lang].download}
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={addPanel}
        className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 flex items-center justify-center font-medium transition-colors"
      >
        <Plus className="w-5 h-5 mr-2" /> {t[lang].addNew}
      </button>

      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={handleImport} 
        lang={lang} 
      />

      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            <button 
              className="absolute -top-10 right-0 text-white hover:text-gray-300 p-2"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl" 
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
