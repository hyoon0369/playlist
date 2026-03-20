import { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./supabase";

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

  const fetchSongCounts = async (playlistIds) => {
    if (!playlistIds.length) {
      setSongCountByPlaylist({});
      return;
    }

    const { data, error } = await supabase
      .from("songs")
      .select("playlist_id")
      .in("playlist_id", playlistIds);

    if (error) {
      console.error(error);
      return;
    }

    const counts = (data || []).reduce((acc, song) => {
      const key = song.playlist_id;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    setSongCountByPlaylist(counts);
  };

  const fetchPlaylists = async () => {
    setPlaylistsLoading(true);
    setPlaylistsError("");

    const { data, error } = await supabase
      .from("playlists")
      .select("*")
      .order("created_at", { ascending: false });

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

      setPlaylists(normalizedPlaylists);
      await fetchSongCounts(normalizedPlaylists.map((item) => item.id));
    }

    setPlaylistsLoading(false);
  };

  useEffect(() => {
    fetchPlaylists();
  }, [location.key]);

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
      className="min-h-screen px-6 py-8 text-[#1f1c17] md:px-10 lg:px-14"
      style={{
        fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
        backgroundColor: "#f3efdf",
        backgroundImage: "linear-gradient(180deg, #f7f3e7 0%, #eee7d1 100%)",
      }}
      onClick={() => setOpenMenuId(null)}
    >
      <header className="mx-auto mb-10 w-full max-w-[1280px]">
        <h1
          className="text-[56px] leading-none tracking-tight text-[#1d1a14] md:text-[60pt]"
          style={{ fontFamily: "'Noto Sans KR', 'Arial Black', 'Apple SD Gothic Neo', sans-serif", fontWeight: 800 }}
        >
          Mayonnaise
        </h1>
        <p className="mt-5 text-lg font-semibold text-[#4b473d] md:text-2xl">Share your musics</p>
      </header>

      <div className="mx-auto w-full max-w-[1280px]">
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
          <p className="mb-3 rounded-xl border border-[#bcc6a2] bg-[#e8edd8] px-4 py-2 text-sm font-medium text-[#4e6440]">
            {playlistSuccess}
          </p>
        )}
      </div>

      {playlistsLoading ? (
        <p className="mx-auto w-full max-w-[1280px] text-lg font-medium text-[#4e4a40]">플레이리스트 로딩 중...</p>
      ) : (
        <section className="mx-auto grid w-full max-w-[1280px] grid-cols-1 auto-rows-fr gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {playlists.map((pl) => (
            <article
              key={pl.playlist_id}
              className="relative flex h-full cursor-pointer flex-col rounded-[24px] bg-[#e8e1cb] p-7 transition duration-200 hover:bg-[#ece4ce]"
              onClick={() => navigate(`/${pl.id}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 pr-2">
                  <h2
                    className="line-clamp-2 break-words text-[24px] leading-[1.15] text-[#1e1b16] md:text-[30px] lg:text-[34px]"
                    style={{ fontFamily: "'Noto Sans KR', 'Arial Black', 'Apple SD Gothic Neo', sans-serif", fontWeight: 800 }}
                  >
                    {pl.title}
                  </h2>
                  <p className="mt-3 text-base font-semibold text-[#403c32] md:text-[20px]">
                    {songCountByPlaylist[pl.id] || 0} Tracks
                  </p>
                </div>

                <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="flex h-9 w-9 flex-col items-center justify-center rounded-full opacity-50 transition hover:bg-[#d5ceb1] hover:opacity-100"
                    onClick={() =>
                      setOpenMenuId((prev) => (prev === pl.id ? null : pl.id))
                    }
                    aria-label="playlist menu"
                  >
                    <span className="mb-1 block h-1.5 w-1.5 rounded-full bg-[#889a63]" />
                    <span className="mb-1 block h-1.5 w-1.5 rounded-full bg-[#889a63]" />
                    <span className="block h-1.5 w-1.5 rounded-full bg-[#889a63]" />
                  </button>

                  {openMenuId === pl.id && (
                    <div className="absolute right-0 top-11 z-20 w-36 rounded-xl border border-[#d2caae] bg-[#f5f1e2] p-2 shadow-[0_2px_8px_rgba(58,50,34,0.12)]">
                      <button
                        type="button"
                        className="mb-1 w-full rounded-lg px-3 py-2 text-left font-semibold text-[#2c291f] hover:bg-[#e6dfc8]"
                        onClick={() => handleEditPlaylist(pl)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left font-semibold text-[#9a4343] hover:bg-[#e6dfc8]"
                        onClick={() => handleDeletePlaylist(pl.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 aspect-square w-full overflow-hidden rounded-[12px] bg-[#c4d19f]">
                {pl.thumbnail ? (
                  <img
                    src={pl.thumbnail}
                    alt={pl.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full" aria-hidden="true" />
                )}
              </div>
            </article>
          ))}

          <article
            className="relative flex h-full cursor-pointer flex-col rounded-[24px] bg-[#e8e1cb] p-7 transition duration-200 hover:bg-[#ece4ce]"
            onClick={openAddPlaylistModal}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 pr-2">
                <h2
                  className="line-clamp-2 break-words text-[24px] leading-[1.15] text-[#1e1b16] md:text-[30px] lg:text-[34px]"
                  style={{ fontFamily: "'Noto Sans KR', 'Arial Black', 'Apple SD Gothic Neo', sans-serif", fontWeight: 800 }}
                >
                  New playlist
                </h2>
                <p className="mt-3 text-base font-semibold text-[#403c32] md:text-[20px]">
                  0 Tracks
                </p>
              </div>

              <div className="shrink-0">
                <div className="flex h-9 w-9 flex-col items-center justify-center rounded-full opacity-50" aria-hidden="true">
                  <span className="mb-1 block h-1.5 w-1.5 rounded-full bg-[#889a63]" />
                  <span className="mb-1 block h-1.5 w-1.5 rounded-full bg-[#889a63]" />
                  <span className="block h-1.5 w-1.5 rounded-full bg-[#889a63]" />
                </div>
              </div>
            </div>
            <div className="mt-5 flex aspect-square w-full items-center justify-center rounded-[12px] bg-[#c4d19f]/85 text-xl font-semibold text-[#556741]">
              Insert Image
            </div>
          </article>
        </section>
      )}

      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2e291f]/35 p-4 backdrop-blur-[1px]"
          onClick={closePlaylistModal}
        >
          <div
            className="w-full max-w-[500px]"
            style={{ fontFamily: "'Noto Sans KR', 'Arial Black', 'Apple SD Gothic Neo', sans-serif" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-[22px] bg-[#f5f0e0] p-8">
              <input
                className="w-full bg-transparent text-[34px] font-bold leading-[1.08] text-[#1d1a14] outline-none md:text-[48px]"
                placeholder={modalMode === "edit" ? "Edit playlist" : "New playlist"}
                value={modalTitleValue}
                onChange={(e) => modalTitleSetter(e.target.value)}
                disabled={playlistUploading}
              />

              {!modalTitleValue.trim() && (
                <p className="mt-1 text-xs font-semibold text-[#a44949]">필수 입력 항목입니다.</p>
              )}

              <p className="mt-2 text-base font-bold text-[#5f594c] md:text-lg">
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
                className="relative mt-4 block aspect-square w-full overflow-hidden rounded-[12px] bg-[#c4d19f]"
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
                  <div className="flex h-full w-full items-center justify-center text-5xl font-semibold text-[#4f6039]">
                    Insert Image
                  </div>
                )}
                {modalPreviewImage && (
                  <button
                    type="button"
                    className="absolute right-3 top-3 rounded-lg border border-[#d9d0b4] bg-[#f5f0e0]/90 px-2 py-1 text-xs font-bold text-[#2f3b1f]"
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
                className="rounded-xl border border-[#cfc7ad] bg-[#efe9d5] px-6 py-2 text-2xl font-bold text-[#312d24] transition hover:bg-[#e7e0c9] md:text-3xl"
                onClick={closePlaylistModal}
                disabled={playlistUploading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl border-0 px-6 py-2 text-2xl font-bold transition md:text-3xl"
                style={{
                  backgroundColor: saveDisabled ? "#cbc4ad" : "#6d8050",
                  color: saveDisabled ? "#716b5a" : "#f6f2e7",
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

  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingArtist, setEditingArtist] = useState("");
  const [editingLink, setEditingLink] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

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
      setSongs(data || []);
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

    const { error: insertError } = await supabase.from("songs").insert([
      {
        title: track.trackName || "",
        artist: track.artistName || "",
        youtube_url: track.trackViewUrl || track.previewUrl || null,
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
  };

  const copySongList = async () => {
    if (!songs.length) {
      setCopyMessage("복사할 음악이 없습니다.");
      return;
    }

    const text = songs
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
    fetchPlaylist();
    fetchSongs();

    return () => {
      if (itunesAbortControllerRef.current) {
        itunesAbortControllerRef.current.abort();
      }
    };
  }, [playlistId]);

  const filteredSongs = useMemo(() => {
    const q = search.toLowerCase();
    return songs.filter(
      (song) =>
        song.title.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q)
    );
  }, [songs, search]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !artist) {
      setError("제목과 아티스트 입력");
      return;
    }

    const { error } = await supabase.from("songs").insert([
      {
        title,
        artist,
        youtube_url: link || null,
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
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from("songs").delete().eq("id", id);

    if (error) {
      console.error(error);
      setError("삭제 실패");
    } else {
      setSongs(songs.filter((song) => song.id !== id));
    }
  };

  const handleUpdate = async (id) => {
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
      setSongs(
        songs.map((song) =>
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
  };

  if (playlistLoading) return <div style={{ padding: 40 }}>플레이리스트 로딩 중...</div>;
  if (!playlist) return <div style={{ padding: 40 }}>플레이리스트를 찾을 수 없습니다.</div>;

  const sectionHeadingClass = "mb-2 mt-6 text-xl font-bold text-[#1f1c17] md:text-2xl";
  const detailButtonClass =
    "rounded-lg bg-[#d9d1ba] px-4 py-2 text-sm font-semibold text-[#2f2a21] transition hover:bg-[#cbc2a8]";
  const songCardClass = "mb-2 rounded-xl bg-[#ebe4d1] px-4 py-3";

  return (
    <div style={{ padding: 40 }}>
      <button
        type="button"
        aria-label="뒤로 가기"
        className="mb-4 rounded-lg bg-[#ebe4d1] px-3 py-2 text-lg font-bold text-[#2f2a21]"
        onClick={() => navigate("/")}
      >
        ←
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{playlist.title}</h1>
        <button
          className={detailButtonClass}
          onClick={copySongList}
        >
          목록 복사
        </button>
        {copyMessage && <span className="text-sm text-slate-500">{copyMessage}</span>}
      </div>
      {playlist.thumbnail && (
        <div className="mb-7 mt-4 w-full max-w-[320px] rounded-[14px] bg-[#e1dac2] p-2">
          <div className="aspect-square w-full overflow-hidden rounded-[10px] bg-[#c4d19f]/45">
            <img
              src={playlist.thumbnail}
              alt={playlist.title}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      )}

      <h2 className={sectionHeadingClass}>iTunes에서 검색하여 추가</h2>
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="iTunes 검색어"
          value={itunesQuery}
          onChange={(e) => setItunesQuery(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button className={detailButtonClass} onClick={(e) => { e.preventDefault(); fetchItunes(); }} disabled={itunesLoading}>
          {itunesLoading ? "검색중..." : "검색"}
        </button>
        <button
          className={detailButtonClass}
          onClick={(e) => {
            e.preventDefault();
            handleCancelItunesSearch();
          }}
          style={{ marginLeft: 8 }}
        >
          취소
        </button>
      </div>
      {itunesError && <p style={{ color: "red" }}>{itunesError}</p>}
      {itunesResults.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {itunesResults.map((track) => (
            <div
              key={track.trackId}
              style={{ border: "1px solid #ddd", padding: 8, marginBottom: 6 }}
            >
              <div>
                <strong>{track.trackName}</strong> - {track.artistName}
              </div>
              <div style={{ fontSize: 12, color: "#555" }}>
                {track.collectionName} | {Math.floor(track.trackTimeMillis / 60000)}:{String(
                  Math.floor((track.trackTimeMillis % 60000) / 1000)
                ).padStart(2, "0")}
              </div>
              <button className={detailButtonClass} onClick={() => handleAddItunesTrack(track)} style={{ marginTop: 8 }}>
                추가
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className={sectionHeadingClass}>직접 입력해서 추가</h2>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="곡 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <input
          placeholder="아티스트"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <input
          placeholder="링크"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button type="submit" className={detailButtonClass}>추가</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h2 className={sectionHeadingClass}>음악 목록</h2>
      <input
        placeholder="검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {loading ? (
        <p>로딩중...</p>
      ) : filteredSongs.length === 0 ? (
        <p>음악이 없습니다.</p>
      ) : (
        filteredSongs.map((song) => (
          <div key={song.id} className={songCardClass}>
            {editingId === song.id ? (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} style={{ marginRight: 8 }} />
                  <input value={editingArtist} onChange={(e) => setEditingArtist(e.target.value)} style={{ marginRight: 8 }} />
                  <input value={editingLink} onChange={(e) => setEditingLink(e.target.value)} style={{ marginRight: 8 }} />
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <button className={detailButtonClass} onClick={() => handleUpdate(song.id)}>저장</button>
                  <button className={detailButtonClass} onClick={() => setEditingId(null)}>취소</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-[#1f1c17] md:text-xl">{song.title}</h3>
                  <p className="mt-1 text-base font-bold text-[#3a352b] md:text-lg">{song.artist}</p>
                  {song.youtube_url && (
                    <a href={song.youtube_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-bold text-[#5e6f44] hover:underline">
                      LINK
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <button onClick={() => {
                    setEditingId(song.id);
                    setEditingTitle(song.title);
                    setEditingArtist(song.artist);
                    setEditingLink(song.youtube_url || "");
                  }} className={detailButtonClass}>수정</button>
                  <button className={detailButtonClass} onClick={() => handleDelete(song.id)}>삭제</button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
