"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { 
  BookOpen, 
  Heart, 
  Settings, 
  LogOut,
  Star,
  Edit,
  Eye,
  Mail,
  Calendar,
  Plus,
  Share2,
  Award,
  Zap,
  Coins
} from "lucide-react";

const API_URL = "https://ink-backend.vercel.app";

type UserProfile = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  isCertified: boolean;
  premiumActive: boolean;
  premiumExpires: string | null;
  createdAt: string;
  manas: number;
  steamPoints: number;
  steamLevel: number;
  _count: {
    mangas: number;
    followers: number;
    following: number;
  };
  mangas?: any[];
  earnings?: {
    total: number;
    pending: number;
    paid: number;
  };
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const [profileRes, earningsRes, mangasRes] = await Promise.all([
          fetch(`${API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/dashboard/earnings`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/mangas/user/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null), // Fallback si la route change
        ]);

        if (!profileRes.ok) {
          if (profileRes.status === 401) {
            localStorage.removeItem("token");
            router.push("/login");
            return;
          }
          throw new Error("Erreur lors du chargement du profil");
        }

        const profileData = await profileRes.json();
        
        let earningsData = null;
        if (earningsRes.ok) {
          earningsData = await earningsRes.json();
        }

        let mangasData = profileData.mangas || [];
        if (mangasRes && mangasRes.ok) {
          const fetchedMangas = await mangasRes.json();
          if (Array.isArray(fetchedMangas)) {
            mangasData = fetchedMangas;
          }
        }

        setProfile({
          ...profileData,
          mangas: mangasData,
          earnings: earningsData || { total: 0, pending: 0, paid: 0 },
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const handleShare = () => {
    const username = profile?.username || "utilisateur";
    const shareUrl = `https://ink-drop-one.vercel.app/creator/${username}`;
    
    if (navigator.share) {
      navigator.share({
        title: `INKDROP - ${username}`,
        text: `Découvre le profil de ${username} sur INKDROP ! 📚`,
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert("📋 Lien copié !");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white px-4">
        <p className="text-gray-500 text-center">{error || "Profil non trouvé"}</p>
        <button
          onClick={() => router.push("/login")}
          className="mt-4 px-6 py-2 rounded-lg bg-black text-white font-semibold"
        >
          Se connecter
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-white">

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <span className="text-xl font-bold text-black">Profil</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="text-gray-600 hover:text-black transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <Link href="/profile/settings" className="text-gray-600 hover:text-black transition-colors">
              <Settings className="w-5 h-5" />
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* AVATAR & INFOS PUBLIQUES */}
      <section className="px-4 py-6">
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-3xl font-bold text-black overflow-hidden border-2 border-black">
              {profile.avatarUrl ? (
                <img 
                  src={profile.avatarUrl} 
                  alt={profile.username} 
                  className="w-full h-full object-cover"
                />
              ) : (
                profile.username?.charAt(0).toUpperCase() || "?"
              )}
            </div>
            {profile.isCertified && (
              <span className="absolute -top-1 -right-1">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-black truncate">{profile.username}</h1>
              {profile.premiumActive && (
                <span className="px-2 py-0.5 rounded-full bg-black text-white text-[10px] font-bold">
                  PRO
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm truncate">{profile.bio || "Aucune bio"}</p>
            <div className="flex items-center gap-1 text-gray-400 text-xs mt-1">
              <Mail className="w-3 h-3" />
              <span className="truncate">{profile.email}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400 text-xs">
              <Calendar className="w-3 h-3" />
              <span>Membre depuis {new Date(profile.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-3 mt-4">
          <Link
            href="/profile/edit"
            className="flex-1 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Modifier
          </Link>
          <button
            onClick={handleShare}
            className="px-4 py-2 rounded-lg bg-gray-100 text-black text-sm font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Partager
          </button>
        </div>
      </section>

      {/* STATS & MANAS */}
      <section className="px-4 py-3 border-t border-b border-gray-100">
        <div className="grid grid-cols-4 gap-2 max-w-lg mx-auto">
          <div className="text-center">
            <p className="text-lg font-bold text-black">{profile._count?.mangas || profile.mangas?.length || 0}</p>
            <p className="text-xs text-gray-500">Mangas</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-black">{profile._count?.followers || 0}</p>
            <p className="text-xs text-gray-500">Abonnés</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-black">{profile._count?.following || 0}</p>
            <p className="text-xs text-gray-500">Abonnements</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-black">{profile.manas || 0}</p>
            <p className="text-xs text-gray-500">MANAS</p>
          </div>
        </div>
      </section>

      {/* STEAM & REVENUS */}
      <section className="px-4 py-3 border-b border-gray-100">
        <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto">
          <div className="text-center bg-gray-50 rounded-lg p-2">
            <Zap className="w-4 h-4 mx-auto text-yellow-500" />
            <p className="text-sm font-bold text-black">{profile.steamPoints || 0}</p>
            <p className="text-[10px] text-gray-500">Points Steam</p>
          </div>
          <div className="text-center bg-gray-50 rounded-lg p-2">
            <Award className="w-4 h-4 mx-auto text-purple-500" />
            <p className="text-sm font-bold text-black">Niv. {profile.steamLevel || 1}</p>
            <p className="text-[10px] text-gray-500">Niveau</p>
          </div>
          <div className="text-center bg-gray-50 rounded-lg p-2">
            <Coins className="w-4 h-4 mx-auto text-green-500" />
            <p className="text-sm font-bold text-black">{profile.earnings?.total || 0}$</p>
            <p className="text-[10px] text-gray-500">Revenus</p>
          </div>
        </div>
      </section>

      {/* MANGAS PUBLIÉS */}
      <section className="flex-1 px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-black" />
            <h2 className="text-sm font-semibold text-black">Mangas publiés</h2>
          </div>
          <Link
            href="/creator/upload"
            className="flex items-center gap-1 text-sm font-medium text-black hover:underline"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </Link>
        </div>

        {!profile.mangas || profile.mangas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-12 h-12 text-gray-300" />
            <p className="text-gray-500 mt-4 text-sm">Aucun manga publié</p>
            <Link
              href="/creator/upload"
              className="mt-4 px-6 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              Publier mon premier manga
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {profile.mangas.map((manga: any) => (
              <div
                key={manga.id}
                className="group relative aspect-[2/3] bg-gray-100 rounded-lg overflow-hidden"
              >
                <Link href={`/manga/${manga.id}`} className="absolute inset-0 block">
                  {manga.coverUrl || manga.imageUrl ? (
                    <img 
                      src={manga.coverUrl || manga.imageUrl} 
                      alt={manga.title} 
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-gray-300 group-hover:text-gray-400 transition-colors" />
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-xs font-medium truncate">{manga.title}</p>
                    <div className="flex items-center gap-2 text-white/70 text-[10px]">
                      <span className="flex items-center gap-0.5">
                        <Heart className="w-3 h-3" /> {manga.likesCount || 0}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Eye className="w-3 h-3" /> {manga.viewsCount || 0}
                      </span>
                    </div>
                  </div>
                </Link>

                {/* BOUTON SUPPRIMER */}
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm(`Supprimer "${manga.title}" définitivement ?`)) {
                      const token = localStorage.getItem("token");
                      try {
                        const res = await fetch(`${API_URL}/mangas/${manga.id}`, {
                          method: "DELETE",
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        if (res.ok) {
                          setProfile((prev) => prev ? {
                            ...prev,
                            mangas: prev.mangas?.filter((m) => m.id !== manga.id)
                          } : null);
                        } else {
                          alert("Erreur lors de la suppression");
                        }
                      } catch (error) {
                        alert("Erreur réseau");
                      }
                    }
                  }}
                  className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-all"
                  title="Supprimer le manga"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}
