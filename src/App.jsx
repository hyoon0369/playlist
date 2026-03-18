import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

export default function App() {
  const [songs, setSongs] = useState([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [youtube, setYoutube] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // DB에서 데이터 불러오기
  async function fetchSongs() {
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError("데이터 불러오기 실패");
    } else {
      setSongs(data);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchSongs();
  }, []);

  const filteredSongs = useMemo(() => {
    const q = search.toLowerCase();
    return songs.filter(
      (song) =>
        song.title.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q)
    );
  }, [songs, search]);

  // DB에 곡 추가
  async function handleSubmit(e) {
    e.preventDefault();

    if (!title || !artist) {
      setError("제목이랑 아티스트 입력해");
      return;
    }

    const { error } = await supabase.from("songs").insert([
      {
        title,
        artist,
        youtube_url: youtube || null,
      },
    ]);

    if (error) {
      console.error(error);
      setError("추가 실패");
    } else {
      setTitle("");
      setArtist("");
      setYoutube("");
      fetchSongs(); // 다시 불러오기
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>같이 만드는 플레이리스트</h1>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="곡 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          placeholder="아티스트"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />
        <input
          placeholder="유튜브 링크"
          value={youtube}
          onChange={(e) => setYoutube(e.target.value)}
        />
        <button type="submit">추가</button>
      </form>

      <input
        placeholder="검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p>로딩중...</p>
      ) : (
        filteredSongs.map((song) => (
          <div key={song.id}>
            <h3>{song.title}</h3>
            <p>{song.artist}</p>
            {song.youtube_url && (
              <a href={song.youtube_url} target="_blank">
                링크
              </a>
            )}
          </div>
        ))
      )}
    </div>
  );
}