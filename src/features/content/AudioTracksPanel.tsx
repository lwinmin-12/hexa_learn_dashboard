import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import axios from "axios";
import { BookOpen, Mic, MoreHorizontal, Pause, Play, Plus } from "lucide-react";
import { Button } from "@/components/common/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/app/toast-context";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { messageFromError } from "@/lib/utils";
import { deleteAudioTrack, type AudioTrack } from "./api";
import {
  FileDropzone,
  LearningToolsEmpty,
  LearningToolsError,
  LearningToolsLoading,
  primaryActionClass,
} from "./LearningToolsShared";
import { getAllChapterItems } from "./learningTools";

type Track = Omit<AudioTrack, "durationSec" | "audioUrl"> & {
  durationSec: number | null;
  audioUrl: string | null;
  position?: number;
  fileSize?: number;
};
type AudioDialog = { kind: "upload" } | { kind: "rename"; track: Track } | null;
const types = [
  { value: "vocab", label: "Vocabulary", Icon: BookOpen },
  { value: "speaking", label: "Speaking", Icon: Mic },
] satisfies {
  value: AudioTrack["type"];
  label: string;
  Icon: typeof BookOpen;
}[];

function clock(seconds: number) {
  const rounded = Number.isFinite(seconds)
    ? Math.max(0, Math.floor(seconds))
    : 0;
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}
function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AudioTracksPanel({
  chapterId,
  chapterPicker,
}: {
  chapterId: string;
  chapterPicker: ReactNode;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const key = queryKeys.audio(chapterId);
  const tracks = useQuery({
    queryKey: key,
    queryFn: () => getAllChapterItems<Track>(chapterId, "audio"),
  });
  const [filter, setFilter] = useState<"all" | Track["type"]>("all");
  const [dialog, setDialog] = useState<AudioDialog>(null);
  const [deleting, setDeleting] = useState<Track | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const remove = useMutation({
    mutationFn: deleteAudioTrack,
    onSuccess: async () => {
      await refresh();
      setDeleting(null);
      restoreFocus();
      toast("Audio track deleted.");
    },
    onError: (error) => toast(messageFromError(error), "error"),
  });
  const sorted = [...(tracks.data ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const visible = sorted.filter(
    (track) => filter === "all" || track.type === filter,
  );
  function open(next: AudioDialog, trigger?: HTMLElement | null) {
    setPlayingId(null);
    opener.current =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setDialog(next);
  }
  function restoreFocus() {
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus();
      else document.getElementById("upload-audio-action")?.focus();
    });
  }
  function close() {
    setDialog(null);
    restoreFocus();
  }
  const uploadButton = (
    <Button
      id="upload-audio-action"
      variant="primary"
      className={primaryActionClass}
      onClick={() => open({ kind: "upload" })}
    >
      <Plus className="size-4" />
      Upload audio
    </Button>
  );

  return (
    <div className="space-y-5 p-5 md:p-6">
      <header className="sticky top-[68px] z-20 flex flex-col items-stretch justify-between gap-4 xl:flex-row xl:items-start bg-white/95 py-3 backdrop-blur dark:bg-slate-900/95">
        <div>
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Audio tracks
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Give learners vocabulary and speaking practice.
          </p>
          <div className="mt-4">{chapterPicker}</div>
        </div>
        {uploadButton}
      </header>
      {tracks.isLoading ? (
        <LearningToolsLoading />
      ) : tracks.isError ? (
        <LearningToolsError
          message={messageFromError(tracks.error)}
          onRetry={() => void tracks.refetch()}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Filter audio tracks"
              className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
            >
              {[{ value: "all", label: "All" }, ...types].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  aria-pressed={filter === type.value}
                  onClick={() => {
                    setPlayingId(null);
                    setFilter(
                      type.value === "vocab" || type.value === "speaking"
                        ? type.value
                        : "all",
                    );
                  }}
                  className={`rounded-md px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${filter === type.value ? "bg-white text-ink shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}
                >
                  {type.label}{" "}
                  <span className="ml-1">
                    {
                      sorted.filter(
                        (track) =>
                          type.value === "all" || track.type === type.value,
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {visible.length} {visible.length === 1 ? "track" : "tracks"}
            </p>
          </div>
          {!sorted.length ? (
            <LearningToolsEmpty
              title="No audio tracks yet"
              description="Upload an MP3 for learners to listen and practise."
            >
              <Button
                variant="primary"
                className={primaryActionClass}
                onClick={() => open({ kind: "upload" })}
              >
                <Plus className="size-4" />
                Upload audio
              </Button>
            </LearningToolsEmpty>
          ) : !visible.length ? (
            <LearningToolsEmpty
              title="No tracks in this category"
              description="Upload a track or choose another category."
            >
              <Button
                variant="primary"
                className={primaryActionClass}
                onClick={() => open({ kind: "upload" })}
              >
                <Plus className="size-4" />
                Upload audio
              </Button>
            </LearningToolsEmpty>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line dark:border-slate-700">
              {visible.map((track) => (
                <AudioTrackRow
                  key={track.id}
                  track={track}
                  playing={playingId === track.id}
                  onPlay={() => setPlayingId(track.id)}
                  onPause={() =>
                    setPlayingId((current) =>
                      current === track.id ? null : current,
                    )
                  }
                  onRename={(trigger) =>
                    open({ kind: "rename", track }, trigger)
                  }
                  onDelete={(trigger) => {
                    setPlayingId(null);
                    opener.current = trigger;
                    setDeleting(track);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
      {dialog?.kind === "upload" && (
        <AudioUploadDialog
          chapterId={chapterId}
          onClose={close}
          onUploaded={() => {
            void refresh();
            close();
            toast("Audio track uploaded.");
          }}
        />
      )}
      {dialog?.kind === "rename" && (
        <AudioRenameDialog
          track={dialog.track}
          onClose={close}
          onSaved={() => {
            void refresh();
            close();
            toast("Audio track renamed.");
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(isOpen) => {
          if (!isOpen && !remove.isPending) {
            setDeleting(null);
            restoreFocus();
          }
        }}
        title="Delete this track?"
        description="Learners will no longer see it."
        confirmLabel="Delete track"
        destructive
        busy={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
      />
    </div>
  );
}

function AudioTrackRow({
  track,
  playing,
  onPlay,
  onPause,
  onRename,
  onDelete,
}: {
  track: Track;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRename: (trigger: HTMLButtonElement | null) => void;
  onDelete: (trigger: HTMLButtonElement | null) => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(
    track.durationSec !== null &&
      Number.isFinite(track.durationSec) &&
      track.durationSec > 0
      ? track.durationSec
      : 0,
  );
  const [previewFailed, setPreviewFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const canPlay = /^https?:\/\//i.test(track.audioUrl ?? "") && !previewFailed;
  const type = types.find((item) => item.value === track.type) ?? types[0];
  useEffect(() => {
    const element = audio.current;
    let cancelled = false;
    if (playing) {
      setExpanded(true);
      void element?.play().catch(() => {
        if (!cancelled) setPreviewFailed(true);
      });
    } else element?.pause();
    return () => {
      cancelled = true;
      element?.pause();
    };
  }, [playing]);
  return (
    <div className="min-h-14 border-b border-line px-4 py-4 last:border-b-0 hover:bg-[#F7F8F8] dark:border-slate-700 dark:hover:bg-slate-800/60">
      <div className="flex items-center gap-3">
        <span
          title={
            !canPlay ? "Preview not available" : playing ? "Pause" : "Play"
          }
        >
          <button
            type="button"
            disabled={!canPlay}
            aria-label={
              !canPlay
                ? `Preview not available for ${track.title}`
                : `${playing ? "Pause" : "Play"} ${track.title}`
            }
            className="flex size-9 items-center justify-center rounded-full border border-line text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-slate-600 dark:text-slate-100"
            onClick={playing ? onPause : onPlay}
          >
            {playing ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </button>
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium text-ink dark:text-white">
            {track.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">
              <type.Icon className="size-3" />
              {type.label}
            </span>
            <span aria-label="Duration">
              {duration ? clock(duration) : "—"}
            </span>
            {track.fileSize !== undefined && (
              <span>{sizeLabel(track.fileSize)}</span>
            )}
          </div>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              ref={menuTrigger}
              type="button"
              title={`Actions for ${track.title}`}
              aria-label={`Actions for ${track.title}`}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:text-slate-300"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              className="z-50 min-w-36 rounded-lg border border-line bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <DropdownMenu.Item
                onSelect={() => onRename(menuTrigger.current)}
                className="cursor-pointer rounded px-3 py-2 text-sm outline-none focus:bg-slate-100 dark:focus:bg-slate-800"
              >
                Rename
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => onDelete(menuTrigger.current)}
                className="cursor-pointer rounded px-3 py-2 text-sm text-red-700 outline-none focus:bg-red-50 dark:text-red-400 dark:focus:bg-red-950"
              >
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {canPlay && (
        <audio
          ref={audio}
          src={track.audioUrl ?? undefined}
          preload="metadata"
          onLoadedMetadata={(event) => {
            if (Number.isFinite(event.currentTarget.duration))
              setDuration(event.currentTarget.duration);
          }}
          onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
          onEnded={onPause}
          onError={() => {
            setPreviewFailed(true);
            onPause();
          }}
        />
      )}
      {expanded && canPlay && (
        <div className="mt-3 flex items-center gap-3 pl-12">
          <input
            type="range"
            aria-label={`Seek ${track.title}`}
            min={0}
            max={duration || 1}
            step="0.1"
            value={Math.min(position, duration || 1)}
            disabled={!duration}
            onChange={(event) => {
              if (audio.current)
                audio.current.currentTime = Number(event.target.value);
              setPosition(Number(event.target.value));
            }}
            className="min-w-0 flex-1 accent-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          />
          <span className="whitespace-nowrap text-xs tabular-nums text-slate-600 dark:text-slate-300">
            {clock(position)} / {clock(duration)}
          </span>
        </div>
      )}
    </div>
  );
}

function AudioRenameDialog({
  track,
  onClose,
  onSaved,
}: {
  track: Track;
  onClose: () => void;
  onSaved: () => void;
}) {
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // The menu restores focus after the dialog mounts.
    const frame = requestAnimationFrame(() => titleInput.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const [title, setTitle] = useState(track.title);
  const toast = useToast();
  const save = useMutation({
    mutationFn: () =>
      api.patch(`/admin/audio/${track.id}`, { title: title.trim() }),
    onSuccess: onSaved,
    onError: (error) => toast(messageFromError(error), "error"),
  });
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
      title="Rename audio track"
      description="Use a clear title learners can recognise."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (
            title.trim().length >= 2 &&
            title.trim().length <= 120 &&
            !save.isPending
          )
            save.mutate();
        }}
        className="space-y-4"
      >
        <label className="block text-sm font-medium">
          Title
          <input
            ref={titleInput}
            autoFocus
            required
            minLength={2}
            maxLength={120}
            className="field mt-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          2 to 120 characters.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" disabled={save.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className={primaryActionClass}
            disabled={title.trim().length < 2 || save.isPending}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AudioUploadDialog({
  chapterId,
  onClose,
  onUploaded,
}: {
  chapterId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AudioTrack["type"]>("vocab");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => controller.current?.abort(), []);
  function chooseFile(next: File) {
    setDuration(0);
    setError(null);
    if (
      !next.name.toLowerCase().endsWith(".mp3") ||
      (next.type && !["audio/mpeg", "audio/mp3"].includes(next.type))
    ) {
      setFile(null);
      setError("Choose an MP3 audio file.");
      return;
    }
    if (next.size > 30 * 1024 * 1024) {
      setFile(null);
      setError("MP3 files must be 30 MB or smaller.");
      return;
    }
    if (!next.size) {
      setFile(null);
      setError("Choose an MP3 file that is not empty.");
      return;
    }
    setFile(next);
    if (!title.trim()) setTitle(next.name.replace(/\.mp3$/i, "").slice(0, 120));
  }
  function cancel() {
    controller.current?.abort();
    onClose();
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !file ||
      title.trim().length < 2 ||
      title.trim().length > 120 ||
      uploading
    )
      return;
    const request = new AbortController();
    controller.current = request;
    setUploading(true);
    setError(null);
    setProgress(0);
    const form = new FormData();
    form.append(
      "file",
      file.type ? file : new File([file], file.name, { type: "audio/mpeg" }),
    );
    form.append("title", title.trim());
    form.append("type", type);
    if (duration > 0 && Number.isFinite(duration))
      form.append("durationSec", String(Math.max(1, Math.round(duration))));
    try {
      await api.post<AudioTrack>(`/admin/chapters/${chapterId}/audio`, form, {
        signal: request.signal,
        onUploadProgress: (event) => {
          if (event.total)
            setProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
      if (!request.signal.aborted) onUploaded();
    } catch (failure) {
      if (!axios.isCancel(failure) && !request.signal.aborted) {
        const message = messageFromError(failure);
        setError(message);
        toast(message, "error");
      }
    } finally {
      if (!request.signal.aborted) setUploading(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
      title="Upload audio"
      description="Add an MP3 for vocabulary or speaking practice."
    >
      <form onSubmit={(event) => void upload(event)} className="space-y-5">
        <label className="block text-sm font-medium">
          Title
          <input
            autoFocus
            required
            minLength={2}
            maxLength={120}
            disabled={uploading}
            className="field mt-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <p className="-mt-3 text-xs text-slate-600 dark:text-slate-300">
          2 to 120 characters.
        </p>
        <fieldset disabled={uploading}>
          <legend className="mb-2 text-sm font-medium">Type</legend>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {types.map((item) => (
              <label
                key={item.value}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm ${type === item.value ? "bg-white text-ink shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}
              >
                <input
                  className="sr-only peer"
                  type="radio"
                  name="audio-type"
                  value={item.value}
                  checked={type === item.value}
                  onChange={() => setType(item.value)}
                />
                <span className="inline-flex items-center gap-2 rounded peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-teal-700">
                  <item.Icon className="size-4" />
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <FileDropzone
          label="MP3 file, up to 30 MB"
          accept=".mp3,audio/mpeg,audio/mp3"
          disabled={uploading}
          onFile={chooseFile}
        />
        {file && (
          <div className="space-y-2 rounded-lg border border-line p-3 dark:border-slate-700">
            <p className="break-words text-sm font-medium">{file.name}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {sizeLabel(file.size)}
              {duration > 0 ? ` · ${clock(duration)}` : ""}
            </p>
            {preview && (
              <audio
                controls
                preload="metadata"
                src={preview}
                aria-label="Selected audio preview"
                className="h-10 w-full"
                onLoadedMetadata={(event) => {
                  const value = event.currentTarget.duration;
                  if (Number.isFinite(value) && value > 0) setDuration(value);
                }}
              />
            )}
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {error}
          </p>
        )}
        {uploading && (
          <div role="status" className="space-y-2">
            <div
              role="progressbar"
              aria-label="Audio upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            >
              <div
                className="h-full bg-slate-700 transition-all dark:bg-slate-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {progress < 100 ? `Uploading… ${progress}%` : "Finishing upload…"}
            </p>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-4 dark:border-slate-700">
          <Button type="button" onClick={cancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className={primaryActionClass}
            disabled={
              uploading ||
              !file ||
              title.trim().length < 2 ||
              title.trim().length > 120
            }
          >
            {uploading
              ? "Uploading…"
              : error && file
                ? "Retry upload"
                : "Upload audio"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
