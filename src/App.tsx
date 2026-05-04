import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Play, Download, Film, BrainCircuit, Wand2, Upload, Link as LinkIcon, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';

type AppState = 'idle' | 'auth_required' | 'analyzing' | 'rendering' | 'complete' | 'error';

export default function App() {
  const [vibe, setVibe] = useState('');
  const [appState, setAppState] = useState<AppState>('idle');
  const [productionPrompt, setProductionPrompt] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // TikTok Intelligence State
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isAnalyzingVibe, setIsAnalyzingVibe] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [vibeToast, setVibeToast] = useState<{ title: string, body: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if user has selected a paid API key for Veo
    // @ts-ignore
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      // @ts-ignore
      window.aistudio.hasSelectedApiKey().then(hasKey => {
        if (!hasKey) {
          setAppState('auth_required');
        }
      });
    }
  }, []);

  const handleSelectKey = async () => {
    try {
      // @ts-ignore
      if (window.aistudio && window.aistudio.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setAppState('idle');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAnalyzeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
      setTiktokUrl(''); // Clear URL if file selected
    }
  };

  const clearAnalysis = () => {
    setAnalysisResult(null);
    setAnalyzeError(null);
    setUploadFile(null);
    setTiktokUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyzeVibe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tiktokUrl.trim() && !uploadFile) return;

    setIsAnalyzingVibe(true);
    setAnalyzeError(null);
    setAnalysisResult(null);

    try {
      const formData = new FormData();
      if (uploadFile) {
        formData.append('source', 'upload');
        formData.append('video', uploadFile);
      } else {
        formData.append('source', 'tiktok');
        formData.append('url', tiktokUrl);
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      let data;
      const resText = await res.text();
      try {
        data = JSON.parse(resText);
      } catch (err) {
        throw new Error(`Server returned non-JSON response (Status ${res.status}): ${resText.substring(0, 100)}...`);
      }

      if (!data.success) {
        const errorCode = data.error?.code;
        if (errorCode === 'TIKTOK_PROVIDER_NOT_CONFIGURED' || errorCode === 'TIKTOK_INGESTION_FAILED') {
          throw new Error('TikTok link analysis is not available for this video yet. Upload the video file instead and VibeFlow can still analyze it.');
        }
        throw new Error(data.error?.message || 'Failed to analyze video');
      }

      setAnalysisResult(data.analysis);
      setVibe(data.analysis.productionPrompt);
      
      setVibeToast({
        title: 'Vibe Match Created',
        body: data.analysis.summary,
      });

      setTimeout(() => setVibeToast(null), 5000);

    } catch (error: any) {
      setAnalyzeError(error.message);
    } finally {
      setIsAnalyzingVibe(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vibe.trim()) return;

    setAppState('analyzing');
    setProductionPrompt(null);
    setVideoUrl(null);
    setErrorMessage(null);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is missing.");
      }

      const ai = new GoogleGenAI({ apiKey });

      // Only synthesize a new prompt if we didn't just paste from TikTok (or we can just refine it)
      // Usually we pass user vibe to Flash to make it proper. If they used analysis, it's already a good prompt.
      // But we will pass it through Flash again to ensure formatting and detail.
      const textResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: vibe,
        config: {
          systemInstruction: "You are a master Cinematographer. Take the user's vibe and expand it into a detailed, visually striking production prompt for a video generator. Describe lighting, camera angle, film stock style, color grading, and specific motion. Keep it under 60 words. Ensure it is optimized for vertical 9:16 format.",
        }
      });
      
      const generatedPrompt = textResponse.text || vibe;
      setProductionPrompt(generatedPrompt);
      setAppState('rendering');

      // Veo rendering vertical 9:16
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt: generatedPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '9:16' // Updated based on requirements
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      
      if (!downloadLink) {
        throw new Error("Failed to retrieve generated video URL.");
      }

      const videoRes = await fetch(downloadLink, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey,
        },
      });
      
      if (!videoRes.ok) {
        throw new Error("Failed to download video blob: " + videoRes.statusText);
      }

      const videoBlob = await videoRes.blob();
      const localVideoUrl = URL.createObjectURL(videoBlob);
      
      setVideoUrl(localVideoUrl);
      setAppState('complete');

    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setAppState('error');
    }
  };

  if (appState === 'auth_required') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-white font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white/5 border border-white/10 backdrop-blur-xl p-8 rounded-3xl text-center space-y-6 shadow-2xl"
        >
          <Film className="w-12 h-12 text-[#00d2ff] mx-auto opacity-80" />
          <h2 className="text-2xl font-light tracking-tight">API Key Required</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Generating video with Veo requires a paid Gemini API key. Please select a valid key from your Google Cloud project to continue.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full bg-[#00d2ff] hover:bg-[#00b8e6] text-black font-medium py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(0,210,255,0.3)] hover:shadow-[0_0_30px_rgba(0,210,255,0.5)] flex items-center justify-center gap-2"
          >
            Select API Key
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col lg:flex-row p-4 lg:p-8 text-white font-sans relative overflow-x-hidden gap-8">
      
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#00d2ff]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* LEFT COLUMN: Controls & Analysis */}
      <div className="w-full lg:w-1/2 max-w-xl mx-auto flex flex-col gap-6 relative z-10">
        
        <div className="text-left space-y-2 mt-4">
          <h1 className="text-4xl font-extralight tracking-tighter flex items-center gap-3">
            <Film className="w-8 h-8 text-[#00d2ff]" />
            Vibe<span className="font-medium text-[#00d2ff]">Flow</span>
          </h1>
          <p className="text-gray-400 text-sm">
            Content Factory as a Service MVP
          </p>
        </div>

        {/* TikTok Intelligence Panel */}
        <div className="bg-white/5 border border-[#00d2ff]/20 backdrop-blur-xl rounded-3xl p-6 shadow-xl flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-medium flex items-center gap-2 text-white/90">
              <BrainCircuit className="w-5 h-5 text-[#00d2ff]" />
              TikTok Intelligence
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Analyze a viral video and turn its structure into an original production prompt.
            </p>
          </div>

          {!analysisResult ? (
            <form onSubmit={handleAnalyzeVibe} className="flex flex-col gap-3">
              <div className="flex bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:border-[#00d2ff]/50 transition-colors">
                <div className="px-3 flex items-center justify-center text-gray-500">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <input
                  type="url"
                  placeholder="Paste TikTok link..."
                  value={tiktokUrl}
                  onChange={(e) => {
                    setTiktokUrl(e.target.value);
                    setUploadFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-gray-600"
                  disabled={isAnalyzingVibe}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="h-px bg-white/10 flex-1"></span>
                <span className="px-3">OR</span>
                <span className="h-px bg-white/10 flex-1"></span>
              </div>

              <div>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleAnalyzeFileChange}
                  className="hidden"
                  ref={fileInputRef}
                  disabled={isAnalyzingVibe}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 border border-dashed border-white/20 rounded-xl text-sm text-gray-400 hover:text-white hover:border-white/40 transition-colors flex items-center justify-center gap-2"
                  disabled={isAnalyzingVibe}
                >
                  <Upload className="w-4 h-4" />
                  {uploadFile ? uploadFile.name : "Upload video instead"}
                </button>
              </div>

              <button
                type="submit"
                disabled={(!tiktokUrl && !uploadFile) || isAnalyzingVibe}
                className="mt-2 bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {isAnalyzingVibe ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                {isAnalyzingVibe ? 'Analyzing viral structure...' : 'Analyze Vibe'}
              </button>

              {analyzeError && (
                <div className="text-red-400 text-xs mt-2 flex items-start gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{analyzeError}</span>
                </div>
              )}
            </form>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="inline-flex items-center gap-1.5 bg-[#00d2ff]/10 text-[#00d2ff] px-3 py-1 rounded-full text-xs font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Vibe Match: {analysisResult.vibeScore}/100
                </div>
                <button onClick={clearAnalysis} className="text-xs text-gray-500 hover:text-white transition-colors">
                  Reset
                </button>
              </div>
              
              <div className="text-xs text-gray-300 space-y-2 bg-black/30 p-3 rounded-lg">
                <p><span className="text-gray-500">Summary:</span> {analysisResult.summary}</p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <p><span className="text-gray-500 block">Hook:</span>{analysisResult.hookStyle}</p>
                  <p><span className="text-gray-500 block">Style:</span>{analysisResult.visualStyle}</p>
                  <p><span className="text-gray-500 block">Camera:</span>{analysisResult.cameraStyle}</p>
                  <p><span className="text-gray-500 block">Pacing:</span>{analysisResult.pacing}</p>
                </div>
              </div>

              {analysisResult.safetyNotes?.length > 0 && (
                <div className="text-[10px] text-yellow-500/80 bg-yellow-500/10 p-2 rounded">
                  Safety Note: {analysisResult.safetyNotes.join(' ')}
                </div>
              )}

              <div className="text-xs text-gray-500 pt-2 border-t border-white/10">
                Prompt ready! Adjust below or tap generate.
              </div>
            </motion.div>
          )}
        </div>

        {/* Generate Video Settings */}
        <form onSubmit={handleGenerate} className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
          <div className="relative">
            <textarea
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              placeholder="Describe a vibe or analyze a video to auto-fill..."
              rows={4}
              className="w-full bg-black/50 border border-white/5 rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#00d2ff]/50 focus:bg-white/5 transition-all placeholder:text-gray-600 resize-none"
              disabled={appState === 'analyzing' || appState === 'rendering'}
            />
          </div>
          
          <button
             type="submit"
             disabled={!vibe.trim() || appState === 'analyzing' || appState === 'rendering'}
             className="bg-[#00d2ff] hover:bg-[#00b8e6] text-black font-medium text-lg px-6 py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(0,210,255,0.2)] hover:shadow-[0_0_30px_rgba(0,210,255,0.4)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3"
          >
            {appState === 'analyzing' && <><Loader2 className="w-5 h-5 animate-spin" /> Synthesizing Prompt...</>}
            {appState === 'rendering' && <><Loader2 className="w-5 h-5 animate-spin" /> Rendering Frame by Frame...</>}
            {(appState === 'idle' || appState === 'complete' || appState === 'error') && <><Wand2 className="w-5 h-5" /> Generate Original Frame</>}
          </button>
        </form>

        <p className="text-[10px] text-gray-500 text-center px-4">
          Use videos you own or have permission to analyze. VibeFlow extracts patterns, not copyright.
        </p>

        {appState === 'error' && errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-4 text-center text-sm"
          >
            {errorMessage}
          </motion.div>
        )}
      </div>

      {/* RIGHT COLUMN: Mobile Phone Preview */}
      <div className="w-full lg:w-1/2 flex items-center justify-center relative z-10 py-8 lg:py-0">
        <div className="w-[300px] h-[533px] sm:w-[340px] sm:h-[604px] bg-black border-[6px] border-gray-800 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-center items-center">
          
          {/* Phone Notch/Dynamic Island simulated */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-20"></div>

          <AnimatePresence mode="wait">
            {!productionPrompt && appState !== 'rendering' && !videoUrl && (
               <motion.div 
                 key="empty"
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                 className="flex flex-col items-center justify-center text-gray-700 gap-3"
               >
                 <Film className="w-12 h-12 opacity-50" />
                 <p className="text-sm font-medium">9:16 Video Canvas</p>
               </motion.div>
            )}

            {productionPrompt && appState === 'rendering' && (
              <motion.div 
                key="rendering"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center z-10 border border-[#00d2ff]/20"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-[#00d2ff]/20 overflow-hidden">
                   <div className="h-full bg-[#00d2ff] w-1/2 animate-[progress_2s_ease-in-out_infinite]" />
                </div>
                <BrainCircuit className="w-8 h-8 text-[#00d2ff] mb-4 animate-pulse" />
                <h3 className="text-[#00d2ff] text-xs font-bold uppercase tracking-wider mb-2">Production Prompt</h3>
                <p className="text-gray-300 text-xs leading-relaxed font-mono line-clamp-6 opacity-70">
                  {productionPrompt}
                </p>
              </motion.div>
            )}

            {appState === 'complete' && videoUrl && (
              <motion.div 
                key="complete"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="w-full h-full relative"
              >
                <video 
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
                <a 
                  href={videoUrl}
                  download="vibeflow_original.mp4"
                  className="absolute bottom-6 right-4 z-20 bg-black/50 hover:bg-black/80 backdrop-blur-md text-white px-3 py-2 rounded-full flex items-center justify-center transition-all border border-white/10"
                >
                  <Download className="w-4 h-4" />
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Global Toast */}
      <AnimatePresence>
        {vibeToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#00d2ff]/10 border border-[#00d2ff]/30 backdrop-blur-xl px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-sm w-full"
          >
            <div className="bg-[#00d2ff] p-2 rounded-full text-black">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-white text-sm font-semibold">{vibeToast.title}</h4>
              <p className="text-gray-300 text-xs truncate max-w-[200px]">{vibeToast.body}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}


