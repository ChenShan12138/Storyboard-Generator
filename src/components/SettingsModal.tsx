import React, { useState, useEffect } from 'react';
import { Language, t } from '../translations';
import { X, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { ApiProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export function SettingsModal({ isOpen, onClose, lang }: SettingsModalProps) {
  const [provider, setProvider] = useState<ApiProvider>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiBaseUrl, setGeminiBaseUrl] = useState('');
  const [geminiModel, setGeminiModel] = useState('');
  const [geminiAspectRatio, setGeminiAspectRatio] = useState('16:9');
  const [geminiImageSize, setGeminiImageSize] = useState('4K');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');
  const [openaiImageSize, setOpenaiImageSize] = useState('1024x1024');
  const [nanobananaKey, setNanobananaKey] = useState('');
  const [nanobananaModel, setNanobananaModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const [feishuAppId, setFeishuAppId] = useState('');
  const [feishuAppSecret, setFeishuAppSecret] = useState('');

  useEffect(() => {
    if (isOpen) {
      setProvider((localStorage.getItem('api_provider') as ApiProvider) || 'gemini');
      setGeminiKey(localStorage.getItem('custom_gemini_api_key') || '');
      setGeminiBaseUrl(localStorage.getItem('gemini_base_url') || '');
      setGeminiModel(localStorage.getItem('gemini_model') || 'gemini-3.1-flash-image-preview');
      setGeminiAspectRatio(localStorage.getItem('gemini_aspect_ratio') || '16:9');
      setGeminiImageSize(localStorage.getItem('gemini_image_size') || '4K');
      setOpenaiKey(localStorage.getItem('openai_api_key') || '');
      setOpenaiBaseUrl(localStorage.getItem('openai_base_url') || '');
      setOpenaiModel(localStorage.getItem('openai_model') || '');
      setOpenaiImageSize(localStorage.getItem('openai_image_size') || '1024x1024');
      setNanobananaKey(localStorage.getItem('nanobanana_api_key') || '');
      setNanobananaModel(localStorage.getItem('nanobanana_model') || 'nano-banana');
      setFeishuAppId(localStorage.getItem('feishu_app_id') || '');
      setFeishuAppSecret(localStorage.getItem('feishu_app_secret') || '');
      
      const savedModels = localStorage.getItem('openai_models_list');
      if (savedModels) {
        setModels(JSON.parse(savedModels));
      }
    }
  }, [isOpen]);

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

  const fetchModels = async () => {
    if (provider === 'gemini') {
      if (!geminiKey) return;
      setIsFetchingModels(true);
      try {
        const response = await fetchWithRetry('/api/gemini/models', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apiKey: geminiKey,
            baseUrl: geminiBaseUrl
          })
        });
        if (!response.ok) throw new Error('Failed to fetch models');
        const data = await response.json();
        
        // Handle standard Gemini API format or OpenAI compatible format
        let modelIds: string[] = [];
        if (data.models) {
          modelIds = data.models.map((m: any) => m.name.replace('models/', '')).sort();
        } else if (data.data) {
          modelIds = data.data.map((m: any) => m.id).sort();
        }

        setModels(modelIds);
        localStorage.setItem('gemini_models_list', JSON.stringify(modelIds));
        
        // Default to nano-banana-pro if available
        if (modelIds.includes('nano-banana-pro') || modelIds.includes('nano banana pro')) {
          const proModel = modelIds.includes('nano-banana-pro') ? 'nano-banana-pro' : 'nano banana pro';
          setGeminiModel(proModel);
        }

        alert(t[lang].fetchModelsSuccess);
      } catch (error) {
        console.error(error);
        alert(t[lang].fetchModelsError);
      } finally {
        setIsFetchingModels(false);
      }
    } else if (provider === 'openai') {
      if (!openaiKey) return;
      setIsFetchingModels(true);
      try {
        const response = await fetchWithRetry('/api/openai/models', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apiKey: openaiKey,
            baseUrl: openaiBaseUrl
          })
        });
        if (!response.ok) throw new Error('Failed to fetch models');
        const data = await response.json();
        const modelIds = data.data.map((m: any) => m.id).sort();
        setModels(modelIds);
        localStorage.setItem('openai_models_list', JSON.stringify(modelIds));
        alert(t[lang].fetchModelsSuccess);
      } catch (error) {
        console.error(error);
        alert(t[lang].fetchModelsError);
      } finally {
        setIsFetchingModels(false);
      }
    } else if (provider === 'nanobanana') {
      setIsFetchingModels(true);
      try {
        const response = await fetchWithRetry('/api/nanobanana/models');
        if (!response.ok) throw new Error('Failed to fetch models');
        const data = await response.json();
        const modelIds = data.data.map((m: any) => m.name).sort();
        setModels(modelIds);
        localStorage.setItem('nanobanana_models_list', JSON.stringify(modelIds));
        alert(t[lang].fetchModelsSuccess);
      } catch (error) {
        console.error(error);
        alert(t[lang].fetchModelsError);
      } finally {
        setIsFetchingModels(false);
      }
    }
  };

  const handleSave = () => {
    localStorage.setItem('api_provider', provider);
    
    if (geminiKey.trim()) {
      localStorage.setItem('custom_gemini_api_key', geminiKey.trim());
    } else {
      localStorage.removeItem('custom_gemini_api_key');
    }

    localStorage.setItem('gemini_base_url', geminiBaseUrl.trim());
    localStorage.setItem('gemini_model', geminiModel.trim());
    localStorage.setItem('gemini_aspect_ratio', geminiAspectRatio);
    localStorage.setItem('gemini_image_size', geminiImageSize);

    if (openaiKey.trim()) {
      localStorage.setItem('openai_api_key', openaiKey.trim());
    } else {
      localStorage.removeItem('openai_api_key');
    }

    localStorage.setItem('openai_base_url', openaiBaseUrl.trim());
    localStorage.setItem('openai_model', openaiModel.trim());
    localStorage.setItem('openai_image_size', openaiImageSize);

    if (nanobananaKey.trim()) {
      localStorage.setItem('nanobanana_api_key', nanobananaKey.trim());
    } else {
      localStorage.removeItem('nanobanana_api_key');
    }
    localStorage.setItem('nanobanana_model', nanobananaModel.trim());

    if (feishuAppId.trim()) {
      localStorage.setItem('feishu_app_id', feishuAppId.trim());
    } else {
      localStorage.removeItem('feishu_app_id');
    }

    if (feishuAppSecret.trim()) {
      localStorage.setItem('feishu_app_secret', feishuAppSecret.trim());
    } else {
      localStorage.removeItem('feishu_app_secret');
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <SettingsIcon className="w-5 h-5 mr-2" />
            {t[lang].settings}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">AI {t[lang].apiProvider}</h3>
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setProvider('gemini')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${provider === 'gemini' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Gemini
                </button>
                <button
                  onClick={() => setProvider('openai')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${provider === 'openai' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  OpenAI
                </button>
                <button
                  onClick={() => setProvider('nanobanana')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${provider === 'nanobanana' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Nano Banana
                </button>
              </div>

              {provider === 'gemini' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t[lang].apiKey}
                    </label>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder={t[lang].apiKeyPlaceholder}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      {t[lang].apiKeyDesc}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t[lang].geminiBaseUrl}
                    </label>
                    <input
                      type="text"
                      value={geminiBaseUrl}
                      onChange={(e) => setGeminiBaseUrl(e.target.value)}
                      placeholder="https://generativelanguage.googleapis.com/v1beta"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t[lang].geminiModel}
                    </label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={geminiModel}
                          onChange={(e) => setGeminiModel(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          list="gemini-models"
                          placeholder="gemini-3.1-flash-image-preview"
                        />
                        <datalist id="gemini-models">
                          <option value="gemini-3.1-flash-image-preview" />
                          <option value="gemini-2.5-flash-image" />
                          <option value="gemini-2.0-flash-exp" />
                          <option value="banana" />
                          <option value="banana pro" />
                          <option value="banana2" />
                          {models.map(m => <option key={m} value={m} />)}
                        </datalist>
                      </div>
                      <button
                        onClick={fetchModels}
                        disabled={isFetchingModels || !geminiKey}
                        className="p-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 disabled:opacity-50"
                        title={t[lang].fetchModels}
                      >
                        <RefreshCw className={`w-5 h-5 ${isFetchingModels ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t[lang].geminiAspectRatio}
                    </label>
                    <select
                      value={geminiAspectRatio}
                      onChange={(e) => setGeminiAspectRatio(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="1:1">1:1</option>
                      <option value="3:4">3:4</option>
                      <option value="4:3">4:3</option>
                      <option value="9:16">9:16</option>
                      <option value="16:9">16:9</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t[lang].imageResolution}
                    </label>
                    <select
                      value={geminiImageSize}
                      onChange={(e) => setGeminiImageSize(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="256">256</option>
                      <option value="512">512</option>
                      <option value="1024">1024</option>
                      <option value="4K">4K</option>
                    </select>
                  </div>
                </div>
              )}

              {provider === 'openai' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t[lang].openaiKey}
                    </label>
                    <input
                      type="password"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t[lang].openaiBaseUrl}
                    </label>
                    <input
                      type="text"
                      value={openaiBaseUrl}
                      onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t[lang].openaiModel}
                    </label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={openaiModel}
                          onChange={(e) => setOpenaiModel(e.target.value)}
                          placeholder="dall-e-3"
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          list="openai-models"
                        />
                        <datalist id="openai-models">
                          {models.map(m => <option key={m} value={m} />)}
                        </datalist>
                      </div>
                      <button
                        onClick={fetchModels}
                        disabled={isFetchingModels || !openaiKey}
                        className="p-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 disabled:opacity-50"
                        title={t[lang].fetchModels}
                      >
                        <RefreshCw className={`w-5 h-5 ${isFetchingModels ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t[lang].imageResolution}
                    </label>
                    <select
                      value={openaiImageSize}
                      onChange={(e) => setOpenaiImageSize(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="256x256">256x256</option>
                      <option value="512x512">512x512</option>
                      <option value="1024x1024">1024x1024</option>
                      <option value="1024x1792">1024x1792 (DALL-E 3)</option>
                      <option value="1792x1024">1792x1024 (DALL-E 3)</option>
                    </select>
                  </div>
                </div>
              )}

              {provider === 'nanobanana' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t[lang].nanobananaKey}
                    </label>
                    <input
                      type="password"
                      value={nanobananaKey}
                      onChange={(e) => setNanobananaKey(e.target.value)}
                      placeholder="nb_..."
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t[lang].nanobananaModel}
                    </label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={nanobananaModel}
                          onChange={(e) => setNanobananaModel(e.target.value)}
                          placeholder="nano-banana"
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          list="nanobanana-models"
                        />
                        <datalist id="nanobanana-models">
                          <option value="nano-banana-pro" />
                          <option value="nano-banana" />
                          {models.map(m => <option key={m} value={m} />)}
                        </datalist>
                      </div>
                      <button
                        onClick={fetchModels}
                        disabled={isFetchingModels}
                        className="p-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 disabled:opacity-50"
                        title={t[lang].fetchModels}
                      >
                        <RefreshCw className={`w-5 h-5 ${isFetchingModels ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {t[lang].nanobananaProHint}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Feishu (Lark)</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t[lang].feishuAppId}
              </label>
              <input
                type="text"
                value={feishuAppId}
                onChange={(e) => setFeishuAppId(e.target.value)}
                placeholder="cli_..."
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t[lang].feishuAppSecret}
              </label>
              <input
                type="password"
                value={feishuAppSecret}
                onChange={(e) => setFeishuAppSecret(e.target.value)}
                placeholder="Secret..."
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-2 text-xs text-gray-500">
                {t[lang].feishuConfigDesc}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleSave}
            className="w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium transition-colors"
          >
            {t[lang].saveSettings}
          </button>
        </div>
      </div>
    </div>
  );
}
