"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";

import { recordWatchProgressAction } from "@/app/actions/learning";
import { cn, formatTimecode } from "@/lib/utils";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

/**
 * Custom video chrome. The native controls are hidden so the player matches the
 * neumorphic surface, and because we need the watch-position hook: progress is
 * reported to the server every 15 seconds and on pause/end, which is what
 * auto-completes the lesson.
 */
export function VideoPlayer({
  src,
  lessonId,
  poster,
  onCompleted,
}: {
  src: string;
  lessonId: string;
  poster?: string | null;
  onCompleted?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<number | undefined>(undefined);
  const lastReport = useRef(0);
  const reportedComplete = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [buffered, setBuffered] = useState(0);

  const report = useCallback(
    async (seconds: number, total: number) => {
      if (!total) return;
      try {
        const result = await recordWatchProgressAction({
          lessonId,
          seconds,
          duration: total,
        });
        if (result.completed && !reportedComplete.current) {
          reportedComplete.current = true;
          onCompleted?.();
        }
      } catch {
        // A dropped progress ping is not worth interrupting playback for; the
        // next tick will carry the newer position anyway.
      }
    },
    [lessonId, onCompleted]
  );

  // Reset per-lesson state when the source changes.
  useEffect(() => {
    reportedComplete.current = false;
    lastReport.current = 0;
    setCurrent(0);
    setPlaying(false);
  }, [src, lessonId]);

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrent(video.currentTime);

    if (video.buffered.length > 0) {
      setBuffered(video.buffered.end(video.buffered.length - 1));
    }

    // Throttle to one write per 15 seconds of playback.
    if (video.currentTime - lastReport.current >= 15) {
      lastReport.current = video.currentTime;
      void report(video.currentTime, video.duration);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(seconds, video.duration || 0));
    setCurrent(video.currentTime);
  };

  const toggleFullscreen = async () => {
    if (!shellRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await shellRef.current.requestFullscreen();
    }
  };

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Keyboard shortcuts, scoped to when the player shell has focus so they don't
  // hijack typing in the notes panel.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (!shellRef.current?.contains(document.activeElement) && !fullscreen) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (event.key) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          event.preventDefault();
          seek(video.currentTime - 5);
          break;
        case "ArrowRight":
          event.preventDefault();
          seek(video.currentTime + 5);
          break;
        case "j":
          seek(video.currentTime - 10);
          break;
        case "l":
          seek(video.currentTime + 10);
          break;
        case "m":
          video.muted = !video.muted;
          setMuted(video.muted);
          break;
        case "f":
          void toggleFullscreen();
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  const nudgeControls = () => {
    setControlsVisible(true);
    window.clearTimeout(hideControlsTimer.current);
    if (playing) {
      hideControlsTimer.current = window.setTimeout(
        () => setControlsVisible(false),
        2600
      );
    }
  };

  const progressPercent = duration ? (current / duration) * 100 : 0;
  const bufferedPercent = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={shellRef}
      tabIndex={-1}
      onMouseMove={nudgeControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
      className="group relative aspect-video w-full overflow-hidden rounded-[var(--radius-neu)] bg-black outline-none"
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        className="h-full w-full"
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
          nudgeControls();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
          const video = videoRef.current;
          if (video) void report(video.currentTime, video.duration);
        }}
        onEnded={() => {
          setPlaying(false);
          setControlsVisible(true);
          const video = videoRef.current;
          if (video) void report(video.duration, video.duration);
        }}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
      />

      {/* Centre play affordance */}
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/35"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-md transition-transform duration-300 hover:scale-110">
            <Play className="ml-1 h-9 w-9 fill-white text-white" />
          </span>
        </button>
      )}

      {/* Controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Scrubber */}
        <div className="relative mb-2 h-1.5 w-full cursor-pointer">
          <div className="absolute inset-0 rounded-full bg-white/25" />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/35"
            style={{ width: `${bufferedPercent}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
            style={{ left: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        <div className="flex items-center gap-2 text-white">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
          >
            {playing ? (
              <Pause className="h-5 w-5 fill-white" />
            ) : (
              <Play className="h-5 w-5 fill-white" />
            )}
          </button>

          <button
            type="button"
            onClick={() => seek(current - 10)}
            aria-label="Back 10 seconds"
            className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => seek(current + 10)}
            aria-label="Forward 10 seconds"
            className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
          >
            <RotateCw className="h-4 w-4" />
          </button>

          <div className="group/vol flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                video.muted = !video.muted;
              }}
              aria-label={muted ? "Unmute" : "Mute"}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const video = videoRef.current;
                if (!video) return;
                video.volume = Number(e.target.value);
                video.muted = Number(e.target.value) === 0;
              }}
              aria-label="Volume"
              className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 transition-all duration-250 group-hover/vol:w-16 group-hover/vol:opacity-100 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>

          <span className="ml-1 text-xs tabular-nums text-white/85">
            {formatTimecode(current)} / {formatTimecode(duration)}
          </span>

          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setShowSpeed((v) => !v)}
              aria-label="Playback speed"
              aria-expanded={showSpeed}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors hover:bg-white/15"
            >
              <Settings2 className="h-4 w-4" />
              {speed}×
            </button>

            {showSpeed && (
              <div className="absolute bottom-[calc(100%+8px)] right-0 overflow-hidden rounded-xl bg-black/90 backdrop-blur-md">
                {SPEEDS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      const video = videoRef.current;
                      if (video) video.playbackRate = option;
                      setSpeed(option);
                      setShowSpeed(false);
                    }}
                    className={cn(
                      "block w-full px-4 py-2 text-left text-xs transition-colors hover:bg-white/15",
                      option === speed && "text-[var(--accent-soft)]"
                    )}
                  >
                    {option}×
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
          >
            {fullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
