"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8890";

interface Video {
  video_id: string;
  filename: string;
  duration: number;
  total_frames: number;
  fps: number;
  video_url?: string;
}

interface Moment {
  timestamp: number;
  frame_num: number;
  video_filename: string;
  video_id: string;
  frame_url: string;
  score: number;
  time_formatted: string;
  description?: string;
}

interface FeedMetadata {
  video_id: string;
  feed_type: "cctv" | "bodycam" | "dashcam";
  camera_id: string;
  location: string;
  gps: string;
}

interface SystemLog {
  timestamp: string;
  message: string;
  type: "info" | "success" | "warn" | "error";
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Icon Components
function CctvIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2" />
      <path d="M21 6V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9v1" />
      <path d="M12 14v1" />
      <path d="M9 12h1" />
      <path d="M14 12h1" />
    </svg>
  );
}

function BodycamIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <circle cx="12" cy="11" r="3" />
      <path d="M12 14v2" />
    </svg>
  );
}

function DashcamIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <path d="M8 16h.01" />
      <path d="M16 16h.01" />
    </svg>
  );
}

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [searchMode, setSearchMode] = useState<"image" | "text">("image");
  const [textQuery, setTextQuery] = useState("");
  const [queryImage, setQueryImage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoTimestamp, setVideoTimestamp] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [logs, setLogs] = useState<SystemLog[]>([]);

  // Category & Metadata State
  const [activeFilter, setActiveFilter] = useState<"all" | "cctv" | "bodycam" | "dashcam">("all");
  const [feedMappings, setFeedMappings] = useState<Record<string, FeedMetadata>>({});
  
  // Pending Upload State
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadFeedType, setUploadFeedType] = useState<"cctv" | "bodycam" | "dashcam">("cctv");
  const [uploadCameraId, setUploadCameraId] = useState("");
  const [uploadLocation, setUploadLocation] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Helper to add system logs
  const addLog = useCallback((message: string, type: "info" | "success" | "warn" | "error" = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-30), { timestamp: time, message, type }]);
  }, []);

  // Fetch local configurations
  useEffect(() => {
    const saved = localStorage.getItem("sentinel_feed_mappings");
    if (saved) {
      try {
        setFeedMappings(JSON.parse(saved));
      } catch {}
    }
    addLog("Project Sentinel Forensics Engine loaded.", "info");
    addLog("Multi-feed vector index mapping: ONLINE.", "success");
  }, [addLog]);

  // Scroll terminal logs to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Generate metadata mappings dynamically for fallback/display
  const getFeedMetadata = useCallback((video: Video): FeedMetadata => {
    if (feedMappings[video.video_id]) {
      return feedMappings[video.video_id];
    }
    
    // Deterministic fallback if not in localStorage (based on ID/name)
    const id = video.video_id;
    const name = video.filename.toLowerCase();
    
    let type: "cctv" | "bodycam" | "dashcam" = "cctv";
    let camId = `CAM-${id.toUpperCase()}`;
    let loc = "Strategic Intersection Alpha";
    let lat = 34.0522;
    let lng = -118.2437;
    
    if (name.includes("body") || name.includes("whatsapp") || id.charCodeAt(0) % 3 === 0) {
      type = "bodycam";
      camId = `B-CAM_OFFICER_DAVIS_${id.slice(0, 3).toUpperCase()}`;
      loc = "South Precinct Patrol - Beats 4-6";
      lat = 34.0412;
      lng = -118.2567;
    } else if (name.includes("dash") || name.includes("car") || id.charCodeAt(0) % 3 === 1) {
      type = "dashcam";
      camId = `UNIT_308_DASH_${id.slice(0, 3).toUpperCase()}`;
      loc = "Expressway 101 Northbound - Mile 12";
      lat = 34.0688;
      lng = -118.2289;
    } else {
      type = "cctv";
      camId = `CCTV_TRAFFIC_CH_${id.slice(0, 3).toUpperCase()}`;
      loc = "Transit Terminal East Entrance";
      lat = 34.0564;
      lng = -118.2482;
    }
    
    return {
      video_id: id,
      feed_type: type,
      camera_id: camId,
      location: loc,
      gps: `${lat.toFixed(4)}° N, ${Math.abs(lng).toFixed(4)}° W`,
    };
  }, [feedMappings]);

  const fetchVideos = async () => {
    try {
      const res = await fetch(`${API}/videos`);
      const data = await res.json();
      setVideos(data.videos);
      addLog(`Indexed feeds updated. Active channels: ${data.videos.length}`, "info");
    } catch {
      addLog("Failed to reach backend API.", "error");
    }
  };

  useEffect(() => { fetchVideos(); }, []);

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setPendingFile(file);
    // Suggest default camera details
    setUploadCameraId(file.filename.split(".")[0].toUpperCase().slice(0, 16));
    setUploadLocation("Operational Sector " + Math.floor(Math.random() * 9 + 1));
    addLog(`Feed staged for ingest: ${file.filename}`, "info");
  };

  const handleIngestVideo = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setUploadProgress("Ingesting and indexing video frames...");
    addLog(`Beginning extraction & multi-modal vector embedding build for ${pendingFile.name}...`, "info");

    const form = new FormData();
    form.append("file", pendingFile);
    form.append("fps", "1");

    try {
      const res = await fetch(`${API}/upload-video`, { method: "POST", body: form });
      const data = await res.json();
      
      // Save local metadata mapping
      const newMapping: FeedMetadata = {
        video_id: data.video_id,
        feed_type: uploadFeedType,
        camera_id: uploadCameraId || `CAM-${data.video_id.toUpperCase()}`,
        location: uploadLocation || "Tactical Unit Boundary",
        gps: `${(34.02 + Math.random() * 0.08).toFixed(4)}° N, ${(118.20 + Math.random() * 0.08).toFixed(4)}° W`,
      };
      
      const updated = { ...feedMappings, [data.video_id]: newMapping };
      setFeedMappings(updated);
      localStorage.setItem("sentinel_feed_mappings", JSON.stringify(updated));

      addLog(`Ingest successful. Created ${data.frames_extracted} vector keys for ${pendingFile.name}`, "success");
      setUploadProgress(`Indexed ${data.frames_extracted} frames successfully.`);
      await fetchVideos();
      setSelectedVideo(data.video_id);
      setPendingFile(null);
    } catch {
      addLog("Ingest process failed. Verify backend services.", "error");
      setUploadProgress("Ingest failed.");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(""), 5000);
    }
  };

  const runImageSearch = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => setQueryImage(ev.target?.result as string);
    reader.readAsDataURL(file);

    setLoading(true);
    setMoments([]);
    addLog("Sending tactical screenshot match request...", "info");
    const t0 = Date.now();

    const form = new FormData();
    form.append("image", file);
    if (selectedVideo) {
      form.append("video_id", selectedVideo);
      addLog(`Bounding search to active camera feed ID: ${selectedVideo}`, "info");
    } else {
      addLog("Searching all active feeds simultaneously...", "info");
    }
    form.append("top_k", "6");

    try {
      const res = await fetch(`${API}/find-moment`, { method: "POST", body: form });
      const data = await res.json();
      setMoments(data.moments || []);
      const duration = (Date.now() - t0) / 1000;
      setElapsed(duration);
      addLog(`Image search complete. Found ${data.moments?.length || 0} moments in ${duration.toFixed(2)}s`, "success");
    } catch {
      addLog("Search request failed.", "error");
      setMoments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    runImageSearch(e.target.files[0]);
  };

  const handleTextSearch = async () => {
    if (!textQuery.trim()) return;
    setLoading(true);
    setMoments([]);
    setQueryImage(null);
    addLog(`Running query matching for: "${textQuery}"`, "info");
    const t0 = Date.now();

    try {
      const body: any = { query: textQuery, top_k: 6 };
      if (selectedVideo) {
        body.video_id = selectedVideo;
        addLog(`Bounding search to active camera feed ID: ${selectedVideo}`, "info");
      } else {
        addLog("Searching all active feeds simultaneously...", "info");
      }
      const res = await fetch(`${API}/find-moment-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setMoments(data.moments || []);
      const duration = (Date.now() - t0) / 1000;
      setElapsed(duration);
      addLog(`Text query complete. Found ${data.moments?.length || 0} moments in ${duration.toFixed(2)}s`, "success");
    } catch {
      addLog("Search request failed.", "error");
      setMoments([]);
    } finally {
      setLoading(false);
    }
  };

  const jumpToMoment = (moment: Moment) => {
    setVideoTimestamp(moment.timestamp);
    setSelectedVideo(moment.video_id);
    addLog(`Jumping to tactical timestamp: ${moment.time_formatted} on feed ${moment.video_filename}`, "info");
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = moment.timestamp;
        videoRef.current.play();
      }
    }, 100);
  };

  const deleteVideoFeed = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to purge feed: ${name}?`)) return;
    addLog(`Purging feed: ${name}...`, "warn");
    try {
      const res = await fetch(`${API}/videos/${id}`, { method: "DELETE" });
      if (res.ok) {
        addLog(`Successfully purged feed ${name}.`, "success");
        if (selectedVideo === id) setSelectedVideo(null);
        // Clear mapping from localStorage
        const updated = { ...feedMappings };
        delete updated[id];
        setFeedMappings(updated);
        localStorage.setItem("sentinel_feed_mappings", JSON.stringify(updated));
        await fetchVideos();
      }
    } catch {
      addLog("Purge request failed.", "error");
    }
  };

  // Drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      runImageSearch(file);
    }
  }, [selectedVideo]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const activeVideo = videos.find((v) => v.video_id === selectedVideo) || videos[0];
  const activeMetadata = activeVideo ? getFeedMetadata(activeVideo) : null;
  const totalFrames = videos.reduce((a, v) => a + v.total_frames, 0);

  // Apply feed type filtering
  const filteredVideos = videos.filter((v) => {
    if (activeFilter === "all") return true;
    return getFeedMetadata(v).feed_type === activeFilter;
  });

  const filteredMoments = moments.filter((m) => {
    if (activeFilter === "all") return true;
    const v = videos.find((vid) => vid.video_id === m.video_id);
    if (!v) return true;
    return getFeedMetadata(v).feed_type === activeFilter;
  });

  const getFeedColor = (type: "cctv" | "bodycam" | "dashcam") => {
    if (type === "cctv") return "text-cyan-400 border-cyan-500/30 bg-cyan-950/20";
    if (type === "bodycam") return "text-blue-400 border-blue-500/30 bg-blue-950/20";
    return "text-purple-400 border-purple-500/30 bg-purple-950/20";
  };

  const getFeedIcon = (type: "cctv" | "bodycam" | "dashcam") => {
    if (type === "cctv") return <CctvIcon className="w-3.5 h-3.5" />;
    if (type === "bodycam") return <BodycamIcon className="w-3.5 h-3.5" />;
    return <DashcamIcon className="w-3.5 h-3.5" />;
  };

  return (
    <div className="flex flex-col h-screen bg-[#070709] text-zinc-200 font-sans scanline">
      {/* Header */}
      <header className="glass border-b border-cyan-500/15 px-6 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center relative">
            <span className="absolute w-2 h-2 rounded-full bg-cyan-400 led-active top-1 right-1" />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-widest text-glow-cyan text-cyan-400 font-mono">PROJECT SENTINEL</h1>
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-mono text-cyan-300">v3.4 FORENSIC CONSOLE</span>
            </div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
              Tactical Multi-Feed Cross-Modal Search Platform &middot; Zero Transcription
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 bg-zinc-900/40 border border-zinc-800 px-3 py-1 rounded-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 led-active" />
            <span className="text-[10px] text-zinc-400 uppercase">System: Online</span>
          </div>
          {totalFrames > 0 && (
            <div className="hidden md:flex items-center gap-3 text-[10px] text-zinc-400">
              <span>ACTIVE FEEDS: <strong className="text-cyan-400">{videos.length}</strong></span>
              <span>|</span>
              <span>INDEXED KEYS: <strong className="text-cyan-400">{totalFrames.toLocaleString()}</strong></span>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Video feed + config + log */}
        <div className="w-[55%] border-r border-zinc-800/40 flex flex-col">
          {/* Active Feed Metadata Strip */}
          {activeVideo && activeMetadata && (
            <div className="bg-zinc-950/80 px-4 py-2 border-b border-zinc-900 text-xs font-mono flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] border flex items-center gap-1.5 font-bold uppercase ${getFeedColor(activeMetadata.feed_type)}`}>
                  {getFeedIcon(activeMetadata.feed_type)}
                  {activeMetadata.feed_type}
                </span>
                <span className="text-zinc-300 font-bold">{activeMetadata.camera_id}</span>
                <span className="text-zinc-600">&middot;</span>
                <span className="text-zinc-400">{activeMetadata.location}</span>
              </div>
              <div className="text-zinc-500 flex items-center gap-1">
                <span className="text-cyan-500 text-[10px]">●</span>
                <span>{activeMetadata.gps}</span>
              </div>
            </div>
          )}

          {/* Video Player Area */}
          <div className="flex-1 bg-black/60 flex items-center justify-center relative p-4 overflow-hidden">
            {activeVideo ? (
              <div className="relative max-w-full max-h-full aspect-video target-corners border border-cyan-500/15 overflow-hidden shadow-2xl">
                <video
                  ref={videoRef}
                  src={`${API}${activeVideo.video_url}`}
                  controls
                  className="w-full h-full object-contain"
                />
                {/* Forensic crosshair overlay */}
                <div className="absolute top-1/2 left-4 right-4 h-px bg-cyan-500/10 pointer-events-none" />
                <div className="absolute left-1/2 top-4 bottom-4 w-px bg-cyan-500/10 pointer-events-none" />
                <span className="absolute top-4 left-4 text-[9px] text-cyan-400 font-mono tracking-wider bg-black/60 px-1 py-0.5 border border-cyan-500/10">INGEST_STREAM_01 // SECURE</span>
              </div>
            ) : (
              <div className="text-center px-8">
                <div className="w-16 h-16 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center mx-auto mb-4 target-corners">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-cyan-500/60">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-400 font-mono font-bold tracking-wider">NO FORENSIC FEEDS AVAILABLE</p>
                <p className="text-xs text-zinc-600 mt-1 uppercase font-mono">Stage a video file to run vector indexing</p>
              </div>
            )}
            {videoTimestamp !== null && (
              <div className="absolute top-6 right-6 bg-cyan-600/90 border border-cyan-400/30 backdrop-blur text-white text-[10px] font-mono px-3 py-1 rounded shadow-lg">
                FEED_TIME: {formatDuration(videoTimestamp)}
              </div>
            )}
          </div>

          {/* Middle Ingest & Video Feed Manager */}
          <div className="p-4 border-t border-zinc-900 bg-zinc-950/60 shrink-0">
            {/* INGEST CONFIG FORM */}
            {pendingFile ? (
              <div className="bg-zinc-900/80 border border-cyan-500/20 rounded-xl p-3.5 mb-3 animate-fade-up">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold font-mono text-cyan-400 tracking-wider">STAGE NEW FEED FOR VECTOR INGEST</h3>
                  <button onClick={() => setPendingFile(null)} className="text-zinc-500 hover:text-zinc-300 text-xs">Cancel</button>
                </div>
                <div className="grid grid-cols-3 gap-2.5 mb-3">
                  <div>
                    <label className="block text-[9px] font-mono text-zinc-500 mb-1 uppercase">Feed Classification</label>
                    <select
                      value={uploadFeedType}
                      onChange={(e) => setUploadFeedType(e.target.value as any)}
                      className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:border-cyan-500/50"
                    >
                      <option value="cctv">CCTV Feed</option>
                      <option value="bodycam">Bodycam Feed</option>
                      <option value="dashcam">Dashcam Feed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-zinc-500 mb-1 uppercase">Camera / Officer ID</label>
                    <input
                      type="text"
                      value={uploadCameraId}
                      onChange={(e) => setUploadCameraId(e.target.value)}
                      placeholder="e.g. OFFICER_DAVIS"
                      className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 placeholder-zinc-700 focus:border-cyan-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-zinc-500 mb-1 uppercase">Deployment Location</label>
                    <input
                      type="text"
                      value={uploadLocation}
                      onChange={(e) => setUploadLocation(e.target.value)}
                      placeholder="e.g. Sector 4 Road"
                      className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 placeholder-zinc-700 focus:border-cyan-500/50"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleIngestVideo}
                    disabled={uploading}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-black text-xs font-mono font-bold tracking-wider py-1.5 rounded uppercase transition-all"
                  >
                    {uploading ? "Analyzing & Generating Vector Keys..." : "Begin Ingest & Indexing"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-3 shrink-0">
                <button
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-1.5 rounded border border-cyan-500/30 bg-cyan-950/10 hover:bg-cyan-500/10 text-cyan-400 text-xs font-mono font-bold tracking-wider uppercase transition-all"
                >
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleSelectFile}
                  />
                  Stage Forensic Feed
                </button>
                {uploadProgress && (
                  <span className="text-[10px] font-mono text-cyan-400/80 animate-pulse uppercase">{uploadProgress}</span>
                )}
              </div>
            )}

            {/* FEED CHANNELS TIMELINE */}
            {filteredVideos.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {filteredVideos.map((v) => {
                  const isActive = selectedVideo === v.video_id || (!selectedVideo && v === filteredVideos[0]);
                  const meta = getFeedMetadata(v);
                  return (
                    <div
                      key={v.video_id}
                      onClick={() => { setSelectedVideo(v.video_id); addLog(`Selected feed: ${meta.camera_id}`, "info"); }}
                      className={`
                        shrink-0 p-2.5 rounded border transition-all cursor-pointer w-48 text-left
                        ${isActive
                          ? "bg-cyan-950/20 border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                          : "bg-zinc-950/60 border-zinc-900 hover:border-zinc-700 hover:bg-zinc-900/40"}
                      `}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] border font-bold uppercase tracking-wider flex items-center gap-1 ${getFeedColor(meta.feed_type)}`}>
                          {getFeedIcon(meta.feed_type)}
                          {meta.feed_type}
                        </span>
                        <button
                          onClick={(e) => deleteVideoFeed(e, v.video_id, meta.camera_id)}
                          className="text-zinc-600 hover:text-red-400 font-mono text-[9px] px-1 hover:bg-red-500/10 rounded transition-colors"
                          title="Purge feed from database"
                        >
                          PURGE
                        </button>
                      </div>
                      <h4 className="text-[11px] font-bold font-mono text-zinc-300 truncate tracking-wide">{meta.camera_id}</h4>
                      <p className="text-[9px] text-zinc-500 truncate mt-0.5">{meta.location}</p>
                      <div className="flex justify-between items-center mt-2 text-[8px] font-mono text-zinc-600">
                        <span>LEN: {formatDuration(v.duration)}</span>
                        <span>KEYS: {v.total_frames}f</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] font-mono text-zinc-600 py-1 uppercase text-center border border-dashed border-zinc-900 rounded-lg">No camera feeds matching current filter.</p>
            )}
          </div>

          {/* Bottom Live System Log Terminal */}
          <div className="h-32 border-t border-zinc-900 bg-[#050507] p-3 flex flex-col overflow-hidden font-mono shrink-0">
            <div className="flex items-center gap-2 border-b border-zinc-900 pb-1.5 mb-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 led-active" />
              <span className="text-[9px] text-cyan-400 uppercase tracking-widest font-bold">TACTICAL EVENT STREAM LOG</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 text-[9px] scrollbar-thin">
              {logs.map((log, idx) => {
                const colors = {
                  info: "text-zinc-400",
                  success: "text-cyan-400 font-bold",
                  warn: "text-amber-500",
                  error: "text-red-500 font-bold",
                };
                return (
                  <div key={idx} className={`leading-relaxed flex gap-2 ${colors[log.type]}`}>
                    <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                    <span>{log.message}</span>
                  </div>
                );
              })}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>

        {/* Right: Search queries + Forensic Results list */}
        <div className="w-[45%] flex flex-col bg-[#070709] overflow-hidden">
          {/* Forensic Filter tabs (cyan borders) */}
          <div className="px-4 py-3 border-b border-zinc-900 shrink-0 flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">CHANNEL SELECTOR:</span>
            <div className="flex gap-1 bg-zinc-950 p-1 border border-zinc-900 rounded-lg">
              {(["all", "cctv", "bodycam", "dashcam"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setActiveFilter(mode); addLog(`Console filter shifted to: ${mode.toUpperCase()}`, "info"); }}
                  className={`px-2 py-1 rounded text-[9px] font-mono font-bold uppercase tracking-wider transition-all ${
                    activeFilter === mode
                      ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-400"
                      : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                  }`}
                >
                  {mode === "all" ? "All Feeds" : mode}
                </button>
              ))}
            </div>
          </div>

          {/* Search Panel Controls */}
          <div className="p-4 border-b border-zinc-900 shrink-0">
            {/* Mode Tabs */}
            <div className="flex gap-1 mb-3 bg-zinc-950 p-1 border border-zinc-900 rounded-lg w-fit">
              <button
                onClick={() => setSearchMode("image")}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold font-mono tracking-wider uppercase transition-all ${
                  searchMode === "image"
                    ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                }`}
              >
                IMAGE TARGET MATCH
              </button>
              <button
                onClick={() => setSearchMode("text")}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold font-mono tracking-wider uppercase transition-all ${
                  searchMode === "text"
                    ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                }`}
              >
                TACTICAL TEXT DESCR
              </button>
            </div>

            {/* Search Input */}
            {searchMode === "image" ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => imageInputRef.current?.click()}
                className={`
                  relative rounded-xl cursor-pointer transition-all overflow-hidden target-corners
                  ${isDragging
                    ? "border border-cyan-500 bg-cyan-500/5 drop-zone-active"
                    : "border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950/40"}
                  ${queryImage ? "p-2 border border-cyan-500/30" : "p-6"}
                `}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSearch}
                />
                {queryImage ? (
                  <div className="relative">
                    <img src={queryImage} alt="Query Target" className="max-h-32 mx-auto rounded border border-cyan-500/20" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setQueryImage(null); setMoments([]); addLog("Target clear.", "info"); }}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/90 border border-cyan-500/20 rounded-full flex items-center justify-center text-cyan-400 hover:text-white text-xs"
                    >
                      &times;
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <div className="w-10 h-10 rounded bg-cyan-500/5 border border-cyan-500/20 flex items-center justify-center mx-auto mb-2.5">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                    <p className="text-xs text-zinc-400 font-mono tracking-wide">DRAG & DROP EVIDENTIAL IMAGE TARGET</p>
                    <p className="text-[10px] text-zinc-600 font-mono mt-1 uppercase">Instant cosine-similarity visual lookup across feeds</p>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleTextSearch(); }} className="flex gap-2">
                <input
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  placeholder='Describe incident: "person wearing yellow hood", "police vehicle"'
                  className="flex-1 bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-2.5 text-xs font-mono text-zinc-200 placeholder-zinc-700 focus:border-cyan-500/50 focus:bg-[#09090c] transition-all"
                />
                <button
                  type="submit"
                  disabled={!textQuery.trim() || loading}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-20 disabled:hover:bg-cyan-600 rounded-xl text-xs font-mono font-bold text-black uppercase transition-all shadow-md shadow-cyan-500/10 tracking-widest"
                >
                  Search
                </button>
              </form>
            )}
          </div>

          {/* Results list */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin bg-zinc-950/10">
            {/* Loading / Scanning */}
            {loading && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="glass rounded-xl p-3 border border-cyan-500/5 animate-fade-up" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="flex gap-3">
                      <div className="w-36 h-20 bg-zinc-900/60 border border-zinc-800 rounded-lg shimmer relative overflow-hidden" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="w-20 h-3 bg-zinc-900/60 rounded shimmer" />
                        <div className="w-32 h-2 bg-zinc-900/40 rounded shimmer" />
                        <div className="w-24 h-2 bg-zinc-900/40 rounded shimmer" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && filteredMoments.length === 0 && !queryImage && (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="w-12 h-12 rounded bg-zinc-900/40 border border-zinc-900 flex items-center justify-center mb-3.5 target-corners text-zinc-700">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h3 className="text-xs font-bold font-mono text-zinc-500 uppercase tracking-widest mb-1">WAITING FOR TACTICAL QUERY</h3>
                <p className="text-[10px] font-mono text-zinc-700 max-w-xs leading-relaxed uppercase">
                  Input coordinates, text parameters, or screenshot uploads to process native embedding matching.
                </p>
              </div>
            )}

            {/* Results List */}
            {!loading && filteredMoments.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    ANALYSIS REVEALED: <strong className="text-cyan-400">{filteredMoments.length} Target Matches</strong>
                  </span>
                  {elapsed !== null && (
                    <span className="text-[9px] font-mono text-zinc-600">MATCH_TIME: {elapsed.toFixed(3)}s</span>
                  )}
                </div>

                <div className="space-y-3">
                  {filteredMoments.map((m, i) => {
                    const video = videos.find((v) => v.video_id === m.video_id);
                    const meta = video ? getFeedMetadata(video) : null;
                    const matchPct = Math.round(m.score * 100);

                    return (
                      <button
                        key={`${m.video_id}-${m.frame_num}`}
                        onClick={() => jumpToMoment(m)}
                        className="result-card w-full text-left glass rounded-xl p-3 group animate-fade-up target-corners hover:scale-[1.01]"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <div className="flex gap-3">
                          {/* Thumbnail w/ Radar Sweep on Hover */}
                          <div className="relative shrink-0 w-36 h-20 overflow-hidden rounded border border-zinc-900 group-hover:border-cyan-500/40 radar-sweep">
                            <img
                              src={`${API}${m.frame_url}`}
                              alt={`Frame at ${m.time_formatted}`}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute bottom-1 right-1 bg-black/95 text-white text-[9px] font-mono px-1.5 py-0.5 border border-zinc-800 rounded">
                              {m.time_formatted}
                            </div>
                            {i === 0 && (
                              <div className="absolute top-1 left-1 bg-cyan-600 text-black text-[9px] font-mono font-bold px-1.5 py-0.5 border border-cyan-400 rounded">
                                TARGET_LOCK
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 py-0.5 font-mono">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-cyan-400 text-glow-cyan">
                                TIMESTAMP: {m.time_formatted}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <div className="w-14 h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                                  <div 
                                    className={`h-full rounded-full ${
                                      m.score > 0.85 ? "bg-cyan-500" :
                                      m.score > 0.70 ? "bg-blue-500" : "bg-amber-500"
                                    }`} 
                                    style={{ width: `${matchPct}%` }} 
                                  />
                                </div>
                                <span className={`text-[10px] font-bold ${
                                  m.score > 0.85 ? "text-cyan-400" :
                                  m.score > 0.70 ? "text-blue-400" : "text-amber-500"
                                }`}>{matchPct}% MATCH</span>
                              </div>
                            </div>

                            {meta && (
                              <div className="flex items-center gap-1.5 mb-1.5 text-[9px]">
                                <span className={`px-1.5 py-0.2 rounded-[3px] border font-bold text-[8px] uppercase ${getFeedColor(meta.feed_type)}`}>
                                  {meta.feed_type}
                                </span>
                                <span className="text-zinc-300 font-bold truncate max-w-[120px]">{meta.camera_id}</span>
                                <span className="text-zinc-600">|</span>
                                <span className="text-zinc-500 truncate max-w-[110px]">{meta.location}</span>
                              </div>
                            )}

                            {m.description ? (
                              <p className="text-[10px] text-zinc-400 leading-normal line-clamp-2 bg-zinc-950/40 p-1.5 border border-zinc-900/60 rounded mb-1 text-zinc-400 italic">
                                "{m.description}"
                              </p>
                            ) : (
                              <p className="text-[10px] text-zinc-600 leading-normal mb-1">No AI frame analysis computed.</p>
                            )}

                            {meta && (
                              <div className="flex items-center gap-1.5 text-[8px] text-zinc-600">
                                <span>COORDINATES:</span>
                                <span className="text-cyan-600 font-bold">{meta.gps}</span>
                                <span className="text-zinc-700">&middot;</span>
                                <span>FRAME_{m.frame_num}</span>
                              </div>
                            )}
                          </div>

                          {/* Target Select Hover visual */}
                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-8 h-8 rounded border border-cyan-500/20 bg-cyan-500/5 flex items-center justify-center">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
