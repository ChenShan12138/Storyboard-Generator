export interface AssetCategory {
  id: string;
  name: string;
}

export interface Asset {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  images: string[];
  showInStoryboard?: boolean;
}

export interface StoryboardPanel {
  id: string;
  sceneShotNumber: string;
  sceneTitle?: string;
  sceneDescription?: string;
  dialogue?: string;
  coreVisualContent: string;
  opticalParameters: string;
  shotSize: string;
  cameraMovement: string;
  compositionRequirements: string;
  lightingColorStyle: string;
  physicalAiConstraints: string;
  modificationSuggestions: string;
  
  imagePrompt: string;
  generatedImages: string[];
  selectedImageIndex: number;
  status: 'idle' | 'generating' | 'done' | 'error';
  error?: string;
  usedAssetIds?: string[];
  referenceImages?: string[];
  associatedAssets?: { assetId: string, image?: string }[];
  showInStoryboard?: boolean;
}

export interface Script {
  id: string;
  name: string;
  panels: StoryboardPanel[];
  assets: Asset[];
  categories: AssetCategory[];
  systemPrompt?: string;
  createdAt: number;
  updatedAt: number;
}

export type ApiProvider = 'gemini' | 'openai' | 'nanobanana';

export interface ApiConfig {
  provider: ApiProvider;
  geminiKey?: string;
  openaiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
  nanobananaKey?: string;
  nanobananaModel?: string;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
