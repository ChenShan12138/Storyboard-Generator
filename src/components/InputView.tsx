import React, { useState, useRef } from 'react';
import { StoryboardPanel, Asset, AssetCategory } from '../types';
import { Plus, Trash2, Image as ImageIcon, Loader2, ChevronDown, ChevronUp, Table, Settings as SettingsIcon, BookOpen, Download, X, Upload, Search, Check, ChevronRight, Edit3 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Language, t } from '../translations';
import { ImportModal } from './ImportModal';
import { motion } from 'motion/react';

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
  const [isSystemPromptModalOpen, setIsSystemPromptModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activeAssetSelector, setActiveAssetSelector] = useState<string | null>(null);

  const handleSystemPromptChange = (val: string) => {
    setSystemPrompt(val);
  };

  const PROMPT_TEMPLATES = [
    {
      id: 'optical',
      name: t[lang].templateOptical,
      keywords: 'ARRI ALEXA 65, 35mm Anamorphic, f/2.8, Shallow DOF, Macro, Wide-angle',
      description: lang === 'zh' ? '摄影机型号、焦段、光圈、镜头类型、深浅。' : 'Camera model, focal length, aperture, lens type, depth of field.'
    },
    {
      id: 'movement',
      name: t[lang].templateMovement,
      keywords: 'Slow push-in, Tracking, God\'s eye view, Handheld shake',
      description: lang === 'zh' ? '摄影机运动轨迹、速度、稳定性。' : 'Camera trajectory, speed, stability.'
    },
    {
      id: 'subject',
      name: t[lang].templateSubject,
      keywords: 'Hyper-detailed, intricate textures, specific era (1990s/Modern)',
      description: lang === 'zh' ? '角色身份、服装材质、具体动作、神态细节。' : 'Character identity, clothing material, specific actions, expression details.'
    },
    {
      id: 'lighting',
      name: t[lang].templateLighting,
      keywords: '6500K Cool White, Volumetric lighting, Teal & Orange, High contrast',
      description: lang === 'zh' ? '光源性质、色温(K)、色彩分级、对比度。' : 'Light source quality, color temperature (K), color grading, contrast.'
    },
    {
      id: 'environment',
      name: t[lang].templateEnvironment,
      keywords: 'Marine snow, Fluid dynamics, Buoyancy, Floating debris',
      description: lang === 'zh' ? '介质(水/雾)、颗粒物、流体交互、重力感。' : 'Medium (water/fog), particles, fluid interaction, gravity.'
    },
    {
      id: 'quality',
      name: t[lang].templateQuality,
      keywords: 'IMAX quality, 8k, Fine film grain, Motion blur',
      description: lang === 'zh' ? '底片质感、分辨率、动态模糊。' : 'Film texture, resolution, motion blur.'
    },
    {
      id: 'negative',
      name: t[lang].templateNegative,
      keywords: 'No AI morphing, No flat lighting, No flickering, No cartoonish',
      description: lang === 'zh' ? '明确禁止的 AI 常见错误。' : 'Common AI errors to avoid.'
    }
  ];

  const FULL_STRUCTURE_PROMPT = [
    `(Camera) ${PROMPT_TEMPLATES.find(t => t.id === 'optical')?.keywords}`,
    `(Movement) ${PROMPT_TEMPLATES.find(t => t.id === 'movement')?.keywords}`,
    `(Subject) ${PROMPT_TEMPLATES.find(t => t.id === 'subject')?.keywords}`,
    `(Lighting) ${PROMPT_TEMPLATES.find(t => t.id === 'lighting')?.keywords}`,
    `(Environment) ${PROMPT_TEMPLATES.find(t => t.id === 'environment')?.keywords}`,
    `(Negative) ${PROMPT_TEMPLATES.find(t => t.id === 'negative')?.keywords}`
  ].join('\n');

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
    setPanels(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const updatePanelMultiple = (id: string, updates: Partial<StoryboardPanel>) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
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

  const processStoryboardFiles = async (panelId: string, files: File[]) => {
    const newImages: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      const promise = new Promise<string>((resolve) => {
        reader.onload = (ev) => resolve(ev.target?.result as string);
      });
      reader.readAsDataURL(file);
      newImages.push(await promise);
    }

    const panel = panels.find(p => p.id === panelId);
    if (panel) {
      const existing = panel.generatedImages || [];
      updatePanelMultiple(panelId, {
        generatedImages: [...existing, ...newImages],
        status: 'done'
      });
    }
  };

  const handleStoryboardDrop = async (e: React.DragEvent, panelId: string) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length > 0) {
      await processStoryboardFiles(panelId, files);
    }
  };

  const deleteGeneratedImage = (panelId: string, imageIndex: number) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel) return;
    const newImages = [...(panel.generatedImages || [])];
    newImages.splice(imageIndex, 1);
    updatePanelMultiple(panelId, {
      generatedImages: newImages,
      status: newImages.length === 0 ? 'idle' : panel.status
    });
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
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center">
          {t[lang].title}
          <span className="ml-3 text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded-full align-middle">v1.0.2</span>
        </h1>
        <div className="space-x-3 flex items-center">
          <button
            onClick={() => setIsSystemPromptModalOpen(true)}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium transition-colors"
          >
            <SettingsIcon className="w-4 h-4 mr-2 text-indigo-600" />
            {t[lang].storyboardGenSettings}
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
                  <td 
                    className="p-3"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleStoryboardDrop(e, panel.id)}
                  >
                    <div className="space-y-3">
                      {(panel.generatedImages || []).length > 0 ? (
                        <div className="space-y-3">
                          {(panel.generatedImages || []).map((img, imgIdx) => (
                            <div key={imgIdx} className="relative group/img rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-[16/9] bg-gray-50">
                              <img 
                                src={img} 
                                alt={`Generated ${imgIdx}`} 
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={() => setPreviewImage(img)}
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                                <button
                                  onClick={() => setPreviewImage(img)}
                                  className="w-8 h-8 flex items-center justify-center bg-white text-gray-900 rounded-full hover:bg-gray-100 transition-all transform hover:scale-110 shadow-lg"
                                  title={t[lang].viewLarge}
                                >
                                  <Search className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDownload(img, `panel-${panel.sceneShotNumber || index + 1}-${imgIdx + 1}.png`)}
                                  className="w-8 h-8 flex items-center justify-center bg-white text-gray-900 rounded-full hover:bg-gray-100 transition-all transform hover:scale-110 shadow-lg"
                                  title={t[lang].download}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteGeneratedImage(panel.id, imgIdx)}
                                  className="w-8 h-8 flex items-center justify-center bg-white text-red-600 rounded-full hover:bg-red-50 transition-all transform hover:scale-110 shadow-lg"
                                  title={t[lang].deleteImage}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => onGenerateSingle(panel.id)}
                            disabled={panel.status === 'generating'}
                            className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center justify-center border border-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {panel.status === 'generating' ? (
                              <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> {t[lang].generating}</>
                            ) : (
                              <><ImageIcon className="w-3 h-3 mr-2" /> {t[lang].regenerate}</>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button
                            onClick={() => onGenerateSingle(panel.id)}
                            disabled={panel.status === 'generating'}
                            className="w-full aspect-[16/9] border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all group/gen disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {panel.status === 'generating' ? (
                              <><Loader2 className="w-6 h-6 mb-2 animate-spin" /> <span className="text-xs">{t[lang].generating}</span></>
                            ) : (
                              <><ImageIcon className="w-6 h-6 mb-2 group-hover/gen:scale-110 transition-transform" /> <span className="text-xs font-bold">{t[lang].generateImage}</span></>
                            )}
                          </button>
                          <label
                            htmlFor={`upload-storyboard-${panel.id}`}
                            className="w-full py-2 text-gray-500 hover:text-indigo-600 text-[10px] font-medium flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Upload className="w-3 h-3 mr-1" />
                            {t[lang].uploadStoryboard}
                          </label>
                          <input 
                            type="file" 
                            id={`upload-storyboard-${panel.id}`}
                            className="hidden" 
                            accept="image/*" 
                            multiple
                            onChange={(e) => {
                              if (e.target.files) {
                                processStoryboardFiles(panel.id, Array.from(e.target.files));
                                e.target.value = '';
                              }
                            }}
                          />
                        </div>
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

      {/* System Prompt Modal */}
      {isSystemPromptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <SettingsIcon className="w-5 h-5 mr-2 text-indigo-600" />
                  {t[lang].storyboardGenSettings}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{t[lang].systemPromptDesc}</p>
              </div>
              <button 
                onClick={() => setIsSystemPromptModalOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Prompt Templates Grid */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
                  <BookOpen className="w-4 h-4 mr-2 text-indigo-500" />
                  {t[lang].promptTemplates}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PROMPT_TEMPLATES.map(template => (
                    <div key={template.id} className="p-4 border border-gray-200 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-sm text-gray-900">{template.name}</span>
                        <button 
                          onClick={() => {
                            const newPrompt = systemPrompt ? `${systemPrompt}\n${template.keywords}` : template.keywords;
                            handleSystemPromptChange(newPrompt);
                          }}
                          className="text-[10px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter bg-indigo-100 px-2 py-0.5 rounded"
                        >
                          {t[lang].applyTemplate}
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">{template.description}</p>
                      <div className="text-[10px] font-mono text-indigo-500 bg-white p-2 rounded border border-indigo-50 leading-normal">
                        {template.keywords}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Full Template Structure */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
                  <Table className="w-4 h-4 mr-2 text-indigo-500" />
                  {t[lang].recommendedStructure}
                </h3>
                <div className="p-4 bg-gray-900 rounded-xl relative group border border-indigo-500/30 shadow-inner">
                  <div className="absolute -top-3 left-4 px-2 bg-indigo-600 text-[10px] text-white font-bold rounded uppercase tracking-widest">
                    {lang === 'zh' ? '一键生成全套提示词' : 'One-click Full Prompt'}
                  </div>
                  <code className="text-[11px] text-indigo-300 font-mono leading-relaxed block pr-24 whitespace-pre-wrap">
                    {FULL_STRUCTURE_PROMPT}
                  </code>
                  <button 
                    onClick={() => handleSystemPromptChange(FULL_STRUCTURE_PROMPT)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {t[lang].applyFullStructure}
                  </button>
                </div>
              </div>

              {/* System Prompt Input */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
                  <Edit3 className="w-4 h-4 mr-2 text-indigo-500" />
                  {t[lang].systemPrompt}
                </h3>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => handleSystemPromptChange(e.target.value)}
                  placeholder={lang === 'zh' ? '在此输入或从上方模板组合提示词...' : 'Enter your system prompt here or combine from templates above...'}
                  className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm h-48 bg-gray-50/30"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setIsSystemPromptModalOpen(false)}
                className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
              >
                {lang === 'zh' ? '保存并关闭' : 'Save & Close'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

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
