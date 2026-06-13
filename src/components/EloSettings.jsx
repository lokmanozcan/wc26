import React from "react";

const getFlagUrl = (iso) => iso ? `https://flagcdn.com/w40/${iso.toLowerCase()}.png` : "";

export default function EloSettings({ initialTeams, customElo, setCustomElo }) {

  // Tek bir takımın ELO değerini el ile veya butonla güncelleyen fonksiyon
  const handleUpdateSingleElo = (id, newElo) => {
    const v = parseInt(newElo);
    if (!isNaN(v) && v >= 500 && v <= 3000) {
      setCustomElo(prev => ({ ...prev, [id]: v }));
    }
  };

  // Tüm özelleştirilmiş ELO ayarlarını varsayılana sıfırlayan fonksiyon
  const handleResetAllElo = () => {
    if (window.confirm("Tüm takım güçlerini (ELO) orijinal değerlerine sıfırlamak istiyor musunuz?")) {
      setCustomElo({});
    }
  };

  return (
    <div style={{ padding: "20px 0" }}>
      
      {/* ÜST PANEL VE KONTROL BUTONLARI */}
      <div style={{ background: "#1e293b", padding: "16px 20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#f8fafc" }}>Takım Güç Dengesi (ELO) Ayarları</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>Takımların ELO puanlarını değiştirerek simülasyon sonuçlarını doğrudan etkileyebilirsiniz.</p>
        </div>
        <button
          onClick={handleResetAllElo}
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            color: "#f87171",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"; }}
        >
          Tüm Güçleri Varsayılana Döndür 🔄
        </button>
      </div>

      {/* TAKIM KARTLARI LİSTESİ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
        {Object.entries(initialTeams).map(([id, team]) => {
          const original = team.elo;
          const current = customElo[id] !== undefined ? customElo[id] : original;
          const changed = current !== original;

          return (
            <div 
              key={id} 
              style={{ 
                background: "#1e293b", 
                borderRadius: "10px", 
                border: changed ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255,255,255,0.05)", 
                padding: "12px 14px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                gap: "10px"
              }}
            >
              {/* Sol Alan: Bayrak ve Takım İsmi */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                <img 
                  src={getFlagUrl(team.iso)} 
                  style={{ width: 22, height: 15, borderRadius: "2px", objectFit: "cover", flexShrink: 0 }} 
                  alt="" 
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {team.name}
                  </div>
                  <div style={{ fontSize: "10px", color: "#64748b", fontFamily: "monospace" }}>
                    Kod: {id} | Orijinal: {original}
                  </div>
                </div>
              </div>

              {/* Sağ Alan: ELO Kontrolleri ve İndikatör */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                {/* Değişim Farkı Göstergesi */}
                {changed && (
                  <span style={{ 
                    fontSize: "10px", 
                    fontFamily: "monospace", 
                    color: current > original ? "#10b981" : "#ef4444", 
                    fontWeight: 700 
                  }}>
                    {current > original ? `+${current - original}` : current - original}
                  </td>
                )}

                {/* ELO Kontrol Grubu */}
                <div style={{ display: "flex", alignItems: "center", background: "#0f172a", borderRadius: "6px", border: "1px solid #334155", padding: "2px" }}>
                  {/* Azalt Butonu */}
                  <button 
                    onClick={() => handleUpdateSingleElo(id, current - 25)}
                    style={{ width: "20px", height: "20px", background: "none", border: "none", color: "#ef4444", fontWeight: 900, cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justify: "center" }}
                  >
                    -
                  </button>
                  
                  {/* Skor Giriş Inputu */}
                  <input
                    type="number"
                    value={current}
                    onChange={(e) => handleUpdateSingleElo(id, e.target.value)}
                    style={{ 
                      width: "45px", 
                      height: "18px", 
                      background: "none", 
                      border: "none", 
                      color: changed ? "#10b981" : "#fbbf24", 
                      fontFamily: "monospace", 
                      fontWeight: 800, 
                      fontSize: "12px", 
                      textAlign: "center", 
                      outline: "none" 
                    }}
                  />

                  {/* Arttır Butonu */}
                  <button 
                    onClick={() => handleUpdateSingleElo(id, current + 25)}
                    style={{ width: "20px", height: "20px", background: "none", border: "none", color: "#10b981", fontWeight: 900, cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justify: "center" }}
                  >
                    +
                  </button>
                </div>

                {/* Tekli Sıfırlama Butonu */}
                {changed && (
                  <button 
                    onClick={() => {
                      const next = { ...customElo };
                      delete next[id];
                      setCustomElo(next);
                    }}
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "11px", padding: "2px" }}
                    title="Bu takımı varsayılana döndür"
                  >
                    ↩️
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>
      
    </div>
  );
}