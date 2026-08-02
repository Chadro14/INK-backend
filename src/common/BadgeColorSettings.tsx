import React, { useState, useEffect } from 'react';

export default function BadgeColorSettings() {
  const [freeColors, setFreeColors] = useState<string[]>([]);
  const [premiumColors, setPremiumColors] = useState<string[]>([]);
  const [isUserPremium, setIsUserPremium] = useState(false);
  const [selectedColor, setSelectedColor] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 1. Charger les couleurs disponibles au chargement du composant
  useEffect(() => {
    fetch('/api/users/badge-colors/list', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}` // Adapte selon ta gestion du token
      }
    })
      .then(res => res.json())
      .then(data => {
        setFreeColors(data.freeColors);
        setPremiumColors(data.premiumColors);
        setIsUserPremium(data.isUserPremium);
      })
      .catch(err => console.error("Erreur chargement couleurs", err));
  }, []);

  // 2. Envoyer la sélection au backend
  const handleSave = async (color: string) => {
    setSelectedColor(color);
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/users/badge-color', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ badgeColor: color })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur lors de la mise à jour');

      setMessage('Couleur du badge mise à jour avec succès ! 🔥');
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-black border border-white/10 rounded-xl text-white">
      <h2 className="text-xl font-bold mb-4">Personnalisation du Badge de Certification</h2>
      
      {message && <p className="mb-4 text-sm p-2 bg-white/10 rounded">{message}</p>}

      {/* Couleurs Gratuites */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">🎨 Couleurs Gratuites (Shonen Vibes)</h3>
        <div className="flex gap-4">
          {freeColors.map((color) => (
            <button
              key={color}
              onClick={() => handleSave(color)}
              style={{ backgroundColor: color }}
              className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                selectedColor === color ? 'border-white scale-110' : 'border-transparent'
              }`}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Couleurs & Effets Premium */}
      <div>
        <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
          ✨ Couleurs & Effets Animés Premium 
          {!isUserPremium && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">🔒 Réservé VIP</span>}
        </h3>
        
        <div className="grid grid-cols-4 gap-3">
          {premiumColors.map((item) => (
            <button
              key={item}
              onClick={() => isUserPremium && handleSave(item)}
              disabled={!isUserPremium}
              className={`p-3 rounded-lg border text-xs font-medium transition-all ${
                isUserPremium 
                  ? 'border-white/20 hover:border-white bg-white/5 cursor-pointer' 
                  : 'border-white/5 opacity-40 cursor-not-allowed bg-black'
              }`}
            >
              {item.startsWith('#') ? (
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: item }} />
                  <span className="truncate">{item}</span>
                </div>
              ) : (
                <span className="capitalize">{item.replace('-', ' ')}</span>
              )}
            </button>
          ))}
        </div>
        {!isUserPremium && (
          <p className="text-xs text-gray-500 mt-2">Passe ton compte en Premium pour débloquer ces effets visuels légendaires !</p>
        )}
      </div>
    </div>
  );
}
