import { GoogleGenAI, Type } from "@google/genai";
import { Asset, ApiProvider } from "../types";

function getApiConfig() {
  const provider = (localStorage.getItem('api_provider') as ApiProvider) || 'gemini';
  return {
    provider,
    geminiKey: localStorage.getItem('custom_gemini_api_key') || process.env.GEMINI_API_KEY,
    geminiBaseUrl: localStorage.getItem('gemini_base_url'),
    geminiModel: localStorage.getItem('gemini_model') || 'gemini-3.1-flash-image-preview',
    geminiAspectRatio: localStorage.getItem('gemini_aspect_ratio') || '16:9',
    geminiImageSize: localStorage.getItem('gemini_image_size') || '4K',
    proxyEnabled: localStorage.getItem('proxy_enabled') === 'true',
    proxyUrl: localStorage.getItem('proxy_url') || 'http://127.0.0.1:7890',
    openaiKey: localStorage.getItem('openai_api_key'),
    openaiBaseUrl: localStorage.getItem('openai_base_url') || 'https://api.openai.com/v1',
    openaiModel: localStorage.getItem('openai_model') || 'dall-e-3',
    openaiImageSize: localStorage.getItem('openai_image_size') || '1024x1024',
    nanobananaKey: localStorage.getItem('nanobanana_api_key'),
    nanobananaModel: localStorage.getItem('nanobanana_model') || 'nano-banana'
  };
}

export async function associateAssetWithPanel(panel: any, assets: Asset[], retries = 2): Promise<{ assetId: string, imageIndex: number }[]> {
  if (!assets || assets.length === 0) return [];

  const config = getApiConfig();
  const aiConfig: any = { apiKey: config.geminiKey };
  if (config.geminiBaseUrl) {
    aiConfig.baseUrl = config.geminiBaseUrl;
  } else if (config.proxyEnabled && config.proxyUrl) {
    aiConfig.baseUrl = `${window.location.origin}/api/gemini/proxy/${encodeURIComponent(config.proxyUrl)}`;
  }
  const ai = new GoogleGenAI(aiConfig);

  const assetList = assets.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    imageCount: a.images?.length || 0
  }));

  const prompt = `
You are an AI assistant helping to associate a storyboard panel with the most relevant assets from a library.

Storyboard Panel Content:
Core Visual: ${panel.coreVisualContent}
Composition: ${panel.compositionRequirements}
Lighting: ${panel.lightingColorStyle}

Available Assets:
${JSON.stringify(assetList, null, 2)}

Analyze the storyboard panel content and select ALL relevant assets from the available assets.
Return an array of objects, where each object has an 'assetId' and an 'imageIndex' (from 0 to imageCount - 1). If no assets are relevant, return an empty array.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              assetId: { type: Type.STRING },
              imageIndex: { type: Type.INTEGER }
            }
          }
        }
      }
    });
    const result = JSON.parse(response.text || '[]');
    return Array.isArray(result) ? result : [];
  } catch (e: any) {
    console.error("Failed to associate asset", e);
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return associateAssetWithPanel(panel, assets, retries - 1);
    }
    return [];
  }
}

export async function selectRelevantAssets(prompt: string, assets: Asset[], retries = 2): Promise<string[]> {
  if (!assets || assets.length === 0) return [];
  const config = getApiConfig();
  
  if (config.provider === 'openai') {
    // For now, we use Gemini for selection as it's better at JSON/reasoning and usually free-tier available
    // But we use the Gemini key if provided
  }

  const aiConfig: any = { apiKey: config.geminiKey };
  if (config.geminiBaseUrl) {
    aiConfig.baseUrl = config.geminiBaseUrl;
  } else if (config.proxyEnabled && config.proxyUrl) {
    aiConfig.baseUrl = `${window.location.origin}/api/gemini/proxy/${encodeURIComponent(config.proxyUrl)}`;
  }
  const ai = new GoogleGenAI(aiConfig);
  
  const assetDescriptions = (assets || []).map(a => `ID: ${a.id}, Description: ${a.description}`).join('\n');
  const systemInstruction = `You are an assistant that selects relevant assets for a storyboard panel.
Given the user's prompt and a list of available assets, return a JSON array of asset IDs that are relevant to the prompt.
Only return the JSON array of strings, nothing else.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Prompt: ${prompt}\n\nAvailable Assets:\n${assetDescriptions}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (e: any) {
    console.error("Failed to select relevant assets", e);
    
    const isBusyError = e?.status === 503 || e?.status === 504 || e?.message?.includes('503') || e?.message?.includes('504') || e?.message?.includes('Deadline expired') || e?.message?.includes('UNAVAILABLE');
    const isNetworkError = e?.message?.toLowerCase().includes('fetch') || e?.message?.toLowerCase().includes('network');
    
    if ((isBusyError || isNetworkError) && retries > 0) {
      console.warn(`Retrying selectRelevantAssets due to ${isNetworkError ? 'network error' : 'busy service'}... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2 seconds
      return selectRelevantAssets(prompt, assets, retries - 1);
    }

    if (e?.status === 403 || e?.message?.includes('403') || e?.message?.includes('PERMISSION_DENIED')) {
      throw new Error("Permission Denied. This model might require a custom API key with billing enabled. Please click 'Settings' to enter your own Gemini API Key.");
    }

    if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("API Quota Exceeded. Please click 'Settings' to enter a valid Gemini API Key.");
    }

    if (isBusyError) {
      throw new Error("The AI service is currently busy or timed out. Please try again in a moment.");
    }
    
    throw e;
  }
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
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

async function generateOpenAIImage(prompt: string, config: any): Promise<string> {
  const response = await fetchWithRetry('/api/openai/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apiKey: config.openaiKey,
      baseUrl: config.openaiBaseUrl,
      body: {
        model: config.openaiModel,
        prompt: prompt,
        n: 1,
        size: config.openaiImageSize || "1024x1024",
        response_format: "b64_json"
      }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'OpenAI Image Generation Failed');
  }

  const data = await response.json();
  return `data:image/png;base64,${data.data[0].b64_json}`;
}

async function generateNanoBananaImage(prompt: string, config: any, referenceImages: string[] = []): Promise<string> {
  // Nano Banana expects URLs, not base64. Filter out base64 strings.
  const validReferenceUrls = referenceImages.filter(img => img.startsWith('http'));

  const response = await fetchWithRetry('/api/nanobanana/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apiKey: config.nanobananaKey,
      body: {
        prompt: prompt,
        selectedModel: config.nanobananaModel,
        referenceImageUrls: validReferenceUrls.length > 0 ? validReferenceUrls : undefined,
        aspectRatio: "16:9",
        mode: "sync"
      }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.errorMessage || err.msg || 'Nano Banana Image Generation Failed');
  }

  const result = await response.json();
  
  // Try to find the image URL in various possible locations based on the documentation and common patterns
  const data = result.data || result;
  
  if (data.processingStatus === 'failed') {
    throw new Error(`Nano Banana Generation Failed: ${data.errorMessage || 'Unknown error'}`);
  }

  const imageUrls = data.outputImageUrls || data.imageUrls || (Array.isArray(data) ? data : []);
  
  if (Array.isArray(imageUrls) && imageUrls.length > 0) {
    return imageUrls[0];
  }

  // Fallback for single URL fields
  const singleUrl = data.url || data.outputImageUrl || data.imageUrl;
  if (singleUrl && typeof singleUrl === 'string') {
    return singleUrl;
  }

  console.error('Unexpected Nano Banana response structure:', result);
  throw new Error('No image URL returned from Nano Banana. Please check your API key and credits.');
}

export async function uploadImageToServer(base64Image: string): Promise<string> {
  if (!base64Image.startsWith('data:image/')) return base64Image;
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image })
    });
    if (res.ok) {
      const data = await res.json();
      return data.url;
    }
  } catch (e) {
    console.error('Failed to upload image to server', e);
  }
  return base64Image;
}

export async function generateStoryboardImages(prompt: string, referenceImages: string[] = []): Promise<string[]> {
  const config = getApiConfig();
  
  const generateSingleImage = async (retries = 2, forceFallback = false, disableConfig = false): Promise<string> => {
    if (config.provider === 'nanobanana' && config.nanobananaKey) {
      try {
        return await generateNanoBananaImage(prompt, config, referenceImages);
      } catch (e: any) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          return generateSingleImage(retries - 1, forceFallback, disableConfig);
        }
        throw e;
      }
    }

    if (config.provider === 'openai' && config.openaiKey) {
      try {
        return await generateOpenAIImage(prompt, config);
      } catch (e: any) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          return generateSingleImage(retries - 1, forceFallback, disableConfig);
        }
        throw e;
      }
    }

    const aiConfig: any = { apiKey: config.geminiKey };
    if (config.geminiBaseUrl) {
      aiConfig.baseUrl = config.geminiBaseUrl;
    } else if (config.proxyEnabled && config.proxyUrl) {
      aiConfig.baseUrl = `${window.location.origin}/api/gemini/proxy/${encodeURIComponent(config.proxyUrl)}`;
    }
    const ai = new GoogleGenAI(aiConfig);
    const parts: any[] = [{ text: prompt }];

    for (const img of referenceImages) {
      const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      }
    }

    const useHighQualityModel = !!localStorage.getItem('custom_gemini_api_key') && !forceFallback;
    const model = forceFallback ? 'gemini-2.5-flash-image' : config.geminiModel;

    try {
      const generateParams: any = {
        model,
        contents: { parts },
      };
      
      if (!disableConfig) {
        generateParams.config = {
          imageConfig: {
            aspectRatio: config.geminiAspectRatio,
            imageSize: (config.geminiImageSize === '4K' && !useHighQualityModel) ? '1024' : config.geminiImageSize
          }
        };
      }

      const response = await ai.models.generateContent(generateParams);

      let returnedText = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${base64EncodeString}`;
        } else if (part.text) {
          returnedText += part.text;
          // Sometimes proxies return markdown images or URLs in text
          const urlMatch = part.text.match(/https?:\/\/[^\s)\]"']+/);
          if (urlMatch) {
            return urlMatch[0];
          }
          const base64Match = part.text.match(/data:image\/[a-zA-Z+]+;base64,[^\s)\]"']+/);
          if (base64Match) {
            return base64Match[0];
          }
          // Check if the text itself is just a raw base64 string (very long, no spaces)
          if (part.text.length > 1000 && !part.text.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(part.text.trim())) {
            return `data:image/png;base64,${part.text.trim()}`;
          }
        }
      }
      console.error("Gemini response did not contain image:", JSON.stringify(response));
      throw new Error(returnedText ? `No image generated. Model returned: ${returnedText}` : "No image generated");
    } catch (e: any) {
      const isBusyError = e?.status === 503 || e?.status === 504 || e?.message?.includes('503') || e?.message?.includes('504') || e?.message?.includes('Deadline expired') || e?.message?.includes('UNAVAILABLE');
      const isPermissionError = e?.status === 403 || e?.message?.includes('403') || e?.message?.includes('PERMISSION_DENIED');
      const isBadRequest = e?.status === 400 || e?.message?.includes('400') || e?.message?.includes('INVALID_ARGUMENT');
      const isNetworkError = e?.message?.toLowerCase().includes('fetch') || e?.message?.toLowerCase().includes('network');

      if (isPermissionError && useHighQualityModel) {
        console.warn("Permission denied for 4K model, falling back to standard model...");
        return generateSingleImage(retries, true, disableConfig);
      }

      if (isBadRequest && !disableConfig) {
        console.warn("Bad request (possibly unsupported imageConfig), retrying without config...");
        return generateSingleImage(retries, forceFallback, true);
      }
      
      if ((isBusyError || isNetworkError) && retries > 0) {
        console.warn(`Retrying generateSingleImage due to ${isNetworkError ? 'network error' : 'busy service'}... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return generateSingleImage(retries - 1, forceFallback, disableConfig);
      }

      if (isPermissionError) {
        throw new Error("Permission Denied. The AI service is restricted. Please click 'Settings' to enter a valid Gemini API Key with billing enabled to use 4K features.");
      }

      if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('RESOURCE_EXHAUSTED')) {
        throw new Error("API Quota Exceeded. Please click 'Settings' to enter a valid Gemini API Key.");
      }
      if (isBusyError) {
        throw new Error("The AI service is currently busy or timed out. Please try again in a moment.");
      }
      throw e;
    }
  };

  // Generate 1 image
  const img1 = await generateSingleImage();
  const uploadedUrl = await uploadImageToServer(img1);

  return [uploadedUrl];
}
