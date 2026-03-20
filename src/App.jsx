import { useEffect, useMemo, useState } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
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
  const [playlists, setPlaylists] = useState([]);
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
      setPlaylists(
        data.map((item) => ({
          id: item.id,
          playlist_id: item.id?.toString() || `pl-${Date.now()}`,
          title: item.title,
          thumbnail: item.thumbnail || "",
        }))
      );
    }

    setPlaylistsLoading(false);
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

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

  const handleCancelAddPlaylist = (e) => {
    e.preventDefault();
    if (newPlaylistPreview) {
      URL.revokeObjectURL(newPlaylistPreview);
    }
    setNewPlaylistTitle("");
    setNewPlaylistFile(null);
    setNewPlaylistPreview("");
    setPlaylistError("");
    setPlaylistSuccess("");
  };

  const handleAddPlaylist = async (e) => {
    e.preventDefault();
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
      };

      setPlaylists((prev) => [addedPlaylist, ...prev]);
      setNewPlaylistTitle("");
      setNewPlaylistFile(null);
      if (newPlaylistPreview) {
        URL.revokeObjectURL(newPlaylistPreview);
        setNewPlaylistPreview("");
      }
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
              }
            : pl
        )
      );

      setPlaylistSuccess("플레이리스트가 성공적으로 수정되었습니다.");
      setTimeout(() => {
        handleCancelEditPlaylist();
      }, 1000);
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
      setPlaylistSuccess("플레이리스트가 삭제되었습니다.");
    } catch (error) {
      console.error(error);
      setPlaylistError("플레이리스트 삭제 중 오류가 발생했습니다.");
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Playlist</h1>

      <section style={{ marginBottom: 24 }}>
        <h2>플레이리스트</h2>
        <form onSubmit={handleAddPlaylist} style={{ marginBottom: 12 }}>
          <input
            placeholder="플레이리스트 제목"
            value={newPlaylistTitle}
            onChange={(e) => setNewPlaylistTitle(e.target.value)}
            style={{ marginRight: 8 }}
            disabled={playlistUploading}
          />
          <input
            type="file"
            accept="image/*"
            onChange={handlePlaylistFileChange}
            disabled={playlistUploading}
          />
          <button type="submit" style={{ marginLeft: 8 }} disabled={playlistUploading}>
            {playlistUploading ? "업로드 중..." : "추가"}
          </button>
          <button
            type="button"
            onClick={handleCancelAddPlaylist}
            style={{ marginLeft: 8 }}
            disabled={playlistUploading}
          >
            취소
          </button>
        </form>

        {newPlaylistPreview && (
          <div style={{ marginBottom: 8 }}>
            <strong>선택된 썸네일 미리보기</strong>
            <div>
              <img
                src={newPlaylistPreview}
                alt="미리보기"
                style={{ width: 240, height: 120, objectFit: "cover", marginTop: 4 }}
              />
            </div>
            <button type="button" onClick={handleRemoveSelectedImage} disabled={playlistUploading}>
              이미지 삭제
            </button>
          </div>
        )}

        {playlistError && <p style={{ color: "red" }}>{playlistError}</p>}
        {playlistSuccess && <p style={{ color: "green" }}>{playlistSuccess}</p>}

        {playlistsLoading ? (
          <p>플레이리스트 로딩 중...</p>
        ) : editingPlaylistId ? (
          <div style={{ border: "2px solid #007bff", padding: 16, marginBottom: 12 }}>
            <h3>플레이리스트 수정</h3>
            <input
              placeholder="플레이리스트 제목"
              value={editingPlaylistTitle}
              onChange={(e) => setEditingPlaylistTitle(e.target.value)}
              style={{ marginRight: 8, marginBottom: 8 }}
              disabled={playlistUploading}
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleEditFileChange}
              disabled={playlistUploading}
              style={{ marginBottom: 8 }}
            />

            {(editingPlaylistPreview || editingPlaylistThumbnail) && (
              <div style={{ marginBottom: 8 }}>
                <strong>썸네일 미리보기</strong>
                <div>
                  <img
                    src={editingPlaylistPreview || editingPlaylistThumbnail}
                    alt="미리보기"
                    style={{ width: 240, height: 120, objectFit: "cover", marginTop: 4 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRemoveEditingImage}
                  disabled={playlistUploading}
                  style={{ marginRight: 8 }}
                >
                  이미지 삭제
                </button>
              </div>
            )}

            <div>
              <button
                onClick={handleSaveEditPlaylist}
                disabled={playlistUploading}
                style={{ marginRight: 8 }}
              >
                {playlistUploading ? "저장 중..." : "저장"}
              </button>
              <button onClick={handleCancelEditPlaylist} disabled={playlistUploading}>
                취소
              </button>
            </div>

            {playlistError && <p style={{ color: "red", marginTop: 8 }}>{playlistError}</p>}
            {playlistSuccess && <p style={{ color: "green", marginTop: 8 }}>{playlistSuccess}</p>}
          </div>
        ) : playlists.length === 0 ? (
          <p>플레이리스트가 없습니다. 추가해주세요.</p>
        ) : (
          playlists.map((pl) => (
            <div
              key={pl.playlist_id}
              style={{ border: "1px solid #ccc", padding: 12, marginBottom: 8, cursor: "pointer" }}
              onClick={() => navigate(`/${pl.id}`)}
            >
              <h3>{pl.title}</h3>
              {pl.thumbnail ? (
                <img
                  src={pl.thumbnail}
                  alt={pl.title}
                  style={{ width: 240, height: 120, objectFit: "cover" }}
                />
              ) : (
                <p>썸네일 없음</p>
              )}
              <button onClick={(e) => { e.stopPropagation(); handleEditPlaylist(pl); }} style={{ marginRight: 8 }}>
                편집
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(pl.id); }}>
                삭제
              </button>
            </div>
          ))
        )}
      </section>
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
  const [youtube, setYoutube] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingArtist, setEditingArtist] = useState("");
  const [editingYoutube, setEditingYoutube] = useState("");

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

  useEffect(() => {
    fetchPlaylist();
    fetchSongs();
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
        youtube_url: youtube || null,
        playlist_id: parseInt(playlistId),
      },
    ]);

    if (error) {
      console.error(error);
      setError("추가 실패");
    } else {
      setTitle("");
      setArtist("");
      setYoutube("");
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
        youtube_url: editingYoutube || null,
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
                youtube_url: editingYoutube || null,
              }
            : song
        )
      );
      setEditingId(null);
      setEditingTitle("");
      setEditingArtist("");
      setEditingYoutube("");
    }
  };

  if (playlistLoading) return <div style={{ padding: 40 }}>플레이리스트 로딩 중...</div>;
  if (!playlist) return <div style={{ padding: 40 }}>플레이리스트를 찾을 수 없습니다.</div>;

  return (
    <div style={{ padding: 40 }}>
      <button onClick={() => navigate("/")} style={{ marginBottom: 16 }}>
        ← 뒤로가기
      </button>

      <h1>{playlist.title}</h1>
      {playlist.thumbnail && (
        <img
          src={playlist.thumbnail}
          alt={playlist.title}
          style={{ width: 300, height: 150, objectFit: "cover", marginBottom: 16 }}
        />
      )}

      <h2>음악 추가</h2>
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
          value={youtube}
          onChange={(e) => setYoutube(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button type="submit">추가</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h2>음악 목록</h2>
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
          <div key={song.id} style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8 }}>
            {editingId === song.id ? (
              <>
                <input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} style={{ marginRight: 8 }} />
                <input value={editingArtist} onChange={(e) => setEditingArtist(e.target.value)} style={{ marginRight: 8 }} />
                <input value={editingYoutube} onChange={(e) => setEditingYoutube(e.target.value)} style={{ marginRight: 8 }} />
              </>
            ) : (
              <>
                <h3>{song.title}</h3>
                <p>{song.artist}</p>
                {song.youtube_url && (
                  <a href={song.youtube_url} target="_blank" rel="noreferrer">
                    링크
                  </a>
                )}
              </>
            )}
            {editingId === song.id ? (
              <>
                <button onClick={() => handleUpdate(song.id)} style={{ marginRight: 8 }}>저장</button>
                <button onClick={() => setEditingId(null)}>취소</button>
              </>
            ) : (
              <>
                <button onClick={() => handleDelete(song.id)} style={{ marginRight: 8 }}>삭제</button>
                <button onClick={() => {
                  setEditingId(song.id);
                  setEditingTitle(song.title);
                  setEditingArtist(song.artist);
                  setEditingYoutube(song.youtube_url || "");
                }}>수정</button>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
