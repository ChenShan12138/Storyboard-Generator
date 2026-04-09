import React from 'react';
import { StoryboardPanel, Asset } from '../types';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { Language, t } from '../translations';

interface StoryboardViewProps {
  panels: StoryboardPanel[];
  assets: Asset[];
  onBack: () => void;
  lang: Language;
  onToggleLang: () => void;
}

export function StoryboardView({ panels, assets, onBack, lang, onToggleLang }: StoryboardViewProps) {
  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter panels and assets based on showInStoryboard
  const filteredPanels = panels.filter(p => p.showInStoryboard !== false);
  const filteredAssets = assets.filter(a => a.showInStoryboard !== false);

  // Group panels by scene
  const scenes: { [key: string]: StoryboardPanel[] } = {};
  filteredPanels.forEach(panel => {
    const sceneKey = panel.sceneTitle || 'SCENE 1';
    if (!scenes[sceneKey]) {
      scenes[sceneKey] = [];
    }
    scenes[sceneKey].push(panel);
  });

  const characters = filteredAssets.filter(a => a.type === 'character');
  const supplementary = filteredAssets.filter(a => a.type !== 'character');

  return (
    <div className="min-h-screen bg-black text-white font-sans p-8 selection:bg-indigo-500/30">
      {/* Navigation - Hidden in Print */}
      <div className="flex justify-between items-center mb-12 print:hidden">
        <button
          onClick={onBack}
          className="flex items-center text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" /> {t[lang].back}
        </button>
        <div className="space-x-4 flex items-center">
          <button onClick={onToggleLang} className="text-gray-400 hover:text-white font-medium px-3 py-1">
            {t[lang].langToggle}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center px-4 py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors font-medium"
          >
            <Printer className="w-4 h-4 mr-2" /> {t[lang].print}
          </button>
        </div>
      </div>

      {/* PDF Header */}
      <div className="border-b border-gray-800 pb-4 mb-12">
        <h1 className="text-2xl font-light tracking-widest uppercase mb-1">
          {lang === 'zh' ? '先导片 故事板' : 'STORYBOARD PACKAGE'}
        </h1>
        <p className="text-xs text-gray-500 tracking-[0.2em] uppercase">
          {lang === 'zh' ? 'STORYBOARD PACKAGE | 2026年4月' : 'STORYBOARD PACKAGE | APRIL 2026'}
        </p>
      </div>

      {/* CHARACTER Section */}
      {characters.length > 0 && (
        <section className="mb-16">
          <h2 className="text-sm font-medium tracking-widest uppercase text-gray-400 mb-6 border-l-2 border-indigo-500 pl-3">
            CHARACTER
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {characters.map(asset => (
              <div key={asset.id} className="space-y-3">
                <div className="aspect-[16/9] bg-gray-900 rounded overflow-hidden border border-gray-800">
                  {asset.images?.[0] ? (
                    <img src={asset.images[0]} alt={asset.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">NO IMAGE</div>
                  )}
                </div>
                <p className="text-center text-xs text-gray-300 tracking-wider">{asset.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SUPPLEMENTARY Section */}
      {supplementary.length > 0 && (
        <section className="mb-24">
          <h2 className="text-sm font-medium tracking-widest uppercase text-gray-400 mb-6 border-l-2 border-indigo-500 pl-3">
            SUPPLEMENTARY
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {supplementary.map(asset => (
              <div key={asset.id} className="space-y-3">
                <div className="aspect-[16/9] bg-gray-900 rounded overflow-hidden border border-gray-800">
                  {asset.images?.[0] ? (
                    <img src={asset.images[0]} alt={asset.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">NO IMAGE</div>
                  )}
                </div>
                <p className="text-center text-xs text-gray-300 tracking-wider">{asset.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* STORYBOARD Section */}
      <section>
        <h2 className="text-sm font-medium tracking-widest uppercase text-gray-400 mb-12 border-l-2 border-indigo-500 pl-3">
          STORYBOARD
        </h2>

        {Object.entries(scenes).map(([sceneTitle, scenePanels], sceneIdx) => (
          <div key={sceneIdx} className="mb-24 break-inside-avoid">
            <div className="mb-8">
              <h3 className="text-lg font-medium tracking-widest uppercase text-white mb-2">
                {sceneTitle.toUpperCase()}
              </h3>
              {scenePanels[0]?.sceneDescription && (
                <p className="text-sm text-gray-400 max-w-4xl leading-relaxed mb-4">
                  {scenePanels[0].sceneDescription}
                </p>
              )}
              {scenePanels[0]?.dialogue && (
                <div className="space-y-1">
                  {scenePanels[0].dialogue.split('\n').map((line, lIdx) => (
                    <p key={lIdx} className={`text-xs font-medium ${lIdx % 2 === 0 ? 'text-cyan-400' : 'text-blue-400'}`}>
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
              {scenePanels.map((panel, pIdx) => {
                const currentImageUrl = (panel.generatedImages || [])[panel.selectedImageIndex || 0];
                return (
                  <div key={panel.id} className="space-y-4">
                    <div className="aspect-[16/9] bg-gray-900 rounded overflow-hidden border border-gray-800 relative group">
                      {currentImageUrl ? (
                        <>
                          <img 
                            src={currentImageUrl} 
                            alt={`Shot ${pIdx + 1}`} 
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => handleDownload(currentImageUrl, `shot-${panel.sceneShotNumber || pIdx + 1}.png`)}
                            className="absolute bottom-2 right-2 p-2 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black print:hidden"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">
                          {t[lang].noImage}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-500">
                        SHOT {panel.sceneShotNumber || pIdx + 1}
                      </h4>
                      <p className="text-xs text-gray-300 leading-relaxed line-clamp-4">
                        {panel.coreVisualContent}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Page Number Placeholder for Print */}
      <div className="hidden print:block fixed bottom-4 right-8 text-[10px] text-gray-600 font-mono">
        1
      </div>
    </div>
  );
}
