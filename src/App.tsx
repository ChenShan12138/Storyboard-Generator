import React, { useState, useEffect } from 'react';
import { Script, StoryboardPanel, Asset, AssetCategory } from './types';
import { InputView } from './components/InputView';
import { StoryboardView } from './components/StoryboardView';
import { AssetView } from './components/AssetView';
import { SettingsModal } from './components/SettingsModal';
import { DocsModal } from './components/DocsModal';
import { generateStoryboardImages, selectRelevantAssets } from './services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import { Language, t } from './translations';
import localforage from 'localforage';
import { FileVideo, Plus, Trash2, Edit2, Check, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState<Language>('zh');
  const [view, setView] = useState<'assets' | 'storyboard' | 'video' | 'view_storyboard'>('view_storyboard');
  
  const [scripts, setScripts] = useState<Script[]>([]);
  const [currentScriptId, setCurrentScriptId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingScriptNameId, setEditingScriptNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isServerHealthy, setIsServerHealthy] = useState(true);

  // Monitor server health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        setIsServerHealthy(res.ok);
      } catch (e) {
        setIsServerHealthy(false);
      }
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load scripts from localforage
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedScripts = await localforage.getItem<Script[]>('storyboard_scripts');
        if (savedScripts && savedScripts.length > 0) {
          const sanitizedScripts = savedScripts.map(script => ({
            ...script,
            panels: (script.panels || []).map(panel => ({
              ...panel,
              generatedImages: panel.generatedImages || []
            })),
            assets: script.assets || []
          }));
          setScripts(sanitizedScripts);
          setCurrentScriptId(sanitizedScripts[0].id);
        } else {
          createNewScript();
        }
      } catch (e) {
        console.error("Failed to load scripts", e);
        createNewScript();
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Save scripts to localforage
  useEffect(() => {
    if (!isLoading && scripts.length > 0) {
      localforage.setItem('storyboard_scripts', scripts).catch(e => console.error("Failed to save scripts", e));
    }
  }, [scripts, isLoading]);

  const createNewScript = () => {
    const newScript: Script = {
      id: uuidv4(),
      name: t[lang].untitledScript,
      panels: [
        {
          id: uuidv4(),
          sceneShotNumber: t[lang].defaultSceneShot,
          coreVisualContent: t[lang].defaultCoreVisual,
          opticalParameters: t[lang].defaultOptical,
          shotSize: t[lang].defaultShotSize,
          cameraMovement: t[lang].defaultCameraMovement,
          compositionRequirements: t[lang].defaultComposition,
          lightingColorStyle: t[lang].defaultLighting,
          physicalAiConstraints: t[lang].defaultConstraints,
          modificationSuggestions: '',
          imagePrompt: '',
          generatedImages: [],
          selectedImageIndex: 0,
          status: 'idle'
        }
      ],
      assets: [],
      categories: [
        { id: uuidv4(), name: lang === 'zh' ? '场景' : 'Scene' },
        { id: uuidv4(), name: lang === 'zh' ? '角色' : 'Character' },
        { id: uuidv4(), name: lang === 'zh' ? '道具' : 'Prop' }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setScripts(prev => [...prev, newScript]);
    setCurrentScriptId(newScript.id);
    setView('input');
  };

  const deleteScript = (id: string) => {
    if (scripts.length <= 1) {
      // Don't delete the last script, just reset it
      const newScript: Script = {
        id: uuidv4(),
        name: t[lang].untitledScript,
        panels: [],
        assets: [],
        categories: [
          { id: uuidv4(), name: lang === 'zh' ? '场景' : 'Scene' },
          { id: uuidv4(), name: lang === 'zh' ? '角色' : 'Character' },
          { id: uuidv4(), name: lang === 'zh' ? '道具' : 'Prop' }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setScripts([newScript]);
      setCurrentScriptId(newScript.id);
      return;
    }
    
    const newScripts = scripts.filter(s => s.id !== id);
    setScripts(newScripts);
    if (currentScriptId === id) {
      setCurrentScriptId(newScripts[0].id);
    }
  };

  const updateCurrentScript = (updates: Partial<Script>) => {
    setScripts(prev => (prev || []).map(s => s.id === currentScriptId ? { ...s, ...updates, updatedAt: Date.now() } : s));
  };

  const handleUpdateScript = (updatedScript: Script) => {
    setScripts(prev => (prev || []).map(s => s.id === updatedScript.id ? updatedScript : s));
  };

  const handleSetPanels = (action: React.SetStateAction<StoryboardPanel[]>) => {
    if (!currentScript) return;
    const newPanels = typeof action === 'function' ? action(currentScript.panels || []) : action;
    updateCurrentScript({ panels: newPanels });
  };

  const handleSetAssets = (action: React.SetStateAction<Asset[]>) => {
    if (!currentScript) return;
    const newAssets = typeof action === 'function' ? action(currentScript.assets || []) : action;
    updateCurrentScript({ assets: newAssets });
  };

  const handleSetCategories = (action: React.SetStateAction<AssetCategory[]>) => {
    if (!currentScript) return;
    const newCategories = typeof action === 'function' ? action(currentScript.categories || []) : action;
    updateCurrentScript({ categories: newCategories });
  };

  const currentScript = scripts.find(s => s.id === currentScriptId);

  const handleGenerateSingle = async (id: string) => {
    if (!currentScript) return;
    
    const apiKey = localStorage.getItem('custom_gemini_api_key') || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }

    const panel = (currentScript.panels || []).find(p => p.id === id);
    if (!panel) return;

    updateCurrentScript({
      panels: (currentScript.panels || []).map(p => p.id === id ? { ...p, status: 'generating', error: undefined } : p)
    });

    try {
      const prompt = panel.imagePrompt.trim() || `${panel.coreVisualContent}. ${panel.compositionRequirements}. ${panel.lightingColorStyle}. ${panel.opticalParameters}. ${panel.shotSize}. ${panel.cameraMovement}. Cinematic lighting, storyboard style, detailed.`;
      
      // 1. Select relevant assets using LLM
      let relevantAssetIds: string[] = [];
      let referenceImages: string[] = [...(panel.referenceImages || [])];
      
      if ((currentScript.assets || []).length > 0) {
        relevantAssetIds = await selectRelevantAssets(prompt, currentScript.assets || []);
        const assetImages = (currentScript.assets || [])
          .filter(a => relevantAssetIds.includes(a.id))
          .flatMap(a => a.images || []); // Use all images from selected assets
        referenceImages = [...referenceImages, ...assetImages];
      }

      // 2. Generate images with the selected assets as reference
      const images = await generateStoryboardImages(prompt, referenceImages);
      
      setScripts(prev => (prev || []).map(s => {
        if (s.id !== currentScriptId) return s;
        return {
          ...s,
          updatedAt: Date.now(),
          panels: (s.panels || []).map(p => p.id === id ? { 
            ...p, 
            status: 'done', 
            generatedImages: [...(p.generatedImages || []), ...images],
            selectedImageIndex: (p.generatedImages || []).length,
            usedAssetIds: relevantAssetIds
          } : p)
        };
      }));
    } catch (error: any) {
      console.error(error);
      let errorMessage = error.message || 'Failed to generate images';
      try {
        const parsedError = JSON.parse(errorMessage);
        if (parsedError?.error?.message) {
          errorMessage = parsedError.error.message;
        }
      } catch (e) {
        // Ignore JSON parse error, use original message
      }
      
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = "API Quota Exceeded. Please click 'Settings' to enter a valid Gemini API Key.";
      } else if (errorMessage.includes('503') || errorMessage.includes('504') || errorMessage.includes('Deadline expired') || errorMessage.includes('UNAVAILABLE')) {
        errorMessage = "The AI service is currently busy or timed out. Please try again in a moment.";
      }

      setScripts(prev => (prev || []).map(s => {
        if (s.id !== currentScriptId) return s;
        return {
          ...s,
          panels: (s.panels || []).map(p => p.id === id ? { 
            ...p, 
            status: 'error', 
            error: errorMessage 
          } : p)
        };
      }));
    }
  };

  const handleGenerateAll = async () => {
    if (!currentScript) return;
    const panelsToGenerate = (currentScript.panels || []).filter(p => p.status !== 'generating');
    
    // Generate sequentially to avoid rate limits
    for (const panel of panelsToGenerate) {
      await handleGenerateSingle(panel.id);
    }
  };

  const toggleLang = () => setLang(l => l === 'en' ? 'zh' : 'en');

  const startEditingName = (script: Script) => {
    setEditingScriptNameId(script.id);
    setEditingName(script.name);
  };

  const saveEditingName = () => {
    if (editingScriptNameId && editingName.trim()) {
      setScripts(prev => prev.map(s => s.id === editingScriptNameId ? { ...s, name: editingName.trim(), updatedAt: Date.now() } : s));
    }
    setEditingScriptNameId(null);
  };

  if (isLoading || !currentScript) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">
      {/* Sidebar for Script Management */}
      <div className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out print:hidden relative`}>
        <div className={`p-4 border-b border-gray-200 flex ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} items-center h-16`}>
          {!isSidebarCollapsed && (
            <h2 className="font-bold text-gray-900 flex items-center overflow-hidden whitespace-nowrap">
              <FileVideo className="w-5 h-5 mr-2 text-indigo-600 flex-shrink-0" />
              {t[lang].scripts}
            </h2>
          )}
          <div className="flex items-center">
            {!isSidebarCollapsed && (
              <button onClick={createNewScript} className="p-1 text-gray-500 hover:text-indigo-600 transition-colors mr-1" title={t[lang].newScript}>
                <Plus className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
              className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          </div>
        </div>
        
        {isSidebarCollapsed && (
          <div className="p-2 border-b border-gray-100 flex justify-center">
            <button onClick={createNewScript} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title={t[lang].newScript}>
              <Plus className="w-6 h-6" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {(scripts || []).map(script => (
            <div 
              key={script.id}
              className={`group flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} p-2 rounded-md cursor-pointer transition-colors ${script.id === currentScriptId ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-100 text-gray-700'}`}
              onClick={() => {
                setCurrentScriptId(script.id);
                setView('view_storyboard');
              }}
              title={isSidebarCollapsed ? script.name : undefined}
            >
              {isSidebarCollapsed ? (
                <FileVideo className={`w-5 h-5 ${script.id === currentScriptId ? 'text-indigo-600' : 'text-gray-400'}`} />
              ) : (
                editingScriptNameId === script.id ? (
                  <div className="flex items-center w-full" onClick={e => e.stopPropagation()}>
                    <input 
                      type="text" 
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEditingName()}
                      autoFocus
                      className="flex-1 min-w-0 px-1 py-0.5 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button onClick={saveEditingName} className="ml-1 text-indigo-600 hover:text-indigo-800">
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="truncate text-sm font-medium flex-1">{script.name}</span>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); startEditingName(script); }}
                        className="p-1 text-gray-400 hover:text-indigo-600"
                        title={t[lang].renameScript}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteScript(script.id); }}
                        className="p-1 text-gray-400 hover:text-red-600 ml-1"
                        title={t[lang].deleteScript}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {!isServerHealthy && (
          <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-xs py-1 px-4 text-center z-[100] animate-pulse">
            {lang === 'zh' ? '后端服务连接不稳定，正在尝试重新连接...' : 'Server connection unstable, retrying...'}
          </div>
        )}
        
        {/* Top Navigation Tabs */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setView('view_storyboard')}
              className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${view === 'view_storyboard' ? 'bg-black text-white shadow-lg scale-105' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              {lang === 'zh' ? '分镜板' : 'Storyboard Board'}
            </button>
            
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setView('assets')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === 'assets' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}
              >
                {lang === 'zh' ? '资产' : 'Assets'}
              </button>
              <button
                onClick={() => setView('storyboard')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === 'storyboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}
              >
                {lang === 'zh' ? '分镜' : 'Storyboard'}
              </button>
              <button
                onClick={() => setView('video')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === 'video' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}
              >
                {lang === 'zh' ? '视频' : 'Video'}
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={toggleLang} className="text-gray-600 hover:text-gray-900 font-medium px-3 py-1">
              {t[lang].langToggle}
            </button>
            <button
              onClick={() => setIsDocsOpen(true)}
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              {t[lang].documentation}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              {t[lang].settings}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {view === 'assets' && (
            <AssetView 
              assets={currentScript.assets || []}
              setAssets={handleSetAssets}
              categories={currentScript.categories || []}
              setCategories={handleSetCategories}
              lang={lang}
            />
          )}
          {view === 'storyboard' && (
            <InputView 
              panels={currentScript.panels || []} 
              setPanels={handleSetPanels} 
              assets={currentScript.assets || []}
              setAssets={handleSetAssets}
              categories={currentScript.categories || []}
              systemPrompt={currentScript.systemPrompt || ''}
              setSystemPrompt={(val) => handleUpdateScript({ ...currentScript, systemPrompt: val })}
              onGenerateAll={handleGenerateAll}
              onGenerateSingle={handleGenerateSingle}
              onGoToStoryboard={() => setView('view_storyboard')}
              lang={lang}
            />
          )}
          {view === 'view_storyboard' && (
            <StoryboardView 
              panels={currentScript.panels || []}
              assets={currentScript.assets || []}
              categories={currentScript.categories || []}
              onBack={() => setView('storyboard')}
              lang={lang}
              onToggleLang={toggleLang}
            />
          )}
          {view === 'video' && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-white">
              <FileVideo className="w-16 h-16 mb-4 text-gray-300" />
              <h2 className="text-2xl font-semibold mb-2">{lang === 'zh' ? '视频生成' : 'Video Generation'}</h2>
              <p>{lang === 'zh' ? '此功能即将推出，敬请期待...' : 'Coming soon, stay tuned...'}</p>
            </div>
          )}
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        lang={lang} 
      />

      <DocsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
        lang={lang}
      />
    </div>
  );
}
