import { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./supabase";
import { CoverGraphic } from "./components/CoverGraphic";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PlaylistListPage />} />
      <Route path="/:playlistId" element={<PlaylistDetailPage />} />
    </Routes>
  );
}

// ========================
// 플레이리스트 목록 페이지
// ========================
function PlaylistListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [playlists, setPlaylists] = useState([]);
  const [songCountByPlaylist, setSongCountByPlaylist] = useState({});
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistsError, setPlaylistsError] = useState("");
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [newPlaylistFile, setNewPlaylistFile] = useState(null);
  const [newPlaylistPreview, setNewPlaylistPreview] = useState("");
  const [playlistError, setPlaylistError] = useState("");
  const [playlistSuccess, setPlaylistSuccess] = useState("");
  const [playlistUploading, setPlaylistUploading] = useState(false);

  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [editingPlaylistTitle, setEditingPlaylistTitle] = useState("");
  const [editingPlaylistThumbnail, setEditingPlaylistThumbnail] = useState("");
  const [editingPlaylistFile, setEditingPlaylistFile] = useState(null);
  const [editingPlaylistPreview, setEditingPlaylistPreview] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const addFileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  const playlistFetchRequestRef = useRef(0);

  const fetchSongCounts = async (playlistIds) => {
    if (!playlistIds.length) {
      return {};
    }

    const { data, error } = await supabase
      .from("songs")
      .select("playlist_id")
      .in("playlist_id", playlistIds);

    if (error) {
      console.error(error);
      return null;
    }

    const counts = (data || []).reduce((acc, song) => {
      const key = song.playlist_id;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return counts;
  };

  const fetchPlaylists = async () => {
    const requestId = playlistFetchRequestRef.current + 1;
    playlistFetchRequestRef.current = requestId;

    setPlaylistsLoading(true);
    setPlaylistsError("");

    const { data, error } = await supabase
      .from("playlists")
      .select("*")
      .order("created_at", { ascending: false });

    if (requestId !== playlistFetchRequestRef.current) {
      return;
    }

    if (error) {
      console.error(error);
      setPlaylistsError("플레이리스트 불러오기 실패");
    } else {
      const normalizedPlaylists = (data || []).map((item) => ({
          id: item.id,
          playlist_id: item.id?.toString() || `pl-${Date.now()}`,
          title: item.title,
          thumbnail: item.thumbnail || "",
          created_at: item.created_at || null,
        }));

      const counts = await fetchSongCounts(normalizedPlaylists.map((item) => item.id));
      if (requestId !== playlistFetchRequestRef.current) {
        return;
      }

      setPlaylists(normalizedPlaylists);
      setSongCountByPlaylist(counts || {});
    }

    if (requestId === playlistFetchRequestRef.current) {
      setPlaylistsLoading(false);
    }
  };

  useEffect(() => {
    let disposed = false;

    fetchPlaylists();
    const delayedRefetch = setTimeout(() => {
      if (!disposed) {
        fetchPlaylists();
      }
    }, 1200);

    return () => {
      disposed = true;
      clearTimeout(delayedRefetch);
    };
  }, [location.key]);

  useEffect(() => {
    const handleFocus = () => {
      fetchPlaylists();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchPlaylists();
      }
    };
    const handlePageShow = () => {
      fetchPlaylists();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (playlistSuccess) {
      const timer = setTimeout(() => {
        setPlaylistSuccess("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [playlistSuccess]);

  const sanitizeFileName = (originalName) => {
    const ext = originalName.split(".").pop() || "jpg";
    const nameWithoutExt = originalName.split(".").slice(0, -1).join(".");
    const sanitized = nameWithoutExt
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase()
      .slice(0, 50);
    return `${sanitized}-${Date.now()}.${ext}`;
  };

  const uploadPlaylistThumbnail = async (file) => {
    if (!file) return "";
    const fileName = `playlist/${sanitizeFileName(file.name)}`;
    const { data, error } = await supabase.storage
      .from("playlists")
      .upload(fileName, file, { cacheControl: "3600", upsert: false });

    if (error) {
      console.error("썸네일 업로드 실패", error);
      throw error;
    }

    const { data: urlData } = supabase.storage.from("playlists").getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handlePlaylistFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (newPlaylistPreview) {
      URL.revokeObjectURL(newPlaylistPreview);
    }
    if (file) {
      setNewPlaylistPreview(URL.createObjectURL(file));
      setNewPlaylistFile(file);
    } else {
      setNewPlaylistFile(null);
      setNewPlaylistPreview("");
    }
  };

  const handleRemoveSelectedImage = () => {
    if (newPlaylistPreview) {
      URL.revokeObjectURL(newPlaylistPreview);
    }
    setNewPlaylistFile(null);
    setNewPlaylistPreview("");
  };

  const handleCancelAddPlaylist = () => {
    if (newPlaylistPreview) {
      URL.revokeObjectURL(newPlaylistPreview);
    }
    setNewPlaylistTitle("");
    setNewPlaylistFile(null);
    setNewPlaylistPreview("");
    setPlaylistError("");
    setPlaylistSuccess("");
  };

  const handleAddPlaylist = async () => {
    setPlaylistError("");
    setPlaylistSuccess("");

    if (!newPlaylistTitle.trim()) {
      setPlaylistError("플레이리스트 제목은 필수입니다.");
      return;
    }

    setPlaylistUploading(true);
    let thumbnailUrl = "";

    try {
      if (newPlaylistFile) {
        thumbnailUrl = await uploadPlaylistThumbnail(newPlaylistFile);
      }

      const { data, error } = await supabase
        .from("playlists")
        .insert([{ title: newPlaylistTitle.trim(), thumbnail: thumbnailUrl }])
        .select("*")
        .single();

      if (error) throw error;

      const addedPlaylist = {
        id: data.id,
        playlist_id: data.id?.toString() || `pl-${Date.now()}`,
        title: data.title,
        thumbnail: data.thumbnail || "",
        created_at: data.created_at || null,
      };

      setPlaylists((prev) => [addedPlaylist, ...prev]);
      setNewPlaylistTitle("");
      setNewPlaylistFile(null);
      if (newPlaylistPreview) {
        URL.revokeObjectURL(newPlaylistPreview);
        setNewPlaylistPreview("");
      }
      setSongCountByPlaylist((prev) => ({ ...prev, [data.id]: 0 }));
      setModalMode(null);
      setPlaylistSuccess("플레이리스트가 성공적으로 추가되었습니다.");
    } catch (uploadError) {
      console.error(uploadError);
      setPlaylistError("플레이리스트 추가 실패. 다시 시도해주세요.");
    } finally {
      setPlaylistUploading(false);
    }
  };

  const handleEditPlaylist = (playlist) => {
    setEditingPlaylistId(playlist.id);
    setEditingPlaylistTitle(playlist.title);
    setEditingPlaylistThumbnail(playlist.thumbnail);
    setEditingPlaylistFile(null);
    setEditingPlaylistPreview("");
    setOpenMenuId(null);
    setModalMode("edit");
    setPlaylistError("");
    setPlaylistSuccess("");
  };

  const handleEditFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (editingPlaylistPreview) {
      URL.revokeObjectURL(editingPlaylistPreview);
    }
    if (file) {
      setEditingPlaylistPreview(URL.createObjectURL(file));
      setEditingPlaylistFile(file);
    } else {
      setEditingPlaylistFile(null);
      setEditingPlaylistPreview("");
    }
  };

  const handleRemoveEditingImage = () => {
    if (editingPlaylistPreview) {
      URL.revokeObjectURL(editingPlaylistPreview);
      setEditingPlaylistPreview("");
      setEditingPlaylistFile(null);
    } else if (editingPlaylistThumbnail) {
      setEditingPlaylistThumbnail("");
    }
  };

  const handleCancelEditPlaylist = () => {
    setEditingPlaylistId(null);
    setEditingPlaylistTitle("");
    setEditingPlaylistThumbnail("");
    setEditingPlaylistFile(null);
    if (editingPlaylistPreview) {
      URL.revokeObjectURL(editingPlaylistPreview);
      setEditingPlaylistPreview("");
    }
    setModalMode(null);
    setPlaylistError("");
    setPlaylistSuccess("");
  };

  const handleSaveEditPlaylist = async () => {
    setPlaylistError("");
    setPlaylistSuccess("");

    if (!editingPlaylistTitle.trim()) {
      setPlaylistError("플레이리스트 제목은 필수입니다.");
      return;
    }

    setPlaylistUploading(true);
    let newThumbnailUrl = editingPlaylistThumbnail;

    try {
      if (editingPlaylistFile) {
        newThumbnailUrl = await uploadPlaylistThumbnail(editingPlaylistFile);
      }

      const { data, error } = await supabase
        .from("playlists")
        .update({
          title: editingPlaylistTitle.trim(),
          thumbnail: newThumbnailUrl,
        })
        .eq("id", editingPlaylistId)
        .select("*")
        .single();

      if (error) throw error;

      setPlaylists((prev) =>
        prev.map((pl) =>
          pl.id === editingPlaylistId
            ? {
                ...pl,
                title: data.title,
                thumbnail: data.thumbnail || "",
                created_at: data.created_at || pl.created_at,
              }
            : pl
        )
      );

      setPlaylistSuccess("플레이리스트가 성공적으로 수정되었습니다.");
      handleCancelEditPlaylist();
    } catch (updateError) {
      console.error(updateError);
      setPlaylistError("플레이리스트 수정 실패. 다시 시도해주세요.");
    } finally {
      setPlaylistUploading(false);
    }
  };

  const handleDeletePlaylist = async (id) => {
    if (!window.confirm("이 플레이리스트를 삭제하시겠습니까?")) return;

    try {
      const { error } = await supabase.from("playlists").delete().eq("id", id);
      if (error) {
        console.error(error);
        setPlaylistError("플레이리스트 삭제 실패");
        return;
      }

      setPlaylists((prev) => prev.filter((pl) => pl.id !== id));
      setSongCountByPlaylist((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setOpenMenuId(null);
      setPlaylistSuccess("플레이리스트가 삭제되었습니다.");
    } catch (error) {
      console.error(error);
      setPlaylistError("플레이리스트 삭제 중 오류가 발생했습니다.");
    }
  };

  const openAddPlaylistModal = () => {
    handleCancelAddPlaylist();
    setNewPlaylistTitle("Empty");
    setModalMode("add");
    setOpenMenuId(null);
  };

  const closePlaylistModal = () => {
    if (modalMode === "edit") {
      handleCancelEditPlaylist();
      return;
    }
    handleCancelAddPlaylist();
    setModalMode(null);
  };

  const handleSaveModal = async () => {
    if (modalMode === "edit") {
      await handleSaveEditPlaylist();
      return;
    }
    await handleAddPlaylist();
  };

  const saveDisabled =
    playlistUploading ||
    (modalMode === "edit"
      ? !editingPlaylistTitle.trim()
      : !newPlaylistTitle.trim());

  const modalPreviewImage =
    modalMode === "edit"
      ? editingPlaylistPreview || editingPlaylistThumbnail
      : newPlaylistPreview;

  const modalTitleValue = modalMode === "edit" ? editingPlaylistTitle : newPlaylistTitle;

  const modalTitleSetter = modalMode === "edit" ? setEditingPlaylistTitle : setNewPlaylistTitle;

  const currentModalPlaylistCount =
    modalMode === "edit" ? songCountByPlaylist[editingPlaylistId] || 0 : 0;

  const triggerModalFilePicker = () => {
    if (modalMode === "edit") {
      editFileInputRef.current?.click();
      return;
    }
    addFileInputRef.current?.click();
  };

  return (
    <div
      className="min-h-screen bg-[#e8e6dd] px-6 py-10 text-[#0a0a0a] md:px-12 md:py-16"
      style={{
        fontFamily: "'Space Grotesk', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
      }}
      onClick={() => setOpenMenuId(null)}
    >
      <header className="mx-auto mb-10 w-full max-w-7xl md:mb-12">
        <h1 className="mb-2 text-[2.5rem] font-bold leading-none tracking-[-0.02em] text-[#0a0a0a] md:text-[4rem]">
          Mayonnaise
        </h1>
        <p className="text-lg font-normal text-[#0a0a0a] md:text-2xl">Share your music</p>
      </header>

      <div className="mx-auto w-full max-w-7xl">
        {playlistsError && (
          <p className="mb-3 rounded-xl border border-[#d9b8b1] bg-[#f3e4df] px-4 py-2 text-sm font-medium text-[#a44949]">
            {playlistsError}
          </p>
        )}
        {playlistError && (
          <p className="mb-3 rounded-xl border border-[#d9b8b1] bg-[#f3e4df] px-4 py-2 text-sm font-medium text-[#a44949]">
            {playlistError}
          </p>
        )}
        {playlistSuccess && (
          <p className="mb-3 rounded-xl border border-[#d9c4ad] bg-[#f0e3d0] px-4 py-2 text-sm font-medium text-[#8b6f3d]">
            {playlistSuccess}
          </p>
        )}
      </div>

      {playlistsLoading ? (
        <p className="mx-auto w-full max-w-7xl text-lg font-medium text-[#5a5a5a]">플레이리스트 로딩 중...</p>
      ) : (
        <section className="mx-auto grid w-full max-w-7xl grid-cols-1 auto-rows-fr gap-8 md:grid-cols-2 lg:grid-cols-3">
          {playlists.map((pl) => (
            <article
              key={pl.playlist_id}
              className="relative flex h-full cursor-pointer flex-col rounded-3xl bg-[#ddd9cd] p-6 transition-[transform,background-color,box-shadow] duration-200 ease-out hover:z-10 hover:scale-[1.012] hover:-translate-y-0.5 hover:bg-[#e8e4d9] hover:shadow-[0_10px_24px_rgba(44,39,31,0.16)]"
              onClick={() => navigate(`/${pl.id}`)}
            >
              <div className="mb-4 flex items-start gap-4">
                <div className="min-w-0 pr-2">
                  <h2
                    className="mb-2 line-clamp-2 break-words leading-[1.2] text-[#0a0a0a]"
                    style={{ fontSize: "1.75rem", fontWeight: 700 }}
                  >
                    {pl.title}
                  </h2>
                  <p style={{ fontSize: "0.95rem", fontWeight: 400, minHeight: "1.4rem" }} className="text-[#5a5a5a]">
                    {(songCountByPlaylist[pl.id] || 0) > 0 ? `${songCountByPlaylist[pl.id] || 0} Tracks` : "0 Tracks"}
                  </p>
                </div>
              </div>

              <div className="absolute right-[6px] top-6 z-10" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="group flex h-9 w-9 appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 outline-none hover:bg-transparent focus:bg-transparent active:bg-transparent"
                  onClick={() =>
                    setOpenMenuId((prev) => (prev === pl.id ? null : pl.id))
                  }
                  aria-label="playlist menu"
                >
                  <div className="flex flex-col items-center justify-center">
                    <span className="mb-1 block h-1.5 w-1.5 rounded-full bg-[#7a756a] transition-colors group-hover:bg-[#c95652]" />
                    <span className="mb-1 block h-1.5 w-1.5 rounded-full bg-[#7a756a] transition-colors group-hover:bg-[#c95652]" />
                    <span className="block h-1.5 w-1.5 rounded-full bg-[#7a756a] transition-colors group-hover:bg-[#c95652]" />
                  </div>
                </button>

                {openMenuId === pl.id && (
                  <div className="absolute right-0 top-11 z-20 w-40 rounded-xl bg-[#d7d3c8] p-2 shadow-[0_8px_20px_rgba(58,50,34,0.18)]">
                    <button
                      type="button"
                      className="mb-1 w-full appearance-none rounded-lg border-0 bg-[#ece9df] px-3 py-2 text-left font-semibold text-[#2c291f] outline-none transition hover:bg-[#f4f2ea]"
                      onClick={() => handleEditPlaylist(pl)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="w-full appearance-none rounded-lg border-0 bg-[#ece9df] px-3 py-2 text-left font-semibold text-[#9a4343] outline-none transition hover:bg-[#f4f2ea]"
                      onClick={() => handleDeletePlaylist(pl.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              <div className="aspect-square w-full overflow-hidden rounded-2xl bg-[#e8e6dd]">
                {pl.thumbnail ? (
                  <img
                    src={pl.thumbnail}
                    alt={pl.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <CoverGraphic />
                )}
              </div>
            </article>
          ))}

          <article
            className="relative flex h-full cursor-pointer flex-col rounded-3xl bg-[#ddd9cd] p-6 transition-[transform,background-color,box-shadow] duration-200 ease-out hover:z-10 hover:scale-[1.012] hover:-translate-y-0.5 hover:bg-[#e8e4d9] hover:shadow-[0_10px_24px_rgba(44,39,31,0.16)]"
            onClick={openAddPlaylistModal}
          >
            <div className="mb-4 flex items-start gap-4">
              <div className="min-w-0 pr-2">
                <h2
                  className="mb-2 line-clamp-2 break-words leading-[1.2] text-[#0a0a0a]"
                  style={{ fontSize: "1.75rem", fontWeight: 700 }}
                >
                  New playlist
                </h2>
                <p style={{ fontSize: "0.95rem", fontWeight: 400, minHeight: "1.4rem" }} className="text-[#5a5a5a]">
                  
                </p>
              </div>
            </div>
            <div className="pointer-events-none absolute right-[6px] top-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-full" aria-hidden="true">
                <div className="flex flex-col items-center justify-center">
                  <span className="mb-1 block h-1.5 w-1.5 rounded-full bg-[#7a756a]" />
                  <span className="mb-1 block h-1.5 w-1.5 rounded-full bg-[#7a756a]" />
                  <span className="block h-1.5 w-1.5 rounded-full bg-[#7a756a]" />
                </div>
              </div>
            </div>
            <div className="aspect-square w-full overflow-hidden rounded-2xl bg-[#e8e6dd]">
              <CoverGraphic />
            </div>
          </article>
        </section>
      )}

      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/45 p-4 backdrop-blur-[3px]"
          onClick={closePlaylistModal}
        >
          <div
            className="w-full max-w-[500px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-3xl bg-[#ddd9cd] p-8">
              <input
                className="w-full bg-transparent text-[36px] font-bold leading-[1.06] tracking-[-0.02em] text-[#0a0a0a] outline-none placeholder:text-[#6d685f] md:text-[50px]"
                placeholder={modalMode === "edit" ? "Edit playlist" : "New playlist"}
                value={modalTitleValue}
                onChange={(e) => modalTitleSetter(e.target.value)}
                disabled={playlistUploading}
              />

              {!modalTitleValue.trim() && (
                <p className="mt-1 text-xs font-semibold text-[#a44949]">필수 입력 항목입니다.</p>
              )}

              <p className="mt-2 text-base font-medium text-[#5a5a5a] md:text-lg">
                {currentModalPlaylistCount} Tracks
              </p>

              <div className="hidden">
                <input
                  ref={addFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePlaylistFileChange}
                  disabled={playlistUploading}
                />
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEditFileChange}
                  disabled={playlistUploading}
                />
              </div>

              <div
                role="button"
                tabIndex={playlistUploading ? -1 : 0}
                aria-disabled={playlistUploading}
                className="relative mt-4 block aspect-square w-full overflow-hidden rounded-2xl bg-[#e8e6dd]"
                onClick={() => {
                  if (!playlistUploading) triggerModalFilePicker();
                }}
                onKeyDown={(e) => {
                  if (playlistUploading) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    triggerModalFilePicker();
                  }
                }}
              >
                {modalPreviewImage ? (
                  <img
                    src={modalPreviewImage}
                    alt="playlist preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-[#5a5a5a]">
                    Insert Image
                  </div>
                )}
                {modalPreviewImage && (
                  <button
                    type="button"
                    className="absolute right-3 top-3 rounded-lg border border-[#cfb7b6] bg-[#f4e3e2]/90 px-2 py-1 text-xs font-bold text-[#9a4343]"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (modalMode === "edit") {
                        handleRemoveEditingImage();
                      } else {
                        handleRemoveSelectedImage();
                      }
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 px-1">
              <button
                type="button"
                className="rounded-xl border border-[#cfc8b8] bg-[#c4c0b5] px-6 py-2 text-lg font-bold text-[#0a0a0a] transition hover:bg-[#b8b4a8] md:text-xl"
                onClick={closePlaylistModal}
                disabled={playlistUploading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl border-0 px-6 py-2 text-lg font-bold transition md:text-xl"
                style={{
                  backgroundColor: saveDisabled ? "#c4c0b5" : "#c95652",
                  color: saveDisabled ? "#6d685f" : "#ffffff",
                  cursor: saveDisabled ? "not-allowed" : "pointer",
                }}
                onClick={handleSaveModal}
                disabled={saveDisabled}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========================
// 플레이리스트 상세 페이지 (음악 CRUD)
// ========================
function PlaylistDetailPage() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState(null);
  const [playlistLoading, setPlaylistLoading] = useState(true);
  const [songs, setSongs] = useState([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [link, setLink] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [itunesQuery, setItunesQuery] = useState("");
  const [itunesResults, setItunesResults] = useState([]);
  const [itunesLoading, setItunesLoading] = useState(false);
  const [itunesError, setItunesError] = useState("");
  const itunesAbortControllerRef = useRef(null);
  const metadataBackfillRunningRef = useRef(false);
  const metadataBackfillAttemptedIdsRef = useRef(new Set());

  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingArtist, setEditingArtist] = useState("");
  const [editingLink, setEditingLink] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [songMutating, setSongMutating] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLinks, setExportLinks] = useState([]);

  const platformOptions = [
    { value: "all", label: "모두 보기" },
    { value: "youtube", label: "YouTube" },
    { value: "apple_music", label: "Apple Music" },
    { value: "soundcloud", label: "Soundcloud" },
    { value: "link", label: "link" },
  ];

  const getLinkType = (rawLink) => {
    if (!rawLink || !rawLink.trim()) {
      return null;
    }

    const trimmed = rawLink.trim();
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const host = new URL(normalized).hostname.toLowerCase();

      if (host.includes("youtube.com") || host.includes("youtu.be")) {
        return "youtube";
      }
      if (host.includes("music.apple.com") || host.includes("itunes.apple.com")) {
        return "apple_music";
      }
      if (host.includes("soundcloud.com")) {
        return "soundcloud";
      }

      return "link";
    } catch {
      return "link";
    }
  };

  const extractAppleMusicSongId = (url) => {
    if (!url) return null;
    try {
      const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const parsed = new URL(normalized);
      // ?i=SONGID 형식
      const i = parsed.searchParams.get("i");
      if (i) return i;
      // /album/name/ALBUMID 형식에서 마지막 숫자 추출 (단독 트랙 링크)
      const segments = parsed.pathname.split("/").filter(Boolean);
      const last = segments[segments.length - 1];
      if (/^\d+$/.test(last)) return last;
      // /.../id123456789 또는 쿼리/경로에 포함된 id123456789 형식
      const idMatch = `${parsed.pathname}${parsed.search}`.match(/id(\d{6,})/i);
      if (idMatch?.[1]) return idMatch[1];
    } catch {
      const fallbackMatch = String(url).match(/id(\d{6,})/i);
      if (fallbackMatch?.[1]) return fallbackMatch[1];
      return null;
    }
    return null;
  };

  const handleExportToAppleMusic = () => {
    const appleSongs = songs.filter(
      (song) => getLinkType(song.youtube_url) === "apple_music" && song.youtube_url
    );

    if (appleSongs.length === 0) {
      setError("Apple Music 링크가 있는 곡이 없습니다.");
      return;
    }

    const links = appleSongs.map((song) => ({
      title: song.title,
      artist: song.artist,
      url: song.youtube_url,
      songId: extractAppleMusicSongId(song.youtube_url),
    }));

    setExportLinks(links);
    setExportModalOpen(true);
  };

  const getLinkTypeLabel = (type) => {
    switch (type) {
      case "youtube":
        return "YouTube";
      case "apple_music":
        return "Apple Music";
      case "soundcloud":
        return "Soundcloud";
      case "link":
      default:
        return "link";
    }
  };

  const fetchPlaylist = async () => {
    const { data, error } = await supabase
      .from("playlists")
      .select("*")
      .eq("id", playlistId)
      .single();

    if (error) {
      console.error(error);
      setError("플레이리스트 불러오기 실패");
    } else {
      setPlaylist(data);
    }
    setPlaylistLoading(false);
  };

  const normalizeGenreValue = (genre) => {
    if (genre == null) {
      return "";
    }
    if (typeof genre === "string") {
      return genre.trim();
    }
    return String(genre).trim();
  };

  const normalizeArtworkValue = (artworkUrl) => {
    if (artworkUrl == null) {
      return "";
    }
    const value = typeof artworkUrl === "string" ? artworkUrl.trim() : String(artworkUrl).trim();
    if (!value) {
      return "";
    }
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname) {
        return "";
      }
      return normalized;
    } catch {
      return "";
    }
  };

  const getItunesArtworkUrl = (track) =>
    normalizeArtworkValue(track?.artworkUrl100 || track?.artworkUrl60 || track?.artworkUrl30);

  const getItunesMetadataFromTrack = (track) => {
    if (!track) {
      return null;
    }

    const genre = normalizeGenreValue(track.primaryGenreName);
    const artworkUrl = getItunesArtworkUrl(track);

    if (!genre && !artworkUrl) {
      return null;
    }

    return { genre, artworkUrl };
  };

  const normalizeComparableText = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const fetchItunesMetadataBySongId = async (appleSongId) => {
    if (!appleSongId) {
      return null;
    }

    try {
      const response = await fetch(
        `https://itunes.apple.com/lookup?id=${encodeURIComponent(appleSongId)}&entity=song`
      );
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const results = data.results || [];
      const matchedTrack =
        results.find((item) => String(item.trackId) === String(appleSongId)) ||
        results.find((item) => item.kind === "song");
      return getItunesMetadataFromTrack(matchedTrack);
    } catch (lookupError) {
      console.error(lookupError);
      return null;
    }
  };

  const fetchItunesTrackByTitleArtist = async (song) => {
    const query = `${song?.title || ""} ${song?.artist || ""}`.trim();
    if (!query) {
      return null;
    }

    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`
      );
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const results = data.results || [];
      const titleLower = normalizeComparableText(song?.title);
      const artistLower = normalizeComparableText(song?.artist);

      const strictMatch = results.find((item) => {
        const trackName = normalizeComparableText(item?.trackName);
        const artistName = normalizeComparableText(item?.artistName);
        return (
          (!titleLower || trackName.includes(titleLower)) &&
          (!artistLower || artistName.includes(artistLower))
        );
      });

      return strictMatch || results[0] || null;
    } catch (searchError) {
      console.error(searchError);
      return null;
    }
  };

  const backfillMetadataFromAppleLinks = async (sourceSongs) => {
    if (metadataBackfillRunningRef.current) {
      return;
    }

    const candidates = sourceSongs
      .filter((song) => {
        const needsGenre = !normalizeGenreValue(song.genre);
        const needsArtwork = !normalizeArtworkValue(song.artwork_url);
        return (
          (needsGenre || needsArtwork) &&
          song.youtube_url &&
          getLinkType(song.youtube_url) === "apple_music" &&
          !metadataBackfillAttemptedIdsRef.current.has(song.id)
        );
      })
      .map((song) => ({
        ...song,
        appleSongId: extractAppleMusicSongId(song.youtube_url),
      }));

    if (!candidates.length) {
      return;
    }

    candidates.forEach((song) => {
      metadataBackfillAttemptedIdsRef.current.add(song.id);
    });

    metadataBackfillRunningRef.current = true;

    try {
      const metadataByAppleSongId = {};
      const uniqueAppleSongIds = [
        ...new Set(
          candidates
            .map((song) => (song.appleSongId ? String(song.appleSongId) : null))
            .filter(Boolean)
        ),
      ];

      for (const appleSongId of uniqueAppleSongIds) {
        const metadata = await fetchItunesMetadataBySongId(appleSongId);
        if (metadata) {
          metadataByAppleSongId[appleSongId] = metadata;
        }
      }

      const songPatchMap = {};
      await Promise.all(
        candidates.map(async (song) => {
          let metadata = song.appleSongId
            ? metadataByAppleSongId[String(song.appleSongId)]
            : null;

          if (!metadata || (!metadata.genre && !metadata.artworkUrl)) {
            const searchedTrack = await fetchItunesTrackByTitleArtist(song);
            metadata = getItunesMetadataFromTrack(searchedTrack);
          }

          if (!metadata) {
            return;
          }

          const updatePayload = {};
          const existingGenre = normalizeGenreValue(song.genre);
          const existingArtwork = normalizeArtworkValue(song.artwork_url);

          if (!existingGenre && metadata.genre) {
            updatePayload.genre = metadata.genre;
          }
          if (!existingArtwork && metadata.artworkUrl) {
            updatePayload.artwork_url = metadata.artworkUrl;
          }

          if (Object.keys(updatePayload).length === 0) {
            return;
          }

          const { error: updateError } = await supabase
            .from("songs")
            .update(updatePayload)
            .eq("id", song.id);

          if (updateError) {
            console.error(updateError);
            return;
          }

          songPatchMap[song.id] = updatePayload;
        })
      );

      if (Object.keys(songPatchMap).length > 0) {
        setSongs((prev) =>
          prev.map((song) =>
            songPatchMap[song.id]
              ? {
                  ...song,
                  ...songPatchMap[song.id],
                }
              : song
          )
        );
      }
    } finally {
      metadataBackfillRunningRef.current = false;
    }
  };

  const fetchSongs = async () => {
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .eq("playlist_id", playlistId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError("음악 불러오기 실패");
    } else {
      const normalizedSongs = (data || []).map((song) => {
        const normalizedGenre = normalizeGenreValue(song.genre);
        const normalizedArtwork = normalizeArtworkValue(song.artwork_url);
        return {
          ...song,
          genre: normalizedGenre || null,
          artwork_url: normalizedArtwork || null,
        };
      });
      setSongs(normalizedSongs);
      void backfillMetadataFromAppleLinks(normalizedSongs);
    }
    setLoading(false);
  };

  const fetchItunes = async () => {
    if (!itunesQuery.trim()) {
      setItunesError("검색어를 입력하세요.");
      return;
    }

    if (itunesAbortControllerRef.current) {
      itunesAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    itunesAbortControllerRef.current = controller;

    setItunesError("");
    setItunesLoading(true);
    setItunesResults([]);

    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(itunesQuery)}&entity=song&limit=12`,
        { signal: controller.signal }
      );
      if (!response.ok) {
        throw new Error(`iTunes 검색 실패: ${response.status}`);
      }
      const data = await response.json();
      setItunesResults(data.results || []);
      if (!data.results || data.results.length === 0) {
        setItunesError("검색 결과가 없습니다.");
      }
    } catch (e) {
      if (e.name === "AbortError") {
        return;
      }
      console.error(e);
      setItunesError("iTunes 검색 중 오류가 발생했습니다.");
    } finally {
      if (itunesAbortControllerRef.current === controller) {
        itunesAbortControllerRef.current = null;
      }
      setItunesLoading(false);
    }
  };

  const handleCancelItunesSearch = () => {
    if (itunesAbortControllerRef.current) {
      itunesAbortControllerRef.current.abort();
      itunesAbortControllerRef.current = null;
    }
    setItunesLoading(false);
    setItunesError("");
    setItunesResults([]);
    setItunesQuery("");
  };

  const handleAddItunesTrack = async (track) => {
    setError("");
    setSongMutating(true);

    try {
      const { error: insertError } = await supabase.from("songs").insert([
        {
          title: track.trackName || "",
          artist: track.artistName || "",
          youtube_url: track.trackViewUrl || track.previewUrl || null,
          genre: track.primaryGenreName || null,
          artwork_url: getItunesArtworkUrl(track) || null,
          playlist_id: parseInt(playlistId),
        },
      ]);

      if (insertError) {
        console.error(insertError);
        setError("트랙 추가 실패");
        return;
      }

      setItunesResults((prev) => prev.filter((item) => item.trackId !== track.trackId));
      fetchSongs();
    } finally {
      setSongMutating(false);
    }
  };

  const copySongList = async () => {
    if (!visibleSongs.length) {
      setCopyMessage("복사할 음악이 없습니다.");
      return;
    }

    const text = visibleSongs
      .map((song) => `${song.title || ""} | ${song.artist || ""}`)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("클립보드에 복사되었습니다.");
    } catch (copyError) {
      console.error(copyError);
      setCopyMessage("복사에 실패했습니다. 텍스트를 수동으로 선택하세요.");
    }

    setTimeout(() => setCopyMessage(""), 3000);
  };

  useEffect(() => {
    metadataBackfillAttemptedIdsRef.current.clear();
    metadataBackfillRunningRef.current = false;

    fetchPlaylist();
    fetchSongs();

    return () => {
      if (itunesAbortControllerRef.current) {
        itunesAbortControllerRef.current.abort();
      }
    };
  }, [playlistId]);

  const visibleSongs = useMemo(() => {
    const q = search.toLowerCase();
    return songs.filter(
      (song) => {
        const titleMatched = (song.title || "").toLowerCase().includes(q);
        const artistMatched = (song.artist || "").toLowerCase().includes(q);
        if (!titleMatched && !artistMatched) {
          return false;
        }

        if (selectedPlatform === "all") {
          return true;
        }

        const linkType = getLinkType(song.youtube_url);
        return linkType === selectedPlatform;
      }
    );
  }, [songs, search, selectedPlatform]);

  const getSongGenre = (song) => {
    return normalizeGenreValue(song?.genre);
  };

  const getSongArtwork = (song) => {
    return normalizeArtworkValue(song?.artwork_url);
  };

  const getPlaceholderVariant = (song) => {
    const seedBase = `${song?.id || ""}-${song?.title || ""}-${song?.artist || ""}`;
    let hash = 0;
    for (let i = 0; i < seedBase.length; i += 1) {
      hash = (hash * 31 + seedBase.charCodeAt(i)) >>> 0;
    }
    const variant = hash % 5;
    switch (variant) {
      case 0:
        return "corner-tl";
      case 1:
        return "corner-tr";
      case 2:
        return "corner-br";
      case 3:
        return "corner-bl";
      case 4:
      default:
        return "circle";
    }
  };

  const getPlaceholderClipPath = (variant) => {
    switch (variant) {
      case "corner-tl":
        return "circle(100% at 0% 0%)";
      case "corner-tr":
        return "circle(100% at 100% 0%)";
      case "corner-br":
        return "circle(100% at 100% 100%)";
      case "corner-bl":
        return "circle(100% at 0% 100%)";
      case "circle":
      default:
        return "circle(50% at 50% 50%)";
    }
  };

  const genreDistribution = useMemo(() => {
    const appleGenreSongs = songs.filter(
      (song) => getLinkType(song.youtube_url) === "apple_music" && getSongGenre(song)
    );

    const total = appleGenreSongs.length;
    if (!total) {
      return { total: 0, items: [] };
    }

    const counts = appleGenreSongs.reduce((acc, song) => {
      const genre = getSongGenre(song);
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {});

    const sorted = Object.entries(counts)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count);

    const topItems = sorted.slice(0, 5);
    const othersCount = sorted.slice(5).reduce((sum, item) => sum + item.count, 0);
    const items = othersCount > 0 ? [...topItems, { genre: "Others", count: othersCount }] : topItems;

    return {
      total,
      items: items.map((item) => ({
        ...item,
        ratio: item.count / total,
      })),
    };
  }, [songs]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !artist) {
      setError("제목과 아티스트 입력");
      return;
    }

    setSongMutating(true);

    try {
      const { error } = await supabase.from("songs").insert([
        {
          title,
          artist,
          youtube_url: link || null,
          genre: null,
          playlist_id: parseInt(playlistId),
        },
      ]);

      if (error) {
        console.error(error);
        setError("추가 실패");
      } else {
        setTitle("");
        setArtist("");
        setLink("");
        fetchSongs();
      }
    } finally {
      setSongMutating(false);
    }
  };

  const handleDelete = async (id) => {
    setError("");
    setSongMutating(true);

    try {
      const { data: deletedRows, error } = await supabase
        .from("songs")
        .delete()
        .eq("id", id)
        .select("id");

      if (error) {
        console.error(error);
        setError("삭제 실패");
      } else if (!deletedRows || deletedRows.length === 0) {
        // RLS 등으로 삭제 권한이 없으면 error 없이 0 row가 반환될 수 있다.
        setError("삭제 권한이 없거나 삭제 대상이 없습니다.");
        await fetchSongs();
      } else {
        await fetchSongs();
      }
    } finally {
      setSongMutating(false);
    }
  };

  const handleUpdate = async (id) => {
    setSongMutating(true);

    try {
      const { error } = await supabase
        .from("songs")
        .update({
          title: editingTitle,
          artist: editingArtist,
          youtube_url: editingLink || null,
        })
        .eq("id", id);

      if (error) {
        console.error(error);
        setError("업데이트 실패");
      } else {
        setSongs((prev) =>
          prev.map((song) =>
            song.id === id
              ? {
                  ...song,
                  title: editingTitle,
                  artist: editingArtist,
                  youtube_url: editingLink || null,
                }
              : song
          )
        );
        setEditingId(null);
        setEditingTitle("");
        setEditingArtist("");
        setEditingLink("");
      }
    } finally {
      setSongMutating(false);
    }
  };

  if (playlistLoading) {
    return (
      <div className="min-h-screen bg-[#e8e6dd] px-6 py-10 text-[#0a0a0a] md:px-12 md:py-16">
        <div className="mx-auto max-w-7xl text-lg font-medium text-[#5a5a5a]">플레이리스트 로딩 중...</div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen bg-[#e8e6dd] px-6 py-10 text-[#0a0a0a] md:px-12 md:py-16">
        <div className="mx-auto max-w-7xl text-lg font-medium text-[#5a5a5a]">플레이리스트를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const sectionHeadingClass = "mb-3 mt-8 text-2xl font-bold text-[#0a0a0a]";
  const detailButtonClass =
    "rounded-lg border-0 bg-[#c4c0b5] px-4 py-2 text-sm font-semibold text-[#0a0a0a] transition hover:bg-[#b8b4a8] disabled:cursor-not-allowed disabled:opacity-60";
  const songCardClass = "mb-3 rounded-2xl bg-[#ddd9cd] px-5 py-4";
  const inputClass =
    "rounded-lg border border-[#cfc8b8] bg-[#ece9df] px-3 py-2 text-sm text-[#0a0a0a] outline-none placeholder:text-[#6d685f] focus:border-[#c95652] focus:bg-[#f9f7f3]";
  const genreChartColors = ["#c95652", "#d4a84f", "#9f8f75", "#7a756a", "#b9827f", "#8b6f3d"];

  const donutSegments = (() => {
    let accumulated = 0;
    return genreDistribution.items.map((item, index) => {
      const startRatio = accumulated;
      accumulated += item.ratio;
      return {
        ...item,
        startRatio,
        endRatio: accumulated,
        color: genreChartColors[index % genreChartColors.length],
      };
    });
  })();

  const polarToCartesian = (cx, cy, r, angle) => {
    const rad = ((angle - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const describeArc = (cx, cy, r, startAngle, endAngle) => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  return (
    <div className="min-h-screen bg-[#e8e6dd] px-6 py-10 text-[#0a0a0a] md:px-12 md:py-16">
      <div className="mx-auto max-w-7xl">
        <button
          type="button"
          aria-label="뒤로 가기"
          className="mb-5 rounded-lg border-0 bg-[#d0ccc0] px-3 py-2 text-lg font-bold text-[#0a0a0a] transition hover:bg-[#c4c0b5] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => navigate("/", { state: { refreshedAt: Date.now() } })}
          disabled={songMutating}
        >
          ←
        </button>

        <div className="mb-6">
          <h1 className="mb-3 text-3xl font-bold text-[#0a0a0a]">{playlist.title}</h1>
          <div className="flex flex-wrap gap-3">
            <button className={detailButtonClass} onClick={copySongList}>
              목록 복사
            </button>
            <button className={detailButtonClass} onClick={handleExportToAppleMusic}>
              Apple Music으로 내보내기
            </button>
            {copyMessage && <span className="text-sm text-[#5a5a5a]">{copyMessage}</span>}
          </div>
        </div>

        <div className="mb-8 mt-4 grid w-full max-w-[720px] grid-cols-1 items-start gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-[#ddd9cd] p-2">
            <div className="aspect-square w-full overflow-hidden rounded-xl bg-[#e8e6dd]">
              {playlist.thumbnail ? (
                <img src={playlist.thumbnail} alt={playlist.title} className="h-full w-full object-cover" />
              ) : (
                <CoverGraphic />
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-[#ddd9cd] p-4">
            <h3 className="mb-1 text-lg font-bold text-[#0a0a0a]">장르 비율</h3>
            <p className="mb-3 text-xs text-[#5a5a5a]">Apple Music으로 추가된 곡 기준</p>

            {genreDistribution.total === 0 ? (
              <p className="text-sm text-[#6d685f]">장르 정보가 있는 Apple Music 곡이 아직 없습니다.</p>
            ) : (
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0">
                  <circle cx="60" cy="60" r="44" fill="none" stroke="#ece9df" strokeWidth="20" />
                  {donutSegments.map((segment) => {
                    const start = segment.startRatio * 360;
                    const end = segment.endRatio * 360;
                    if (end - start >= 360) {
                      return (
                        <circle
                          key={segment.genre}
                          cx="60" cy="60" r="44"
                          fill="none"
                          stroke={segment.color}
                          strokeWidth="20"
                        />
                      );
                    }
                    return (
                      <path
                        key={segment.genre}
                        d={describeArc(60, 60, 44, start, end)}
                        fill="none"
                        stroke={segment.color}
                        strokeWidth="20"
                        strokeLinecap="butt"
                      />
                    );
                  })}
                  <circle cx="60" cy="60" r="26" fill="#ddd9cd" />
                  <text x="60" y="58" textAnchor="middle" className="fill-[#3a352b] text-[10px] font-semibold">
                    Genres
                  </text>
                  <text x="60" y="72" textAnchor="middle" className="fill-[#0a0a0a] text-[13px] font-bold">
                    {genreDistribution.total}
                  </text>
                </svg>

                <div className="min-w-0 flex-1 space-y-1">
                  {donutSegments.map((segment) => (
                    <div key={segment.genre} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                        <span className="truncate text-[#3a352b]">{segment.genre}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-[#5a5a5a]">
                        {Math.round(segment.ratio * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {(error || itunesError) && (
          <p className="mb-4 rounded-xl border border-[#d9b8b1] bg-[#f3e4df] px-4 py-2 text-sm font-medium text-[#a44949]">
            {error || itunesError}
          </p>
        )}

        <h2 className={sectionHeadingClass}>iTunes에서 검색하여 추가</h2>
        <section className="mb-5 rounded-3xl bg-[#ddd9cd] p-5">
          <div className="flex flex-wrap gap-2">
            <input
              placeholder="iTunes 검색어"
              value={itunesQuery}
              onChange={(e) => setItunesQuery(e.target.value)}
              className={`${inputClass} min-w-[220px] flex-1`}
            />
            <button
              className={detailButtonClass}
              onClick={(e) => {
                e.preventDefault();
                fetchItunes();
              }}
              disabled={itunesLoading}
            >
              {itunesLoading ? "검색중..." : "검색"}
            </button>
            <button
              className={detailButtonClass}
              onClick={(e) => {
                e.preventDefault();
                handleCancelItunesSearch();
              }}
            >
              취소
            </button>
          </div>

          {itunesResults.length > 0 && (
            <div className="mt-4">
              {itunesResults.map((track) => (
                <div key={track.trackId} className="mb-2 rounded-xl border border-[#cfc8b8] bg-[#ece9df] p-3">
                  <div className="text-sm font-bold text-[#0a0a0a]">
                    {track.trackName} - {track.artistName}
                  </div>
                  <div className="mt-1 text-xs text-[#5a5a5a]">
                    {track.collectionName} | {Math.floor(track.trackTimeMillis / 60000)}:{String(
                      Math.floor((track.trackTimeMillis % 60000) / 1000)
                    ).padStart(2, "0")}
                    {track.primaryGenreName ? ` | ${track.primaryGenreName}` : ""}
                  </div>
                  <button className={`${detailButtonClass} mt-2`} onClick={() => handleAddItunesTrack(track)}>
                    추가
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <h2 className={sectionHeadingClass}>직접 입력해서 추가</h2>
        <section className="mb-5 rounded-3xl bg-[#ddd9cd] p-5">
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
            <input
              placeholder="곡 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`${inputClass} min-w-[170px] flex-1`}
            />
            <input
              placeholder="아티스트"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className={`${inputClass} min-w-[170px] flex-1`}
            />
            <input
              placeholder="링크"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className={`${inputClass} min-w-[220px] flex-[1.2]`}
            />
            <button type="submit" className={detailButtonClass}>추가</button>
          </form>
        </section>

        <h2 className={sectionHeadingClass}>음악 목록</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {platformOptions.map((option) => {
            const isSelected = selectedPlatform === option.value;
            const buttonClass = isSelected
              ? "rounded-lg border-0 bg-[#c95652] px-3 py-1.5 text-sm font-semibold text-white"
              : "rounded-lg border-0 bg-[#c4c0b5] px-3 py-1.5 text-sm font-semibold text-[#0a0a0a] transition hover:bg-[#b8b4a8]";
            return (
              <button
                key={option.value}
                type="button"
                className={buttonClass}
                onClick={() => setSelectedPlatform(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <input
          placeholder="검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} mb-3 w-full max-w-[440px]`}
        />

        {loading ? (
          <p className="text-[#5a5a5a]">로딩중...</p>
        ) : visibleSongs.length === 0 ? (
          <p className="text-[#5a5a5a]">음악이 없습니다.</p>
        ) : (
          visibleSongs.map((song) => (
            <div key={song.id} className={`${songCardClass} transition-colors duration-150 ${confirmDeleteId === song.id ? "bg-[#ecdcd9]" : ""}`}>
              {editingId === song.id ? (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className={`${inputClass} mb-2 min-w-[200px] flex-1`}
                    />
                    <input
                      value={editingArtist}
                      onChange={(e) => setEditingArtist(e.target.value)}
                      className={`${inputClass} mb-2 min-w-[200px] flex-1`}
                    />
                    <input
                      value={editingLink}
                      onChange={(e) => setEditingLink(e.target.value)}
                      className={`${inputClass} mb-2 min-w-[250px] flex-1`}
                    />
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-2">
                    <button className={detailButtonClass} onClick={() => handleUpdate(song.id)}>저장</button>
                    <button className={detailButtonClass} onClick={() => setEditingId(null)}>취소</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="hidden lg:block">
                      {getSongArtwork(song) ? (
                        <img
                          src={getSongArtwork(song)}
                          alt={`${song.title} 앨범 커버`}
                          loading="lazy"
                          decoding="async"
                          className="h-16 w-16 rounded-lg border border-[#cfc8b8] bg-[#ece9df] object-cover"
                        />
                      ) : (
                        <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-[#cfc8b8] bg-[#ece9df]">
                          <div
                            className="absolute inset-1 bg-[#D4A84F]"
                            style={{ clipPath: getPlaceholderClipPath(getPlaceholderVariant(song)) }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-[#0a0a0a] md:text-xl">{song.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold text-[#3a352b] md:text-lg">{song.artist}</p>
                        {getSongGenre(song) && (
                          <span className="max-w-[170px] truncate rounded-full bg-[#ece9df] px-2 py-0.5 text-[11px] font-semibold text-[#6b665b] sm:max-w-none sm:overflow-visible sm:whitespace-normal">
                            {getSongGenre(song)}
                          </span>
                        )}
                      </div>
                      {song.youtube_url && (
                        <a href={song.youtube_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-bold text-[#c95652] hover:underline">
                          {getLinkTypeLabel(getLinkType(song.youtube_url))}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-2">
                    {confirmDeleteId === song.id ? (
                      <>
                        <span className="hidden text-sm font-semibold text-[#9a4343] sm:inline">"{song.title}" 삭제할까요?</span>
                        <button
                          className="rounded-lg bg-[#c95652] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[#b84547] disabled:opacity-60"
                          onClick={() => { setConfirmDeleteId(null); handleDelete(song.id); }}
                          disabled={songMutating}
                        >
                          삭제
                        </button>
                        <button className={detailButtonClass} onClick={() => setConfirmDeleteId(null)} disabled={songMutating}>
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(song.id);
                            setEditingTitle(song.title);
                            setEditingArtist(song.artist);
                            setEditingLink(song.youtube_url || "");
                          }}
                          className={detailButtonClass}
                        >
                          수정
                        </button>
                        <button
                          className={`${detailButtonClass} hover:bg-[#e8d5d3] hover:text-[#9a4343]`}
                          onClick={() => setConfirmDeleteId(song.id)}
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {exportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/45 p-4 backdrop-blur-[3px]"
          onClick={() => setExportModalOpen(false)}
        >
          <div
            className="w-full max-w-[520px] rounded-3xl bg-[#ddd9cd] p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-2xl font-bold text-[#0a0a0a]">Apple Music으로 내보내기</h2>
            <p className="mb-5 text-sm text-[#5a5a5a]">
              아래 곡들을 Apple Music에서 열고, 각 곡을 플레이리스트에 추가하세요.
            </p>

            <div className="mb-5 max-h-[50vh] overflow-y-auto">
              {exportLinks.map((item, i) => (
                <div key={i} className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-[#ece9df] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#0a0a0a]">{item.title}</p>
                    <p className="truncate text-xs text-[#5a5a5a]">{item.artist}</p>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg bg-[#c95652] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#b84547]"
                  >
                    Apple Music 열기
                  </a>
                </div>
              ))}
            </div>

            <p className="mb-5 rounded-xl border border-[#d9c4ad] bg-[#f0e3d0] px-4 py-3 text-xs font-medium text-[#8b6f3d]">
              💡 Apple Music 앱이 설치된 기기에서 링크를 열면 앱에서 바로 해당 곡으로 이동합니다.
              각 곡 페이지의 ···(더보기) → "플레이리스트에 추가"로 직접 저장하세요.
            </p>

            <button
              type="button"
              className="w-full rounded-xl bg-[#c4c0b5] px-6 py-2 text-base font-bold text-[#0a0a0a] transition hover:bg-[#b8b4a8]"
              onClick={() => setExportModalOpen(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
