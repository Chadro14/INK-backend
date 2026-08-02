"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BottomNav } from "@/components/layout/bottom-nav";
import { 
  Star, 
  CheckCircle, 
  Users, 
  BookOpen, 
  Clock,
  ArrowLeft
} from "lucide-react";

const API_URL = "https://ink-backend.vercel.app";

type CertificationStatus = {
  isCertified: boolean;
  certifiedAt: string | null;
  badgeColor: string;
  conditions: {
    chapters: { current: number; required: number; met: boolean };
    followers: { current: number; required: number; met: boolean };
    age: { current: number; required: number; met: boolean };
  };
  canCertify: boolean;
};

export default function CertificationPage() {
  const router = useRouter();
  const [status, setStatus] = useState<CertificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchStatus = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/certification/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [router]);

  // Fonction pour demander la certification
  const handleRequestCertification = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setSubmitting(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`${API_URL}/certification/request`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de la demande de certification");
      }

      setSuccessMsg("Félicitations ! Votre certification a été activée.");
      await fetchStatus(); // Recharger le statut mis à jour
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white px-4">
        <p className="text-gray-500">{error}</p>
        <button onClick={() => router.push("/profile")} className="mt-4 px-6 py-2 rounded-lg bg-black text-white">
          Retourner au profil
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-white">

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-black transition-colors flex items-center gap-1">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Retour</span>
          </button>
          <span className="text-lg font-bold text-black">Certification</span>
          <div className="w-16" />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm text-center">
            {successMsg}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {/* BADGE */}
        <div className="text-center mb-8">
          <div 
            className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-4xl border-4"
            style={{ 
              borderColor: status?.isCertified ? (status.badgeColor || "#eab308") : "#e5e7eb",
              backgroundColor: status?.isCertified ? `${status.badgeColor}15` : "#f9fafb" 
            }}
          >
            <Star 
              className="w-12 h-12" 
              style={{ color: status?.isCertified ? (status.badgeColor || "#eab308") : "#d1d5db" }} 
            />
          </div>
          <h2 className="text-xl font-bold text-black mt-3">
            {status?.isCertified ? "Certifié" : "Non certifié"}
          </h2>
          {status?.isCertified && (
            <p className="text-gray-500 text-sm">
              Certifié depuis le {status.certifiedAt ? new Date(status.certifiedAt).toLocaleDateString() : "récemment"}
            </p>
          )}
          <p className="text-gray-400 text-xs mt-2">
            {status?.isCertified 
              ? "Félicitations ! Vous êtes un créateur certifié INKDROP." 
              : "Atteignez les conditions ci-dessous pour obtenir la certification"}
          </p>
        </div>

        {/* CONDITIONS DYNAMIQUES */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Conditions requises</h3>

          {/* Chapitres */}
          <div className={`rounded-lg p-4 border ${status?.conditions.chapters.met ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className={`w-5 h-5 ${status?.conditions.chapters.met ? 'text-green-600' : 'text-gray-600'}`} />
                <div>
                  <p className="text-sm font-medium text-black">Chapitres publiés</p>
                  <p className="text-xs text-gray-400">
                    {status?.conditions.chapters.current} / {status?.conditions.chapters.required}
                  </p>
                </div>
              </div>
              {status?.conditions.chapters.met ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <span className="text-xs text-gray-400">En cours</span>
              )}
            </div>
          </div>

          {/* Abonnés */}
          <div className={`rounded-lg p-4 border ${status?.conditions.followers.met ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className={`w-5 h-5 ${status?.conditions.followers.met ? 'text-green-600' : 'text-gray-600'}`} />
                <div>
                  <p className="text-sm font-medium text-black">Abonnés</p>
                  <p className="text-xs text-gray-400">
                    {status?.conditions.followers.current} / {status?.conditions.followers.required}
                  </p>
                </div>
              </div>
              {status?.conditions.followers.met ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <span className="text-xs text-gray-400">En cours</span>
              )}
            </div>
          </div>

          {/* Ancienneté */}
          <div className={`rounded-lg p-4 border ${status?.conditions.age.met ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className={`w-5 h-5 ${status?.conditions.age.met ? 'text-green-600' : 'text-gray-600'}`} />
                <div>
                  <p className="text-sm font-medium text-black">Ancienneté</p>
                  <p className="text-xs text-gray-400">
                    {status?.conditions.age.current} / {status?.conditions.age.required} jours
                  </p>
                </div>
              </div>
              {status?.conditions.age.met ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <span className="text-xs text-gray-400">En cours</span>
              )}
            </div>
          </div>
        </div>

        {/* ACTION / STATUT GLOBAL */}
        <div className="mt-6">
          {status?.isCertified ? (
            <div className="p-4 rounded-lg bg-black text-white text-center">
              <p className="text-sm font-medium">Vous êtes certifié 🌟</p>
            </div>
          ) : status?.canCertify ? (
            <button
              onClick={handleRequestCertification}
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-black text-white font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Demander la certification"
              )}
            </button>
          ) : (
            <div className="p-4 rounded-lg bg-gray-100 text-gray-500 text-center">
              <p className="text-sm font-medium">Remplissez toutes les conditions pour débloquer</p>
            </div>
          )}
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
