"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Loader } from "@/components/ui/loader";
import {
  ArrowLeft,
  Download,
  Share2,
  Users,
  Clock,
  QrCode,
  BadgeCheck,
  Crown,
  User,
  Calendar,
  Sparkles,
  ChevronRight,
  Copy,
  Check,
  Eye,
} from "lucide-react";

const API_URL = "https://ink-backend.vercel.app";

type QRData = {
  userId: string;
  username: string;
  qrData: string;
  qrImage: string;
  scanCount: number;
  avatarUrl?: string | null;
  isCertified?: boolean;
  premiumActive?: boolean;
  createdAt?: string;
  qrColor?: string;
  badgeColor?: string;
};

export default function QRCodePage() {
  const router = useRouter();
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const activeBadgeColor = qrData?.badgeColor || qrData?.qrColor || "#3B82F6";

  useEffect(() => {
    const fetchQR = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const [qrRes, userRes] = await Promise.all([
          fetch(`${API_URL}/qr/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!qrRes.ok || !userRes.ok) {
          throw new Error("Erreur lors du chargement");
        }

        const qr = await qrRes.json();
        const user = await userRes.json();

        const defaultColor = "#3B82F6";
        const badgeColor = user.badgeColor || qr.badgeColor || defaultColor;
        const qrColor = qr.qrColor || user.badgeColor || defaultColor;

        setQrData({
          ...qr,
          avatarUrl: user.avatarUrl || null,
          isCertified: user.isCertified || false,
          premiumActive: user.premiumActive || false,
          createdAt: user.createdAt || new Date().toISOString(),
          qrColor: qrColor,
          badgeColor: badgeColor,
        });
      } catch (err: any) {
        console.error("❌ Erreur fetchQR:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQR();
  }, [router]);

  // ============================================
  // 📤 FONCTION DE PARTAGE (comme Telegram)
  // ============================================
  const handleShare = async () => {
    if (!qrRef.current || !qrData) return;

    try {
      // 1. Créer un canvas avec le QR + Avatar + Nom
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = 800;
      canvas.height = 1000;

      // Fond noir
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // ===== AVATAR =====
      const avatarSize = 120;
      const avatarY = 80;

      if (qrData.avatarUrl) {
        const avatarImg = new Image();
        avatarImg.crossOrigin = "anonymous";
        avatarImg.src = qrData.avatarUrl;
        await new Promise((resolve) => {
          avatarImg.onload = resolve;
          avatarImg.onerror = resolve;
        });
        ctx.save();
        ctx.beginPath();
        ctx.arc(canvas.width / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, (canvas.width - avatarSize) / 2, avatarY, avatarSize, avatarSize);
        ctx.restore();
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.arc(canvas.width / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = "#3B82F6";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 50px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(qrData.username?.charAt(0).toUpperCase() || "?", canvas.width / 2, avatarY + avatarSize / 2 + 2);
        ctx.restore();
      }

      // ===== NOM =====
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(qrData.username || "Utilisateur", canvas.width / 2, avatarY + avatarSize + 50);

      // ===== STATUT =====
      ctx.fillStyle = "#6b7280";
      ctx.font = "24px Arial";
      ctx.fillText("QR Code", canvas.width / 2, avatarY + avatarSize + 90);

      // ===== QR CODE =====
      const qrImg = new Image();
      qrImg.crossOrigin = "anonymous";
      qrImg.src = qrData.qrImage;
      await new Promise((resolve) => {
        qrImg.onload = resolve;
        qrImg.onerror = resolve;
      });

      const qrSize = 400;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = avatarY + avatarSize + 120;
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // ===== TEXTE =====
      ctx.fillStyle = "#4a4a4a";
      ctx.font = "20px Arial";
      ctx.fillText("Scannez le code QR", canvas.width / 2, qrY + qrSize + 50);

      // 2. Convertir en fichier
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png");
      });

      const file = new File([blob], `qr-${qrData.username}.png`, { type: "image/png" });

      // 3. Partager (API Web Share)
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `QR Code de ${qrData.username}`,
          text: `Scannez le QR Code de ${qrData.username} sur INKDROP`,
          files: [file],
        });
        setShared(true);
        setTimeout(() => setShared(false), 3000);
      } else {
        // Fallback : téléchargement
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `qr-${qrData.username}.png`;
        link.click();
        alert("📱 Image téléchargée ! Partagez-la manuellement.");
      }
    } catch (error) {
      console.error("Erreur partage:", error);
      // Fallback : copier le lien
      if (qrData.qrData) {
        await navigator.clipboard.writeText(qrData.qrData);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    }
  };

  const downloadQR = () => {
    if (!qrData) return;
    const link = document.createElement("a");
    link.download = `qr-${qrData.username}.png`;
    link.href = qrData.qrImage;
    link.click();
  };

  const copyLink = async () => {
    if (!qrData) return;
    await navigator.clipboard.writeText(qrData.qrData);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (loading) {
    return <Loader message="Génération de votre QR code" />;
  }

  if (error || !qrData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-white px-4">
        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
          <QrCode className="w-8 h-8 text-zinc-600" />
        </div>
        <p className="text-zinc-400 text-center">{error || "QR non trouvé"}</p>
        <Link href="/profile" className="mt-4 px-6 py-2.5 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20">
          Retourner au profil
        </Link>
      </div>
    );
  }

  const isPremium = qrData.premiumActive;

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-zinc-950 text-white selection:bg-blue-500 selection:text-white">

      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/60 px-4 md:px-8 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Link href="/profile" className="text-white/60 hover:text-white transition-colors flex items-center gap-1.5 group">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Retour</span>
          </Link>
          <span className="text-sm font-bold text-white/90 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-blue-400" />
            Mon QR Code
          </span>
          <div className="w-16" />
        </div>
      </header>

      {/* ===== BANNIÈRE ===== */}
      <div className="h-32 md:h-40 w-full bg-gradient-to-r from-zinc-950 via-blue-950/40 to-zinc-950 border-b border-zinc-800/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="absolute inset-0 flex items-center justify-center opacity-5">
          <div className="text-8xl font-black text-blue-500 select-none">QR</div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto w-full px-4 md:px-8 -mt-14 md:-mt-20 flex flex-col items-center">

        {/* ===== CARTE PRINCIPALE ===== */}
        <div ref={qrRef} className="w-full max-w-md bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/60 rounded-3xl p-6 md:p-8 shadow-2xl shadow-black/50">

          {/* ===== EN-TÊTE AVEC AVATAR ===== */}
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-zinc-800/60">
            <div className="relative shrink-0">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-900 overflow-hidden ring-2 ring-blue-500/30 ring-offset-2 ring-offset-zinc-950">
                {qrData.avatarUrl ? (
                  <img src={qrData.avatarUrl} alt={qrData.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-black text-blue-400 bg-gradient-to-br from-zinc-800 to-zinc-900">
                    {qrData.username?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
              </div>
              {qrData.isCertified && (
                <div className="absolute bottom-0 right-0 bg-zinc-950 p-0.5 rounded-full shadow-lg">
                  <BadgeCheck
                    className="w-5 h-5 md:w-6 md:h-6"
                    fill={activeBadgeColor}
                    color="black"
                    strokeWidth={1.5}
                  />
                </div>
              )}
              {isPremium && (
                <div className="absolute -top-1 -right-1">
                  <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white truncate">@{qrData.username}</h2>
                {isPremium && (
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-400 text-[9px] font-bold border border-amber-500/30">
                    PREMIUM
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-2">
                <User className="w-3 h-3" />
                {qrData.isCertified ? "Créateur certifié" : "Membre INKDROP"}
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                <Calendar className="w-3 h-3" />
                {qrData.createdAt ? new Date(qrData.createdAt).toLocaleDateString() : "Nouveau"}
              </p>
            </div>
          </div>

          {/* ===== QR CODE ===== */}
          <div className="flex flex-col items-center">
            <div className="relative bg-white rounded-2xl p-3 shadow-2xl shadow-blue-500/10 border border-zinc-800/40">
              <img
                src={qrData.qrImage}
                alt={`QR Code de ${qrData.username}`}
                className="w-48 h-48 md:w-56 md:h-56 object-contain"
              />
              <div className="absolute -bottom-2 -right-2 bg-zinc-950 rounded-full p-1 border border-zinc-800">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: activeBadgeColor }}
                >
                  <QrCode className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm font-semibold text-white flex items-center justify-center gap-2">
                <Eye className="w-4 h-4 text-blue-400" />
                Scanner pour découvrir le profil
              </p>
              <p className="text-xs text-zinc-500 mt-1 flex items-center justify-center gap-2">
                <span>Partagez ce QR code avec vos amis</span>
                <Sparkles className="w-3 h-3 text-blue-400" />
              </p>
            </div>
          </div>

          {/* ===== STATISTIQUES ===== */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-zinc-900/60 rounded-2xl p-4 text-center border border-zinc-800/40 hover:border-blue-500/30 transition-all group">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-2xl font-black text-white">{qrData.scanCount}</span>
              </div>
              <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Scans</p>
            </div>
            <div className="bg-zinc-900/60 rounded-2xl p-4 text-center border border-zinc-800/40 hover:border-blue-500/30 transition-all group">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                <span className="text-2xl font-black text-white">1</span>
              </div>
              <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Généré</p>
            </div>
          </div>

          {/* ===== ACTIONS ===== */}
          <div className="flex flex-col gap-2.5 mt-6">
            <button
              onClick={downloadQR}
              className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-all border border-white/10 hover:border-white/20 group"
            >
              <Download className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Télécharger le QR</span>
              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:translate-x-1 transition-transform ml-auto" />
            </button>

            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white transition-all shadow-lg shadow-blue-600/20 group"
            >
              {shared ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-bold">Partagé !</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold">Partager mon QR</span>
                  <ChevronRight className="w-4 h-4 text-blue-300 group-hover:translate-x-1 transition-transform ml-auto" />
                </>
              )}
            </button>

            <button
              onClick={copyLink}
              className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-zinc-900/60 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all border border-zinc-800/40 group"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-400">Lien copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium">Copier le lien</span>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:translate-x-1 transition-transform ml-auto" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* ===== MESSAGE D'INFORMATION ===== */}
        <div className="mt-6 max-w-md text-center">
          <p className="text-xs text-zinc-500 leading-relaxed">
            Votre QR code est unique et permanent. <br />
            Partagez-le avec vos amis pour qu'ils puissent découvrir votre profil
            et gagner des <span className="text-blue-400 font-medium">points</span>.
          </p>
          {isPremium && (
            <p className="text-xs text-purple-400/60 mt-2">
               Premium : QR code personnalisé avec votre avatar
            </p>
          )}
          {!isPremium && (
            <p className="text-xs text-amber-400/60 mt-2">
               Passez Premium pour un QR code avec votre avatar
            </p>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
